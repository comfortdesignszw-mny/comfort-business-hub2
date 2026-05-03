import React, { useState, useEffect } from 'react';
import { useParams, useNavigate, Link, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Star, MessageSquare, ArrowLeft, Share2, Info, Loader2, Sparkles, ShoppingBag, 
  ChevronLeft, ChevronRight, Zap, Store as StoreIcon, ShieldCheck, Clock, Send, Heart
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  doc, getDoc, collection, query, where, getDocs, addDoc, serverTimestamp, 
  orderBy, limit, updateDoc, increment, runTransaction, onSnapshot 
} from 'firebase/firestore';
import { UserProfile, Product, Store, Review } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { interactionService } from '../services/interactionService';
import { useMessaging } from '../components/MessagingProvider';

export default function ProductDetail({ profile }: { profile: UserProfile | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const location = useLocation();
  
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
  const { startConversation } = useMessaging();

  useEffect(() => {
    if (!id) return;

    // Real-time Product Listener
    const productUnsub = onSnapshot(doc(db, 'products', id), (snap) => {
      if (snap.exists()) {
        const productData = { id: snap.id, ...snap.data() } as Product;
        setProduct(productData);
        setLoading(false);

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
      setError("Error syncing inventory stream");
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

  const handlePurchase = async () => {
    if (!profile || !product || !store) return;
    
    // Create engagement
    try {
      if (navigator.onLine) {
        await addDoc(collection(db, 'engagements'), {
          productId: id,
          productName: product.name,
          customerId: profile.uid,
          customerName: profile.name || 'User',
          supplierId: product.ownerId,
          type: 'interested',
          createdAt: serverTimestamp()
        });

        // Send notification
        await interactionService.sendNotification(
          product.ownerId,
          'buy',
          profile,
          id
        );
      }

      // Open chat with initial message
      const initialMsg = `Hie, I am interested in purchasing ${product.name}. Let's discuss delivery/payment.`;
      const convoId = await startConversation(product.ownerId, initialMsg);
      navigate(`/chat?id=${convoId}`);
    } catch (err) {
      console.error('Purchase init failed:', err);
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
      
      setNewReview({ rating: 5, comment: '' });
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'submit-review');
    } finally {
      setIsSubmittingReview(false);
    }
  };

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/product/${id}`;
    if (navigator.share) {
      navigator.share({
        title: product?.name || 'Comfort Business Hub product',
        text: `Check out ${product?.name} on Comfort Business Hub!`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Product Link Copied to Clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-[60vh] gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Syncing Inventory Matrix...</p>
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
      className="pb-24 space-y-8"
    >
      {/* Product Image Slider */}
      <section className="relative px-4 pt-4">
        <div className="relative aspect-[16/10] sm:aspect-video rounded-[2.5rem] overflow-hidden neon-card group">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentImageIndex}
              src={images[currentImageIndex]} 
              className="w-full h-full object-cover"
              initial={{ opacity: 0, scale: 1.1 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              transition={{ duration: 0.5 }}
              referrerPolicy="no-referrer"
            />
          </AnimatePresence>
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a]/80 via-transparent to-transparent pointer-events-none" />

          {/* Navigation Arrows */}
          {images.length > 1 && (
            <>
              <button 
                onClick={() => setCurrentImageIndex(prev => (prev - 1 + images.length) % images.length)}
                className="absolute left-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-md rounded-xl text-white hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronLeft size={20} />
              </button>
              <button 
                onClick={() => setCurrentImageIndex(prev => (prev + 1) % images.length)}
                className="absolute right-4 top-1/2 -translate-y-1/2 p-2 bg-black/50 backdrop-blur-md rounded-xl text-white hover:text-primary transition-colors opacity-0 group-hover:opacity-100"
              >
                <ChevronRight size={20} />
              </button>
            </>
          )}

          {/* Share Button */}
          <button 
            onClick={handleShare}
            className="absolute top-6 right-6 p-3 bg-black/50 backdrop-blur-md rounded-2xl border border-white/10 text-white hover:text-primary transition-all hover:scale-110 active:scale-95 shadow-2xl"
          >
            <Share2 size={18} />
          </button>
        </div>

        {/* Thumbnail indicators */}
        {images.length > 1 && (
          <div className="flex justify-center gap-2 mt-4">
            {images.map((_, idx) => (
              <button 
                key={idx}
                onClick={() => setCurrentImageIndex(idx)}
                className={cn(
                  "h-1 rounded-full transition-all duration-300",
                  idx === currentImageIndex ? "w-8 bg-primary" : "w-2 bg-white/20"
                )}
              />
            ))}
          </div>
        )}
      </section>

      {/* Main Info */}
      <section className="px-6 space-y-6">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white italic uppercase tracking-tighter leading-tight sm:text-4xl">
              {product.name}
            </h1>
            <div className="flex items-center gap-3">
              <div className="glass-pill !text-primary !border-primary/20 flex items-center gap-1">
                <Zap size={10} className="fill-primary" />
                {product.category}
              </div>
              <div className="flex items-center gap-1.5">
                <Star size={12} className="fill-primary text-primary" />
                <span className="text-sm font-black text-white">{product.rating?.toFixed(1) || 'N/A'}</span>
                <span className="text-[10px] text-gray-500 font-bold uppercase">({product.reviewCount || 0} Synced Reviews)</span>
              </div>
              <button 
                onClick={() => profile && interactionService.likeProduct(product.id, product.ownerId, profile)}
                className="glass-pill !text-neon-pink !border-neon-pink/20 flex items-center gap-1.5 hover:bg-neon-pink/5 transition-colors"
              >
                <Heart size={10} className={cn("fill-neon-pink", product.likeCount ? "opacity-100" : "opacity-30")} />
                <span className="text-[10px] font-black">{product.likeCount || 0}</span>
              </button>
            </div>
          </div>
          <div className="text-right">
            <p className="text-3xl font-black text-primary italic tracking-tighter">{formatCurrency(product.price, product.currency)}</p>
            <div className="flex items-center justify-end gap-1 text-neon-green mt-1">
               <ShieldCheck size={12} />
               <p className="text-[9px] font-black uppercase tracking-widest">Verified Hub Price</p>
            </div>
          </div>
        </div>

        {/* Action Bar */}
        <div className="flex gap-4 p-2 bg-white/5 border border-white/5 rounded-3xl backdrop-blur-xl">
          <button 
             onClick={() => navigate(`/store/${product.storeId}`)}
             className="flex-1 flex items-center gap-3 p-3 hover:bg-white/5 rounded-2xl transition-all group"
          >
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary group-hover:scale-110 transition-transform">
              <StoreIcon size={20} />
            </div>
            <div className="text-left">
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none mb-1">Direct Node</p>
              <p className="text-xs font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{store?.name || 'Local Store'}</p>
            </div>
          </button>
          
          <div className="flex items-center px-4 border-l border-white/5">
             <div className="flex flex-col items-center">
                <Clock size={14} className="text-gray-500 mb-1" />
                <span className="text-[8px] font-bold text-gray-600 uppercase">Ready now</span>
             </div>
          </div>

          <button 
            onClick={handlePurchase}
            className="flex-none px-8 bg-primary rounded-2xl flex items-center justify-center text-[#05070a] font-black uppercase text-[10px] tracking-widest hover:shadow-[0_0_20px_rgba(0,242,254,0.3)] transition-all"
          >
             Initialize Purchase
          </button>
        </div>

        {/* Description */}
        <div className="space-y-4">
          <h3 className="font-black text-white uppercase tracking-tighter text-lg italic flex items-center gap-2">
            <Info size={18} className="text-primary" />
            Node Insight
          </h3>
          <p className="text-gray-400 text-sm leading-relaxed font-medium">
            {product.description || "No tactical details provided for this inventory node."}
          </p>
        </div>

        {/* Ratings & Reviews Section */}
        <div className="space-y-8 pt-8 border-t border-white/5">
          <div className="flex items-center justify-between">
            <h3 className="font-black text-white uppercase tracking-tighter text-xl italic flex items-center gap-2">
              <Star size={22} className="text-primary fill-primary" />
              Neural Feedback
            </h3>
            <div className="flex items-center gap-2">
              <span className="text-3xl font-black text-primary">{product.rating?.toFixed(1) || '0.0'}</span>
              <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                Overall Consensus
              </div>
            </div>
          </div>

          {/* Submit Review Form */}
          {profile ? (
            <motion.div 
               initial={{ opacity: 0, y: 20 }}
               animate={{ opacity: 1, y: 0 }}
               className="neon-card p-6 space-y-4 bg-gradient-to-br from-white/5 to-transparent"
            >
              <h4 className="text-xs font-black text-white uppercase tracking-[0.2em] mb-4">Post Experience Signal</h4>
              <form onSubmit={handleSubmitReview} className="space-y-4">
                <div className="flex gap-4">
                  {[1, 2, 3, 4, 5].map((star) => (
                    <button
                      key={star}
                      type="button"
                      onClick={() => setNewReview({ ...newReview, rating: star })}
                      className="transition-all hover:scale-125"
                    >
                      <Star 
                        size={24} 
                        className={cn(
                          "transition-colors",
                          star <= newReview.rating ? "fill-primary text-primary" : "text-gray-700"
                        )} 
                      />
                    </button>
                  ))}
                </div>
                <div className="relative">
                  <textarea
                    placeholder="Describe your synchronization experience..."
                    className="w-full bg-[#0d1117] border border-white/10 rounded-2xl p-4 text-white text-xs outline-none focus:border-primary/50 transition-colors"
                    rows={3}
                    value={newReview.comment}
                    onChange={(e) => setNewReview({ ...newReview, comment: e.target.value })}
                  />
                </div>
                <button 
                  type="submit"
                  disabled={isSubmittingReview}
                  className="btn-neon w-full py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2"
                >
                  {isSubmittingReview ? <Loader2 className="animate-spin" size={14} /> : <Send size={14} />}
                  Upload Protocol Signal
                </button>
              </form>
            </motion.div>
          ) : (
            <div className="p-8 border border-dashed border-white/10 rounded-3xl text-center bg-white/5 space-y-4">
              <Info className="mx-auto text-gray-700" size={24} />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Identify Yourself to Provide Feedback</p>
              <button 
                onClick={() => navigate('/login')}
                className="text-[10px] text-primary font-black uppercase tracking-widest border-b border-primary/30 pb-0.5 hover:text-white hover:border-white transition-all"
              >
                Access Hub Network
              </button>
            </div>
          )}

          {/* List of Reviews */}
          <div className="space-y-4">
            {reviews.length > 0 ? (
              reviews.map((review) => (
                <div key={review.id} className="p-5 bg-white/5 border border-white/5 rounded-3xl space-y-3">
                  <div className="flex justify-between items-center">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-lg bg-gray-800 flex items-center justify-center text-xs font-black text-gray-500 border border-white/10 overflow-hidden">
                        {review.userAvatar ? (
                           <img src={review.userAvatar} className="w-full h-full object-cover" />
                        ) : review.userName.charAt(0)}
                      </div>
                      <div>
                        <p className="text-[10px] font-black text-white uppercase tracking-tight">{review.userName}</p>
                        <div className="flex gap-0.5">
                          {[1, 2, 3, 4, 5].map((s) => (
                            <Star 
                              key={s} 
                              size={8} 
                              className={cn(s <= review.rating ? "fill-primary text-primary" : "text-gray-800")} 
                            />
                          ))}
                        </div>
                      </div>
                    </div>
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">
                       {review.createdAt?.toDate ? review.createdAt.toDate().toLocaleDateString() : 'Recent'}
                    </span>
                  </div>
                  <p className="text-[11px] text-gray-400 font-medium leading-relaxed italic">
                    "{review.comment}"
                  </p>
                </div>
              ))
            ) : (
              <div className="py-12 text-center bg-[#0d1117] rounded-3xl border border-white/5">
                <Sparkles size={32} className="mx-auto text-gray-800 mb-4" />
                <h4 className="text-xs font-black text-gray-600 uppercase tracking-widest italic">Inventory untested - First Signal Required</h4>
              </div>
            )}
          </div>
        </div>
      </section>
    </motion.div>
  );
}
