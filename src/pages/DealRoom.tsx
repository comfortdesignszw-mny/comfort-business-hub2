import OrderTimeline from "../components/OrderTimeline";
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Clock, CheckCircle2, ChevronRight, DollarSign, MessageCircle, AlertCircle, ShoppingCart, Loader2, Sparkles, MessageSquare, ShoppingBag, Truck, UserCheck, Search, ShieldCheck, FileText, Send } from 'lucide-react';
import { UserProfile, Deal, DealStatus, Product, Engagement, DealHistoryItem } from '../types';
import { cn, formatCurrency, formatAuditableStamp, openWhatsApp } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { offlineResilientWrite } from '../lib/sync';
import { useNotifications } from '../components/NotificationProvider';

export default function DealRoom({ profile }: { profile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'selling' | 'notifications' | 'buying'>('selling');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestPhoneSearch, setGuestPhoneSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();
  const { activeOrdersCount, sellerOrdersCount, buyerOrdersCount } = useNotifications();

  useEffect(() => {
    setLoading(true);
    let unsubscribeDeals = () => {};
    let unsubscribeEngagements = () => {};

    if (profile) {
      if (activeTab === 'notifications') {
        const q = query(
          collection(db, 'engagements'),
          where('supplierId', '==', profile.uid),
          orderBy('createdAt', 'desc')
        );
        unsubscribeEngagements = onSnapshot(q, (snapshot) => {
          setEngagements(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Engagement)));
          setDeals([]);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'engagements-stream');
          setLoading(false);
        });
      } else {
        const savedGuestIds: string[] = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
        const q = query(collection(db, 'deals'), orderBy('updatedAt', 'desc'));
        unsubscribeDeals = onSnapshot(q, (snapshot) => {
          const allDeals = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
          const filtered = allDeals.filter(d => {
            if (activeTab === 'selling') {
              // Unified "Sales and Buyer orders Tracking": includes store sales, supplier orders, guest orders, and buyer trackings
              return (
                d.supplierId === profile.uid ||
                d.customerId === profile.uid ||
                savedGuestIds.includes(d.id) ||
                d.isGuestOrder ||
                (profile.phone && d.customerPhone && d.customerPhone.includes(profile.phone)) ||
                (guestPhoneSearch && (d.customerPhone?.includes(guestPhoneSearch) || d.id.toLowerCase().includes(guestPhoneSearch.toLowerCase()) || d.productName?.toLowerCase().includes(guestPhoneSearch.toLowerCase())))
              );
            } else {
              return (
                d.customerId === profile.uid ||
                savedGuestIds.includes(d.id) ||
                (profile.phone && d.customerPhone && d.customerPhone.includes(profile.phone)) ||
                (guestPhoneSearch && (d.customerPhone?.includes(guestPhoneSearch) || d.id.toLowerCase().includes(guestPhoneSearch.toLowerCase()) || d.productName?.toLowerCase().includes(guestPhoneSearch.toLowerCase())))
              );
            }
          });
          setDeals(filtered);
          setEngagements([]);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'deals-stream');
          setLoading(false);
        });
      }
    } else {
      // Guest User Mode: Load local guest deals & phone search
      const savedGuestIds: string[] = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      const q = query(collection(db, 'deals'), orderBy('updatedAt', 'desc'));
      unsubscribeDeals = onSnapshot(q, (snapshot) => {
        const allDeals = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
        const filtered = allDeals.filter(d => 
          savedGuestIds.includes(d.id) || 
          d.isGuestOrder || 
          (guestPhoneSearch && (d.customerPhone?.includes(guestPhoneSearch) || d.id.toLowerCase().includes(guestPhoneSearch.toLowerCase()) || d.productName?.toLowerCase().includes(guestPhoneSearch.toLowerCase())))
        );
        setDeals(filtered);
        setEngagements([]);
        setLoading(false);
      }, (err) => {
        console.error("Guest deals error:", err);
        setLoading(false);
      });
    }

    return () => {
      unsubscribeDeals();
      unsubscribeEngagements();
    };
  }, [profile, activeTab, guestPhoneSearch]);

  const handleUpdateStage = async (dealId: string, stage: string, currentHistory: DealHistoryItem[] = []) => {
    const stageToStatus: Record<string, DealStatus> = {
      'Order Confirmed': 'confirmed',
      'Order being prepared': 'preparing',
      'Order in Transit': 'in_transit',
      'Order Delivered!': 'delivered'
    };

    const now = new Date().toISOString();
    const newHistoryItem: DealHistoryItem = {
      stage,
      status: stageToStatus[stage] || 'confirmed',
      timestamp: now,
      updatedBy: profile?.name || (profile?.currentRole === 'supplier' ? 'Supplier' : 'User')
    };

    const updatedHistory = [...currentHistory.filter(h => h.stage !== stage), newHistoryItem];

    try {
      await updateDoc(doc(db, 'deals', dealId), {
        trackingStage: stage,
        status: stageToStatus[stage] || 'confirmed',
        history: updatedHistory,
        updatedAt: now
      });
    } catch (e) {
      console.error("Error updating stage:", e);
    }
  };

  const handleConfirmDelivery = async (dealId: string, currentHistory: DealHistoryItem[] = []) => {
    const now = new Date().toISOString();
    const newHistoryItem: DealHistoryItem = {
      stage: 'Delivered Confirmed',
      status: 'won',
      timestamp: now,
      updatedBy: profile?.name || 'Buyer'
    };

    const updatedHistory = [...currentHistory, newHistoryItem];

    try {
      await updateDoc(doc(db, 'deals', dealId), {
        status: 'won',
        trackingStage: 'Delivered Confirmed',
        buyerConfirmedDelivery: true,
        history: updatedHistory,
        updatedAt: now
      });
    } catch (e) {
      console.error("Error confirming delivery:", e);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8 max-w-4xl mx-auto"
    >
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-primary" />
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Market & Order Control</h2>
        </div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Real-Time Delivery & Transaction Management</p>
      </header>

      {/* Guest Phone / Order ID Lookup bar if guest user */}
      {!profile && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-black text-primary uppercase tracking-widest">
            Guest Order Lookup & Tracker
          </p>
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Search className="absolute left-3.5 top-3 text-gray-500" size={14} />
              <input 
                type="text" 
                value={guestPhoneSearch} 
                onChange={e => setGuestPhoneSearch(e.target.value)}
                placeholder="Search by Phone Number or Order ID..." 
                className="w-full bg-black/40 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs outline-none focus:border-primary/50"
              />
            </div>
          </div>
        </div>
      )}

      {/* Role Switcher Tabs */}
      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
        {/* Section 1: Sales and Buyer orders Tracking (Starts First) */}
        <button 
          onClick={() => setActiveTab('selling')}
          className={cn(
            "flex-1 py-3 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative cursor-pointer",
            activeTab === 'selling' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Zap size={14} />
          <span className="truncate">Sales and Buyer orders Tracking</span>
          {(profile?.currentRole === 'supplier' ? (sellerOrdersCount || activeOrdersCount) : activeOrdersCount) > 0 && (
            <span className="min-w-[18px] h-[18px] px-1 bg-red-600 rounded-full border border-[#05070a] flex items-center justify-center text-[9px] font-black text-white shadow-[0_0_10px_rgba(255,0,0,0.6)] animate-pulse shrink-0">
              {profile?.currentRole === 'supplier' ? (sellerOrdersCount || activeOrdersCount) : activeOrdersCount}
            </span>
          )}
        </button>

        {/* Section 2: Network Feed */}
        {profile?.currentRole === 'supplier' && (
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "flex-1 py-3 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative cursor-pointer",
              activeTab === 'notifications' ? "bg-accent text-white shadow-[0_0_15px_rgba(240,147,251,0.3)]" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Sparkles size={14} />
            <span className="truncate">Network Feed</span>
            {engagements.length > 0 && activeTab !== 'notifications' && (
              <span className="w-2 h-2 bg-red-500 rounded-full animate-ping shrink-0"></span>
            )}
          </button>
        )}

        {/* Section 3: Buyer Orders */}
        <button 
          onClick={() => setActiveTab('buying')}
          className={cn(
            "flex-1 py-3 px-2 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative cursor-pointer",
            activeTab === 'buying' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <ShoppingCart size={14} />
          <span className="truncate">Buyer Orders</span>
          {buyerOrdersCount > 0 && (
            <span className="min-w-[16px] h-[16px] px-1 bg-red-600/80 rounded-full flex items-center justify-center text-[8px] font-black text-white shrink-0">
              {buyerOrdersCount}
            </span>
          )}
        </button>
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Syncing orders...</p>
          </div>
        ) : activeTab === 'notifications' ? (
          engagements.length > 0 ? (
            engagements.map((eng, idx) => (
              <EngagementCard key={`eng-${eng.id || idx}-${idx}`} engagement={eng} />
            ))
          ) : (
            <div className="py-20 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-700">
                <Sparkles size={32} />
              </div>
              <p className="text-white font-black uppercase tracking-widest text-xs">No active engagement signals</p>
              <p className="text-[10px] text-gray-500">You have no incoming orders yet.</p>
            </div>
          )
        ) : deals.length > 0 ? (
          deals.map((deal, idx) => (
            <DealCard 
              key={`deal-${deal.id || idx}-${idx}`} 
              deal={deal} 
              profile={profile}
              onUpdateStage={handleUpdateStage}
              onConfirmDelivery={handleConfirmDelivery}
            />
          ))
        ) : (
          <div className="py-20 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-700">
              <Clock size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-white font-black uppercase tracking-widest text-xs">No active order transmissions</p>
              <p className="text-[10px] text-gray-500">Browse products in Explore to place an order or track delivery.</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all cursor-pointer"
            >
              Scan Hub Products
            </button>
          </div>
        )}
      </div>
    </motion.div>
  );
}

function EngagementCard({ engagement }: { engagement: Engagement, key?: React.Key }) {
  const navigate = useNavigate();
  const isEngaged = engagement.type === 'engaged';
  
  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={cn(
        "neon-card p-5 border-l-4 flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group transition-all",
        isEngaged ? "border-l-primary bg-primary/5" : "border-l-accent bg-accent/5"
      )}
      onClick={() => navigate(`/chat?id=${[engagement.customerId, engagement.supplierId].sort().join('_')}`)}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
          isEngaged ? "bg-primary/20 text-primary shadow-[0_0_15px_rgba(0,242,254,0.2)]" : "bg-accent/20 text-accent shadow-[0_0_15px_rgba(240,147,251,0.2)]"
        )}>
          {isEngaged ? <MessageSquare size={20} /> : <ShoppingBag size={20} />}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded border shadow-sm",
              isEngaged ? "bg-primary/10 border-primary/20 text-primary" : "bg-accent/10 border-accent/20 text-accent"
            )}>
              {isEngaged ? 'Engaged' : 'Interested to Buy'}
            </span>
            <span className="text-[7.5px] font-mono text-primary/80 font-bold uppercase tracking-wider">
              {formatAuditableStamp(engagement.createdAt)}
            </span>
          </div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-primary transition-colors">
            <span className="text-primary italic">{engagement.customerName}</span> 
            {isEngaged ? ' engaged you on ' : ' interested to buy '}
            <span className="text-white italic">{engagement.productName}</span>
          </h4>
          <p className="text-[9px] text-gray-500 font-medium">Customer has shown interest.</p>
        </div>
      </div>
      <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:bg-primary group-hover:text-[#05070a] group-hover:border-primary transition-all">
        View Details <ChevronRight size={10} />
      </button>
    </motion.div>
  );
}

function DealCard({ 
  deal, 
  profile,
  onUpdateStage,
  onConfirmDelivery
}: { 
  deal: Deal; 
  profile: UserProfile | null;
  onUpdateStage: (dealId: string, stage: string, currentHistory?: DealHistoryItem[]) => void;
  onConfirmDelivery: (dealId: string, currentHistory?: DealHistoryItem[]) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [popInput, setPopInput] = useState<string>('');
  const [submittingPop, setSubmittingPop] = useState<boolean>(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        if (deal.productId) {
          const docSnap = await getDoc(doc(db, 'products', deal.productId));
          if (docSnap.exists()) {
            setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
          }
        }
      } catch (err) {
        console.error("Error fetching product for deal:", err);
      }
    };
    const fetchSupplierPhone = async () => {
      try {
        if (deal.supplierId) {
          const userSnap = await getDoc(doc(db, 'public_profiles', deal.supplierId));
          if (userSnap.exists()) {
            const data = userSnap.data();
            setSupplierPhone(data.whatsappNumber || data.phone || data.phoneNumber || '');
          }
        }
      } catch (err) {
        console.error("Error fetching supplier phone:", err);
      }
    };
    fetchProduct();
    fetchSupplierPhone();
  }, [deal.productId, deal.supplierId]);

  const isSupplier = profile?.uid === deal.supplierId || profile?.currentRole === 'supplier';
  const isPOD = deal.paymentMethod === 'pod';
  const isDeliveredStage = (deal.trackingStage === 'Order Delivered!') || deal.status === 'delivered';
  const isWon = deal.status === 'won' || deal.buyerConfirmedDelivery;

  const handleWirePaymentWhatsApp = () => {
    const buyerName = deal.customerName || 'Customer';
    const totalAmount = deal.agreedPrice;
    const messageText = `🛒 *SALES ORDER PAYMENT INFO*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Order ID:* ${deal.id}\n` +
      `• *Buyer Name:* ${buyerName}\n` +
      `• *Buyer Phone:* ${deal.customerPhone || 'N/A'}\n` +
      `• *Buyer Email:* ${deal.customerEmail || 'N/A'}\n` +
      `• *Product/Service:* ${deal.productName || product?.name || 'Item'} (x${deal.quantity || 1})\n` +
      `• *Total Purchase:* ${formatCurrency(totalAmount, product?.currency || 'USD')}\n` +
      `• *Payment System:* ${(deal.paymentMethod || 'Non-POD').toUpperCase()}\n` +
      `• *Date:* ${formatAuditableStamp(deal.createdAt)}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Status:* Sales Order logged in Deal Room. Please confirm processing.`;

    if (supplierPhone) {
      openWhatsApp(supplierPhone, messageText);
    } else {
      navigator.clipboard.writeText(messageText);
      alert('Payment info copied to clipboard!');
    }
  };

  const handleSubmitPopInDeal = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!popInput.trim()) return;
    setSubmittingPop(true);

    try {
      const updatedDeal: Deal = {
        ...deal,
        popReference: popInput.trim(),
        popStatus: 'submitted',
        updatedAt: new Date().toISOString(),
        history: [
          ...(deal.history || []),
          {
            stage: 'POP Submitted',
            status: 'confirmed',
            timestamp: new Date().toISOString(),
            updatedBy: deal.customerName || 'Customer',
            note: `Proof of payment submitted: ${popInput.trim()}`
          }
        ]
      };

      await offlineResilientWrite('deals', deal.id, 'update', updatedDeal);
      setPopInput('');
    } catch (err) {
      console.error("POP submission error in DealCard:", err);
    } finally {
      setSubmittingPop(false);
    }
  };

  const handleVerifyPopBySupplier = async () => {
    try {
      const updatedDeal: Deal = {
        ...deal,
        popStatus: 'verified',
        updatedAt: new Date().toISOString(),
        history: [
          ...(deal.history || []),
          {
            stage: 'POP Verified',
            status: 'confirmed',
            timestamp: new Date().toISOString(),
            updatedBy: profile?.name || 'Supplier',
            note: `Supplier verified Proof of Payment: ${deal.popReference}`
          }
        ]
      };

      await offlineResilientWrite('deals', deal.id, 'update', updatedDeal);
    } catch (err) {
      console.error("POP verification error:", err);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="neon-card p-5 space-y-5 relative group overflow-hidden border border-white/10 bg-[#070a0f]"
    >
      <div className="flex justify-between items-start gap-4">
        <div className="flex gap-4">
          <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 overflow-hidden shrink-0 shadow-inner">
            <img 
              src={deal.productImage || product?.images?.[0] || 'https://images.unsplash.com/photo-1540350394557-8ae14678e7f91?w=200&q=80'} 
              alt="Thumbnail" 
              className="w-full h-full object-cover" 
              referrerPolicy="no-referrer"
            />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-white uppercase tracking-tight text-base line-clamp-1">
              {deal.productName || product?.name || 'Order Item'}
            </h4>
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Order ID:</span>
              <span className="text-[9px] text-primary font-mono font-bold tracking-widest">{deal.id.substring(0, 10).toUpperCase()}</span>
              <span className="text-[8px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded border border-white/10">
                {formatAuditableStamp(deal.createdAt)}
              </span>
            </div>
            {deal.customerName && (
              <p className="text-[10px] text-gray-400 font-bold">
                Customer: <span className="text-white">{deal.customerName}</span> ({deal.customerPhone})
              </p>
            )}
            {deal.deliveryAddress && (
              <p className="text-[10px] text-gray-400 font-medium line-clamp-1">
                📍 Delivery Address: <span className="text-gray-200">{deal.deliveryAddress}</span>
              </p>
            )}
          </div>
        </div>

        <div className="text-right space-y-1 shrink-0">
          <p className="text-lg font-black text-primary italic">
            {formatCurrency(deal.agreedPrice, product?.currency || 'USD')}
          </p>
          <span className={cn(
            "text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded border block",
            isPOD ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-primary/20 text-primary border-primary/30"
          )}>
            {deal.paymentMethod ? deal.paymentMethod.toUpperCase() : 'PAYMENT'}
          </span>
        </div>
      </div>

      {/* Non-POD Sales Order Payment Info & Proof of Payment (POP) Box */}
      {!isPOD && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Zap size={12} /> Non-POD Sales Order Payment Info
            </span>
            <span className="text-[9px] font-mono text-gray-400 uppercase">
              System: {deal.paymentMethod ? deal.paymentMethod.toUpperCase() : 'DIRECT'}
            </span>
          </div>

          <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 text-xs">
            <div>
              <p className="text-[8.5px] text-gray-400 font-bold uppercase">Buyer Name</p>
              <p className="font-bold text-white text-[11px]">{deal.customerName || 'Customer'}</p>
            </div>
            <div>
              <p className="text-[8.5px] text-gray-400 font-bold uppercase">Phone Number</p>
              <p className="font-mono font-bold text-gray-200 text-[11px]">{deal.customerPhone || 'N/A'}</p>
            </div>
            <div>
              <p className="text-[8.5px] text-gray-400 font-bold uppercase">Total Purchase</p>
              <p className="font-black text-primary text-[11px]">{formatCurrency(deal.agreedPrice, product?.currency || 'USD')}</p>
            </div>
          </div>

          {/* WhatsApp Wire Button */}
          <button
            onClick={handleWirePaymentWhatsApp}
            className="w-full bg-emerald-600/90 hover:bg-emerald-500 text-white py-2.5 px-3 rounded-xl text-[9.5px] font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all cursor-pointer shadow-md"
          >
            <MessageCircle size={14} /> Wire Sales Payment Info on WhatsApp
          </button>

          {/* Proof of Payment (POP) State */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
              <FileText size={12} /> Proof of Payment (POP) Status
            </p>

            {deal.popReference ? (
              <div className="bg-amber-500/10 border border-amber-500/30 rounded-xl p-3 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                <div>
                  <p className="text-[10px] font-mono font-bold text-white">
                    Ref / Code: <span className="text-amber-300 font-black">{deal.popReference}</span>
                  </p>
                  <p className="text-[9px] text-gray-400">
                    Status: {deal.popStatus === 'verified' ? (
                      <span className="text-emerald-400 font-black">Verified by Supplier ✓</span>
                    ) : (
                      <span className="text-amber-400 font-bold">Awaiting Supplier Verification</span>
                    )}
                  </p>
                </div>

                {isSupplier && deal.popStatus !== 'verified' && (
                  <button
                    onClick={handleVerifyPopBySupplier}
                    className="bg-emerald-500 hover:bg-emerald-400 text-black px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                  >
                    <CheckCircle2 size={12} /> Verify POP & Conclude Sale
                  </button>
                )}
              </div>
            ) : (
              <form onSubmit={handleSubmitPopInDeal} className="flex gap-2">
                <input
                  type="text"
                  required
                  value={popInput}
                  onChange={e => setPopInput(e.target.value)}
                  placeholder="Enter POP Ref / Transaction Code (e.g. EC12345678)"
                  className="flex-1 bg-black/50 border border-white/10 rounded-xl px-3 py-1.5 text-white text-xs font-mono outline-none focus:border-amber-400"
                />
                <button
                  type="submit"
                  disabled={submittingPop}
                  className="bg-amber-500 hover:bg-amber-400 text-black px-3 py-1.5 rounded-xl font-black text-[9px] uppercase tracking-wider flex items-center gap-1 cursor-pointer shrink-0"
                >
                  {submittingPop ? <Loader2 className="animate-spin" size={12} /> : <Send size={12} />} Submit POP
                </button>
              </form>
            )}
          </div>
        </div>
      )}

      {/* Visual 4-Stage Tracker Timeline with Timestamps (Active for POD orders as required) */}
      <div className="pt-2">
        <OrderTimeline 
          status={deal.status} 
          trackingStage={deal.trackingStage} 
          createdAt={deal.createdAt}
          updatedAt={deal.updatedAt}
          history={deal.history}
        />
      </div>

      {/* Toggle Timestamp & History Audit Drawer */}
      <div className="pt-1">
        <button 
          onClick={() => setShowTimestamps(!showTimestamps)}
          className="text-[9px] font-black uppercase tracking-wider text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
        >
          <Clock size={12} />
          {showTimestamps ? 'Hide Transaction Timeline Audit' : 'View Order Transaction Dates & Timestamps Log'}
        </button>

        {showTimestamps && (
          <div className="mt-2.5 bg-black/60 border border-white/10 rounded-xl p-3.5 space-y-2 text-[9.5px]">
            <p className="text-[9px] font-black uppercase tracking-widest text-primary border-b border-white/10 pb-1 flex items-center gap-1.5">
              <Clock size={11} /> Auditable Transaction Timestamps Log
            </p>
            <div className="space-y-1.5">
              <div className="flex justify-between items-center text-gray-300">
                <span className="font-bold text-gray-400">Order Initiated:</span>
                <span className="font-mono text-primary">{formatAuditableStamp(deal.createdAt)}</span>
              </div>
              <div className="flex justify-between items-center text-gray-300">
                <span className="font-bold text-gray-400">Last Status Sync:</span>
                <span className="font-mono text-gray-300">{formatAuditableStamp(deal.updatedAt)}</span>
              </div>
              {deal.history && deal.history.length > 0 && (
                <div className="pt-2 border-t border-white/5 space-y-1">
                  <p className="font-bold text-gray-400 uppercase tracking-wider text-[8.5px]">Stage Progress History:</p>
                  {deal.history.map((h, i) => (
                    <div key={i} className="flex justify-between items-center bg-white/5 px-2.5 py-1 rounded text-[8.5px]">
                      <span className="font-black text-white uppercase">{h.stage}</span>
                      <span className="font-mono text-gray-400">{formatAuditableStamp(h.timestamp)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Supplier Toggle Control Buttons (4 Visible Stages for POD and Order Control) */}
      {isSupplier && (
        <div className="space-y-2 pt-3 border-t border-white/10">
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">
            Supplier Delivery Order Stage Control:
          </p>
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            {[
              'Order Confirmed',
              'Order being prepared',
              'Order in Transit',
              'Order Delivered!'
            ].map((stage) => {
              const active = (deal.trackingStage || 'Order Confirmed') === stage;
              return (
                <button
                  key={stage}
                  onClick={() => onUpdateStage(deal.id, stage, deal.history || [])}
                  className={cn(
                    "py-2 px-2.5 rounded-xl text-[9px] font-black uppercase tracking-wider border transition-all cursor-pointer flex items-center justify-center gap-1",
                    active
                      ? "bg-primary text-black border-primary shadow-[0_0_12px_rgba(0,242,254,0.4)] scale-102 font-black"
                      : "bg-white/5 border-white/10 text-gray-400 hover:text-white hover:bg-white/10"
                  )}
                >
                  {active && <CheckCircle2 size={11} />}
                  {stage}
                </button>
              );
            })}
          </div>
        </div>
      )}

      {/* Buyer Delivery Confirmation Box */}
      {isWon ? (
        <div className="bg-emerald-500/20 border border-emerald-500/50 rounded-2xl p-4 text-center space-y-1 shadow-[0_0_25px_rgba(16,185,129,0.2)]">
          <p className="text-sm font-black text-emerald-400 uppercase tracking-widest flex items-center justify-center gap-2">
            <CheckCircle2 size={18} /> DEAL WON & SUCCESSFUL ✓
          </p>
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">
            Order delivery confirmed by Buyer. Transaction complete!
          </p>
        </div>
      ) : isDeliveredStage ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2.5 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-pulse">
          <p className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Truck size={16} /> Supplier Marked Order as Delivered!
          </p>
          <p className="text-[10px] text-gray-300 font-medium leading-relaxed">
            Please verify you received your order and click below to confirm.
          </p>
          <button
            onClick={() => onConfirmDelivery(deal.id, deal.history || [])}
            className="w-full bg-emerald-500 text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} /> Confirm Order Delivery & Finalize Deal
          </button>
        </div>
      ) : null}

      <div className="flex gap-3 pt-2 border-t border-white/5">
        <button 
          onClick={() => navigate(`/chat?supplierId=${deal.supplierId}&dealId=${deal.id}`)}
          className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 hover:border-primary/30 transition-all cursor-pointer"
        >
          <MessageCircle size={14} className="text-primary" /> Contact Seller / Comms
        </button>
      </div>
    </motion.div>
  );
}
