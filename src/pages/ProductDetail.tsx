import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, MessageSquare, ArrowLeft, Share2, Info, Loader2, Sparkles, ShoppingBag, 
  ChevronLeft, ChevronRight, Zap, Store as StoreIcon, ShieldCheck, Clock, Send, Heart, Check
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, 
  orderBy, limit, updateDoc, increment, runTransaction, onSnapshot 
} from 'firebase/firestore';
import { UserProfile, Product, Store, Review } from '../types';
import { cn, formatCurrency, safeShare, openWhatsApp } from '../lib/utils';
import { interactionService } from '../services/interactionService';
import { useMessaging } from '../components/MessagingProvider';
import { useNotifications } from '../components/NotificationProvider';
import AuthGuard from '../components/AuthGuard';
import { viewHistoryService } from '../services/viewHistory';

import { UnifiedCheckoutModal, EcoCashModal, PodModal, PayPalModal, StripeModal, PaynowModal, BankModal } from '../components/CheckoutModals';

export default function ProductDetail({ profile, onGuestLogin }: { profile: UserProfile | null, onGuestLogin?: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  const { triggerFeedback } = useNotifications();
  
  // Try to get pre-loaded data from navigation state
  const preloadedProduct = location.state?.product as Product | undefined;
  const preloadedStore = location.state?.store as Store | undefined;

  const [product, setProduct] = useState<Product | null>(preloadedProduct || null);
  const [store, setStore] = useState<Store | null>(preloadedStore || null);
  const [reviews, setReviews] = useState<Review[]>([]);
  const [loading, setLoading] = useState(!preloadedProduct);
  const [error, setError] = useState<string | null>(null);
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [isSubmittingReview, setIsSubmittingReview] = useState(false);
  const [newReview, setNewReview] = useState({ rating: 5, comment: '' });
  const [activeModal, setActiveModal] = useState<'checkout' | 'ecocash' | 'pod' | 'paypal' | 'stripe' | 'paynow' | 'bank' | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'insight' | 'feedback'>('insight');
  const { startConversation } = useMessaging();

  useEffect(() => {
    if (!id) return;

    // Real-time Product Listener
    const productUnsub = onSnapshot(doc(db, 'products', id), (snap) => {
      if (snap.exists()) {
        const productData = { id: snap.id, ...snap.data() } as Product;
        setProduct(productData);
        setLoading(false);
        viewHistoryService.recordProductView(productData.id, productData.name, productData.category, productData.storeId);

        // Fetch/Listen to Store if not yet done or different
        if (!store || store.id !== productData.storeId) {
          const storeUnsub = onSnapshot(doc(db, 'stores', productData.storeId), (sSnap) => {
            if (sSnap.exists()) {
              setStore({ id: sSnap.id, ...sSnap.data() } as Store);
            }
          });
          return () => storeUnsub();
        }
      } else {
        if (!product) setError("Product not found in local inventory");
        setLoading(false);
      }
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `product-realtime-${id}`);
      setError("Something went wrong on our end. We're retrying automatically.");
      setLoading(false);
    });

    // Fetch Reviews
    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('productId', '==', id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const reviewsUnsub = onSnapshot(reviewsQuery, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    });

    return () => {
      productUnsub();
      reviewsUnsub();
    };
  }, [id]);

  const [isEngaging, setIsEngaging] = useState(false);

  const handleTalk = async () => {
    if (!profile || !product) return;

    setIsEngaging(true);
    let targetPhone = '';
    try {
      const pubDoc = await getDoc(doc(db, 'public_profiles', product.ownerId));
      if (pubDoc.exists()) {
        const pubData = pubDoc.data();
        targetPhone = pubData.whatsappNumber || pubData.phone || pubData.phoneNumber || '';
      }
      if (!targetPhone && store) {
        targetPhone = store.contactNumbers?.[0] || store.whatsappNumber || '';
      }
    } catch (e) {
      console.error("Error fetching supplier phone:", e);
    } finally {
      setIsEngaging(false);
    }

    const cleanNumber = targetPhone ? targetPhone.replace(/[^0-9]/g, '') : '';
    const messageText = `Hi, I am interested in buying your product(s), ${product.name} in Comfort Business Hub Software.`;

    if (cleanNumber) {
      triggerFeedback('WhatsApp Uplink', `Opening WhatsApp contact for ${product.name}...`, 'message');
      openWhatsApp(cleanNumber, messageText);
    } else {
      const convoId = [profile.uid, product.ownerId].sort().join('_');
      startConversation(product.ownerId, messageText).catch(console.error);
      navigate(`/chat?id=${convoId}`);
    }
  };

  const handlePurchase = () => {
    if (!profile) return;
    setActiveModal('checkout');
  };

  const handleLike = async () => {
    if (!profile || !product) return;
    try {
      await interactionService.likeProduct(product.id, product.ownerId, profile);
      triggerFeedback('Success', `You liked ${store?.name || 'this user'}'s product: ${product.name}`, 'like_product');
    } catch (err) {
      console.error(err);
    }
  };

  const handleSubmitReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !id || !product || !store) return;

    setIsSubmittingReview(true);
    try {
      await interactionService.submitReview(
        id,
        store.id,
        profile,
        newReview.rating,
        newReview.comment,
        product.ownerId
      );
      
      triggerFeedback('Neural Feedback Received', `You rated ${product.name} with ${newReview.rating} stars`, 'rate');
      setNewReview({ rating: 5, comment: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'submit-review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/product/${id}`;
    if (navigator.share) {
      await safeShare({
        title: product?.name || 'Comfort Business Hub product',
        text: `Check out ${product?.name} on Comfort Business Hub!`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      triggerFeedback('Link Copied', 'Product Link Copied to Clipboard!', 'message');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Loading details...</p>
      </div>
    );
  }

  if (error || !product) {
    return (
      <div className="p-8 text-center space-y-4">
        <Zap className="mx-auto text-gray-700" size={48} />
        <h3 className="text-lg font-black text-white italic uppercase">{error || "Signal Lost"}</h3>
        <button onClick={() => navigate('/')} className="btn-neon px-8 py-3 text-[10px] font-black uppercase tracking-widest">Return to Hub</button>
      </div>
    );
  }

  const images = (product.images && product.images.length > 0) ? product.images : ["https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=800&auto=format&fit=crop"];

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="pb-20 md:pb-24 space-y-3 sm:space-y-4 max-w-4xl mx-auto flex flex-col h-[calc(100vh-140px)] md:h-auto overflow-hidden text-white"
    >
      {/* Product Image Slider */}
      <section className="relative px-1 pt-1 flex-shrink-0">
        <div className="relative w-full aspect-square md:aspect-video rounded-2xl overflow-hidden neon-card group bg-black/20 flex items-center justify-center">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentImageIndex}
              src={images[currentImageIndex]} 
              className="w-full h-full object-contain md:object-cover"
              initial={{ opacity: 0, scale: 1.05 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.95 }}
              transition={{ duration: 0.3 }}
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a]/90 via-transparent to-transparent pointer-events-none" />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button 
                onClick={() => setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length)}
                className="absolute left-2 top-1/2 -translate-y-1/2 p-1 bg-black/60 backdrop-blur-md rounded-lg text-white hover:text-primary transition-colors hover:scale-105 active:scale-95"
              >
                <ChevronLeft size={12} />
              </button>
              <button 
                onClick={() => setCurrentImageIndex(prev => (prev + 1) % images.length)}
                className="absolute right-2 top-1/2 -translate-y-1/2 p-1 bg-black/60 backdrop-blur-md rounded-lg text-white hover:text-primary transition-colors hover:scale-105 active:scale-95"
              >
                <ChevronRight size={12} />
              </button>
            </>
          )}

          {/* Share Button representing floating item */}
          <button 
            onClick={handleShare}
            className="absolute top-2 right-2 p-1.5 bg-black/60 backdrop-blur-md rounded-lg border border-white/10 text-white hover:text-primary transition-all hover:scale-105 active:scale-95 z-10"
          >
            <Share2 size={12} />
          </button>
        </div>

        {/* Thumbnail indicators */}
        {images.length > 1 && (
          <div className="flex justify-center gap-1 mt-1">
            {images.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={cn(
                  "h-0.5 rounded-full transition-all duration-300",
                  idx === currentImageIndex ? "w-6 bg-primary" : "w-1 bg-white/20"
                )}
              />
            ))}
          </div>
        )}
      </section>

      {/* Main Info */}
      <section className="px-2 sm:px-4 space-y-2 sm:space-y-3 flex-shrink-0">
        <div className="flex justify-between items-start gap-2">
          <div className="space-y-0.5 flex-1 min-w-0">
            <h2 className="text-sm sm:text-lg md:text-xl font-black text-white italic uppercase tracking-tighter leading-tight">
              {product.name}
            </h2>
            <div className="flex flex-wrap items-center gap-1">
              <div className="glass-pill !text-primary !border-primary/20 flex items-center gap-1 py-0.5 px-2 text-[8px] sm:text-[9px] uppercase font-black">
                <Zap size={8} className="fill-primary" />
                <span>{product.category}</span>
              </div>
              {(product.isVerified || (product as any).verified || store?.isVerified) && (
                <div className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                  <Check size={9} className="stroke-[3] text-emerald-400" />
                  <span>Verified Node</span>
                </div>
              )}
              <div className="flex items-center gap-1 bg-white/5 py-0.5 px-2 rounded-full border border-white/5 text-[8px] sm:text-[9px] font-black">
                <Star size={8} className="fill-primary text-primary" />
                <span className="text-white">{product.rating?.toFixed(1) || 'N/A'}</span>
                <span className="text-gray-500">({product.reviewCount || 0})</span>
              </div>
              {profile?.uid !== product.ownerId && (
                <AuthGuard 
                  title="Log Interest Signal" 
                  message="Sign in to save this product to your tactical awareness dashboard."
                  profile={profile}
                >
                  <button 
                    onClick={handleLike}
                    className="glass-pill !text-cyan-400 !border-cyan-400/30 flex items-center gap-1 hover:bg-cyan-400/10 transition-all font-black py-0.5 px-2 text-[8px] sm:text-[9px]"
                  >
                    <Heart size={8} className={cn("fill-cyan-400", product.likeCount ? "opacity-100" : "opacity-30")} />
                    <span>{product.likeCount || 0}</span>
                  </button>
                </AuthGuard>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            <p className="text-lg sm:text-xl md:text-2xl font-black text-primary italic tracking-tighter leading-none">{formatCurrency(product.price, product.currency)}</p>
            <div className="flex items-center justify-end gap-1 text-neon-green mt-0.5">
               <ShieldCheck size={8} />
               <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest">Verified Hub Price</p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex items-center justify-between gap-2 p-1 bg-white/5 border border-white/5 rounded-2xl backdrop-blur-md">
          <button 
             onClick={() => navigate(`/store/${product.storeId}`)}
             className="flex items-center gap-1.5 px-1.5 py-1 hover:bg-white/5 rounded-xl transition-all group border border-white/5 max-w-[120px] sm:max-w-[200px]"
          >
            <div className="w-5 h-5 rounded-lg bg-primary/20 flex items-center justify-center text-primary group-hover:scale-105 transition-transform shrink-0">
              <StoreIcon size={10} />
            </div>
            <div className="text-left overflow-hidden min-w-0">
              <p className="text-[9px] font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors truncate">{store?.name || 'Local Store'}</p>
            </div>
          </button>
          
          {profile?.uid !== product.ownerId ? (
            <div className="flex gap-1 flex-1 justify-end">
              <AuthGuard 
                title="Establish Communication" 
                message="Sign in to send a private message to this seller."
                profile={profile}
              >
                <button 
                  onClick={handleTalk}
                  disabled={isEngaging}
                  className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-1 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                >
                  {isEngaging ? <Loader2 size={8} className="animate-spin" /> : <MessageSquare size={8} className="text-emerald-400 group-hover:text-black" />}
                  Talk on WhatsApp
                </button>
              </AuthGuard>
              <AuthGuard 
                title="Initialize Acquisition" 
                message="Join the Network Hub to process secure payments and finalize the logistics of this acquisition."
                profile={profile}
                allowGuest={true}
                onGuestContinue={onGuestLogin}
              >
                <button 
                  onClick={handlePurchase}
                  className="px-2.5 py-1 bg-primary rounded-lg flex items-center justify-center text-[#05070a] font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:shadow-[0_0_10px_rgba(0,242,254,0.3)] transition-all gap-1"
                >
                   <Zap size={8} className="fill-current" />
                   Order
                </button>
              </AuthGuard>
            </div>
          ) : (
            <div className="text-[8px] sm:text-[10px] text-primary font-black uppercase tracking-widest pr-1.5">Your Product</div>
          )}
        </div>
      </section>

      {/* Tabs list */}
      <div className="flex border-b border-white/5 flex-shrink-0 px-2 sm:px-4">
        <button
          onClick={() => setActiveTab('insight')}
          className={cn(
            "flex-1 py-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center border-b-2 transition-all duration-300",
            activeTab === 'insight' 
              ? "text-primary border-primary drop-shadow-[0_0_8px_rgba(0,242,254,0.3)]" 
              : "text-gray-500 border-transparent hover:text-white"
          )}
        >
          Details
        </button>
        <button
          onClick={() => setActiveTab('feedback')}
          className={cn(
            "flex-1 py-1.5 text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-center border-b-2 transition-all duration-300",
            activeTab === 'feedback' 
              ? "text-primary border-primary drop-shadow-[0_0_8px_rgba(0,242,254,0.3)]" 
              : "text-gray-500 border-transparent hover:text-white"
          )}
        >
          Reviews ({reviews.length})
        </button>
      </div>

      {/* Tab Content Window */}
      <div className="flex-grow overflow-y-auto custom-scrollbar px-2 sm:px-4 text-xs font-semibold max-h-[30vh]">
        <AnimatePresence mode="wait">
          {activeTab === 'insight' ? (
            <motion.div
              key="insight-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-2 py-1"
            >
              <div className="p-3 bg-white/5 border border-white/5 rounded-2xl">
                <p className="text-gray-300 text-[10px] sm:text-[11px] leading-relaxed font-semibold">
                  {product.description || "No tactical details provided for this product."}
                </p>
              </div>
            </motion.div>
          ) : (
            <motion.div
              key="feedback-tab"
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -5 }}
              className="space-y-3 py-1"
            >
              {/* Post Experience Signal form (made extra compact inline) */}
              <AuthGuard
                title="Log Feedback Signal"
                message="Sign in to interact with this item."
                profile={profile}
              >
                <div className="p-2.5 bg-white/5 border border-white/5 rounded-xl space-y-1.5">
                  <p className="text-[7px] font-black text-gray-400 uppercase tracking-widest inline-block">Transmit Experience Signal</p>
                  <form onSubmit={handleSubmitReview} className="space-y-1.5">
                    <div className="flex justify-between items-center bg-[#0d1117] p-1 rounded-lg border border-white/5">
                      <div className="flex gap-1">
                        {[1, 2, 3, 4, 5].map((star) => (
                          <button
                            key={star}
                            type="button"
                            onClick={() => setNewReview({ ...newReview, rating: star })}
                            className="transition-all hover:scale-110"
                          >
                            <Star 
                              size={12} 
                              className={cn(
                                "transition-colors",
                                star <= newReview.rating ? "fill-primary text-primary" : "text-gray-700"
                              )} 
                            />
                          </button>
                        ))}
                      </div>
                      <button 
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-2 py-0.5 bg-primary text-[#05070a] rounded-md text-[7px] font-black uppercase tracking-widest flex items-center gap-1 active:scale-95 transition-all"
                      >
                        {isSubmittingReview ? <Loader2 className="animate-spin" size={6} /> : <Send size={6} />}
                        Post
                      </button>
                    </div>
                    <input
                      type="text"
                      placeholder="Comment on your synchronization experience..."
                      className="w-full bg-[#0d1117] border border-white/10 rounded-lg px-2 py-1 text-white text-[9px] outline-none focus:border-primary/50 transition-colors"
                      value={newReview.comment}
                      onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                      required
                    />
                  </form>
                </div>
              </AuthGuard>

              {/* Reviews List */}
              <div className="space-y-1.5">
                {reviews.length > 0 ? (
                  reviews.map((review, idx) => (
                    <div key={`pd-review-${review.id || idx}`} className="p-2.5 bg-[#0d1117] border border-white/5 rounded-xl space-y-1.5">
                      <div className="flex justify-between items-center">
                        <div className="flex items-center gap-1.5">
                          <div className="w-4 h-4 rounded bg-gray-800 flex items-center justify-center text-[7px] font-black text-gray-500 border border-white/10 overflow-hidden shrink-0">
                            {review.userAvatar ? (
                               <img src={review.userAvatar} className="w-full h-full object-cover" />
                            ) : review.userName.charAt(0)}
                          </div>
                          <div>
                            <p className="text-[8px] font-black text-white uppercase tracking-tight leading-none">{review.userName}</p>
                            <div className="flex gap-0.5 mt-0.5">
                              {[1, 2, 3, 4, 5].map((s) => (
                                <Star 
                                  key={s} 
                                  size={5} 
                                  className={cn(s <= review.rating ? "fill-primary text-primary" : "text-gray-800")} 
                                />
                              ))}
                            </div>
                          </div>
                        </div>
                        <span className="text-[6px] font-black text-gray-600 uppercase tracking-widest">
                           {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Recent'}
                        </span>
                      </div>
                      <p className="text-[9px] text-gray-400 font-medium leading-normal italic">
                        "{review.comment}"
                      </p>
                    </div>
                  ))
                ) : (
                  <div className="py-4 text-center bg-[#0d1117] rounded-xl border border-white/5">
                    <Sparkles size={16} className="mx-auto text-gray-800 mb-1" />
                    <h4 className="text-[7px] font-black text-gray-600 uppercase tracking-widest italic">Untested - Feed consensus first</h4>
                  </div>
                )}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      <AnimatePresence>
        {activeModal === 'checkout' && (
          <UnifiedCheckoutModal 
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            setQuantity={setPurchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }}
            onSwitchModal={(type) => setActiveModal(type)}
          />
        )}
        {activeModal === 'ecocash' && (
          <EcoCashModal 
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'paypal' && (
          <PayPalModal 
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'stripe' && (
          <StripeModal 
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'pod' && (
          <PodModal 
            product={product} 
            profile={profile}
            initialQuantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'paynow' && (
          <PaynowModal 
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'bank' && (
          <BankModal 
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}
