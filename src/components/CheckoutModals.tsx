import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  X, ChevronDown, ChevronUp, MapPinned, CreditCard, Phone, Loader2, CheckCircle2, ShieldCheck
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { interactionService } from '../services/interactionService';
import { useMessaging } from './MessagingProvider';

export function UnifiedCheckoutModal({ product, profile, onClose, onSwitchModal, quantity, setQuantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  onSwitchModal: (type: 'ecocash' | 'pod' | 'paypal' | 'stripe' | 'checkout' | null) => void;
  quantity: number;
  setQuantity: (val: number) => void;
}) {
  const [supplierProfile, setSupplierProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let isMounted = true;
    const fetchSupplier = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'public_profiles', product.ownerId));
        if (isMounted && docSnap.exists()) {
          setSupplierProfile(docSnap.data() as any);
        }
      } catch (e) {
        console.error("Error fetching supplier public profile:", e);
      } finally {
        if (isMounted) setLoading(false);
      }
    };
    fetchSupplier();
    return () => { isMounted = false; };
  }, [product.ownerId]);

  const supplierPaymentMethods = supplierProfile?.paymentMethods || {};
  const supplierGateway = supplierProfile?.gateway;

  const isConfiguredBySupplier = (methodId: string) => {
    if (supplierPaymentMethods[methodId]?.enabled) return true;
    if (supplierGateway?.isActive && supplierGateway?.provider === methodId) return true;
    return false;
  };

  const getMethodDetails = (methodId: string) => {
    if (supplierPaymentMethods[methodId]?.enabled && supplierPaymentMethods[methodId]?.details) {
      return supplierPaymentMethods[methodId].details;
    }
    if (supplierGateway?.isActive && supplierGateway?.provider === methodId && supplierGateway?.details) {
      return supplierGateway.details;
    }
    return '';
  };

  const handleSelection = (method: 'paypal' | 'stripe' | 'ecocash' | 'pod') => {
    if (loading) return;
    
    const details = getMethodDetails(method);
    const isUrl = details && (details.startsWith('http://') || details.startsWith('https://'));

    if (method === 'ecocash') {
      onSwitchModal('ecocash');
      return;
    }
    if (method === 'pod') {
      onSwitchModal('pod');
      return;
    }

    if (method === 'paypal' || method === 'stripe') {
      if (isUrl) {
        interactionService.sendNotification(product.ownerId, 'buy', profile, product.id);
        window.open(details, '_blank');
        onClose();
      } else {
        onSwitchModal(method);
      }
      return;
    }
  };

  const totalPrice = product.price * quantity;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Financial Uplink</h3>
            <p className="text-[9px] text-primary font-black uppercase tracking-widest leading-none">Select Payment Method</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="space-y-4">
            <div className="flex gap-4 items-center p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-12 h-12 bg-white/5 rounded-xl overflow-hidden shrink-0">
                <img src={product.images?.[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[10px] font-black text-white uppercase italic truncate">{product.name}</p>
                <p className="text-sm font-black text-primary">{formatCurrency(product.price, product.currency)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-white/5 rounded-2xl border border-white/5">
              <div className="space-y-1">
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest leading-none">Purchase Quantity</p>
                <div className="flex items-baseline gap-2">
                  <p className="text-sm font-black text-white italic">Total:</p>
                  <p className="text-lg font-black text-primary italic leading-none">{formatCurrency(totalPrice, product.currency)}</p>
                </div>
              </div>
              <div className="flex items-center gap-4 bg-[#05070a] rounded-xl border border-white/10 p-1">
                <div className="text-lg font-black text-white w-8 text-center">{quantity}</div>
                <div className="flex flex-col border-l border-white/10">
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-1 text-gray-400 hover:text-primary transition-colors border-b border-white/10"
                  >
                    <ChevronUp size={16} />
                  </button>
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                  >
                    <ChevronDown size={16} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { 
                id: 'paypal', 
                label: 'PayPal', 
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M7.076 21.337H2.47a.641.641 0 0 1-.633-.74L4.944 3.722a1.06 1.06 0 0 1 1.055-.89h8.29c1.587 0 2.726.347 3.551 1.085.76.681 1.096 1.637 1.033 2.813-.099 2.103-1.685 3.39-3.535 3.39h-3.32a.513.513 0 0 0-.501.401l-.986 4.316a.513.513 0 0 0 .501.628h1.229c.652 0 1.258.463 1.378 1.104l.115.614c.058.307-.158.59-.472.59H9.423a.513.513 0 0 0-.501.401l-.813 3.565a.513.513 0 0 1-.502.408h-.032z"/>
                  </svg>
                )
              },
              { 
                id: 'stripe', 
                label: 'Stripe', 
                icon: (
                  <svg viewBox="0 0 24 24" fill="currentColor" className="w-5 h-5">
                    <path d="M13.976 9.15c-1.303-.532-2.102-.857-2.102-1.428 0-.472.49-.806 1.29-.806a5.556 5.556 0 0 1 2.214.542V5.132a6.398 6.398 0 0 0-2.286-.425c-2.457 0-4.088 1.154-4.088 3.193 0 2.23 2.052 3.111 4.14 3.962 1.346.541 2.14.939 2.14 1.554 0 .616-.628.981-1.606.981-.88 0-2.316-.363-3.238-.857l-.37 2.45c.983.473 2.492.83 3.616.83 2.637 0 4.413-1.121 4.413-3.344 0-2.296-2.073-3.048-4.223-3.927z"/>
                  </svg>
                )
              },
              { 
                id: 'ecocash', 
                label: 'EcoCash', 
                icon: (
                  <div className="w-5 h-5 bg-primary rounded-full flex items-center justify-center text-[#05070a] font-black text-[10px]">
                    e
                  </div>
                )
              },
              { 
                id: 'pod', 
                label: 'Cash/POD', 
                icon: <MapPinned size={20} />
              }
            ].map((m) => {
              const configured = isConfiguredBySupplier(m.id);
              return (
                <button 
                  key={m.id}
                  onClick={() => handleSelection(m.id as any)}
                  disabled={loading}
                  className={cn(
                    "p-4 border rounded-2xl flex flex-col items-center gap-2 transition-all group relative overflow-hidden active:scale-95 shadow-lg cursor-pointer pt-6",
                    configured
                      ? "bg-primary/10 border-primary/60 text-white hover:bg-primary/20 shadow-[0_0_15px_rgba(0,242,254,0.15)]"
                      : "bg-white/5 border-white/10 hover:bg-white/10 hover:border-white/20 text-gray-300"
                  )}
                >
                  {configured && (
                    <span className="absolute top-1.5 right-1.5 px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[7px] font-black uppercase tracking-wider">
                      ✓ Configured
                    </span>
                  )}
                  {loading && (
                    <div className="absolute inset-0 bg-primary/5 animate-pulse" />
                  )}
                  <span className={cn(
                    "group-hover:scale-110 transition-transform",
                    configured ? "text-primary" : "text-gray-400 group-hover:text-white"
                  )}>
                    {m.icon}
                  </span>
                  <span className="text-[9px] font-black uppercase tracking-widest text-gray-200 group-hover:text-white">
                    {m.label}
                  </span>
                </button>
              );
            })}
          </div>
        </div>
      </motion.div>
    </div>
  );
}

export function EcoCashModal({ product, profile, onClose, quantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  quantity: number;
}) {
  const [ussd, setUssd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUSSD = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'public_profiles', product.ownerId));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const ecocashDetail = data.paymentMethods?.ecocash?.enabled && data.paymentMethods.ecocash.details
            ? data.paymentMethods.ecocash.details
            : data.gateway?.provider === 'ecocash' ? data.gateway.details : '';

          if (ecocashDetail) {
            setUssd(ecocashDetail);
          } else {
            const rawPhone = data.whatsappNumber || data.phone || data.phoneNumber || '';
            const cleanPhone = rawPhone.replace(/[^0-9]/g, '') || '0770000000';
            setUssd(`*151*2*2*${cleanPhone}*${Math.round(product.price * quantity)}#`);
          }
        } else {
          setUssd(`*151*2*2*0770000000*${Math.round(product.price * quantity)}#`);
        }
      } catch (e) {
        console.error("Error fetching supplier gateway details:", e);
        setUssd(`*151*2*2*0770000000*${Math.round(product.price * quantity)}#`);
      } finally {
        setLoading(false);
      }
    };
    fetchUSSD();
  }, [product.ownerId, product.price, quantity]);

  const handleDial = () => {
    if (profile) {
      interactionService.sendNotification(
        product.ownerId,
        'buy',
        profile,
        product.id
      );
      const command = ussd || `*151*2*2*0770000000*${Math.round(product.price * quantity)}#`;
      const encodedUssd = command.replace(/#/g, '%23');
      window.location.href = `tel:${encodedUssd}`;
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-8 text-center space-y-6">
        <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary border border-primary/30">
          <Phone size={40} className="animate-pulse" />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">EcoCash Direct Payment</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-none">Quantity: {quantity} Unit(s)</p>
          <p className="text-sm font-black text-primary">Total: {formatCurrency(product.price * quantity, product.currency)}</p>
          {ussd && (
            <div className="pt-2">
              <p className="text-[9px] text-gray-400 font-mono bg-white/5 py-2 px-3 rounded-xl border border-white/10 break-all">{ussd}</p>
            </div>
          )}
        </div>
        <button onClick={handleDial} disabled={loading} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <Phone size={14} />} Dial EcoCash Command
        </button>
      </motion.div>
    </div>
  );
}

export function PayPalModal({ product, profile, onClose, quantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  quantity: number;
}) {
  const navigate = useNavigate();
  const { startConversation } = useMessaging();
  const [email, setEmail] = useState(profile?.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);

    try {
      await interactionService.sendNotification(product.ownerId, 'buy', profile, product.id);

      const orderMsg = `💳 PAYPAL ORDER AUTHORIZED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n` +
        `• PAYPAL ACCOUNT: ${email}\n` +
        `• STATUS: Payment Authorization Logged`;

      const convoId = [profile.uid, product.ownerId].sort().join('_');
      startConversation(product.ownerId, orderMsg).catch(console.error);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/chat?id=${convoId}`);
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center font-black">P</div>
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">PayPal Gateway</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-black text-white uppercase italic">PayPal Order Approved</h4>
            <p className="text-[10px] text-gray-400">Order details dispatched to supplier chat.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{product.name} (x{quantity})</p>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price * quantity, product.currency)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">PayPal Account Email</label>
              <input 
                type="email" 
                required 
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 font-medium"
              />
            </div>

            <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <ShieldCheck size={14} />} Confirm & Pay via PayPal
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export function StripeModal({ product, profile, onClose, quantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  quantity: number;
}) {
  const navigate = useNavigate();
  const { startConversation } = useMessaging();
  const [cardName, setCardName] = useState(profile?.name || '');
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);

    try {
      await interactionService.sendNotification(product.ownerId, 'buy', profile, product.id);

      const orderMsg = `💳 STRIPE CARD ORDER PROCESSED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n` +
        `• CARD HOLDER: ${cardName}\n` +
        `• CARD LAST 4: ${cardNumber.slice(-4) || '4242'}\n` +
        `• STATUS: Stripe Card Transaction Logged`;

      const convoId = [profile.uid, product.ownerId].sort().join('_');
      startConversation(product.ownerId, orderMsg).catch(console.error);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/chat?id=${convoId}`);
      }, 1500);
    } catch (e) {
      console.error(e);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-6 space-y-6">
        <div className="flex justify-between items-center border-b border-white/10 pb-4">
          <div className="flex items-center gap-2">
            <CreditCard size={20} className="text-purple-400" />
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Stripe Card Gateway</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={18} /></button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-black text-white uppercase italic">Stripe Card Approved</h4>
            <p className="text-[10px] text-gray-400">Order details dispatched to supplier chat.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{product.name} (x{quantity})</p>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price * quantity, product.currency)}</p>
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Cardholder Name</label>
              <input 
                type="text" 
                required 
                value={cardName}
                onChange={e => setCardName(e.target.value)}
                placeholder="Full Name on Card"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 font-medium"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Card Number</label>
              <input 
                type="text" 
                required 
                maxLength={19}
                value={cardNumber}
                onChange={e => setCardNumber(e.target.value)}
                placeholder="4242 •••• •••• 4242"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 font-mono"
              />
            </div>

            <div className="flex gap-3">
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Expiry</label>
                <input 
                  type="text" 
                  required 
                  placeholder="MM/YY" 
                  maxLength={5}
                  value={expiry}
                  onChange={e => setExpiry(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 font-mono text-center"
                />
              </div>
              <div className="flex-1 space-y-1">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">CVC</label>
                <input 
                  type="text" 
                  required 
                  placeholder="123" 
                  maxLength={4}
                  value={cvc}
                  onChange={e => setCvc(e.target.value)}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 font-mono text-center"
                />
              </div>
            </div>

            <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2">
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <CreditCard size={14} />} Pay with Stripe
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export function PodModal({ product, profile, onClose, initialQuantity = 1 }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  initialQuantity?: number;
}) {
  const navigate = useNavigate();
  const { startConversation } = useMessaging();
  const [formData, setFormData] = useState({ 
    name: profile?.name || profile?.businessName || '', 
    phone: profile?.phone || profile?.phoneNumber || '', 
    quantity: initialQuantity, 
    address: profile?.location?.address || '' 
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);
    
    const orderMessage = `🚀 PAY ON DELIVERY ORDER INITIATED\n\n` +
      `• ITEM: ${product.name}\n` +
      `• QUANTITY: ${formData.quantity}\n` +
      `• TOTAL: ${formatCurrency(product.price * formData.quantity, product.currency)}\n\n` +
      `📦 CUSTOMER DETAILS:\n` +
      `• NAME: ${formData.name}\n` +
      `• CONTACT: ${formData.phone}\n` +
      `• ADDRESS: ${formData.address}`;

    const convoId = [profile.uid, product.ownerId].sort().join('_');

    startConversation(product.ownerId, orderMessage).catch(err => {
      console.error("Background POD order failure:", err);
    });

    onClose();
    navigate(`/chat?id=${convoId}`);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg neon-card p-8 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Pay on Delivery</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>
        <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Customer Name</label>
            <input required type="text" placeholder="Your Full Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-bold" />
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Contact Link (Phone)</label>
            <input required type="tel" placeholder="Phone Number" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-mono" />
          </div>

          <div className="flex gap-4 items-center">
            <div className="flex-1 space-y-1">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantity</label>
              <div className="flex items-center bg-white/5 border border-white/10 rounded-xl overflow-hidden">
                <button 
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: Math.max(1, prev.quantity - 1) }))}
                  className="w-12 h-12 flex items-center justify-center text-primary border-r border-white/5 hover:bg-white/5 transition-all"
                >
                  <ChevronDown size={14} />
                </button>
                <div className="flex-1 text-center font-black text-white text-sm">
                  {formData.quantity}
                </div>
                <button 
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, quantity: prev.quantity + 1 }))}
                  className="w-12 h-12 flex items-center justify-center text-primary border-l border-white/5 hover:bg-white/5 transition-all"
                >
                  <ChevronUp size={14} />
                </button>
              </div>
            </div>
            <div className="flex-1 space-y-1 text-right">
              <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest mr-1">Total Valuation</label>
              <p className="text-xl font-black text-primary italic leading-[3rem]">
                {formatCurrency(product.price * formData.quantity, product.currency)}
              </p>
            </div>
          </div>
          
          <div className="space-y-1">
            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Delivery Address</label>
            <textarea required placeholder="Full Delivery Address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-medium" rows={3} />
          </div>

          <div className="pt-2">
            <button type="submit" disabled={submitting} className="w-full btn-neon py-5 text-[10px] font-black uppercase tracking-[0.25em] shadow-xl shadow-primary/20">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Finalize Delivery Order'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}
