import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  X, ChevronDown, ChevronUp, MapPinned, CreditCard, Phone, Loader2, CheckCircle2, ShieldAlert,
  Landmark, Copy, Check, ExternalLink, Star, Wallet, Zap, User
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db } from '../lib/firebase';
import { UserProfile, Product, Deal } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { interactionService } from '../services/interactionService';
import { useMessaging } from './MessagingProvider';
import { offlineResilientWrite } from '../lib/sync';

export function getSavedGuestContact(profile: UserProfile | null) {
  if (profile) {
    return {
      name: profile.name || profile.businessName || '',
      phone: profile.phone || profile.phoneNumber || '',
      email: profile.email || ''
    };
  }
  try {
    const saved = localStorage.getItem('guest_contact');
    if (saved) return JSON.parse(saved);
  } catch (e) {}
  return { name: '', phone: '', email: '' };
}

export function saveGuestContact(contact: { name: string; phone: string; email: string }) {
  try {
    localStorage.setItem('guest_contact', JSON.stringify(contact));
  } catch (e) {}
}

export function buildUserProfileForNotification(
  profile: UserProfile | null,
  guestId: string,
  name: string,
  phone: string,
  email?: string
): UserProfile {
  if (profile) return profile;
  return {
    uid: guestId,
    name: name || 'Guest Buyer',
    phone: phone || '',
    email: email || '',
    currentRole: 'customer',
    isVerified: false,
    isGuest: true,
    createdAt: new Date().toISOString(),
    updatedAt: new Date().toISOString()
  };
}

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

export function LegalDisclaimerNotice() {
  return (
    <p className="text-[10px] text-gray-400 text-center font-medium leading-relaxed pt-3 border-t border-white/5 mt-3">
      By clicking finalize Delivery order, you agree to Comfort Business Hub{' '}
      <a 
        href="/terms" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-primary font-bold underline hover:text-cyan-300 transition-colors"
      >
        Terms of Use
      </a>{' '}
      and{' '}
      <a 
        href="/privacy" 
        target="_blank" 
        rel="noopener noreferrer" 
        className="text-primary font-bold underline hover:text-cyan-300 transition-colors"
      >
        Privacy Policy
      </a>
    </p>
  );
}

export function GuestContactFields({
  name,
  setName,
  phone,
  setPhone,
  email,
  setEmail
}: {
  name: string;
  setName: (v: string) => void;
  phone: string;
  setPhone: (v: string) => void;
  email: string;
  setEmail: (v: string) => void;
}) {
  return (
    <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
      <div className="flex items-center gap-2 text-primary">
        <User size={14} />
        <span className="text-[10px] font-black uppercase tracking-widest">Buyer Contact Details</span>
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-gray-300 uppercase tracking-wider block">
          Full Name <span className="text-red-400">*</span>
        </label>
        <input 
          type="text" 
          required 
          value={name} 
          onChange={e => setName(e.target.value)} 
          placeholder="Enter your full name" 
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-primary/50 font-bold" 
        />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-gray-300 uppercase tracking-wider block">
          Phone Number <span className="text-red-400">*</span>
        </label>
        <input 
          type="tel" 
          required 
          value={phone} 
          onChange={e => setPhone(e.target.value)} 
          placeholder="Enter phone number (+263...)" 
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-primary/50 font-mono" 
        />
      </div>
      <div className="space-y-1">
        <label className="text-[9px] font-black text-gray-400 uppercase tracking-wider block">
          Email Address <span className="text-gray-500 font-normal">(Optional)</span>
        </label>
        <input 
          type="email" 
          value={email} 
          onChange={e => setEmail(e.target.value)} 
          placeholder="your.email@example.com" 
          className="w-full bg-black/40 border border-white/10 rounded-xl px-3.5 py-2.5 text-white text-xs outline-none focus:border-primary/50 font-medium" 
        />
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

  const initialContact = getSavedGuestContact(profile);
  const [guestName, setGuestName] = useState(initialContact.name);
  const [guestPhone, setGuestPhone] = useState(initialContact.phone);
  const [guestEmail, setGuestEmail] = useState(initialContact.email);

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
    
    // Save contact
    saveGuestContact({ name: guestName, phone: guestPhone, email: guestEmail });

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
        interactionService.sendNotification(product.ownerId, 'buy', buildUserProfileForNotification(profile, `guest_${Date.now()}`, guestName, guestPhone, guestEmail), product.id);
        window.open(details, '_blank');
        onClose();
      } else {
        onSwitchModal('paynow');
      }
      return;
    }

    if (method === 'paypal' || method === 'stripe') {
      if (isUrl) {
        interactionService.sendNotification(product.ownerId, 'buy', buildUserProfileForNotification(profile, `guest_${Date.now()}`, guestName, guestPhone, guestEmail), product.id);
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
      label: 'Pay on Delivery', 
      icon: <MapPinned size={18} className="text-rose-400" />
    }
  ];

  const sortedMethods = [...allMethods].sort((a, b) => {
    const aConf = isConfiguredBySupplier(a.id);
    const bConf = isConfiguredBySupplier(b.id);
    const aPrim = isPrimaryGateway(a.id);
    const bPrim = isPrimaryGateway(b.id);

    if (aPrim && !bPrim) return -1;
    if (!aPrim && bPrim) return 1;
    if (aConf && !bConf) return -1;
    if (aConf && !bConf) return 1;
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

          {/* Guest Contact Details Input */}
          <GuestContactFields 
            name={guestName} 
            setName={setGuestName} 
            phone={guestPhone} 
            setPhone={setGuestPhone} 
            email={guestEmail} 
            setEmail={setGuestEmail} 
          />

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
            <p className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Select Payment Method:</p>

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
  const initialContact = getSavedGuestContact(profile);
  const [guestName, setGuestName] = useState(initialContact.name);
  const [guestPhone, setGuestPhone] = useState(initialContact.phone);
  const [guestEmail, setGuestEmail] = useState(initialContact.email);

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

  const handleDial = async () => {
    saveGuestContact({ name: guestName, phone: guestPhone, email: guestEmail });

    const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const guestId = profile?.uid || `guest_${Date.now()}`;

    const dealData: Deal = {
      id: dealId,
      customerId: guestId,
      customerName: guestName,
      customerPhone: guestPhone,
      customerEmail: guestEmail || '',
      supplierId: product.ownerId,
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      quantity: quantity,
      agreedPrice: product.price * quantity,
      status: 'confirmed',
      trackingStage: 'Order Confirmed',
      paymentMethod: 'ecocash',
      isGuestOrder: !profile,
      history: [{ stage: 'Order Confirmed', status: 'confirmed', timestamp: new Date().toISOString(), updatedBy: guestName || 'Customer' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await offlineResilientWrite('deals', dealId, 'create', dealData);
      const existing = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      localStorage.setItem('guest_deal_ids', JSON.stringify([...existing, dealId]));
    } catch (e) {}

    interactionService.sendNotification(
      product.ownerId,
      'buy',
      buildUserProfileForNotification(profile, guestId, guestName, guestPhone, guestEmail),
      product.id
    );

    const command = ussd || `*151*2*2*0770000000*${Math.round(product.price * quantity)}#`;
    const encodedUssd = command.replace(/#/g, '%23');
    window.location.href = `tel:${encodedUssd}`;
    onClose();
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

        <GuestContactFields 
          name={guestName} 
          setName={setGuestName} 
          phone={guestPhone} 
          setPhone={setGuestPhone} 
          email={guestEmail} 
          setEmail={setGuestEmail} 
        />

        <div className="space-y-2">
          <button onClick={handleDial} disabled={loading} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Phone size={14} />} Dial EcoCash Command
          </button>
          <LegalDisclaimerNotice />
        </div>
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
  const initialContact = getSavedGuestContact(profile);
  const [guestName, setGuestName] = useState(initialContact.name);
  const [guestPhone, setGuestPhone] = useState(initialContact.phone);
  const [guestEmail, setGuestEmail] = useState(initialContact.email);
  const [paypalEmail, setPaypalEmail] = useState(initialContact.email || '');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    saveGuestContact({ name: guestName, phone: guestPhone, email: guestEmail });

    const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const guestId = profile?.uid || `guest_${Date.now()}`;

    const dealData: Deal = {
      id: dealId,
      customerId: guestId,
      customerName: guestName,
      customerPhone: guestPhone,
      customerEmail: guestEmail || paypalEmail,
      supplierId: product.ownerId,
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      quantity: quantity,
      agreedPrice: product.price * quantity,
      status: 'confirmed',
      trackingStage: 'Order Confirmed',
      paymentMethod: 'paypal',
      isGuestOrder: !profile,
      history: [{ stage: 'Order Confirmed', status: 'confirmed', timestamp: new Date().toISOString(), updatedBy: guestName || 'Customer' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await offlineResilientWrite('deals', dealId, 'create', dealData);
      const existing = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      localStorage.setItem('guest_deal_ids', JSON.stringify([...existing, dealId]));

      await interactionService.sendNotification(product.ownerId, 'buy', buildUserProfileForNotification(profile, guestId, guestName, guestPhone, guestEmail), product.id);

      const orderMsg = `💳 PAYPAL ORDER AUTHORIZED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n` +
        `• PAYPAL ACCOUNT: ${paypalEmail}\n` +
        `• BUYER: ${guestName} (${guestPhone})`;

      startConversation(product.ownerId, orderMsg).catch(console.error);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/deals`);
      }, 1500);
    } catch (e) {
      console.error(e);
      setSuccess(true);
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
            <p className="text-[10px] text-gray-400">Order details recorded for tracking in Markets.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{product.name} (x{quantity})</p>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price * quantity, product.currency)}</p>
            </div>

            <GuestContactFields 
              name={guestName} 
              setName={setGuestName} 
              phone={guestPhone} 
              setPhone={setGuestPhone} 
              email={guestEmail} 
              setEmail={setGuestEmail} 
            />

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">PayPal Account Email</label>
              <input 
                type="email" 
                required 
                value={paypalEmail}
                onChange={e => setPaypalEmail(e.target.value)}
                placeholder="your.email@example.com"
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 font-medium"
              />
            </div>

            <div className="space-y-2">
              <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                {submitting ? <Loader2 className="animate-spin" size={14} /> : <Zap size={14} />} Confirm & Pay via PayPal
              </button>
              <LegalDisclaimerNotice />
            </div>
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
  const initialContact = getSavedGuestContact(profile);
  const [guestName, setGuestName] = useState(initialContact.name);
  const [guestPhone, setGuestPhone] = useState(initialContact.phone);
  const [guestEmail, setGuestEmail] = useState(initialContact.email);
  const [cardName, setCardName] = useState(initialContact.name);
  const [cardNumber, setCardNumber] = useState('');
  const [expiry, setExpiry] = useState('');
  const [cvc, setCvc] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    saveGuestContact({ name: guestName, phone: guestPhone, email: guestEmail });

    const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const guestId = profile?.uid || `guest_${Date.now()}`;

    const dealData: Deal = {
      id: dealId,
      customerId: guestId,
      customerName: guestName,
      customerPhone: guestPhone,
      customerEmail: guestEmail,
      supplierId: product.ownerId,
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      quantity: quantity,
      agreedPrice: product.price * quantity,
      status: 'confirmed',
      trackingStage: 'Order Confirmed',
      paymentMethod: 'stripe',
      isGuestOrder: !profile,
      history: [{ stage: 'Order Confirmed', status: 'confirmed', timestamp: new Date().toISOString(), updatedBy: guestName || 'Customer' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await offlineResilientWrite('deals', dealId, 'create', dealData);
      const existing = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      localStorage.setItem('guest_deal_ids', JSON.stringify([...existing, dealId]));

      await interactionService.sendNotification(product.ownerId, 'buy', buildUserProfileForNotification(profile, guestId, guestName, guestPhone, guestEmail), product.id);

      const orderMsg = `💳 STRIPE CARD ORDER PROCESSED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n` +
        `• CARD HOLDER: ${cardName}\n` +
        `• BUYER: ${guestName} (${guestPhone})`;

      startConversation(product.ownerId, orderMsg).catch(console.error);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/deals`);
      }, 1500);
    } catch (e) {
      console.error(e);
      setSuccess(true);
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
            <p className="text-[10px] text-gray-400">Order recorded for live tracking in Markets.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{product.name} (x{quantity})</p>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price * quantity, product.currency)}</p>
            </div>

            <GuestContactFields 
              name={guestName} 
              setName={setGuestName} 
              phone={guestPhone} 
              setPhone={setGuestPhone} 
              email={guestEmail} 
              setEmail={setGuestEmail} 
            />

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

            <div className="space-y-2">
              <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                {submitting ? <Loader2 className="animate-spin" size={14} /> : <CreditCard size={14} />} Pay with Stripe
              </button>
              <LegalDisclaimerNotice />
            </div>
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
  
  const initialContact = getSavedGuestContact(profile);
  const [formData, setFormData] = useState({ 
    name: initialContact.name, 
    phone: initialContact.phone, 
    email: initialContact.email,
    quantity: initialQuantity, 
    address: profile?.location?.address || '' 
  });
  const [submitting, setSubmitting] = useState(false);
  const [success, setSuccess] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setSubmitting(true);
    
    saveGuestContact({ name: formData.name, phone: formData.phone, email: formData.email });

    const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const guestId = profile?.uid || `guest_${Date.now()}`;

    const dealData: Deal = {
      id: dealId,
      customerId: guestId,
      customerName: formData.name,
      customerPhone: formData.phone,
      customerEmail: formData.email || '',
      supplierId: product.ownerId,
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      quantity: formData.quantity,
      agreedPrice: product.price * formData.quantity,
      status: 'confirmed',
      trackingStage: 'Order Confirmed',
      deliveryAddress: formData.address,
      paymentMethod: 'pod',
      isGuestOrder: !profile,
      history: [{ stage: 'Order Confirmed', status: 'confirmed', timestamp: new Date().toISOString(), updatedBy: formData.name || 'Customer' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await offlineResilientWrite('deals', dealId, 'create', dealData);

      const existingDeals = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      localStorage.setItem('guest_deal_ids', JSON.stringify([...existingDeals, dealId]));

      interactionService.sendNotification(
        product.ownerId, 
        'buy', 
        buildUserProfileForNotification(profile, guestId, formData.name, formData.phone, formData.email), 
        product.id,
        'New Delivery Order Received!',
        `${formData.name} placed a Pay on Delivery order for ${product.name} (x${formData.quantity}).`
      );

      const orderMessage = `🚀 PAY ON DELIVERY ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${formData.quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * formData.quantity, product.currency)}\n\n` +
        `📦 CUSTOMER DETAILS:\n` +
        `• NAME: ${formData.name}\n` +
        `• PHONE: ${formData.phone}\n` +
        `• EMAIL: ${formData.email || 'N/A'}\n` +
        `• ADDRESS: ${formData.address}`;

      startConversation(product.ownerId, orderMessage).catch(console.error);

      setSuccess(true);
    } catch (err) {
      console.error("POD Order error:", err);
      setSuccess(true);
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-lg neon-card p-6 flex flex-col max-h-[90vh] overflow-hidden">
        <div className="flex justify-between items-center mb-4">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Pay on Delivery Checkout</h3>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        {success ? (
          <div className="py-6 text-center space-y-4">
            <div className="w-16 h-16 bg-emerald-500/20 text-emerald-400 rounded-2xl flex items-center justify-center mx-auto border border-emerald-500/40 shadow-[0_0_20px_rgba(16,185,129,0.3)] animate-bounce">
              <CheckCircle2 size={36} />
            </div>
            <div className="space-y-1.5">
              <h4 className="text-base font-black text-emerald-400 uppercase italic tracking-tight">
                Delivery Order created successfully
              </h4>
              <p className="text-xs font-bold text-gray-200 max-w-xs mx-auto leading-relaxed">
                The Seller will get in touch to finalize delivery
              </p>
            </div>
            <button
              onClick={() => {
                onClose();
                navigate('/deals');
              }}
              className="w-full btn-neon py-3.5 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer mt-2"
            >
              <Zap size={14} /> Track Delivery Order in Markets
            </button>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4 overflow-y-auto custom-scrollbar pr-2">
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1">
                Full Name <span className="text-red-400">*</span>
              </label>
              <input required type="text" placeholder="Full Name" value={formData.name} onChange={e => setFormData({ ...formData, name: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-bold" />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1">
                Phone Number <span className="text-red-400">*</span>
              </label>
              <input required type="tel" placeholder="Phone Number (+263...)" value={formData.phone} onChange={e => setFormData({ ...formData, phone: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-mono" />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
                Email Address <span className="text-gray-500 font-normal">(Optional)</span>
              </label>
              <input type="email" placeholder="your.email@example.com" value={formData.email} onChange={e => setFormData({ ...formData, email: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-medium" />
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
              <label className="text-[10px] font-black text-gray-300 uppercase tracking-widest ml-1">
                Delivery Address <span className="text-red-400">*</span>
              </label>
              <textarea required placeholder="Enter complete physical delivery address" value={formData.address} onChange={e => setFormData({ ...formData, address: e.target.value })} className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-xs outline-none focus:border-primary/50 transition-all font-medium" rows={3} />
            </div>

            <div className="pt-2">
              <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-[0.25em] shadow-xl shadow-primary/20 cursor-pointer">
                {submitting ? <Loader2 className="animate-spin" size={18} /> : 'Finalize Delivery Order'}
              </button>
              <LegalDisclaimerNotice />
            </div>
          </form>
        )}
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
  const initialContact = getSavedGuestContact(profile);
  const [guestName, setGuestName] = useState(initialContact.name);
  const [guestPhone, setGuestPhone] = useState(initialContact.phone);
  const [guestEmail, setGuestEmail] = useState(initialContact.email);
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
    setSubmitting(true);
    saveGuestContact({ name: guestName, phone: guestPhone, email: guestEmail });

    const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const guestId = profile?.uid || `guest_${Date.now()}`;

    const dealData: Deal = {
      id: dealId,
      customerId: guestId,
      customerName: guestName,
      customerPhone: guestPhone,
      customerEmail: guestEmail,
      supplierId: product.ownerId,
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      quantity: quantity,
      agreedPrice: product.price * quantity,
      status: 'confirmed',
      trackingStage: 'Order Confirmed',
      paymentMethod: 'bank',
      isGuestOrder: !profile,
      history: [{ stage: 'Order Confirmed', status: 'confirmed', timestamp: new Date().toISOString(), updatedBy: guestName || 'Customer' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await offlineResilientWrite('deals', dealId, 'create', dealData);
      const existing = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      localStorage.setItem('guest_deal_ids', JSON.stringify([...existing, dealId]));

      await interactionService.sendNotification(product.ownerId, 'buy', buildUserProfileForNotification(profile, guestId, guestName, guestPhone, guestEmail), product.id);

      const orderMsg = `🏦 BANK TRANSFER ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n\n` +
        `• BUYER: ${guestName} (${guestPhone})`;

      startConversation(product.ownerId, orderMsg).catch(console.error);

      setSuccess(true);
      setTimeout(() => {
        onClose();
        navigate(`/deals`);
      }, 1500);
    } catch (e) {
      console.error(e);
      setSuccess(true);
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
            <p className="text-[10px] text-gray-400">Bank deposit instructions logged for tracking.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-1">
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">{product.name} (x{quantity})</p>
              <p className="text-lg font-black text-primary">{formatCurrency(product.price * quantity, product.currency)}</p>
            </div>

            <GuestContactFields 
              name={guestName} 
              setName={setGuestName} 
              phone={guestPhone} 
              setPhone={setGuestPhone} 
              email={guestEmail} 
              setEmail={setGuestEmail} 
            />

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

            <div className="space-y-2">
              <button type="submit" disabled={submitting} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
                {submitting ? <Loader2 className="animate-spin" size={14} /> : <Landmark size={14} />} Confirm Bank Deposit & Notify Supplier
              </button>
              <LegalDisclaimerNotice />
            </div>
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
  const initialContact = getSavedGuestContact(profile);
  const [guestName, setGuestName] = useState(initialContact.name);
  const [guestPhone, setGuestPhone] = useState(initialContact.phone);
  const [guestEmail, setGuestEmail] = useState(initialContact.email);
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
    saveGuestContact({ name: guestName, phone: guestPhone, email: guestEmail });

    const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    const guestId = profile?.uid || `guest_${Date.now()}`;

    const dealData: Deal = {
      id: dealId,
      customerId: guestId,
      customerName: guestName,
      customerPhone: guestPhone,
      customerEmail: guestEmail,
      supplierId: product.ownerId,
      productId: product.id,
      productName: product.name,
      productImage: product.images?.[0] || '',
      quantity: quantity,
      agreedPrice: product.price * quantity,
      status: 'confirmed',
      trackingStage: 'Order Confirmed',
      paymentMethod: 'paynow',
      isGuestOrder: !profile,
      history: [{ stage: 'Order Confirmed', status: 'confirmed', timestamp: new Date().toISOString(), updatedBy: guestName || 'Customer' }],
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };

    try {
      await offlineResilientWrite('deals', dealId, 'create', dealData);
      const existing = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      localStorage.setItem('guest_deal_ids', JSON.stringify([...existing, dealId]));

      await interactionService.sendNotification(product.ownerId, 'buy', buildUserProfileForNotification(profile, guestId, guestName, guestPhone, guestEmail), product.id);

      const orderMsg = `💳 PAYNOW ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * quantity, product.currency)}\n` +
        `• BUYER: ${guestName} (${guestPhone})`;

      startConversation(product.ownerId, orderMsg).catch(console.error);

      if (paynowDetail.startsWith('http://') || paynowDetail.startsWith('https://')) {
        window.open(paynowDetail, '_blank');
      }
      onClose();
      navigate(`/deals`);
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

        <GuestContactFields 
          name={guestName} 
          setName={setGuestName} 
          phone={guestPhone} 
          setPhone={setGuestPhone} 
          email={guestEmail} 
          setEmail={setGuestEmail} 
        />

        <div className="space-y-2">
          <button onClick={handlePaynowAction} disabled={loading} className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 cursor-pointer">
            {loading ? <Loader2 className="animate-spin" size={14} /> : <ExternalLink size={14} />} Launch Paynow Checkout
          </button>
          <LegalDisclaimerNotice />
        </div>
      </motion.div>
    </div>
  );
}
