import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Zap, Clock, CheckCircle2, ChevronRight, DollarSign, MessageCircle, AlertCircle, ShoppingCart, Loader2, Sparkles, MessageSquare, ShoppingBag } from 'lucide-react';
import { UserProfile, Deal, DealStatus, Product, Engagement } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, where, getDocs, addDoc, serverTimestamp, doc, getDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { offlineResilientWrite } from '../lib/sync';

export default function DealRoom({ profile }: { profile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'buying' | 'selling' | 'notifications'>('buying');
  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const location = useLocation();
  const navigate = useNavigate();

  useEffect(() => {
    if (!profile) return;
    setLoading(true);

    let unsubscribeDeals = () => {};
    let unsubscribeEngagements = () => {};

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

    return () => {
      unsubscribeDeals();
      unsubscribeEngagements();
    };
  }, [profile, activeTab]);

  useEffect(() => {
    const searchParams = new URLSearchParams(location.search);
    const productId = searchParams.get('productId');
    const action = searchParams.get('action');

    if (productId && action === 'checkout' && profile) {
      const initializeDeal = async () => {
        try {
          const productSnap = await getDoc(doc(db, 'products', productId));
          if (!productSnap.exists()) return;
          const productData = productSnap.data() as Product;

          // Check if dual already exists
          const existingQ = query(
            collection(db, 'deals'),
            where('customerId', '==', profile.uid),
            where('productId', '==', productId),
            where('status', 'in', ['pending', 'quoted', 'accepted'])
          );
          const existingSnap = await getDocs(existingQ);
          
          if (existingSnap.empty) {
            // Create new deal
            const dealId = `deal_${Date.now()}_${Math.random().toString(36).substring(7)}`;
            await offlineResilientWrite('deals', dealId, 'create', {
              customerId: profile.uid,
              supplierId: productData.ownerId,
              productId: productId,
              status: 'pending',
              agreedPrice: productData.price,
              updatedAt: new Date().toISOString(),
              createdAt: new Date().toISOString()
            });
            // Refresh
            navigate('/deals', { replace: true });
          } else {
            // Already exists, just clear params
            navigate('/deals', { replace: true });
          }
        } catch (error) {
          console.error("Error initializing deal:", error);
        }
      };
      initializeDeal();
    }
  }, [location.search, profile, navigate]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8"
    >
      <header className="space-y-1">
        <div className="flex items-center gap-2">
          <Zap size={24} className="text-primary" />
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Market Control</h2>
        </div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Neural Transaction Layer</p>
      </header>

      {/* Role Switcher in Tabs */}
      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner backdrop-blur-md">
        <button 
          onClick={() => setActiveTab('buying')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2",
            activeTab === 'buying' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <ShoppingCart size={14} />
          Incoming
        </button>
        <button 
          onClick={() => setActiveTab('selling')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2",
            activeTab === 'selling' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          <Zap size={14} />
          Outbound
        </button>
        {profile?.currentRole === 'supplier' && (
          <button 
            onClick={() => setActiveTab('notifications')}
            className={cn(
              "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative",
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
      </div>

      <div className="space-y-6">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Saving changes...</p>
          </div>
        ) : activeTab === 'notifications' ? (
          engagements.length > 0 ? (
            engagements.map((eng) => (
              <EngagementCard key={eng.id} engagement={eng} />
            ))
          ) : (
            <div className="py-20 flex flex-col items-center text-center space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-700">
                <Sparkles size={32} />
              </div>
              <p className="text-white font-black uppercase tracking-widest text-xs">No active engagement signals</p>
              <p className="text-[10px] text-gray-500">Your supply nodes are currently waiting for uplink.</p>
            </div>
          )
        ) : deals.length > 0 ? (
          deals.map((deal) => (
            <DealCard key={deal.id} deal={deal} />
          ))
        ) : (
          <div className="py-20 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-700">
              <Clock size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-white font-black uppercase tracking-widest text-xs">No active transmissions</p>
              <p className="text-[10px] text-gray-500">Initialize a shop action in the discovery hub.</p>
            </div>
            <button 
              onClick={() => navigate('/')}
              className="px-6 py-2.5 bg-primary/10 border border-primary/20 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/20 transition-all"
            >
              Scan Hub
            </button>
          </div>
        )}
      </div>

      {/* EcoCash Integration Mock Tip */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="bg-accent/5 border border-accent/20 p-5 rounded-2xl flex items-start gap-4 relative overflow-hidden group cursor-pointer shadow-lg shadow-accent/5"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 blur-3xl -mr-12 -mt-12 group-hover:bg-accent/20 transition-colors"></div>
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(240,147,251,0.4)] shrink-0">
          <DollarSign size={20} />
        </div>
        <div className="relative z-10">
          <h4 className="text-xs font-black text-accent uppercase tracking-widest">Instant Settlement Enabled</h4>
          <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-1">
            Settlement via <span className="text-white font-bold italic">EcoCash & InnBucks</span> is now live. Complete deals up to $5,000 instantly.
          </p>
        </div>
      </motion.div>
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
            <span className="text-[7px] text-gray-600 font-bold uppercase tracking-widest">
              {engagement.createdAt?.seconds ? new Date(engagement.createdAt.seconds * 1000).toLocaleTimeString() : 'RECENT'}
            </span>
          </div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-primary transition-colors">
            <span className="text-primary italic">{engagement.customerName}</span> 
            {isEngaged ? ' engaged you on ' : ' interested to buy '}
            <span className="text-white italic">{engagement.productName}</span>
          </h4>
          <p className="text-[9px] text-gray-500 font-medium">Node Interaction detected in real-time matrix feed.</p>
        </div>
      </div>
      <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-2 group-hover:bg-primary group-hover:text-[#05070a] group-hover:border-primary transition-all">
        Open Signal <ChevronRight size={10} />
      </button>
    </motion.div>
  );
}

function DealCard({ deal }: { deal: Deal, key?: React.Key }) {
  const [product, setProduct] = useState<Product | null>(null);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchProduct = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'products', deal.productId));
        if (docSnap.exists()) {
          setProduct({ id: docSnap.id, ...docSnap.data() } as Product);
        }
      } catch (err) {
        console.error("Error fetching product for deal:", err);
      } finally {
        setLoading(false);
      }
    };
    fetchProduct();
  }, [deal.productId]);

  const statusConfig: Record<DealStatus, { color: string, glow: string, icon: any, label: string, border: string, shadow: string }> = {
    pending: { color: 'text-amber-400', glow: 'shadow-[0_0_10px_rgba(251,191,36,0.3)]', icon: Clock, label: 'ENQUIRED', border: 'rgba(251,191,36,0.4)', shadow: '0 0 20px rgba(251,191,36,0.1)' },
    quoted: { color: 'text-blue-400', glow: 'shadow-[0_0_10px_rgba(96,165,250,0.3)]', icon: DollarSign, label: 'QUOTED', border: 'rgba(96,165,250,0.4)', shadow: '0 0 20px rgba(96,165,250,0.1)' },
    accepted: { color: 'text-neon-green', glow: 'shadow-[0_0_10px_rgba(57,255,20,0.3)]', icon: CheckCircle2, label: 'ENGAGED', border: 'rgba(57,255,20,0.4)', shadow: '0 0 20px rgba(57,255,20,0.1)' },
    delivered: { color: 'text-primary', glow: 'shadow-[0_0_10px_rgba(0,242,254,0.3)]', icon: Zap, label: 'CLOSED', border: 'rgba(0,242,254,0.4)', shadow: '0 0 20px rgba(0,242,254,0.1)' },
    cancelled: { color: 'text-red-400', glow: 'shadow-[0_0_10px_rgba(248,113,113,0.3)]', icon: AlertCircle, label: 'ABORTED', border: 'rgba(248,113,113,0.4)', shadow: '0 0 20px rgba(248,113,113,0.1)' }
  };

  const config = statusConfig[deal.status];

  if (loading) return (
    <div className="neon-card h-40 animate-pulse bg-white/5" />
  );

  return (
    <motion.div 
      whileHover={{ 
        y: -4, 
        scale: 1.01,
        borderColor: config.border,
        boxShadow: config.shadow
      }}
      onClick={() => product && navigate(`/product/${product.id}`, { state: { product } })}
      transition={{ duration: 0.3, ease: "easeOut" }}
      className="neon-card p-5 space-y-6 cursor-pointer relative group overflow-hidden border border-white/5"
    >
      <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-primary/10 transition-colors"></div>
      
      <div className="flex justify-between items-start relative z-10">
        <div className="flex gap-4">
          <div className="w-16 h-16 bg-white/5 rounded-2xl border border-white/10 overflow-hidden shrink-0 shadow-inner group-hover:border-primary/30 transition-colors">
            <img 
              src={product?.images?.[0] || 'https://images.unsplash.com/photo-1540350394557-8ae14678e7f91?w=200&q=80'} 
              alt="Thumbnail" 
              className="w-full h-full object-cover group-hover:scale-125 transition-transform duration-1000 ease-out" 
              referrerPolicy="no-referrer"
              onError={(e) => {
                const target = e.target as HTMLImageElement;
                target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
              }}
            />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-white uppercase tracking-tight text-base group-hover:text-primary transition-colors line-clamp-1">
              {product?.name || 'Unknown Entity'}
            </h4>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Protocol Index:</span>
              <span className="text-[9px] text-primary font-mono font-bold tracking-widest truncate max-w-[80px]">{deal.id.substring(0, 8).toUpperCase()}</span>
            </div>
            <div className="flex items-center gap-1.5 mt-1">
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full"></div>
              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">Signal Locked</p>
            </div>
          </div>
        </div>
        <div className={cn(
          "px-3 py-1.5 rounded-xl text-[8px] font-black flex items-center gap-1.5 uppercase tracking-widest border border-white/5 bg-[#05070a]/60 backdrop-blur-md", 
          config.color, 
          config.glow
        )}>
          <config.icon size={10} />
          {config.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-4 p-4 bg-black/40 rounded-2xl border border-white/5 relative z-10 hover:border-white/10 transition-colors">
        <div className="space-y-1">
          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest ml-1">Asset Value</p>
          <p className="text-xl font-black text-white tracking-tighter italic">
            {formatCurrency(deal.agreedPrice, product?.currency || 'USD')}
          </p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest mr-1">Last Handshake</p>
          <div className="flex items-center justify-end gap-1.5">
            <Clock size={10} className="text-primary" />
            <p className="text-[9px] font-bold text-gray-400 italic">Recently Synchronized</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3 relative z-10">
        <button 
          onClick={() => window.location.href = `/chat?supplierId=${deal.supplierId}&dealId=${deal.id}`}
          className="flex-[2] py-3 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 hover:border-primary/30 transition-all"
        >
          <MessageCircle size={14} className="text-primary" /> Negotiate
        </button>
        <button className="flex-1 py-3 bg-primary rounded-xl flex items-center justify-center text-[10px] font-black uppercase tracking-widest text-[#05070a] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all">
          Settle
        </button>
      </div>
    </motion.div>
  );
}
