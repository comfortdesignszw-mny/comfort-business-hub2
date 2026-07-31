import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  X, ChevronDown, ChevronUp, MapPinned, CreditCard, Phone, Loader2, CheckCircle2, ShieldCheck, ShieldAlert,
  Landmark, Copy, Check, ExternalLink, Star, Wallet
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Product } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { interactionService } from '../services/interactionService';
import { useMessaging } from './MessagingProvider';

export function BuyerDisclaimerNotice() {
  return (
    <div className="bg-amber-500/10 border border-amber-500/30 rounded-2xl p-3.5 flex items-start gap-3 text-amber-300 text-[10px] leading-relaxed font-bold shadow-[0_0_15px_rgba(245,158,11,0.1)]">
      <ShieldAlert className="text-amber-400 shrink-0 mt-0.5" size={16} />
      <div>
        <span className="font-black uppercase tracking-wider text-amber-400 block mb-0.5">Disclaimer & Security Notice</span>
        Disclaimer: Make sure you are satisfied with the product and ensure the Seller is not a Scammer before you send money, or use Pay on Delivery, it's safe and convenient.
      </div>
    </div>
  );
}

export function UnifiedCheckoutModal({ product, profile, onClose, onSwitchModal, quantity, setQuantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  onSwitchModal: (type: 'ecocash' | 'pod' | 'paypal' | 'stripe' | 'paynow' | 'bank' | 'checkout' | null) => void;
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

  const isPrimaryGateway = (methodId: string) => {
    return supplierGateway?.isActive && supplierGateway?.provider === methodId;
  };

  const getMethodDetails = (methodId: string) => {
    if (supplierPaymentMethods[methodId]?.enabled) {
      if (methodId === 'bank' && (supplierPaymentMethods.bank.bankName || supplierPaymentMethods.bank.accountNumber)) {
        const b = supplierPaymentMethods.bank;
        return [b.bankName, b.accountNumber].filter(Boolean).join(' - ') || b.details || '';
      }
      if (supplierPaymentMethods[methodId].details) {
        return supplierPaymentMethods[methodId].details;
      }
    }
    if (supplierGateway?.isActive && supplierGateway?.provider === methodId && supplierGateway?.details) {
      return supplierGateway.details;
    }
    return '';
  };

  const handleSelection = (method: 'paypal' | 'stripe' | 'ecocash' | 'paynow' | 'bank' | 'pod') => {
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
    if (method === 'bank') {
      onSwitchModal('bank');
      return;
    }
    if (method === 'paynow') {
      if (isUrl) {
        interactionService.sendNotification(product.ownerId, 'buy', profile, product.id);
        window.open(details, '_blank');
        onClose();
      } else {
        onSwitchModal('paynow');
      }
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

  const allMethods = [
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
      label: 'Stripe Card', 
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
      id: 'paynow', 
      label: 'Paynow', 
      icon: <Wallet size={18} className="text-cyan-400" />
    },
    { 
      id: 'bank', 
      label: 'Bank Transfer', 
      icon: <Landmark size={18} className="text-amber-400" />
    },
    { 
      id: 'pod', 
      label: 'Cash / POD', 
      icon: <MapPinned size={18} className="text-rose-400" />
    }
  ];

  // Sort methods so configured & preferred methods show first
  const sortedMethods = [...allMethods].sort((a, b) => {
    const aConf = isConfiguredBySupplier(a.id);
    const bConf = isConfiguredBySupplier(b.id);
    const aPrim = isPrimaryGateway(a.id);
    const bPrim = isPrimaryGateway(b.id);

    if (aPrim && !bPrim) return -1;
    if (!aPrim && bPrim) return 1;
    if (aConf && !bConf) return -1;
    if (!aConf && bConf) return 1;
    return 0;
  });

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-md neon-card p-0 overflow-hidden">
        <div className="p-5 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div className="space-y-0.5">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Checkout Gateway</h3>
            <p className="text-[9px] text-primary font-black uppercase tracking-widest leading-none">Configured Payment Methods for {supplierProfile?.name || 'Supplier'}</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={20} /></button>
        </div>

        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto custom-scrollbar">
          <BuyerDisclaimerNotice />
          <div className="space-y-3">
            <div className="flex gap-4 items-center p-3.5 bg-white/5 rounded-2xl border border-white/5">
              <div className="w-12 h-12 bg-white/5 rounded-xl overflow-hidden shrink-0">
                <img src={product.images?.[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] font-black text-white uppercase italic truncate">{product.name}</p>
                <p className="text-xs font-black text-primary">{formatCurrency(product.price, product.currency)}</p>
              </div>
            </div>

            <div className="flex items-center justify-between p-3.5 bg-white/5 rounded-2xl border border-white/5">
              <div className="space-y-0.5">
                <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest leading-none">Purchase Quantity</p>
                <div className="flex items-baseline gap-1.5">
                  <p className="text-xs font-black text-white italic">Total:</p>
                  <p className="text-base font-black text-primary italic leading-none">{formatCurrency(totalPrice, product.currency)}</p>
                </div>
              </div>
              <div className="flex items-center gap-3 bg-[#05070a] rounded-xl border border-white/10 p-1">
                <div className="text-sm font-black text-white w-6 text-center">{quantity}</div>
                <div className="flex flex-col border-l border-white/10">
                  <button 
                    onClick={() => setQuantity(quantity + 1)}
                    className="p-1 text-gray-400 hover:text-primary transition-colors border-b border-white/10"
                  >
                    <ChevronUp size={14} />
                  </button>
                  <button 
                    onClick={() => setQuantity(Math.max(1, quantity - 1))}
                    className="p-1 text-gray-400 hover:text-primary transition-colors"
                  >
                    <ChevronDown size={14} />
                  </button>
                </div>
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Select Supplier Payment Channel:</p>

            <div className="grid grid-cols-2 gap-2.5">
              {sortedMethods.map((m) => {
                const configured = isConfiguredBySupplier(m.id);
                const primary = isPrimaryGateway(m.id);
                const detail = getMethodDetails(m.id);

                return (
                  <button 
                    key={m.id}
                    onClick={() => handleSelection(m.id as any)}
                    disabled={loading}
                    className={cn(
                      "p-3 border rounded-2xl flex flex-col justify-between transition-all group relative overflow-hidden active:scale-98 shadow-md text-left min-h-[90px] cursor-pointer",
                      primary
                        ? "bg-amber-500/10 border-amber-500/60 text-white hover:bg-amber-500/20 shadow-[0_0_15px_rgba(245,158,11,0.2)]"
                        : configured
                        ? "bg-primary/10 border-primary/60 text-white hover:bg-primary/20 shadow-[0_0_15px_rgba(0,242,254,0.15)]"
                        : "bg-white/5 border-white/10 hover:bg-white/10 text-gray-400"
                    )}
                  >
                    <div className="flex items-center justify-between w-full">
                      <span className={cn(
                        "transition-transform group-hover:scale-110",
                        configured || primary ? "text-primary" : "text-gray-400"
                      )}>
                        {m.icon}
                      </span>
                      {primary ? (
                        <span className="px-1.5 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 text-[7px] font-black uppercase tracking-wider flex items-center gap-0.5">
                          <Star size={8} className="fill-amber-300" /> Preferred
                        </span>
                      ) : configured ? (
                        <span className="px-1.5 py-0.5 rounded-full bg-emerald-500/20 text-emerald-400 border border-emerald-500/30 text-[7px] font-black uppercase tracking-wider">
                          ✓ Saved
                        </span>
                      ) : (
                        <span className="px-1.5 py-0.5 rounded-full bg-gray-500/10 text-gray-500 border border-gray-500/20 text-[7px] font-black uppercase tracking-wider">
                          Not Set
                        </span>
                      )}
                    </div>

                    <div>
                      <span className="text-[10px] font-black uppercase tracking-wider text-white block mt-2">
                        {m.label}
                      </span>
                      {detail ? (
                        <p className="text-[8px] text-gray-300 font-mono truncate max-w-full">
                          {detail}
                        </p>
                      ) : (
                        <p className="text-[8px] text-gray-500 italic">
                          Standard Checkout
                        </p>
                      )}
                    </div>
                  </button>
                );
              })}
            </div>
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
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-6 text-center space-y-5">
        <BuyerDisclaimerNotice />
        <div className="w-16 h-16 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary border border-primary/30">
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
            <button type="submit" disabled={submitting} className="w-full btn-neon py-5 text-[10px] font-black uppercase tracking-[0.25em] shadow-xl shadow-primary/20 cursor-pointer">
              {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Finalize Delivery Order'}
            </button>
          </div>
        </form>
      </motion.div>
    </div>
  );
}

export function BankModal({ product, profile, onClose, quantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  quantity: number;
}) {
  const navigate = useNavigate();
  const { startConversation } = useMessaging();
  const [bankDetails, setBankDetails] = useState<{
    bankName?: string;
    accountName?: string;
    accountNumber?: string;
    branchCode?: string;
    details?: string;
  }>({});
  const [copiedField, setCopiedField] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    const fetchBankDetails = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'public_profiles', product.ownerId));
        if (docSnap.exists()) {
          const data = docSnap.data();
          const b = data.paymentMethods?.bank;
          if (b && b.enabled) {
            setBankDetails({
              bankName: b.bankName || 'Supplier Bank',
              accountName: b.accountName || data.name || 'Account Holder',
              accountNumber: b.accountNumber || b.details || 'Contact Supplier',
              branchCode: b.branchCode || '',
              details: b.details || ''
            });
          } else {
            setBankDetails({
              bankName: 'Direct Bank Transfer',
              accountName: data.name || 'Supplier Account',
              accountNumber: data.gateway?.details || 'Request details from supplier',
              details: 'Bank Deposit'
            });
          }
        }
      } catch (e) {
        console.error("Error fetching bank details:", e);
      }
    };
    fetchBankDetails();
  }, [product.ownerId]);

  const copyToClipboard = (text: string, fieldName: string) => {
    navigator.clipboard.writeText(text);
    setCopiedField(fieldName);
    setTimeout(() => setCopiedField(null), 2000);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);

    try {
      await interactionService.sendNotification(product.ownerId, 'buy', profile, product.id);

      const orderMsg = `🏦 BANK TRANSFER ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n\n` +
        `🏦 SUPPLIER BANK DETAILS:\n` +
        `• BANK: ${bankDetails.bankName || 'N/A'}\n` +
        `• ACCOUNT NAME: ${bankDetails.accountName || 'N/A'}\n` +
        `• ACCOUNT NUMBER: ${bankDetails.accountNumber || 'N/A'}\n` +
        `• BRANCH CODE: ${bankDetails.branchCode || 'N/A'}\n\n` +
        `• BUYER CONTACT: ${profile.phone || profile.email || profile.name}\n` +
        `• STATUS: Payment Notification Sent to Supplier`;

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
            <Landmark size={20} className="text-amber-400" />
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Bank Direct Transfer</h3>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={18} /></button>
        </div>

        {success ? (
          <div className="py-8 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-emerald-400 animate-bounce" />
            <h4 className="text-sm font-black text-white uppercase italic">Bank Transfer Notified</h4>
            <p className="text-[10px] text-gray-400">Bank deposit instructions sent to supplier chat.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{product.name} (x{quantity})</p>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price * quantity, product.currency)}</p>
            </div>

            <div className="bg-amber-500/10 border border-amber-500/20 p-4 rounded-2xl space-y-2.5">
              <p className="text-[9px] font-black text-amber-300 uppercase tracking-widest">Supplier Bank Coordinates:</p>

              <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                <div>
                  <p className="text-[8px] text-gray-400 uppercase font-bold">Bank Name</p>
                  <p className="text-xs font-black text-white">{bankDetails.bankName || 'Standard Bank'}</p>
                </div>
              </div>

              <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                <div>
                  <p className="text-[8px] text-gray-400 uppercase font-bold">Account Name</p>
                  <p className="text-xs font-black text-white">{bankDetails.accountName || 'Supplier'}</p>
                </div>
                {bankDetails.accountName && (
                  <button type="button" onClick={() => copyToClipboard(bankDetails.accountName!, 'accountName')} className="text-gray-400 hover:text-amber-300 p-1">
                    {copiedField === 'accountName' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                )}
              </div>

              <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                <div>
                  <p className="text-[8px] text-gray-400 uppercase font-bold">Account Number</p>
                  <p className="text-xs font-mono font-black text-amber-300">{bankDetails.accountNumber || 'Contact Supplier'}</p>
                </div>
                {bankDetails.accountNumber && (
                  <button type="button" onClick={() => copyToClipboard(bankDetails.accountNumber!, 'accountNumber')} className="text-gray-400 hover:text-amber-300 p-1">
                    {copiedField === 'accountNumber' ? <Check size={14} className="text-emerald-400" /> : <Copy size={14} />}
                  </button>
                )}
              </div>

              {bankDetails.branchCode && (
                <div className="flex justify-between items-center bg-black/40 p-2.5 rounded-xl border border-white/5">
                  <div>
                    <p className="text-[8px] text-gray-400 uppercase font-bold">Branch Code / Swift</p>
                    <p className="text-xs font-mono font-bold text-white">{bankDetails.branchCode}</p>
                  </div>
                </div>
              )}
            </div>

            <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
              {submitting ? <Loader2 className="animate-spin" size={14} /> : <Landmark size={14} />} Confirm Bank Deposit & Notify Supplier
            </button>
          </form>
        )}
      </motion.div>
    </div>
  );
}

export function PaynowModal({ product, profile, onClose, quantity }: {
  product: Product;
  profile: UserProfile | null;
  onClose: () => void;
  quantity: number;
}) {
  const navigate = useNavigate();
  const { startConversation } = useMessaging();
  const [paynowDetail, setPaynowDetail] = useState<string>('');
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchPaynow = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'public_profiles', product.ownerId));
        if (userSnap.exists()) {
          const data = userSnap.data();
          const detail = data.paymentMethods?.paynow?.enabled && data.paymentMethods.paynow.details
            ? data.paymentMethods.paynow.details
            : data.gateway?.provider === 'paynow' ? data.gateway.details : '';
          setPaynowDetail(detail || 'https://www.paynow.co.zw');
        }
      } catch (e) {
        console.error("Error fetching Paynow details:", e);
        setPaynowDetail('https://www.paynow.co.zw');
      } finally {
        setLoading(false);
      }
    };
    fetchPaynow();
  }, [product.ownerId]);

  const handlePaynowAction = async () => {
    if (!profile) return;
    try {
      await interactionService.sendNotification(product.ownerId, 'buy', profile, product.id);

      const orderMsg = `💳 PAYNOW ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n` +
        `• PAYNOW REF: ${paynowDetail}\n` +
        `• STATUS: Paynow Checkout Launched`;

      const convoId = [profile.uid, product.ownerId].sort().join('_');
      startConversation(product.ownerId, orderMsg).catch(console.error);

      if (paynowDetail.startsWith('http://') || paynowDetail.startsWith('https://')) {
        window.open(paynowDetail, '_blank');
      }
      onClose();
      navigate(`/chat?id=${convoId}`);
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-6 space-y-6 text-center">
        <div className="w-16 h-16 bg-cyan-500/20 rounded-3xl flex items-center justify-center mx-auto text-cyan-400 border border-cyan-500/30">
          <Wallet size={32} />
        </div>
        <div className="space-y-1">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Paynow Gateway</h3>
          <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-none">Quantity: {quantity} Unit(s)</p>
          <p className="text-sm font-black text-cyan-400">Total: {formatCurrency(product.price * quantity, product.currency)}</p>
          {paynowDetail && (
            <p className="text-[9px] font-mono text-gray-400 bg-white/5 py-2 px-3 rounded-xl border border-white/10 break-all mt-2">
              {paynowDetail}
            </p>
          )}
        </div>
        <button onClick={handlePaynowAction} disabled={loading} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
          {loading ? <Loader2 className="animate-spin" size={14} /> : <ExternalLink size={14} />} Launch Paynow Checkout
        </button>
      </motion.div>
    </div>
  );
}
