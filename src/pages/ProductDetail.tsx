import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, MessageSquare, ArrowLeft, Share2, Info, Loader2, Sparkles, ShoppingBag, 
  ChevronLeft, ChevronRight, Zap, Store as StoreIcon, ShieldCheck, Clock, Send, Heart, Check, CheckCircle2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { localDB } from '../lib/db';
import { 
  doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, 
  orderBy, limit, updateDoc, increment, runTransaction, onSnapshot 
} from 'firebase/firestore';
import { UserProfile, Product, Store, Review } from '../types';
import { cn, formatCurrency, openWhatsApp } from '../lib/utils';
import { executeShare, getProductSharePayload, updateMetaTags, resolveProductByIdOrShortId, resolveStoreByIdOrShortId, getShortId, slugifyProductName } from '../lib/shareUtils';
import { interactionService } from '../services/interactionService';
import { useMessaging } from '../components/MessagingProvider';
import { useNotifications } from '../components/NotificationProvider';
import AuthGuard from '../components/AuthGuard';
import FiveStarRating from '../components/FiveStarRating';
import { viewHistoryService } from '../services/viewHistory';

import { UnifiedCheckoutModal, EcoCashModal, PodModal, PayPalModal, StripeModal, PaynowModal, BankModal } from '../components/CheckoutModals';

export default function ProductDetail({ profile, onGuestLogin }: { profile: UserProfile | null, onGuestLogin?: () => void }) {
  const { id, productSlug } = useParams<{ id?: string; productSlug?: string }>();
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
  const [newReview, setNewReview] = useState<{ rating: number; comment: string; selectedTags: string[] }>({
    rating: 5,
    comment: '',
    selectedTags: []
  });
  const [activeModal, setActiveModal] = useState<'checkout' | 'ecocash' | 'pod' | 'paypal' | 'stripe' | 'paynow' | 'bank' | null>(null);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const [activeTab, setActiveTab] = useState<'insight' | 'feedback'>('insight');
  const { startConversation } = useMessaging();

  const targetId = id || productSlug;

  useEffect(() => {
    if (!targetId) return;

    if (!product) {
      setLoading(true);
    }
    let isMounted = true;

    resolveProductByIdOrShortId(targetId).then((foundProduct) => {
      if (!isMounted) return;
      if (foundProduct) {
        setProduct(foundProduct);
        setError(null);
        setLoading(false);
        viewHistoryService.recordProductView(foundProduct.id, foundProduct.name, foundProduct.category, foundProduct.storeId);

        // Fetch store for this product
        if (foundProduct.storeId) {
          resolveStoreByIdOrShortId(foundProduct.storeId).then((s) => {
            if (s && isMounted) setStore(s);
          });
        }
      } else if (!product) {
        setError("Product not found in local inventory");
        setLoading(false);
      }
    });

    return () => {
      isMounted = false;
    };
  }, [targetId]);

  // Fetch Reviews when product.id is known
  useEffect(() => {
    if (!product?.id) return;

    const reviewsQuery = query(
      collection(db, 'reviews'),
      where('productId', '==', product.id),
      orderBy('createdAt', 'desc'),
      limit(20)
    );
    const reviewsUnsub = onSnapshot(reviewsQuery, (snap) => {
      setReviews(snap.docs.map(d => ({ id: d.id, ...d.data() } as Review)));
    }, (err) => console.warn('ProductDetail reviews query notice:', err));

    return () => reviewsUnsub();
  }, [product?.id]);

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
      let guestId = localStorage.getItem('guest_uid');
      if (!guestId) {
        guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        localStorage.setItem('guest_uid', guestId);
      }
      const userUid = profile?.uid || guestId;
      const convoId = [userUid, product.ownerId].sort().join('_');
      startConversation(product.ownerId, messageText).catch(console.error);
      navigate(`/chat?id=${convoId}`);
    }
  };

  const handlePurchase = () => {
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
    if (!profile || !id || !product) return;

    setIsSubmittingReview(true);
    try {
      await interactionService.submitReview(
        id,
        store?.id || product.storeId,
        profile,
        newReview.rating,
        newReview.comment,
        product.ownerId,
        newReview.selectedTags
      );
      
      triggerFeedback('Rating Submitted', `You rated ${product.name} with ${newReview.rating} stars!`, 'rate');
      setNewReview({ rating: 5, comment: '', selectedTags: [] });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'submit-review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  useEffect(() => {
    if (product) {
      interactionService.logProductClick(product.id, 'detail').catch(() => {});
      const shortId = getShortId(product);
      updateMetaTags({
        title: `${product.name} - ${store?.name || 'Comfort Business Hub'}`,
        description: product.description || `Buy ${product.name} on Comfort Business Hub`,
        image: product.images?.[0],
        url: `${window.location.origin}/p/${shortId}`
      });
    }
  }, [product, store]);

  const handleShare = async () => {
    if (!product) return;
    interactionService.logProductShare(product.id).catch(() => {});
    const payload = getProductSharePayload(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        images: product.images,
        description: product.description,
      },
      store?.name
    );
    await executeShare(payload);
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
              className="w-full h-full object-contain p-2 bg-[#080d14]"
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
              <div className={cn(
                "glass-pill flex items-center gap-1 py-0.5 px-2 text-[8px] sm:text-[9px] uppercase font-black",
                product.itemType === 'service' ? "!text-emerald-400 !border-emerald-500/30" : "!text-primary !border-primary/20"
              )}>
                <Zap size={8} className={product.itemType === 'service' ? "fill-emerald-400" : "fill-primary"} />
                <span>{product.itemType === 'service' ? 'Service' : 'Product'} • {product.category}</span>
              </div>
              {(product.isVerified || (product as any).verified || store?.isVerified) && (
                <div className="inline-flex items-center gap-1 py-0.5 px-2.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                  <Check size={9} className="stroke-[3] text-emerald-400" />
                  <span>Verified Node</span>
                </div>
              )}
              <div 
                onClick={() => setActiveTab('feedback')}
                className="flex items-center gap-1.5 bg-amber-400/10 border border-amber-400/30 py-1 px-2.5 rounded-full cursor-pointer hover:bg-amber-400/20 transition-all"
                title="View & Rate Product"
              >
                <FiveStarRating value={product.rating || 5.0} size="sm" readOnly count={product.reviewCount || 0} />
              </div>

              {profile?.uid !== product.ownerId && (
                <AuthGuard
                  title="Rate Product"
                  message="Sign in to submit your rating and review for this product."
                  profile={profile}
                >
                  <button 
                    onClick={() => setActiveTab('feedback')}
                    className="glass-pill !border-amber-400/40 !text-amber-300 bg-amber-400/10 hover:bg-amber-400/20 flex items-center gap-1 font-black py-1 px-2.5 text-[9px] sm:text-[10px] transition-all"
                  >
                    <Star size={10} className="fill-amber-400 text-amber-400" />
                    <span>Rate Product</span>
                  </button>
                </AuthGuard>
              )}

              {profile?.uid !== product.ownerId && (
                <AuthGuard 
                  title="Save Product" 
                  message="Sign in to save this product to your personal favorites."
                  profile={profile}
                >
                  <button 
                    onClick={handleLike}
                    className="glass-pill !text-red-400 !border-red-400/30 bg-red-400/10 hover:bg-red-400/20 flex items-center gap-1 transition-all font-black py-1 px-2.5 text-[9px] sm:text-[10px]"
                  >
                    <Heart size={10} className={cn("fill-red-400 text-red-400", product.likeCount ? "opacity-100" : "opacity-40")} />
                    <span>{product.likeCount || 0} Likes</span>
                  </button>
                </AuthGuard>
              )}
            </div>
          </div>
          <div className="text-right shrink-0">
            {product.pricingOption === 'contact_seller_for_price' ? (
              <span className="text-sm sm:text-base font-black text-emerald-400 italic tracking-tight block">Contact for Price</span>
            ) : (
              <>
                <p className="text-lg sm:text-xl md:text-2xl font-black text-primary italic tracking-tighter leading-none">
                  {formatCurrency(product.price, product.currency)}
                  {product.quantityUnit && product.quantityUnit !== 'per item' && (
                    <span className="text-xs sm:text-sm font-bold text-gray-400 not-italic ml-1">/{product.quantityUnit}</span>
                  )}
                </p>
                {product.pricingOption === 'negotiable' && (
                  <p className="text-[8px] font-black uppercase text-amber-400 tracking-wider mt-0.5">Price Negotiable</p>
                )}
                {product.pricingOption === 'installments' && (
                  <p className="text-[8px] font-black uppercase text-emerald-400 tracking-wider mt-0.5">Installments Allowed</p>
                )}
              </>
            )}
            <div className="flex items-center justify-end gap-1 text-neon-green mt-0.5">
               <ShieldCheck size={8} />
               <p className="text-[7px] sm:text-[8px] font-black uppercase tracking-widest">Verified Hub Listing</p>
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
              <button 
                onClick={handleTalk}
                disabled={isEngaging}
                className="px-2.5 py-1.5 bg-emerald-500/10 border border-emerald-500/30 rounded-lg text-emerald-400 font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:bg-emerald-500 hover:text-black transition-all flex items-center gap-1 shrink-0 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
              >
                {isEngaging ? <Loader2 size={8} className="animate-spin" /> : <MessageSquare size={8} className="text-emerald-400 group-hover:text-black" />}
                Talk on WhatsApp
              </button>
              <button 
                onClick={handlePurchase}
                className="px-2.5 py-1 bg-primary rounded-lg flex items-center justify-center text-[#05070a] font-black uppercase text-[8px] sm:text-[9px] tracking-widest hover:shadow-[0_0_10px_rgba(0,242,254,0.3)] transition-all gap-1"
              >
                 <Zap size={8} className="fill-current" />
                 Order
              </button>
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
              className="space-y-4 py-1"
            >
              {/* Product Rating Summary & Distribution Widget */}
              {(() => {
                const totalRevs = reviews.length || product.reviewCount || 0;
                const avgRating = totalRevs > 0 && reviews.length > 0 
                  ? (reviews.reduce((acc, r) => acc + (r.rating || 5), 0) / reviews.length) 
                  : (product.rating || 5.0);
                const starCounts = [5, 4, 3, 2, 1].map(stars => ({
                  stars,
                  count: reviews.filter(r => Math.round(r.rating || 5) === stars).length,
                  pct: reviews.length > 0 ? (reviews.filter(r => Math.round(r.rating || 5) === stars).length / reviews.length) * 100 : (stars === 5 ? 100 : 0)
                }));

                return (
                  <div className="p-4 bg-[#0d1117] border border-amber-400/20 rounded-2xl space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                      <div className="flex items-center gap-3">
                        <div className="text-center bg-black/40 border border-amber-400/30 rounded-2xl p-3 min-w-[80px]">
                          <p className="text-2xl font-black text-amber-400 italic leading-none">{avgRating.toFixed(1)}</p>
                          <p className="text-[8px] font-bold text-gray-400 uppercase tracking-wider mt-1">out of 5.0</p>
                          <div className="flex justify-center mt-1">
                            <FiveStarRating value={avgRating} size="sm" readOnly />
                          </div>
                        </div>
                        <div>
                          <h4 className="text-xs font-black text-white uppercase tracking-wider">Product Rating & Reviews</h4>
                          <p className="text-[10px] text-gray-400 font-medium mt-0.5">
                            Based on {totalRevs} verified customer {totalRevs === 1 ? 'rating' : 'ratings'}
                          </p>
                          <div className="flex items-center gap-1.5 mt-1.5">
                            <span className="px-2 py-0.5 rounded-full bg-emerald-500/10 text-emerald-400 border border-emerald-500/30 text-[8px] font-black uppercase tracking-wider flex items-center gap-1">
                              <ShieldCheck size={10} /> 100% Verified Community Feedback
                            </span>
                          </div>
                        </div>
                      </div>

                      {/* Star Bars Breakdown */}
                      <div className="flex-1 max-w-xs space-y-1">
                        {starCounts.map(({ stars, count, pct }) => (
                          <div key={`star-bar-${stars}`} className="flex items-center gap-2 text-[9px]">
                            <span className="w-6 font-mono font-bold text-gray-400 text-right">{stars} ★</span>
                            <div className="flex-1 h-1.5 bg-white/5 rounded-full overflow-hidden">
                              <div 
                                className="h-full bg-amber-400 rounded-full transition-all duration-500" 
                                style={{ width: `${pct}%` }} 
                              />
                            </div>
                            <span className="w-5 font-mono text-gray-500 text-left text-[8px]">{count}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {/* Post Experience Signal form */}
              <AuthGuard
                title="Rate Product"
                message="Sign in to rate and review this product."
                profile={profile}
              >
                <div className="p-4 bg-[#0d1117] border border-amber-400/30 rounded-2xl space-y-3 shadow-[0_0_20px_rgba(251,191,36,0.1)]">
                  <div className="flex items-center justify-between">
                    <p className="text-[10px] font-black text-amber-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Star size={12} className="fill-amber-400 text-amber-400" />
                      Submit Your Product Rating & Review
                    </p>
                    <span className="text-[8px] font-bold text-gray-500 uppercase tracking-widest">Instant Sync</span>
                  </div>

                  <form onSubmit={handleSubmitReview} className="space-y-3">
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 bg-black/60 p-3 rounded-xl border border-white/5">
                      <div className="space-y-1">
                        <span className="text-[8px] font-black text-gray-400 uppercase tracking-widest block">Choose Star Rating</span>
                        <FiveStarRating 
                          value={newReview.rating} 
                          onChange={(r) => setNewReview({ ...newReview, rating: r })} 
                          size="md"
                          showLabel
                        />
                      </div>
                      <button 
                        type="submit"
                        disabled={isSubmittingReview}
                        className="px-4 py-2 bg-amber-400 text-black font-black uppercase text-[10px] tracking-wider rounded-xl flex items-center justify-center gap-1.5 hover:bg-amber-300 active:scale-95 transition-all shadow-[0_0_15px_rgba(251,191,36,0.3)] shrink-0 disabled:opacity-50"
                      >
                        {isSubmittingReview ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />}
                        Submit Rating
                      </button>
                    </div>

                    {/* Quick Review Tags / Message Selector */}
                    <div className="space-y-1.5">
                      <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 block">Quick Review Highlights (Tap to add)</label>
                      <div className="flex flex-wrap gap-1.5">
                        {['Top Quality', 'Fast Delivery', 'Great Customer Service', 'Highly Recommended', 'Best Price', 'Authentic Item', 'Prompt Response', 'Smooth Deal'].map((tag) => {
                          const isSelected = newReview.selectedTags.includes(tag);
                          return (
                            <button
                              key={tag}
                              type="button"
                              onClick={() => {
                                setNewReview(prev => {
                                  const tags = isSelected 
                                    ? prev.selectedTags.filter(t => t !== tag)
                                    : [...prev.selectedTags, tag];
                                  return { ...prev, selectedTags: tags };
                                });
                              }}
                              className={cn(
                                "px-2.5 py-1 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all border",
                                isSelected
                                  ? "bg-amber-400 text-black border-amber-400 shadow-[0_0_10px_rgba(251,191,36,0.4)]"
                                  : "bg-white/5 text-gray-300 border-white/10 hover:border-amber-400/40 hover:text-amber-300"
                              )}
                            >
                              {isSelected ? '✓ ' : '+ '} {tag}
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[8px] font-black uppercase tracking-widest text-gray-400 block">Review Feedback Details</label>
                      <textarea
                        rows={2}
                        placeholder="Share your detailed experience with this product or service..."
                        className="w-full bg-black/60 border border-white/10 rounded-xl px-3 py-2 text-white text-xs outline-none focus:border-amber-400/50 transition-colors placeholder:text-gray-600 resize-none"
                        value={newReview.comment}
                        onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                        required
                      />
                    </div>
                  </form>
                </div>
              </AuthGuard>

              {/* Reviews List */}
              <div className="space-y-2.5">
                <div className="flex items-center justify-between px-1">
                  <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                    Customer Reviews & Feedback ({reviews.length})
                  </h4>
                </div>

                {reviews.length > 0 ? (
                  reviews.map((review, idx) => (
                    <div key={`pd-review-${review.id ? `${review.id}-${idx}` : idx}`} className="p-3.5 bg-[#0d1117] border border-white/10 rounded-2xl space-y-2 hover:border-amber-400/30 transition-all">
                      <div className="flex justify-between items-start">
                        <div className="flex items-center gap-2.5">
                          <div className="w-8 h-8 rounded-xl bg-black flex items-center justify-center text-[10px] font-black text-amber-400 border border-amber-400/20 overflow-hidden shrink-0 shadow-sm">
                            {review.userAvatar ? (
                               <img src={review.userAvatar} className="w-full h-full object-cover" alt={review.userName} />
                            ) : review.userName?.charAt(0) || 'U'}
                          </div>
                          <div>
                            <div className="flex items-center gap-1.5">
                              <p className="text-[10px] font-black text-white uppercase tracking-tight leading-none">{review.userName || 'Verified Buyer'}</p>
                              <span className="px-1.5 py-0.2 bg-amber-400/10 text-amber-300 border border-amber-400/30 rounded text-[7px] font-black uppercase tracking-wider">
                                {review.userRole === 'supplier' ? 'Supplier' : 'Verified Buyer'}
                              </span>
                            </div>
                            <div className="flex items-center gap-1.5 mt-1">
                              <FiveStarRating value={review.rating || 5} size="sm" readOnly />
                              <span className="text-[8px] font-mono font-bold text-amber-300">({(review.rating || 5).toFixed(1)})</span>
                            </div>
                          </div>
                        </div>
                        <span className="text-[7.5px] font-mono font-bold text-gray-500 uppercase tracking-wider">
                           {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' }) : 'Recent'}
                        </span>
                      </div>

                      {/* Quick Review Tags display */}
                      {review.tags && review.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 pt-1">
                          {review.tags.map((t, tidx) => (
                            <span key={`rtag-${tidx}`} className="px-2 py-0.5 bg-amber-400/10 border border-amber-400/20 text-amber-300 rounded-md text-[8px] font-bold uppercase tracking-wider flex items-center gap-1">
                              <CheckCircle2 size={8} className="text-amber-400" /> {t}
                            </span>
                          ))}
                        </div>
                      )}

                      {review.comment && (
                        <p className="text-xs text-gray-300 font-medium leading-relaxed italic bg-black/30 p-2.5 rounded-xl border border-white/5">
                          "{review.comment}"
                        </p>
                      )}
                    </div>
                  ))
                ) : (
                  <div className="py-8 text-center bg-[#0d1117] rounded-2xl border border-white/5 space-y-1.5">
                    <Star size={24} className="mx-auto text-amber-400/40" />
                    <h4 className="text-[10px] font-black text-gray-400 uppercase tracking-widest italic">No product ratings yet</h4>
                    <p className="text-[9px] text-gray-600">Be the first customer to submit a 5-star rating and review for this product!</p>
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
            key={`modal-checkout-pd-${product.id}`}
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
            key={`modal-ecocash-pd-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'paypal' && (
          <PayPalModal 
            key={`modal-paypal-pd-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'stripe' && (
          <StripeModal 
            key={`modal-stripe-pd-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'pod' && (
          <PodModal 
            key={`modal-pod-pd-${product.id}`}
            product={product} 
            profile={profile}
            initialQuantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'paynow' && (
          <PaynowModal 
            key={`modal-paynow-pd-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'bank' && (
          <BankModal 
            key={`modal-bank-pd-${product.id}`}
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
