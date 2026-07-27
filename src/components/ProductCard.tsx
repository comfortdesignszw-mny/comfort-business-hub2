import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, ShoppingBag, ArrowRight, MessageSquare, Phone, Check, Loader2, MapPinned, CreditCard, Share2, X, Info, Star, Store as StoreIcon, Edit3, Trash2, ChevronDown, ChevronUp, ShieldAlert, Heart
} from 'lucide-react';
import { UserProfile, Product, Store, EngagementType } from '../types';
import { cn, formatCurrency, safeShare } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { interactionService } from '../services/interactionService';
import { viewHistoryService } from '../services/viewHistory';
import OptimizedImage from './OptimizedImage';
import AuthGuard from './AuthGuard';
import { useModals } from '../context/ModalContext';
import { useNotifications } from './NotificationProvider';
import ReportModal from './ReportModal';

import { useMessaging } from '../components/MessagingProvider';
import { UnifiedCheckoutModal, EcoCashModal, PodModal, PayPalModal, StripeModal } from './CheckoutModals';

export default function ProductCard({ 
  product, 
  profile, 
  store: initialStore,
  onAction,
  isOwner = false
}: { 
  product: Product, 
  profile: UserProfile | null, 
  store?: Store,
  onAction?: (prod: Product) => void, 
  isOwner?: boolean,
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
  const [activeModal, setActiveModal] = useState<'checkout' | 'ecocash' | 'pod' | 'paypal' | 'stripe' | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);
  const [purchaseQuantity, setPurchaseQuantity] = useState(1);
  const navigate = useNavigate();
  const { triggerFeedback } = useNotifications();

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
    if (!profile) {
      navigate('/login');
      return;
    }

    if (type === 'engage') {
      setIsEngaging(true);
      logEngagement('engaged');
      
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
      const messageText = `Hi, I am interested in buying your product(s), ${product.name} in Comfort Business Hub Software.`;
      
      if (cleanNumber) {
        triggerFeedback('WhatsApp Uplink', `Opening WhatsApp contact for ${product.name}...`, 'message');
        const waUrl = `https://wa.me/${cleanNumber}?text=${encodeURIComponent(messageText)}`;
        window.open(waUrl, '_blank');
      } else {
        const targetUid = product.ownerId;
        const convoId = [profile.uid, targetUid].sort().join('_');
        startConversation(targetUid, messageText).catch(console.error);
        navigate(`/chat?id=${convoId}`);
      }
      return;
    }

    // Fire and forget engagement log
    logEngagement('order_now');

    if (onAction) {
      onAction(product);
      return;
    }

    setActiveModal('checkout');
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) {
      navigate('/login');
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
    const shareUrl = `${window.location.origin}/product/${product.id}`;
    if (navigator.share) {
      await safeShare({
        title: product.name,
        text: `Check out ${product.name} on Comfort Business Hub!`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      triggerFeedback('Link Copied', 'Node Link Copied to Clipboard!', 'message');
    }
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
        className="neon-card group relative overflow-hidden cursor-pointer"
      >
        <div className="aspect-[16/10] sm:aspect-video relative overflow-hidden">
          <AnimatePresence mode="wait">
            <OptimizedImage 
              src={images[currentImageIndex]} 
              alt={product.name}
              className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-500"
              fallbackSrc="https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop"
            />
          </AnimatePresence>
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60 pointer-events-none"></div>

          <div className="absolute top-2 sm:top-4 left-2 sm:left-4 flex gap-2 z-20">
            {product.rating && product.rating > 0 && (
              <div className="px-1.5 py-0.5 sm:px-2 sm:py-1 bg-[#05070a]/80 backdrop-blur-md rounded-lg border border-primary/20 text-[8px] sm:text-[9px] font-black text-primary flex items-center gap-1 shadow-lg">
                <Star size={8} className="fill-primary" />
                {product.rating.toFixed(1)}
              </div>
            )}
          </div>

          <button 
            onClick={handleShare}
            className="absolute top-2 sm:top-4 right-2 sm:right-4 p-1.5 sm:p-2 bg-[#05070a]/80 backdrop-blur-md rounded-xl border border-white/10 text-white hover:text-primary transition-colors hover:scale-110 active:scale-95 shadow-xl z-20 no-auth-guard"
          >
            <Share2 size={12} className="sm:w-[14px] sm:h-[14px]" />
          </button>

          {!isOwner && (
            <>
              <AuthGuard
                title="Save for Later"
                message="Join the network to save this node to your private dashboard."
                profile={profile}
              >
                <button 
                  onClick={handleLike}
                  className="absolute top-2 sm:top-4 right-10 sm:right-14 p-1.5 sm:p-2 bg-[#05070a]/80 backdrop-blur-md rounded-xl border border-white/10 text-white hover:text-red-500 transition-colors hover:scale-110 active:scale-95 shadow-xl z-20"
                >
                  <Heart size={12} className={cn("sm:w-[14px] sm:h-[14px]", product.likeCount ? "fill-red-500 text-red-500" : "")} />
                </button>
              </AuthGuard>

              {profile && !profile.isGuest && (
                <button 
                  onClick={(e) => { e.stopPropagation(); setShowReportModal(true); }}
                  className="absolute top-10 sm:top-14 right-2 sm:right-4 p-1.5 sm:p-2 bg-red-500/20 backdrop-blur-md rounded-xl border border-red-500/20 text-red-500 hover:bg-red-500 hover:text-white transition-all hover:scale-110 active:scale-95 shadow-xl z-20"
                  title="Report Abuse"
                >
                  <ShieldAlert size={12} className="sm:w-[14px] sm:h-[14px]" />
                </button>
              )}
            </>
          )}
        </div>

        <div className="p-3.5 sm:p-5 space-y-3 sm:space-y-4 relative">
          <div className="flex justify-between items-start gap-2 sm:gap-4">
            <div className="space-y-0.5 sm:space-y-1 flex-1 min-w-0">
              <div className="flex items-center gap-1.5 flex-wrap">
                <h3 className="font-black text-white italic uppercase tracking-tighter text-base sm:text-lg leading-none truncate group-hover:text-primary transition-colors">{product.name}</h3>
                {(product.isVerified || (product as any).verified) && (
                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-[7px] sm:text-[8px] font-black uppercase tracking-wider shadow-[0_0_10px_rgba(16,185,129,0.5)] shrink-0">
                    <Check size={8} className="stroke-[3] text-emerald-400" /> Verified
                  </span>
                )}
              </div>
              <p className="text-[8px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">{product.category}</p>
            </div>
            <div className="text-right">
              <p className="text-lg sm:text-xl font-black text-primary italic tracking-tighter leading-none">{formatCurrency(product.price, product.currency)}</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <div className="w-1 h-1 sm:w-1.5 sm:h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_5px_#39FF14]"></div>
                <p className="text-[7px] sm:text-[8px] text-neon-green font-black uppercase tracking-widest">Active</p>
              </div>
            </div>
          </div>

          {product.description && (
            <p className="text-[9px] sm:text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed h-[22px] sm:h-7">
              {product.description}
            </p>
          )}

          <div className="space-y-2.5 sm:space-y-3">
             <div 
              className="flex items-center gap-2 sm:gap-3 cursor-pointer group/store"
              onClick={(e) => {
                e.stopPropagation();
                openUserProfile(product.ownerId);
              }}
             >
              <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center shrink-0 group-hover/store:border-primary/50 transition-all">
                {isStoreLoading ? (
                  <Loader2 size={10} className="text-gray-600 animate-spin" />
                ) : (
                  <StoreIcon size={12} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 min-w-0">
                  <p className="text-[9px] sm:text-[10px] text-white font-black uppercase tracking-tight truncate group-hover/store:text-primary transition-colors">{storeData.name}</p>
                  {storeData.isVerified && (
                    <span className="inline-flex items-center gap-0.5 px-1 py-0.2 rounded bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-[6.5px] sm:text-[7.5px] font-black uppercase tracking-wider shadow-[0_0_6px_rgba(16,185,129,0.4)] shrink-0" title="Verified Store">
                      <Check size={7} className="stroke-[3]" /> Verified
                    </span>
                  )}
                </div>
                <div className="flex items-center gap-1">
                  <Star size={7} className="fill-primary text-primary" />
                  <span className="text-[7px] sm:text-[8px] font-bold text-gray-400 group-hover/store:text-white transition-colors">{storeData.rating.toFixed(1)} Node</span>
                </div>
              </div>
            </div>

            {!isOwner && (
              <div className="flex gap-1.5 sm:gap-2" onClick={(e) => e.stopPropagation()}>
                <AuthGuard 
                  title="Direct Network Uplink" 
                  message="Secure authentication is required to initiate a direct communication channel with this supplier node."
                  profile={profile}
                >
                  <button 
                    onClick={() => handleAction('engage')}
                    disabled={isEngaging}
                    className="flex-1 py-2 sm:py-3 bg-emerald-500/10 border border-emerald-500/30 rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-widest text-emerald-400 hover:text-white hover:bg-emerald-500/20 transition-all flex items-center justify-center gap-1.5 sm:gap-2 shadow-[0_0_10px_rgba(16,185,129,0.15)]"
                  >
                    {isEngaging ? <Loader2 size={10} className="animate-spin" /> : <MessageSquare size={10} className="text-emerald-400" />}
                    Talk on WhatsApp
                  </button>
                </AuthGuard>
                
                <button 
                  onClick={() => handleAction('shop')}
                  className="flex-[1.5] py-2 sm:py-3 bg-primary rounded-xl text-[8px] sm:text-[9px] font-black uppercase tracking-[0.15em] sm:tracking-[0.2em] text-[#05070a] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-1.5 sm:gap-2"
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
    </>
  );
}
