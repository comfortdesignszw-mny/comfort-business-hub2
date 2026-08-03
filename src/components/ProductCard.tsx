import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, ShoppingBag, ArrowRight, MessageSquare, Phone, Check, Loader2, MapPinned, CreditCard, Share2, X, Info, Star, Store as StoreIcon, Edit3, Trash2, ChevronDown, ChevronUp, ShieldAlert, Heart, Send
} from 'lucide-react';
import { UserProfile, Product, Store, EngagementType } from '../types';
import { cn, formatCurrency, openWhatsApp } from '../lib/utils';
import { executeShare, getProductSharePayload } from '../lib/shareUtils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { interactionService } from '../services/interactionService';
import { viewHistoryService } from '../services/viewHistory';
import OptimizedImage from './OptimizedImage';
import AuthGuard from './AuthGuard';
import FiveStarRating from './FiveStarRating';
import { useModals } from '../context/ModalContext';
import { useNotifications } from './NotificationProvider';
import ReportModal from './ReportModal';

import { useMessaging } from '../components/MessagingProvider';
import { UnifiedCheckoutModal, EcoCashModal, PodModal, PayPalModal, StripeModal, PaynowModal, BankModal } from './CheckoutModals';

export default function ProductCard({ 
  product, 
  profile, 
  store: initialStore,
  onAction,
  isOwner = false,
  recommendationReason,
  compact = false
}: { 
  product: Product, 
  profile: UserProfile | null, 
  store?: Store,
  onAction?: (prod: Product) => void, 
  isOwner?: boolean,
  recommendationReason?: string,
  compact?: boolean,
  key?: React.Key 
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { startConversation } = useMessaging();
  const { openUserProfile } = useModals();
  const [storeData, setStoreData] = useState<{ name: string; rating: number; reviewCount: number; isVerified?: boolean }>({
    name: initialStore?.name || 'Verified Node',
    rating: initialStore?.rating || 5.0,
    reviewCount: initialStore?.reviewCount || 0,
    isVerified: initialStore?.isVerified
  });
  const [isStoreLoading, setIsStoreLoading] = useState(!initialStore);
  const [isEngaging, setIsEngaging] = useState(false);
  const [activeModal, setActiveModal] = useState<'checkout' | 'ecocash' | 'pod' | 'paypal' | 'stripe' | 'paynow' | 'bank' | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [showRatingModal, setShowRatingModal] = useState(false);
  const [userRating, setUserRating] = useState(5);
  const [userComment, setUserComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const navigate = useNavigate();
  const { triggerFeedback } = useNotifications();

  const handleSubmitProductRating = async (e: React.FormEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (!profile) return;
    setIsSubmittingRating(true);
    try {
      await interactionService.submitReview(
        product.id,
        product.storeId,
        profile,
        userRating,
        userComment,
        product.ownerId
      );
      triggerFeedback('Rating Submitted', `You submitted a ${userRating}-star rating for ${product.name}!`, 'rate');
      setUserComment('');
      setShowRatingModal(false);
    } catch (err) {
      console.error('Failed to submit product rating:', err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  useEffect(() => {
    if (initialStore) {
      setStoreData({
        name: initialStore.name,
        rating: initialStore.rating,
        reviewCount: initialStore.reviewCount,
        isVerified: initialStore.isVerified
      });
      setIsStoreLoading(false);
      return;
    }

    const fetchStoreData = async () => {
      try {
        const storeSnap = await getDoc(doc(db, 'stores', product.storeId));
        if (storeSnap.exists()) {
          const data = storeSnap.data();
          setStoreData({
            name: data.name || 'Verified Node',
            rating: data.rating || 5.0,
            reviewCount: data.reviewCount || 0,
            isVerified: data.isVerified
          });
        }
      } catch (err) {
        console.error("Error fetching store data:", err);
      } finally {
        setIsStoreLoading(false);
      }
    };
    fetchStoreData();
  }, [product.storeId, initialStore]);

  const logEngagement = async (type: EngagementType) => {
    if (!profile || !product.ownerId) return;
    
    try {
      const customerName = profile.name || profile.businessName || profile.email?.split('@')[0] || 'Member';
      
      await addDoc(collection(db, 'engagements'), {
        productId: product.id,
        productName: product.name,
        customerId: profile.uid,
        customerName: customerName,
        supplierId: product.ownerId,
        type,
        price: product.price,
        currency: product.currency,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error logging engagement:", err);
    }
  };

  const handleAction = async (type: 'shop' | 'engage') => {
    if (type === 'engage') {
      setIsEngaging(true);
      if (profile) logEngagement('engaged');
      interactionService.logStoreEngagement(product.storeId, 'whatsapp', product.price || 0);
      
      let targetPhone = '';
      try {
        const pubDoc = await getDoc(doc(db, 'public_profiles', product.ownerId));
        if (pubDoc.exists()) {
          const pubData = pubDoc.data();
          targetPhone = pubData.whatsappNumber || pubData.phone || pubData.phoneNumber || '';
        }
        if (!targetPhone) {
          const storeDoc = await getDoc(doc(db, 'stores', product.storeId));
          if (storeDoc.exists()) {
            const sData = storeDoc.data();
            targetPhone = sData.contactNumbers?.[0] || sData.phone || sData.whatsappNumber || '';
          }
        }
      } catch (e) {
        console.error("Error fetching supplier phone:", e);
      } finally {
        setIsEngaging(false);
      }

      const cleanNumber = targetPhone ? targetPhone.replace(/[^0-9]/g, '') : '';
      const messageText = `Hi, I am interested in ${product.itemType === 'service' ? 'your service' : 'buying your product'}, ${product.name} on Comfort Business Hub.`;
      
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
        const targetUid = product.ownerId;
        const convoId = [userUid, targetUid].sort().join('_');
        startConversation(targetUid, messageText).catch(console.error);
        navigate(`/chat?id=${convoId}`);
      }
      return;
    }

    // Fire and forget engagement log
    if (profile) logEngagement('order_now');
    interactionService.logStoreEngagement(product.storeId, 'order', product.price || 0);

    if (onAction) {
      onAction(product);
      return;
    }

    setActiveModal('checkout');
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) {
      triggerFeedback('Saved', `Added ${product.name} to guest wishlist`, 'like_product');
      return;
    }
    try {
      await interactionService.likeProduct(product.id, product.ownerId, profile);
      triggerFeedback('Success', `You liked ${storeData.name}'s product: ${product.name}`, 'like_product');
    } catch (err) {
      console.error(err);
    }
  };

  const getActionIcon = () => {
    switch (product.buyButtonType) {
      case 'link': return <ArrowRight size={14} />;
      case 'chat': return <MessageSquare size={14} />;
      case 'ecocash': return <Phone size={14} />;
      case 'pod': return <MapPinned size={14} />;
      default: return <Zap size={14} className="fill-current" />;
    }
  };

  const images = product.images && product.images.length > 0 ? product.images : ['https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=600&auto=format&fit=crop'];

  const handleShare = async (e: React.MouseEvent) => {
    e.stopPropagation();
    const payload = getProductSharePayload(
      {
        id: product.id,
        name: product.name,
        price: product.price,
        currency: product.currency,
        images: images,
        description: product.description,
      },
      storeData?.name || (product as any).storeName
    );
    await executeShare(payload);
  };

  return (
    <>
      <motion.div 
        layout
        whileTap={{ scale: 0.98 }}
        whileHover={{ scale: 1.01, y: -2 }}
        transition={{ type: "spring", stiffness: 400, damping: 25 }}
        onClick={() => {
          viewHistoryService.recordProductView(product.id, product.name, product.category, product.storeId);
          navigate(`/product/${product.id}`, { 
            state: { 
              product, 
              store: initialStore || { 
                id: product.storeId, 
                name: storeData.name, 
                rating: storeData.rating, 
                reviewCount: storeData.reviewCount 
              } 
            } 
          });
        }}
        className={cn(
          "neon-card group relative overflow-hidden cursor-pointer flex flex-col justify-between h-full",
          compact ? "!bg-[#0a0f16] !border-white/10 hover:!border-primary/40 shadow-sm" : ""
        )}
      >
        {/* Dedicated Header Bar for Rating & Social Interactions */}
        <div 
          className={cn(
            "w-full bg-[#03060a] border-b border-white/10 flex items-center justify-between gap-1.5 z-20 shrink-0",
            compact ? "px-2 py-1.5" : "px-3 py-2 sm:px-3.5 sm:py-2.5"
          )} 
          onClick={(e) => e.stopPropagation()}
        >
          {/* Left: 5-Star Rating Capsule */}
          <div className="flex items-center min-w-0 shrink">
            <AuthGuard
              title="Rate Product"
              message="Sign in to rate and review this product."
              profile={profile}
            >
              <button 
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  e.preventDefault();
                  if (isOwner) {
                    triggerFeedback('Owner Notice', 'You are the owner of this item.', 'rate');
                    return;
                  }
                  setShowRatingModal(true);
                }}
                className={cn(
                  "bg-[#080d16] rounded-xl border border-amber-400/50 text-amber-400 font-black flex items-center gap-1 shadow-[0_0_10px_rgba(251,191,36,0.15)] cursor-pointer hover:border-amber-400 hover:bg-amber-400/10 hover:scale-[1.02] active:scale-95 transition-all truncate max-w-full",
                  compact ? "px-1.5 py-0.5 text-[7px]" : "px-2 py-1 sm:px-2.5 text-[8px] sm:text-[9px]"
                )}
                title="Click to rate & review this product"
              >
                <FiveStarRating value={product.rating || 5.0} size="sm" readOnly count={product.reviewCount || 0} countLabel="rating" />
              </button>
            </AuthGuard>
          </div>

          {/* Right: Social Action Icons (Like, Share, Report) */}
          <div className="flex items-center gap-1 sm:gap-1.5 shrink-0">
            {!isOwner && (
              <AuthGuard
                title="Save for Later"
                message="Join the network to save this node to your private dashboard."
                profile={profile}
              >
                <button 
                  onClick={handleLike}
                  className={cn(
                    "rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-red-500 hover:border-red-500/40 hover:bg-red-500/10 transition-all active:scale-90 flex items-center justify-center shadow-sm",
                    compact ? "p-1" : "p-1.5 sm:p-2"
                  )}
                  title="Save/Like Product"
                >
                  <Heart size={12} className={cn(compact ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4", product.likeCount ? "fill-red-500 text-red-500" : "")} />
                </button>
              </AuthGuard>
            )}

            <button 
              onClick={handleShare}
              className={cn(
                "rounded-xl border border-white/10 bg-white/5 text-gray-300 hover:text-primary hover:border-primary/40 hover:bg-primary/10 transition-all active:scale-90 flex items-center justify-center shadow-sm no-auth-guard",
                compact ? "p-1" : "p-1.5 sm:p-2"
              )}
              title="Share Product"
            >
              <Share2 size={12} className={compact ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
            </button>

            {!isOwner && profile && !profile.isGuest && (
              <button 
                onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                className={cn(
                  "rounded-xl border border-red-500/20 bg-red-500/10 text-red-400 hover:bg-red-500 hover:text-white transition-all active:scale-90 flex items-center justify-center shadow-sm",
                  compact ? "p-1" : "p-1.5 sm:p-2"
                )}
                title="Report Abuse"
              >
                <ShieldAlert size={12} className={compact ? "w-3 h-3" : "w-3.5 h-3.5 sm:w-4 sm:h-4"} />
              </button>
            )}
          </div>
        </div>

        {/* Product Image View Container */}
        <div className={cn("relative overflow-hidden shrink-0 bg-[#080d14] flex items-center justify-center", compact ? "h-28 sm:h-32" : "aspect-[16/10] sm:aspect-video")}>
          <AnimatePresence mode="wait">
            <OptimizedImage 
              key={`prod-img-${currentImageIndex}`}
              src={images[currentImageIndex]} 
              alt={product.name}
              className="w-full h-full object-contain p-1 group-hover:scale-105 transition-transform duration-500"
              fallbackSrc="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop"
            />
          </AnimatePresence>
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60 pointer-events-none"></div>
        </div>

        <div className={cn("flex-1 flex flex-col justify-between relative", compact ? "p-2.5 space-y-2" : "p-3.5 sm:p-5 space-y-3 sm:space-y-4")}>
          <div className="flex justify-between items-start gap-1.5">
            <div className="space-y-0.5 flex-1 min-w-0">
              <div className="flex items-center gap-1 flex-wrap">
                <span className={cn(
                  "px-1 py-0.2 rounded text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-wider shrink-0 border",
                  product.itemType === 'service' 
                    ? "bg-emerald-500/10 border-emerald-500/30 text-emerald-400" 
                    : "bg-primary/10 border-primary/20 text-primary"
                )}>
                  {product.itemType === 'service' ? 'Service' : 'Product'}
                </span>
                {recommendationReason && (
                  <span className="px-1.5 py-0.2 rounded-full bg-primary/20 border border-primary/40 text-primary text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-wider flex items-center gap-0.5 shrink-0 truncate max-w-[120px]">
                    <Zap size={7} className="text-primary fill-primary shrink-0" /> <span className="truncate">{recommendationReason}</span>
                  </span>
                )}
              </div>
              <h3 className={cn("font-black text-white italic uppercase tracking-tighter leading-tight truncate group-hover:text-primary transition-colors", compact ? "text-xs sm:text-sm" : "text-base sm:text-lg")}>{product.name}</h3>
              <p className="text-[7.5px] sm:text-[8.5px] text-gray-500 font-bold uppercase tracking-widest truncate">{product.category}</p>
            </div>
            <div className="text-right shrink-0">
              {product.pricingOption === 'contact_seller_for_price' ? (
                <span className="text-[10px] font-black text-emerald-400 italic tracking-tight block">Contact</span>
              ) : (
                <>
                  <p className={cn("font-black text-primary italic tracking-tighter leading-none", compact ? "text-sm sm:text-base" : "text-lg sm:text-xl")}>
                    {formatCurrency(product.price, product.currency)}
                  </p>
                </>
              )}
            </div>
          </div>

          {!compact && product.description && (
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed h-[22px] sm:h-7">
              {product.description}
            </p>
          )}

          <div className="space-y-2 mt-auto">
             <div 
              className="flex items-center gap-1.5 cursor-pointer group/store"
              onClick={(e) => {
                e.stopPropagation();
                openUserProfile(product.ownerId);
              }}
             >
              <div className={cn("rounded-lg border border-white/10 bg-white/5 flex items-center justify-center shrink-0 group-hover/store:border-primary/50 transition-all", compact ? "w-5 h-5" : "w-7 h-7 sm:w-8 sm:h-8")}>
                {isStoreLoading ? (
                  <Loader2 size={8} className="text-gray-600 animate-spin" />
                ) : (
                  <StoreIcon size={10} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1 min-w-0">
                  <p className="text-[8.5px] sm:text-[9.5px] text-white font-black uppercase tracking-tight truncate group-hover/store:text-primary transition-colors">{storeData.name}</p>
                </div>
              </div>
            </div>

            {!isOwner && (
              <div className="flex gap-1" onClick={(e) => e.stopPropagation()}>
                <button 
                  onClick={() => handleAction('engage')}
                  disabled={isEngaging}
                  className={cn(
                    "flex-1 bg-emerald-500/10 border border-emerald-500/30 rounded-lg font-black uppercase tracking-wider text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1 shadow-sm shrink-0 min-w-0",
                    compact ? "py-1 text-[7.5px]" : "py-2 sm:py-3 text-[8px] sm:text-[9px]"
                  )}
                  title="Direct WhatsApp Redirect"
                >
                  <MessageSquare size={10} className="text-emerald-400 shrink-0" />
                  <span className="truncate">{compact ? 'Chat' : 'Chat on WhatsApp'}</span>
                </button>
                
                <button 
                  onClick={() => handleAction('shop')}
                  className={cn(
                    "flex-[1.2] bg-primary rounded-lg font-black uppercase tracking-wider text-[#05070a] shadow-md hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1",
                    compact ? "py-1 text-[7.5px]" : "py-2 sm:py-3 text-[8px] sm:text-[9px]"
                  )}
                >
                  {getActionIcon()}
                  {product.buyButtonText || 'Order'}
                </button>
              </div>
            )}
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {activeModal === 'checkout' && (
          <UnifiedCheckoutModal 
            key={`modal-checkout-${product.id}`}
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
            key={`modal-ecocash-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'paypal' && (
          <PayPalModal 
            key={`modal-paypal-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'stripe' && (
          <StripeModal 
            key={`modal-stripe-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'pod' && (
          <PodModal 
            key={`modal-pod-${product.id}`}
            product={product} 
            profile={profile}
            initialQuantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'paynow' && (
          <PaynowModal 
            key={`modal-paynow-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
        {activeModal === 'bank' && (
          <BankModal 
            key={`modal-bank-${product.id}`}
            product={product} 
            profile={profile}
            quantity={purchaseQuantity}
            onClose={() => { setActiveModal(null); setPurchaseQuantity(1); }} 
          />
        )}
      </AnimatePresence>

      {profile && (
        <ReportModal 
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetId={product.id}
          targetType="product"
          targetName={product.name}
          ownerId={product.ownerId}
          reporterId={profile.uid}
          reporterName={profile.name || profile.businessName || 'Anonymous User'}
        />
      )}

      {/* Interactive Product Rating & Review Modal */}
      <AnimatePresence>
        {showRatingModal && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={(e) => {
              e.stopPropagation();
              setShowRatingModal(false);
            }}
          >
            <motion.div
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              onClick={(e) => e.stopPropagation()}
              className="relative w-full max-w-md bg-[#0d1117] border border-amber-400/40 rounded-3xl p-5 sm:p-6 shadow-[0_0_50px_rgba(251,191,36,0.25)] space-y-4"
            >
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setShowRatingModal(false);
                }}
                className="absolute top-4 right-4 p-2 bg-white/5 hover:bg-white/10 rounded-full text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="flex items-center gap-3 pr-8">
                <div className="w-12 h-12 rounded-xl border border-amber-400/30 overflow-hidden shrink-0 bg-black">
                  <img src={images[0]} alt={product.name} className="w-full h-full object-cover" />
                </div>
                <div>
                  <h3 className="font-black text-white uppercase text-sm sm:text-base italic leading-tight truncate">{product.name}</h3>
                  <p className="text-[10px] text-amber-400 font-bold uppercase tracking-wider">{product.category}</p>
                </div>
              </div>

              <div className="p-3.5 bg-black/60 rounded-2xl border border-amber-400/20 space-y-3 text-center">
                <p className="text-[10px] font-black uppercase tracking-wider text-amber-300">Choose Rating Score</p>
                <div className="flex justify-center">
                  <FiveStarRating 
                    value={userRating} 
                    onChange={(r) => setUserRating(r)} 
                    size="lg"
                    showLabel
                  />
                </div>
              </div>

              <form onSubmit={handleSubmitProductRating} className="space-y-3">
                <div className="space-y-1.5">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Quick Review Highlights</label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Top Quality', 'Fast Delivery', 'Great Customer Service', 'Highly Recommended', 'Best Price'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          setUserComment((prev) => prev ? `${prev} - ${tag}` : tag);
                        }}
                        className="px-2 py-1 rounded-lg bg-white/5 hover:bg-amber-400/20 border border-white/10 hover:border-amber-400/40 text-[9px] font-bold text-gray-300 hover:text-amber-300 transition-all active:scale-95"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-1">
                  <label className="text-[9px] font-black uppercase tracking-wider text-gray-400 block">Your Product Review & Feedback</label>
                  <textarea
                    required
                    rows={3}
                    value={userComment}
                    onChange={(e) => setUserComment(e.target.value)}
                    placeholder="Share your experience with this item..."
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-400 transition-colors resize-none placeholder:text-gray-600"
                  />
                </div>

                <div className="flex gap-2 pt-1">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      setShowRatingModal(false);
                    }}
                    className="flex-1 py-2.5 bg-white/5 hover:bg-white/10 border border-white/10 text-gray-400 font-black text-xs uppercase tracking-wider rounded-xl transition-colors"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="flex-1 py-2.5 bg-amber-400 hover:bg-amber-300 text-black font-black text-xs uppercase tracking-wider rounded-xl transition-all flex items-center justify-center gap-1.5 shadow-[0_0_20px_rgba(251,191,36,0.4)] disabled:opacity-50"
                  >
                    {isSubmittingRating ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />}
                    Submit Rating
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </>
  );
}
