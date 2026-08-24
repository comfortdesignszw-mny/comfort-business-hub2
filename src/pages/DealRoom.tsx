import OrderTimeline from "../components/OrderTimeline";
import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Zap, 
  Clock, 
  CheckCircle2, 
  ChevronRight, 
  DollarSign, 
  MessageCircle, 
  AlertCircle, 
  ShoppingCart, 
  Loader2, 
  Sparkles, 
  MessageSquare, 
  ShoppingBag, 
  Truck, 
  ShieldCheck, 
  FileText, 
  Send,
  Search,
  Filter,
  ArrowUpRight,
  ArrowDownLeft,
  UserCheck,
  Tag,
  PackageCheck,
  RefreshCw,
  Eye,
  Building2,
  User
} from 'lucide-react';
import { UserProfile, Deal, DealStatus, Product, Engagement, DealHistoryItem } from '../types';
import { cn, formatCurrency, formatAuditableStamp, openWhatsApp } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { localDB } from '../lib/db';
import { cacheCollection } from '../lib/dexieSyncManager';
import { collection, query, where, getDocs, doc, getDoc, onSnapshot, updateDoc } from 'firebase/firestore';
import { useLocation, useNavigate } from 'react-router-dom';
import { offlineResilientWrite } from '../lib/sync';
import { useNotifications } from '../components/NotificationProvider';
import { POPForm, POPDisplay, POPAttachmentData } from '../components/PopAttachmentSection';

export default function DealRoom({ profile }: { profile: UserProfile | null }) {
  // Use Notification Context
  const { resetAllNotificationsAndTransactions } = useNotifications();
  const [resettingAlerts, setResettingAlerts] = useState(false);

  const handleResetAttentionCounters = async () => {
    setResettingAlerts(true);
    try {
      await resetAllNotificationsAndTransactions();
    } finally {
      setResettingAlerts(false);
    }
  };

  const handleUpdateDealLocally = (updatedDeal: Deal) => {
    setDeals(prev => prev.map(d => d.id === updatedDeal.id ? updatedDeal : d));
  };
  // 1. "Sales and Buyer Order Tracking" ('tracking')
  // 2. "Network Feed" ('feed')
  const [activeTab, setActiveTab] = useState<'tracking' | 'feed'>('tracking');
  
  // Tracking Sub-filters
  const [roleFilter, setRoleFilter] = useState<'all' | 'sales' | 'purchases'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'in_transit' | 'delivered'>('all');
  
  // Feed Sub-filters
  const [feedFilter, setFeedFilter] = useState<'all' | 'incoming' | 'outgoing'>('all');

  // Search filter
  const [searchQuery, setSearchQuery] = useState('');

  const [deals, setDeals] = useState<Deal[]>([]);
  const [engagements, setEngagements] = useState<Engagement[]>([]);
  const [loading, setLoading] = useState(true);
  const [guestPhoneSearch, setGuestPhoneSearch] = useState('');
  
  const location = useLocation();
  const navigate = useNavigate();
  const { activeOrdersCount, sellerOrdersCount, buyerOrdersCount } = useNotifications();

  // Load Firestore listeners with strict user isolation (supplierId == uid OR customerId == uid)
  useEffect(() => {
    setLoading(true);
    let unsubDealsSupplier = () => {};
    let unsubDealsCustomer = () => {};
    let unsubEngSupplier = () => {};
    let unsubEngCustomer = () => {};

    if (profile?.uid) {
      if (activeTab === 'feed') {
        // Fetch engagements where user is either Supplier (seller) OR Customer (buyer)
        const qSupplier = query(
          collection(db, 'engagements'),
          where('supplierId', '==', profile.uid)
        );
        const qCustomer = query(
          collection(db, 'engagements'),
          where('customerId', '==', profile.uid)
        );

        let supplierEng: Engagement[] = [];
        let customerEng: Engagement[] = [];

        const combineEngagements = () => {
          const map = new Map<string, Engagement>();
          [...supplierEng, ...customerEng].forEach(e => {
            if (e.id) map.set(e.id, e);
          });
          const combined = Array.from(map.values()).sort((a, b) => {
            const tA = new Date(a.createdAt || 0).getTime();
            const tB = new Date(b.createdAt || 0).getTime();
            return tB - tA;
          });
          setEngagements(combined);
          setDeals([]);
          setLoading(false);
        };

        unsubEngSupplier = onSnapshot(qSupplier, (snap) => {
          supplierEng = snap.docs.map(d => ({ id: d.id, ...d.data() } as Engagement));
          combineEngagements();
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'engagements-supplier-stream');
          setLoading(false);
        });

        unsubEngCustomer = onSnapshot(qCustomer, (snap) => {
          customerEng = snap.docs.map(d => ({ id: d.id, ...d.data() } as Engagement));
          combineEngagements();
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'engagements-customer-stream');
          setLoading(false);
        });

      } else {
        // activeTab === 'tracking'
        // Fetch deals where user is either Supplier (seller) OR Customer (buyer)
        const qSupplier = query(
          collection(db, 'deals'),
          where('supplierId', '==', profile.uid)
        );
        const qCustomer = query(
          collection(db, 'deals'),
          where('customerId', '==', profile.uid)
        );

        let supplierDeals: Deal[] = [];
        let customerDeals: Deal[] = [];

        const combineDeals = () => {
          const map = new Map<string, Deal>();
          [...supplierDeals, ...customerDeals].forEach(d => {
            if (d.id) map.set(d.id, d);
          });

          // Also include saved guest deal IDs if applicable
          let savedGuestIds: string[] = [];
          try {
            savedGuestIds = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
          } catch (e) {
            savedGuestIds = [];
          }

          const combined = Array.from(map.values()).sort((a, b) => {
            const tA = new Date(a.updatedAt || a.createdAt || 0).getTime();
            const tB = new Date(b.updatedAt || b.createdAt || 0).getTime();
            return tB - tA;
          });

          cacheCollection('deals', combined);
          setDeals(combined);
          setEngagements([]);
          setLoading(false);
        };

        unsubDealsSupplier = onSnapshot(qSupplier, (snap) => {
          supplierDeals = snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
          combineDeals();
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'deals-supplier-stream');
          setLoading(false);
        });

        unsubDealsCustomer = onSnapshot(qCustomer, (snap) => {
          customerDeals = snap.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
          combineDeals();
        }, (err) => {
          handleFirestoreError(err, OperationType.GET, 'deals-customer-stream');
          setLoading(false);
        });
      }
    } else {
      // Guest User Mode: Load local guest deals & guest phone lookup
      let savedGuestIds: string[] = [];
      try {
        savedGuestIds = JSON.parse(localStorage.getItem('guest_deal_ids') || '[]');
      } catch (e) {
        savedGuestIds = [];
      }

      const loadGuestLocalDeals = async () => {
        try {
          const cachedRecords = await localDB.deals.toArray();
          if (cachedRecords.length > 0) {
            const cachedDeals = cachedRecords.map(r => r.data as Deal);
            const filtered = cachedDeals.filter(d => 
              savedGuestIds.includes(d.id) || 
              d.isGuestOrder || 
              (guestPhoneSearch && (d.customerPhone?.includes(guestPhoneSearch) || d.id.toLowerCase().includes(guestPhoneSearch.toLowerCase()) || d.productName?.toLowerCase().includes(guestPhoneSearch.toLowerCase())))
            );
            setDeals(filtered);
            setLoading(false);
          }
        } catch (e) {}
      };
      loadGuestLocalDeals();

      const q = query(collection(db, 'deals'), where('isGuestOrder', '==', true));
      const unsubGuest = onSnapshot(q, (snapshot) => {
        const allGuestDeals = snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Deal));
        cacheCollection('deals', allGuestDeals);

        const filtered = allGuestDeals.filter(d => 
          savedGuestIds.includes(d.id) || 
          (guestPhoneSearch && (d.customerPhone?.includes(guestPhoneSearch) || d.id.toLowerCase().includes(guestPhoneSearch.toLowerCase()) || d.productName?.toLowerCase().includes(guestPhoneSearch.toLowerCase())))
        );
        setDeals(filtered);
        setEngagements([]);
        setLoading(false);
      }, (err) => {
        console.warn("Guest deals query error:", err);
        loadGuestLocalDeals();
        setLoading(false);
      });

      return () => {
        unsubGuest();
      };
    }

    return () => {
      unsubDealsSupplier();
      unsubDealsCustomer();
      unsubEngSupplier();
      unsubEngCustomer();
    };
  }, [profile, activeTab, guestPhoneSearch]);

  // Handle stage update by supplier
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

  // Handle delivery confirmation by buyer
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

  // Filtered Deals for "Sales and Buyer Order Tracking"
  const filteredDeals = useMemo(() => {
    const list = deals.filter(deal => {
      // 1. Role Filter (Sales vs Purchases)
      if (roleFilter === 'sales' && deal.supplierId !== profile?.uid) return false;
      if (roleFilter === 'purchases' && deal.customerId !== profile?.uid) return false;

      // 2. Status Filter
      if (statusFilter === 'active' && (deal.status === 'delivered' || deal.status === 'won')) return false;
      if (statusFilter === 'in_transit' && deal.trackingStage !== 'Order in Transit') return false;
      if (statusFilter === 'delivered' && deal.status !== 'delivered' && deal.status !== 'won' && !deal.buyerConfirmedDelivery) return false;

      // 3. Search query filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchId = deal.id.toLowerCase().includes(q);
        const matchProduct = deal.productName?.toLowerCase().includes(q);
        const matchCustomer = deal.customerName?.toLowerCase().includes(q);
        const matchPhone = deal.customerPhone?.toLowerCase().includes(q);
        if (!matchId && !matchProduct && !matchCustomer && !matchPhone) return false;
      }

      return true;
    });

    // Unfinished/active orders and latest transactions placed on top
    return list.sort((a, b) => {
      const isUnfinishedA = a.status !== 'delivered' && a.status !== 'won' && a.status !== 'cancelled';
      const isUnfinishedB = b.status !== 'delivered' && b.status !== 'won' && b.status !== 'cancelled';

      if (isUnfinishedA && !isUnfinishedB) return -1;
      if (!isUnfinishedA && isUnfinishedB) return 1;

      const dateA = new Date(a.updatedAt || a.createdAt || 0).getTime();
      const dateB = new Date(b.updatedAt || b.createdAt || 0).getTime();
      return dateB - dateA;
    });
  }, [deals, roleFilter, statusFilter, searchQuery, profile?.uid]);

  // Filtered Engagements for "Network Feed"
  const filteredEngagements = useMemo(() => {
    return engagements.filter(eng => {
      // 1. Direction Filter
      if (feedFilter === 'incoming' && eng.supplierId !== profile?.uid) return false;
      if (feedFilter === 'outgoing' && eng.customerId !== profile?.uid) return false;

      // 2. Search filter
      if (searchQuery.trim()) {
        const q = searchQuery.toLowerCase().trim();
        const matchProduct = eng.productName?.toLowerCase().includes(q);
        const matchCustomer = eng.customerName?.toLowerCase().includes(q);
        if (!matchProduct && !matchCustomer) return false;
      }

      return true;
    });
  }, [engagements, feedFilter, searchQuery, profile?.uid]);

  // Stats calculation
  const totalSalesCount = useMemo(() => deals.filter(d => d.supplierId === profile?.uid).length, [deals, profile?.uid]);
  const totalPurchasesCount = useMemo(() => deals.filter(d => d.customerId === profile?.uid).length, [deals, profile?.uid]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-3 sm:p-6 space-y-6 max-w-5xl mx-auto min-h-screen pb-24"
    >
      {/* Header Banner */}
      <header className="bg-gradient-to-r from-[#0d121f] via-[#090d16] to-[#0d121f] border border-white/10 rounded-3xl p-5 sm:p-6 shadow-2xl relative overflow-hidden backdrop-blur-xl">
        <div className="absolute top-0 right-0 w-64 h-64 bg-primary/10 rounded-full blur-3xl pointer-events-none"></div>
        <div className="relative z-10 flex flex-col md:flex-row md:items-center justify-between gap-4">
          <div className="space-y-1.5">
            <div className="flex items-center gap-2">
              <div className="w-10 h-10 rounded-2xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,242,254,0.3)]">
                <Zap size={22} />
              </div>
              <div>
                <h1 className="text-xl sm:text-2xl font-black text-white italic tracking-tight uppercase">
                  Market & Order Control
                </h1>
                <p className="text-[10px] sm:text-xs text-gray-400 font-bold uppercase tracking-widest flex items-center gap-1.5">
                  <ShieldCheck size={12} className="text-emerald-400" /> Private Transaction & Tracking Feed
                </p>
              </div>
            </div>
          </div>

          {/* Quick Metrics Bar & Reset Action */}
          <div className="flex items-center gap-2 sm:gap-3 flex-wrap">
            <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-2xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400">
                <ArrowUpRight size={14} />
              </div>
              <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Sales Orders</p>
                <p className="text-sm font-black text-white">{totalSalesCount}</p>
              </div>
            </div>

            <div className="bg-white/5 border border-white/10 px-3 py-2 rounded-2xl flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-xl bg-purple-500/10 border border-purple-500/20 flex items-center justify-center text-purple-400">
                <ArrowDownLeft size={14} />
              </div>
              <div>
                <p className="text-[9px] text-gray-400 font-bold uppercase tracking-wider">Purchases</p>
                <p className="text-sm font-black text-white">{totalPurchasesCount}</p>
              </div>
            </div>

            <button
              onClick={handleResetAttentionCounters}
              disabled={resettingAlerts}
              className="bg-white/5 hover:bg-white/10 border border-white/10 hover:border-primary/40 px-3 py-2 rounded-2xl flex items-center gap-2 text-gray-300 hover:text-white transition-all cursor-pointer text-[9px] font-black uppercase tracking-wider shadow-sm"
              title="Reset transactions attention counters to 0 until new transaction updates occur"
            >
              {resettingAlerts ? <Loader2 size={13} className="animate-spin text-primary" /> : <CheckCircle2 size={13} className="text-primary" />}
              <span>Reset Attention Alerts</span>
            </button>
          </div>
        </div>
      </header>

      {/* Guest Order Lookup bar if user is not logged in */}
      {!profile && (
        <div className="bg-gradient-to-r from-amber-500/10 via-black to-black border border-amber-500/30 rounded-2xl p-4 space-y-2">
          <p className="text-[10px] font-black text-amber-400 uppercase tracking-widest flex items-center gap-1.5">
            <Search size={14} /> Guest Order Tracking & Lookup
          </p>
          <div className="relative">
            <Search className="absolute left-3.5 top-3 text-gray-400" size={14} />
            <input 
              type="text" 
              value={guestPhoneSearch} 
              onChange={e => setGuestPhoneSearch(e.target.value)}
              placeholder="Search guest order by Phone Number or Order ID..." 
              className="w-full bg-black/60 border border-white/10 rounded-xl pl-9 pr-4 py-2.5 text-white text-xs outline-none focus:border-amber-400 transition-all"
            />
          </div>
        </div>
      )}

      {/* Primary Subsections Switcher Tabs */}
      <div className="flex bg-[#0a0e17] p-1.5 rounded-2xl border border-white/10 shadow-inner backdrop-blur-xl">
        {/* Subsection 1: "Sales and Buyer Order Tracking" */}
        <button 
          onClick={() => { setActiveTab('tracking'); setSearchQuery(''); }}
          className={cn(
            "flex-1 py-3.5 px-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative cursor-pointer",
            activeTab === 'tracking' 
              ? "bg-gradient-to-r from-primary to-cyan-400 text-black font-black shadow-[0_0_20px_rgba(0,242,254,0.4)] scale-102" 
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Zap size={16} />
          <span className="truncate">Sales and Buyer Order Tracking</span>
          {deals.length > 0 && (
            <span className="min-w-[20px] h-[20px] px-1.5 bg-black/40 text-white rounded-full flex items-center justify-center text-[9px] font-mono font-bold shrink-0">
              {deals.length}
            </span>
          )}
        </button>

        {/* Subsection 2: "Network Feed" */}
        <button 
          onClick={() => { setActiveTab('feed'); setSearchQuery(''); }}
          className={cn(
            "flex-1 py-3.5 px-3 text-[11px] font-black uppercase tracking-wider rounded-xl transition-all duration-300 flex items-center justify-center gap-2 relative cursor-pointer",
            activeTab === 'feed' 
              ? "bg-gradient-to-r from-purple-500 to-pink-500 text-white font-black shadow-[0_0_20px_rgba(240,147,251,0.4)] scale-102" 
              : "text-gray-400 hover:text-white hover:bg-white/5"
          )}
        >
          <Sparkles size={16} />
          <span className="truncate">Network Feed</span>
          {engagements.length > 0 && (
            <span className="min-w-[20px] h-[20px] px-1.5 bg-black/40 text-white rounded-full flex items-center justify-center text-[9px] font-mono font-bold shrink-0">
              {engagements.length}
            </span>
          )}
        </button>
      </div>

      {/* Sub-Filters & Controls Toolbar */}
      <div className="bg-white/5 border border-white/10 rounded-2xl p-3.5 space-y-3">
        <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
          {/* Sub-Filter Pills */}
          {activeTab === 'tracking' ? (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-1 flex items-center gap-1">
                <Filter size={11} /> View:
              </span>
              {[
                { id: 'all', label: 'All Orders' },
                { id: 'sales', label: `My Sales (${totalSalesCount})` },
                { id: 'purchases', label: `My Purchases (${totalPurchasesCount})` }
              ].map(f => (
                <button
                  key={`rf-${f.id}`}
                  onClick={() => setRoleFilter(f.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border",
                    roleFilter === f.id 
                      ? "bg-primary/20 text-primary border-primary/40 shadow-sm" 
                      : "bg-black/30 border-white/5 text-gray-400 hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          ) : (
            <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 scrollbar-none">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400 mr-1 flex items-center gap-1">
                <Filter size={11} /> Filter:
              </span>
              {[
                { id: 'all', label: 'All Interactions' },
                { id: 'incoming', label: 'Incoming (From Buyers)' },
                { id: 'outgoing', label: 'Outgoing (To Suppliers)' }
              ].map(f => (
                <button
                  key={`ff-${f.id}`}
                  onClick={() => setFeedFilter(f.id as any)}
                  className={cn(
                    "px-3 py-1.5 rounded-xl text-[9.5px] font-black uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border",
                    feedFilter === f.id 
                      ? "bg-purple-500/20 text-purple-300 border-purple-500/40 shadow-sm" 
                      : "bg-black/30 border-white/5 text-gray-400 hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}

          {/* Search Box */}
          <div className="relative flex-1 max-w-xs">
            <Search className="absolute left-3 top-2.5 text-gray-400" size={13} />
            <input 
              type="text" 
              value={searchQuery}
              onChange={e => setSearchQuery(e.target.value)}
              placeholder={activeTab === 'tracking' ? "Search order ID, product, phone..." : "Search interactions..."}
              className="w-full bg-black/50 border border-white/10 rounded-xl pl-8 pr-3 py-1.5 text-xs text-white outline-none focus:border-primary/50 transition-all placeholder:text-gray-500"
            />
          </div>
        </div>

        {/* Extra Status Filter Pills for Tracking Tab */}
        {activeTab === 'tracking' && (
          <div className="pt-2 border-t border-white/5 flex items-center gap-1.5 overflow-x-auto scrollbar-none">
            <span className="text-[8.5px] font-black uppercase tracking-widest text-gray-400 mr-1">
              Status:
            </span>
            {[
              { id: 'all', label: 'All Statuses' },
              { id: 'active', label: 'Active Processing' },
              { id: 'in_transit', label: 'In Transit' },
              { id: 'delivered', label: 'Delivered & Completed' }
            ].map(s => (
              <button
                key={`sf-${s.id}`}
                onClick={() => setStatusFilter(s.id as any)}
                className={cn(
                  "px-2.5 py-1 rounded-lg text-[8.5px] font-bold uppercase tracking-wider transition-all cursor-pointer whitespace-nowrap border",
                  statusFilter === s.id 
                    ? "bg-white/15 text-white border-white/30" 
                    : "bg-black/20 border-white/5 text-gray-500 hover:text-gray-300"
                )}
              >
                {s.label}
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Main Content List Area */}
      <div className="space-y-5">
        {loading ? (
          <div className="flex flex-col items-center py-20 gap-4">
            <Loader2 className="animate-spin text-primary" size={32} />
            <p className="text-[10px] text-gray-400 font-black uppercase tracking-widest animate-pulse">
              Syncing transactions...
            </p>
          </div>
        ) : activeTab === 'feed' ? (
          /* SECTION 2: NETWORK FEED */
          filteredEngagements.length > 0 ? (
            <div className="grid grid-cols-1 gap-4">
              {filteredEngagements.map((eng, idx) => (
                <EngagementCard 
                  key={`eng-${eng.id || idx}-${idx}`} 
                  engagement={eng} 
                  currentUserId={profile?.uid}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center text-center space-y-4 bg-white/5 border border-white/5 rounded-3xl p-8">
              <div className="w-16 h-16 bg-purple-500/10 border border-purple-500/20 rounded-2xl flex items-center justify-center text-purple-400">
                <Sparkles size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-white font-black uppercase tracking-widest text-xs">No active network feed signals</p>
                <p className="text-[10px] text-gray-400 max-w-sm mx-auto">
                  Every product interaction, inquiry, or purchase request between you and counterparty buyers or sellers appears here privately.
                </p>
              </div>
              <button 
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-purple-500/20 border border-purple-500/30 rounded-xl text-purple-300 text-[10px] font-black uppercase tracking-widest hover:bg-purple-500/30 transition-all cursor-pointer"
              >
                Browse Marketplace
              </button>
            </div>
          )
        ) : (
          /* SECTION 1: SALES AND BUYER ORDER TRACKING */
          filteredDeals.length > 0 ? (
            <div className="space-y-5">
              {filteredDeals.map((deal, idx) => (
                <DealCard 
                  key={`deal-${deal.id || idx}-${idx}`} 
                  deal={deal} 
                  profile={profile}
                  onUpdateStage={handleUpdateStage}
                  onConfirmDelivery={handleConfirmDelivery}
                  onUpdateDeal={handleUpdateDealLocally}
                />
              ))}
            </div>
          ) : (
            <div className="py-20 flex flex-col items-center text-center space-y-4 bg-white/5 border border-white/5 rounded-3xl p-8">
              <div className="w-16 h-16 bg-primary/10 border border-primary/20 rounded-2xl flex items-center justify-center text-primary">
                <Clock size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-white font-black uppercase tracking-widest text-xs">No order tracking records found</p>
                <p className="text-[10px] text-gray-400 max-w-sm mx-auto">
                  Only transactions involving you as either Seller or Buyer are displayed here to protect your business privacy.
                </p>
              </div>
              <button 
                onClick={() => navigate('/')}
                className="px-6 py-2.5 bg-primary/20 border border-primary/30 rounded-xl text-primary text-[10px] font-black uppercase tracking-widest hover:bg-primary/30 transition-all cursor-pointer"
              >
                Explore Marketplace Products
              </button>
            </div>
          )
        )}
      </div>
    </motion.div>
  );
}

/**
 * Network Feed Engagement Card
 * Shows individual product interaction between a buyer and seller.
 */
function EngagementCard({ engagement, currentUserId }: { engagement: Engagement; currentUserId?: string }) {
  const navigate = useNavigate();
  const isIncoming = engagement.supplierId === currentUserId;
  const isEngaged = engagement.type === 'engaged';

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className={cn(
        "p-5 rounded-2xl border flex flex-col md:flex-row md:items-center justify-between gap-4 cursor-pointer group transition-all backdrop-blur-md relative overflow-hidden",
        isIncoming 
          ? "border-purple-500/30 bg-gradient-to-r from-purple-950/20 via-black to-black hover:border-purple-500/50" 
          : "border-cyan-500/30 bg-gradient-to-r from-cyan-950/20 via-black to-black hover:border-cyan-500/50"
      )}
      onClick={() => {
        const convoId = [engagement.customerId, engagement.supplierId].sort().join('_');
        navigate(`/chat?id=${convoId}`);
      }}
    >
      <div className="flex items-center gap-4">
        <div className={cn(
          "w-12 h-12 rounded-2xl flex items-center justify-center shrink-0 border",
          isIncoming 
            ? "bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_15px_rgba(240,147,251,0.2)]" 
            : "bg-cyan-500/20 border-cyan-500/40 text-cyan-300 shadow-[0_0_15px_rgba(0,242,254,0.2)]"
        )}>
          {isEngaged ? <MessageSquare size={20} /> : <ShoppingBag size={20} />}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "text-[8px] font-black uppercase tracking-[0.2em] px-2 py-0.5 rounded-md border shadow-sm",
              isIncoming ? "bg-purple-500/20 border-purple-500/30 text-purple-300" : "bg-cyan-500/20 border-cyan-500/30 text-cyan-300"
            )}>
              {isIncoming ? 'Incoming Buyer Signal' : 'Outgoing Supplier Inquiry'}
            </span>
            <span className="text-[8px] font-mono text-gray-400 font-bold uppercase tracking-wider">
              {formatAuditableStamp(engagement.createdAt)}
            </span>
          </div>
          <h4 className="text-xs font-black text-white uppercase tracking-wider group-hover:text-primary transition-colors">
            <span className={isIncoming ? "text-purple-300" : "text-cyan-300"}>
              {engagement.customerName || 'Customer'}
            </span> 
            {isEngaged ? ' engaged on ' : ' requested purchase for '}
            <span className="text-white italic">{engagement.productName || 'Product'}</span>
          </h4>
          <p className="text-[9.5px] text-gray-400 font-medium">
            Private interaction between Buyer & Seller. Click to launch live comms.
          </p>
        </div>
      </div>
      <button className="px-4 py-2 bg-white/5 border border-white/10 rounded-xl text-[9px] font-black text-gray-300 uppercase tracking-widest flex items-center gap-2 group-hover:bg-primary group-hover:text-black group-hover:border-primary transition-all shrink-0">
        Open Chat <ChevronRight size={12} />
      </button>
    </motion.div>
  );
}

/**
 * Deal Order Card for Sales and Buyer Order Tracking
 */
function DealCard({ 
  deal, 
  profile,
  onUpdateStage,
  onConfirmDelivery,
  onUpdateDeal
}: { 
  deal: Deal; 
  profile: UserProfile | null;
  onUpdateStage: (dealId: string, stage: string, currentHistory?: DealHistoryItem[]) => void;
  onConfirmDelivery: (dealId: string, currentHistory?: DealHistoryItem[]) => void;
  onUpdateDeal?: (updated: Deal) => void;
}) {
  const [product, setProduct] = useState<Product | null>(null);
  const [showTimestamps, setShowTimestamps] = useState(false);
  const [supplierPhone, setSupplierPhone] = useState<string>('');
  const [popInput, setPopInput] = useState<string>('');
  const [submittingPop, setSubmittingPop] = useState<boolean>(false);
  const navigate = useNavigate();

  // Determine user role relative to this transaction
  const isSeller = profile?.uid === deal.supplierId;
  const isBuyer = profile?.uid === deal.customerId;
  const isGuest = deal.isGuestOrder;

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

  const isPOD = deal.paymentMethod === 'pod';
  const isDeliveredStage = (deal.trackingStage === 'Order Delivered!') || deal.status === 'delivered';
  const isWon = deal.status === 'won' || deal.buyerConfirmedDelivery;

  const handleWirePaymentWhatsApp = () => {
    const buyerName = deal.customerName || 'Customer';
    const totalAmount = deal.agreedPrice;
    const deliveryAddressLine = deal.deliveryAddress
      ? `• *Delivery Address:* ${deal.deliveryAddress}\n`
      : `• *Delivery Choice:* No Delivery / In-Person Pickup\n`;

    const messageText = `🛒 *SALES ORDER PAYMENT INFO*\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `• *Order ID:* ${deal.id}\n` +
      `• *Buyer Name:* ${buyerName}\n` +
      `• *Buyer Phone:* ${deal.customerPhone || 'N/A'}\n` +
      `• *Buyer Email:* ${deal.customerEmail || 'N/A'}\n` +
      `• *Product/Service:* ${deal.productName || product?.name || 'Item'} (x${deal.quantity || 1})\n` +
      `• *Total Purchase:* ${formatCurrency(totalAmount, product?.currency || 'USD')}\n` +
      `• *Payment System:* ${(deal.paymentMethod || 'Non-POD').toUpperCase()}\n` +
      deliveryAddressLine +
      `• *Date:* ${formatAuditableStamp(deal.createdAt)}\n` +
      `━━━━━━━━━━━━━━━━━━━━\n` +
      `*Status:* Sales Order logged in Deal Room. Please confirm processing.\n\n` +
      `This order was initiated in The Comfort Business Hub. Join Comfort Business Hub and deal here; https://comfort-business-hub.comfort-designszw.workers.dev/`;

    if (supplierPhone) {
      openWhatsApp(supplierPhone, messageText);
    } else {
      navigator.clipboard.writeText(messageText);
      alert('Payment info copied to clipboard!');
    }
  };

  const [editingPop, setEditingPop] = useState(false);

  const handleSubmitPopInDeal = async (data: POPAttachmentData) => {
    setSubmittingPop(true);

    try {
      const refPart = data.popReference ? `Ref: ${data.popReference}` : '';
      const attPart = data.popAttachmentName ? `File: ${data.popAttachmentName}` : '';
      const noteDetails = [refPart, attPart].filter(Boolean).join(' | ') || 'Proof attached';

      const updatedDeal: Deal = {
        ...deal,
        popReference: data.popReference,
        popAttachmentUrl: data.popAttachmentUrl,
        popAttachmentName: data.popAttachmentName,
        popAttachmentType: data.popAttachmentType,
        popStatus: 'submitted',
        updatedAt: new Date().toISOString(),
        history: [
          ...(deal.history || []),
          {
            stage: 'POP Submitted',
            status: 'confirmed',
            timestamp: new Date().toISOString(),
            updatedBy: deal.customerName || 'Customer',
            note: `Proof of payment submitted (${noteDetails})`
          }
        ]
      };

      if (onUpdateDeal) {
        onUpdateDeal(updatedDeal);
      }

      await offlineResilientWrite('deals', deal.id, 'update', updatedDeal);
      setEditingPop(false);
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

      if (onUpdateDeal) {
        onUpdateDeal(updatedDeal);
      }

      await offlineResilientWrite('deals', deal.id, 'update', updatedDeal);
    } catch (err) {
      console.error("POP verification error:", err);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -2 }}
      className="p-5 sm:p-6 space-y-5 relative group overflow-hidden border border-white/10 rounded-3xl bg-[#080c14] backdrop-blur-xl shadow-xl transition-all"
    >
      {/* Header Row: Role Badge & Order Status */}
      <div className="flex justify-between items-start gap-3 flex-wrap">
        <div className="flex items-center gap-2">
          {isSeller ? (
            <span className="bg-gradient-to-r from-emerald-500/20 to-teal-500/20 border border-emerald-500/40 text-emerald-300 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
              <Building2 size={12} /> SELLER VIEW (Your Product)
            </span>
          ) : isBuyer ? (
            <span className="bg-gradient-to-r from-purple-500/20 to-indigo-500/20 border border-purple-500/40 text-purple-300 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5 shadow-sm">
              <User size={12} /> BUYER VIEW (Your Purchase)
            </span>
          ) : (
            <span className="bg-amber-500/20 border border-amber-500/40 text-amber-300 text-[9px] font-black uppercase tracking-widest px-2.5 py-1 rounded-xl flex items-center gap-1.5">
              <Tag size={12} /> GUEST ORDER
            </span>
          )}

          <span className="text-[8.5px] font-mono text-gray-400 bg-white/5 px-2 py-0.5 rounded-lg border border-white/10">
            {formatAuditableStamp(deal.createdAt)}
          </span>
        </div>

        <div className="text-right space-y-0.5">
          <p className="text-lg font-black text-primary italic">
            {formatCurrency(deal.agreedPrice, product?.currency || 'USD')}
          </p>
          <span className={cn(
            "text-[8.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded-md border inline-block",
            isPOD ? "bg-amber-500/20 text-amber-300 border-amber-500/30" : "bg-primary/20 text-primary border-primary/30"
          )}>
            {deal.paymentMethod ? deal.paymentMethod.toUpperCase() : 'PAYMENT'}
          </span>
        </div>
      </div>

      {/* Main Order Item Info */}
      <div className="flex gap-4 items-start">
        <div className="w-16 h-16 sm:w-20 sm:h-20 bg-white/5 rounded-2xl border border-white/10 overflow-hidden shrink-0 shadow-inner">
          <img 
            src={deal.productImage || product?.images?.[0] || 'https://images.unsplash.com/photo-1540350394557-8ae14678e7f91?w=200&q=80'} 
            alt="Product" 
            className="w-full h-full object-cover" 
            referrerPolicy="no-referrer"
          />
        </div>
        <div className="space-y-1.5 flex-1 min-w-0">
          <h4 className="font-black text-white uppercase tracking-tight text-sm sm:text-base line-clamp-1">
            {deal.productName || product?.name || 'Order Item'}
          </h4>
          <div className="flex items-center gap-2 flex-wrap text-[9.5px]">
            <span className="text-gray-400 font-bold uppercase tracking-widest">Order ID:</span>
            <span className="text-primary font-mono font-bold tracking-widest">{deal.id.substring(0, 10).toUpperCase()}</span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-[10px] text-gray-300 pt-1">
            {deal.customerName && (
              <p className="font-bold">
                👤 Buyer: <span className="text-white">{deal.customerName}</span> ({deal.customerPhone || 'N/A'})
              </p>
            )}
            {deal.deliveryAddress && (
              <p className="font-medium truncate">
                📍 Location: <span className="text-gray-200">{deal.deliveryAddress}</span>
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Non-POD Payment Info & Proof of Payment Box */}
      {!isPOD && (
        <div className="bg-white/5 border border-white/10 rounded-2xl p-4 space-y-3">
          <div className="flex justify-between items-center border-b border-white/10 pb-2">
            <span className="text-[10px] font-black uppercase tracking-widest text-primary flex items-center gap-1.5">
              <Zap size={12} /> Direct Non-POD Payment Setup
            </span>
            <span className="text-[9px] font-mono text-gray-400 uppercase">
              Method: {deal.paymentMethod ? deal.paymentMethod.toUpperCase() : 'DIRECT'}
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
            <MessageCircle size={14} /> Wire Sales Payment Details on WhatsApp
          </button>

          {/* Proof of Payment (POP) Box */}
          <div className="pt-2 border-t border-white/10 space-y-2">
            <p className="text-[9px] font-black uppercase tracking-widest text-amber-400 flex items-center gap-1">
              <FileText size={12} /> Proof of Payment (POP) Status
            </p>

            {(deal.popReference || deal.popAttachmentUrl) && !editingPop ? (
              <POPDisplay
                popReference={deal.popReference}
                popAttachmentUrl={deal.popAttachmentUrl}
                popAttachmentName={deal.popAttachmentName}
                popAttachmentType={deal.popAttachmentType}
                popStatus={deal.popStatus}
                isSeller={isSeller}
                onVerify={handleVerifyPopBySupplier}
                onReupload={() => setEditingPop(true)}
              />
            ) : (
              <POPForm
                initialReference={deal.popReference || ''}
                submitting={submittingPop}
                onSubmit={handleSubmitPopInDeal}
                buttonText={editingPop ? 'Update Proof of Payment' : 'Submit Proof of Payment (Screenshot / PDF)'}
              />
            )}
          </div>
        </div>
      )}

      {/* Visual 4-Stage Tracker Timeline */}
      <div className="pt-2">
        <OrderTimeline 
          status={deal.status} 
          trackingStage={deal.trackingStage} 
          createdAt={deal.createdAt}
          updatedAt={deal.updatedAt}
          history={deal.history}
        />
      </div>

      {/* Audit Log Drawer Toggle */}
      <div className="pt-1">
        <button 
          onClick={() => setShowTimestamps(!showTimestamps)}
          className="text-[9px] font-black uppercase tracking-wider text-primary hover:underline flex items-center gap-1.5 cursor-pointer"
        >
          <Clock size={12} />
          {showTimestamps ? 'Hide Transaction Timeline Audit' : 'View Order Transaction Dates & Timestamps Log'}
        </button>

        {showTimestamps && (
          <div className="mt-2.5 bg-black/60 border border-white/10 rounded-2xl p-3.5 space-y-2 text-[9.5px]">
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

      {/* Supplier Delivery Stage Controls */}
      {isSeller && (
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
            <CheckCircle2 size={18} /> TRANSACTION COMPLETE & DELIVERED ✓
          </p>
          <p className="text-[10px] text-gray-300 font-bold uppercase tracking-wider">
            Delivery verified by Buyer.
          </p>
        </div>
      ) : isDeliveredStage ? (
        <div className="bg-emerald-500/10 border border-emerald-500/40 rounded-2xl p-4 text-center space-y-2.5 shadow-[0_0_20px_rgba(16,185,129,0.15)] animate-pulse">
          <p className="text-xs font-black text-emerald-400 uppercase tracking-wider flex items-center justify-center gap-1.5">
            <Truck size={16} /> Order Marked as Delivered by Supplier!
          </p>
          <p className="text-[10px] text-gray-300 font-medium leading-relaxed">
            Please confirm you have received your order to conclude this transaction.
          </p>
          <button
            onClick={() => onConfirmDelivery(deal.id, deal.history || [])}
            className="w-full bg-emerald-500 text-black py-3 rounded-xl font-black text-[10px] uppercase tracking-widest hover:bg-emerald-400 shadow-[0_0_20px_rgba(16,185,129,0.4)] transition-all cursor-pointer flex items-center justify-center gap-2"
          >
            <ShieldCheck size={14} /> Confirm Order Delivery & Finalize Deal
          </button>
        </div>
      ) : null}

      {/* Bottom Comms Action */}
      <div className="flex gap-3 pt-2 border-t border-white/5">
        <button 
          onClick={() => {
            const counterpartyId = isSeller ? deal.customerId : deal.supplierId;
            navigate(`/chat?supplierId=${counterpartyId}&dealId=${deal.id}`);
          }}
          className="flex-1 py-2.5 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-white hover:bg-white/10 hover:border-primary/30 transition-all cursor-pointer"
        >
          <MessageCircle size={14} className="text-primary" /> Contact {isSeller ? 'Buyer' : 'Seller'} / Comms
        </button>
      </div>
    </motion.div>
  );
}
