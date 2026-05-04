import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Zap, ShoppingBag, ArrowRight, MessageSquare, Phone, Check, Loader2, MapPinned, CreditCard, Share2, X, Info, Star, Store as StoreIcon, Edit3, Trash2
} from 'lucide-react';
import { UserProfile, Product, Store } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, serverTimestamp, setDoc, doc, getDoc } from 'firebase/firestore';
import { interactionService } from '../services/interactionService';

import { useMessaging } from '../components/MessagingProvider';

export default function ProductCard({ 
  product, 
  profile, 
  store: initialStore,
  onAction,
  isOwner = false,
  onEdit,
  onDelete
}: { 
  product: Product, 
  profile: UserProfile | null, 
  store?: Store,
  onAction?: (prod: Product) => void, 
  isOwner?: boolean,
  onEdit?: (prod: Product) => void,
  onDelete?: (prod: Product) => void,
  key?: React.Key 
}) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const { startConversation } = useMessaging();
  const [storeData, setStoreData] = useState<{ name: string; rating: number; reviewCount: number }>({
    name: initialStore?.name || 'Verified Node',
    rating: initialStore?.rating || 5.0,
    reviewCount: initialStore?.reviewCount || 0
  });
  const [isStoreLoading, setIsStoreLoading] = useState(!initialStore);
  const [isEngaging, setIsEngaging] = useState(false);
  const [activeModal, setActiveModal] = useState<'checkout' | 'ecocash' | 'pod' | null>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (initialStore) {
      setStoreData({
        name: initialStore.name,
        rating: initialStore.rating,
        reviewCount: initialStore.reviewCount
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
            reviewCount: data.reviewCount || 0
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

  const logEngagement = async (type: 'engaged' | 'interested') => {
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
      await logEngagement('engaged');
      const customerName = profile.name || profile.businessName || 'A Customer';
      const interestMessage = `Hie, I am ${customerName}. I am interested in this Product/Service: ${product.name}`;

      try {
        const convoId = await startConversation(product.ownerId, interestMessage);
        navigate(`/chat?id=${convoId}`);
      } catch (err) {
        setIsEngaging(false);
        handleFirestoreError(err, OperationType.CREATE, 'engage-chat');
      }
      return;
    }

    await logEngagement('interested');

    if (onAction) {
      onAction(product);
      return;
    }

    setActiveModal('checkout');
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

  const handleShare = (e: React.MouseEvent) => {
    e.stopPropagation();
    const shareUrl = `${window.location.origin}/product/${product.id}`;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on Comfort Business Hub!`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Node Link Copied to Clipboard!');
    }
  };

  return (
    <>
      <motion.div 
        whileTap={{ scale: 0.98 }}
        onClick={() => navigate(`/product/${product.id}`, { 
          state: { 
            product, 
            store: initialStore || { 
              id: product.storeId, 
              name: storeData.name, 
              rating: storeData.rating, 
              reviewCount: storeData.reviewCount 
            } 
          } 
        })}
        className="neon-card group relative overflow-hidden cursor-pointer"
      >
        <div className="aspect-[16/10] relative overflow-hidden">
          <AnimatePresence mode="wait">
            <motion.img 
              key={currentImageIndex}
              src={images[currentImageIndex]} 
              alt={product.name}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
              }}
            />
          </AnimatePresence>
          
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60 pointer-events-none"></div>

          <div className="absolute top-4 left-4 flex gap-2 z-20">
            {product.rating && product.rating > 0 && (
              <div className="px-2 py-1 bg-[#05070a]/80 backdrop-blur-md rounded-lg border border-primary/20 text-[9px] font-black text-primary flex items-center gap-1">
                <Star size={10} className="fill-primary" />
                {product.rating.toFixed(1)}
              </div>
            )}
          </div>

          <button 
            onClick={handleShare}
            className="absolute top-4 right-4 p-2 bg-[#05070a]/80 backdrop-blur-md rounded-xl border border-white/10 text-white hover:text-primary transition-colors hover:scale-110 active:scale-95 shadow-xl z-20"
          >
            <Share2 size={14} />
          </button>

          {isOwner && (
            <div className="absolute top-4 right-14 flex gap-2 z-20">
              <button 
                onClick={(e) => { e.stopPropagation(); onEdit?.(product); }}
                className="p-2 bg-primary/20 backdrop-blur-md rounded-xl border border-primary/30 text-primary hover:bg-primary hover:text-black transition-all shadow-xl"
              >
                <Edit3 size={14} />
              </button>
              <button 
                onClick={(e) => { e.stopPropagation(); onDelete?.(product); }}
                className="p-2 bg-red-500/20 backdrop-blur-md rounded-xl border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white transition-all shadow-xl"
              >
                <Trash2 size={14} />
              </button>
            </div>
          )}
        </div>

        <div className="p-5 space-y-4 relative">
          <div className="flex justify-between items-start">
            <div className="space-y-1 flex-1 min-w-0">
              <h3 className="font-black text-white italic uppercase tracking-tighter text-lg leading-none truncate group-hover:text-primary transition-colors">{product.name}</h3>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest truncate">{product.category}</p>
            </div>
            <div className="text-right">
              <p className="text-xl font-black text-primary italic tracking-tighter leading-none">{formatCurrency(product.price, product.currency)}</p>
              <div className="flex items-center justify-end gap-1 mt-1">
                <div className="w-1.5 h-1.5 bg-neon-green rounded-full animate-pulse shadow-[0_0_5px_#39FF14]"></div>
                <p className="text-[8px] text-neon-green font-black uppercase tracking-widest">Active Node</p>
              </div>
            </div>
          </div>

          {product.description && (
            <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed h-7">
              {product.description}
            </p>
          )}

          <div className="space-y-3">
             <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-lg border border-white/10 bg-white/5 flex items-center justify-center shrink-0">
                {isStoreLoading ? (
                  <Loader2 size={12} className="text-gray-600 animate-spin" />
                ) : (
                  <StoreIcon size={14} className="text-primary" />
                )}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] text-white font-black uppercase tracking-tight truncate">{storeData.name}</p>
                <div className="flex items-center gap-1">
                  <Star size={8} className="fill-primary text-primary" />
                  <span className="text-[8px] font-bold text-gray-400">{storeData.rating.toFixed(1)} Node Performance</span>
                </div>
              </div>
            </div>

            <div className="flex gap-2" onClick={(e) => e.stopPropagation()}>
              <button 
                onClick={() => handleAction('engage')}
                disabled={isEngaging}
                className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all flex items-center justify-center gap-2"
              >
                {isEngaging ? <Loader2 size={12} className="animate-spin" /> : <MessageSquare size={12} />}
                Negotiate
              </button>
              <button 
                onClick={() => handleAction('shop')}
                className="flex-[1.5] py-3 bg-primary rounded-xl text-[9px] font-black uppercase tracking-[0.2em] text-[#05070a] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all flex items-center justify-center gap-2"
              >
                {getActionIcon()}
                {product.buyButtonText || 'Order Now'}
              </button>
            </div>
          </div>
        </div>
      </motion.div>

      <AnimatePresence>
        {activeModal === 'checkout' && (
          <UnifiedCheckoutModal 
            product={product} 
            profile={profile}
            onClose={() => setActiveModal(null)}
            onSwitchModal={(type) => setActiveModal(type)}
          />
        )}
        {activeModal === 'ecocash' && (
          <EcoCashModal 
            product={product} 
            profile={profile}
            onClose={() => setActiveModal(null)} 
          />
        )}
        {activeModal === 'pod' && (
          <PodModal 
            product={product} 
            profile={profile}
            onClose={() => setActiveModal(null)} 
          />
        )}
      </AnimatePresence>
    </>
  );
}

// Sub-components (UnifiedCheckoutModal, EcoCashModal, PodModal) 
// Copied from Discovery.tsx but properly adapted

function UnifiedCheckoutModal({ product, profile, onClose, onSwitchModal }: any) {
  const [supplierProfile, setSupplierProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', product.ownerId));
        if (docSnap.exists()) {
          setSupplierProfile(docSnap.data() as UserProfile);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [product.ownerId]);

  const handleSelection = (method: 'paypal' | 'stripe' | 'ecocash' | 'pod') => {
    setErrorMessage(null);
    const isConfigured = supplierProfile?.gateway?.provider === method && supplierProfile?.gateway?.isActive;
    
    if (method === 'ecocash') {
      if (isConfigured) onSwitchModal('ecocash');
      else setErrorMessage("Supplier not configure this payment type, Try another payment type");
      return;
    }
    if (method === 'pod') {
      onSwitchModal('pod');
      return;
    }
    if (!isConfigured) {
      setErrorMessage("Supplier not configure this payment type, Try another payment type");
      return;
    }
    if (method === 'paypal' || method === 'stripe') {
      const details = supplierProfile?.gateway?.details;
      if (details) {
        interactionService.sendNotification(
          product.ownerId,
          'buy',
          profile,
          product.id
        );
        window.location.href = details;
      }
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Financial Uplink</h3>
            <p className="text-[9px] text-primary font-black uppercase tracking-widest leading-none">Select Secure Payment Protocol</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4 items-center p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="w-12 h-12 bg-white/5 rounded-xl overflow-hidden">
              <img src={product.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase italic">{product.name}</p>
              <p className="text-sm font-black text-primary">{formatCurrency(product.price, product.currency)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'paypal', label: 'PayPal', icon: CreditCard },
              { id: 'stripe', label: 'Stripe', icon: CreditCard },
              { id: 'ecocash', label: 'EcoCash', icon: Phone },
              { id: 'pod', label: 'Cash/POD', icon: MapPinned }
            ].map((m) => (
              <button 
                key={m.id}
                onClick={() => handleSelection(m.id as any)}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/10 hover:border-primary/30 transition-all group"
              >
                <m.icon size={20} className="text-gray-500 group-hover:text-primary" />
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white">{m.label}</span>
              </button>
            ))}
          </div>

          {errorMessage && (
            <p className="text-[10px] font-bold text-red-500 text-center">{errorMessage}</p>
          )}
        </div>
      </motion.div>
    </div>
  );
}

function EcoCashModal({ product, profile, onClose }: any) {
  const [ussd, setUssd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUSSD = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', product.ownerId));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.gateway?.provider === 'ecocash') setUssd(data.gateway.details);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUSSD();
  }, [product.ownerId]);

  const handleDial = () => {
    if (ussd && profile) {
      interactionService.sendNotification(
        product.ownerId,
        'buy',
        profile,
        product.id
      );
      const encodedUssd = ussd.replace(/#/g, '%23');
      window.location.href = `tel:${encodedUssd}`;
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary">
          <Phone size={40} className="animate-pulse" />
        </div>
        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">EcoCash Matrix</h3>
        <button onClick={handleDial} disabled={loading || !ussd} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Phone size={14} />} Dial Payment Command
        </button>
      </motion.div>
    </div>
  );
}

function PodModal({ product, profile, onClose }: any) {
  const navigate = useNavigate();
  const { startConversation } = useMessaging();
  const [formData, setFormData] = useState({ name: '', phone: '', quantity: 1, address: '' });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    try {
      const orderMessage = `🚀 PAY ON DELIVERY ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${formData.quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * formData.quantity, product.currency)}\n\n` +
        `📦 CUSTOMER DETAILS:\n` +
        `• NAME: ${formData.name}\n` +
        `• CONTACT: ${formData.phone}\n` +
        `• ADDRESS: ${formData.address}`;

      const convoId = await startConversation(product.ownerId, orderMessage);

      onClose();
      navigate(`/chat?id=${convoId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'pod-order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg neon-card p-8 flex flex-col max-h-[90vh] overflow-hidden">
        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter mb-4">Pay on Delivery</h3>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto no-scrollbar">
          <input required type="text" placeholder="Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs" />
          <input required type="tel" placeholder="Phone" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs" />
          <textarea required placeholder="Address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs" rows={3} />
          <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest">
            {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Complete Order'}
          </button>
        </form>
      </motion.div>
    </div>
  );
}
