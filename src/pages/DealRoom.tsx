import OrderTimeline from "../components/OrderTimeline";
import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Clock, CheckCircle2, ChevronRight, DollarSign, MessageCircle, AlertCircle, ShoppingCart, Loader2, Sparkles, MessageSquare, ShoppingBag, Truck, UserCheck, Search, ShieldCheck } from 'lucide-react';
import { UserProfile, Deal, DealStatus, Product, Engagement } from '../types';
import { cn, formatCurrency, formatAuditableStamp } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, doc, getDoc, orderBy, onSnapshot, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { offlineResilientWrite } from '../lib/sync';

export default function DealRoom({ profile }: { profile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'buying' | 'selling' | 'notifications'>(profile?.currentRole === 'supplier' ? 'notifications' : 'buying');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestPhoneSearch, setGuestPhoneSearch] = useState('');
  const location = useLocation();
  const navigate = useNavigate();

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
        const q = query(
          collection(db, 'deals'),
          where(activeTab === 'buying' ? 'customerId' : 'supplierId', '==', profile.uid),
          orderBy('updatedAt', 'desc')
        );
        unsubscribeDeals = onSnapshot(q, (snapshot) => {
          setDeals(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Deal)));
          setEngagements([]);
          setLoading(false);
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'deals-stream');
          setLoading(false);
        });
      }
    } else {
      // Guest User Mode: Load local guest deals
      const savedGuestIds: string[] = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      const q = query(collection(db, 'deals'), orderBy('updatedAt', 'desc'));
      unsubscribeDeals = onSnapshot(q, (snapshot) => {
        const allDeals = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
        const filtered = allDeals.filter(d => 
          savedGuestIds.includes(d.id) || 
          d.isGuestOrder || 
          (guestPhoneSearch && (d.customerPhone?.includes(guestPhoneSearch) || d.id.toLowerCase().includes(guestPhoneSearch.toLowerCase())))
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

  const handleUpdateStage = async (dealId: string, stage: string) => {
    const stageToStatus: Record<string, DealStatus> = {
      'Order Confirmed': 'confirmed',
      'Order being prepared': 'preparing',
      'Order in Transit': 'in_transit',
      'Order Delivered!': 'delivered'
    };

    try {
      await updateDoc(doc(db, 'deals', dealId), {
        trackingStage: stage,
        status: stageToStatus[stage] || 'confirmed',
        updatedAt: new Date().toISOString()
      });
    } catch (e) {
      console.error("Error updating stage:", e);
    }
  };

  const handleConfirmDelivery = async (dealId: string) => {
    try {
      await updateDoc(doc(db, 'deals', dealId), {
        status: 'won',
        trackingStage: 'Delivered Confirmed',
        buyerConfirmedDelivery: true,
        updatedAt: new Date().toISOString()
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
        {profile?.currentRole === 'supplier' && (
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative cursor-pointer",
              activeTab === 'notifications' ? "bg-accent text-white shadow-[0_0_15px_rgba(240,147,251,0.3)]" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Sparkles size={14} />
            Network Feed
            {engagements.length > 0 && activeTab !== 'notifications' && (
              <span className="absolute top-2 right-2 w-2 h-2 bg-red-500 rounded-full animate-ping"></span>
            )}
          </button>
        )}
        <button 
          onClick={() => setActiveTab('buying')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
            activeTab === 'buying' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <ShoppingCart size={14} />
          {profile?.currentRole === 'supplier' ? 'Buyer Orders' : 'My Orders & Deliveries'}
        </button>
        {profile?.currentRole === 'supplier' && (
          <button 
            onClick={() => setActiveTab('selling')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 cursor-pointer",
              activeTab === 'selling' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
            )}
          >
            <Zap size={14} />
            Store Sales
          </button>
        )}
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
  onUpdateStage: (dealId: string, stage: string) => void;
  onConfirmDelivery: (dealId: string) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
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
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [deal.productId]);

  const isSupplier = profile?.uid === deal.supplierId || profile?.currentRole === 'supplier';
  const isDeliveredStage = (deal.trackingStage === 'Order Delivered!') || deal.status === 'delivered';
  const isWon = deal.status === 'won' || deal.buyerConfirmedDelivery;

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
          <span className="text-[9px] font-black uppercase tracking-widest px-2 py-0.5 rounded bg-white/5 border border-white/10 text-gray-300 block">
            {deal.paymentMethod ? deal.paymentMethod.toUpperCase() : 'PAYMENT'}
          </span>
        </div>
      </div>

      {/* Visual 4-Stage Tracker Timeline */}
      <div className="pt-2">
        <OrderTimeline status={deal.status} trackingStage={deal.trackingStage} />
      </div>

      {/* Supplier Toggle Control Buttons (4 Visible Stages) */}
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
                  onClick={() => onUpdateStage(deal.id, stage)}
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
            onClick={() => onConfirmDelivery(deal.id)}
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
