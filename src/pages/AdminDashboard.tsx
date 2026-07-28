import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Users, Search, Filter, CheckCircle, Info, XCircle, ArrowRight, 
  Trash2, Pause, Play, AlertCircle, Calendar, Hash, Tag, User as UserIcon, Store, ShoppingBag, ExternalLink, Loader2,
  X, AlertTriangle, Shield, Check, Megaphone, Clock
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, where, writeBatch, serverTimestamp, deleteDoc } from 'firebase/firestore';
import { Report, UserProfile, Role, Store as StoreType, Product, Spotlight } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard({ profile }: { profile: UserProfile | null }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'users' | 'stores' | 'products' | 'reports' | 'ads'>('users');
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [stores, setStores] = useState<StoreType[]>([]);
  const [products, setProducts] = useState<Product[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [adFilter, setAdFilter] = useState<'pending' | 'approved' | 'all'>('pending');
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);
  
  // Custom modals state
  const [quarantineUser, setQuarantineUser] = useState<UserProfile | null>(null);
  const [selectedDuration, setSelectedDuration] = useState<{ label: string; days: number; durationLabel: string } | null>(null);
  const [purgeUser, setPurgeUser] = useState<UserProfile | null>(null);

  // Clear selected duration when quarantine modal closes
  useEffect(() => {
    if (!quarantineUser) {
      setSelectedDuration(null);
    }
  }, [quarantineUser]);

  // Security: Only allow specific admin
  useEffect(() => {
    if (!profile) {
      navigate('/login');
      return;
    }
    if (profile.email !== 'comfort.designszw@gmail.com' && !profile.isAdmin) {
      navigate('/');
    }
  }, [profile, navigate]);

  useEffect(() => {
    setLoading(true);
    
    // Listen for reports
    const reportsQuery = query(collection(db, 'reports'), orderBy('createdAt', 'desc'));
    const unsubscribeReports = onSnapshot(reportsQuery, (snap) => {
      setReports(snap.docs.map(d => ({ id: d.id, ...d.data() } as Report)));
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'admin-reports');
      setLoading(false);
    });

    // Listen for users (Admin has permission)
    const usersQuery = query(collection(db, 'users'), orderBy('updatedAt', 'desc'));
    const unsubscribeUsers = onSnapshot(usersQuery, (snap) => {
      setUsers(snap.docs.map(d => ({ uid: d.id, ...d.data() } as UserProfile)));
    });

    // Listen for stores
    const storesQuery = query(collection(db, 'stores'), orderBy('updatedAt', 'desc'));
    const unsubscribeStores = onSnapshot(storesQuery, (snap) => {
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as StoreType)));
    });

    // Listen for products
    const productsQuery = query(collection(db, 'products'), orderBy('updatedAt', 'desc'));
    const unsubscribeProducts = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    });

    // Listen for spotlights / classified ads
    const spotlightsQuery = query(collection(db, 'spotlights'), orderBy('createdAt', 'desc'));
    const unsubscribeSpotlights = onSnapshot(spotlightsQuery, (snap) => {
      setSpotlights(snap.docs.map(d => ({ id: d.id, ...d.data() } as Spotlight)));
    });

    return () => {
      unsubscribeReports();
      unsubscribeUsers();
      unsubscribeStores();
      unsubscribeProducts();
      unsubscribeSpotlights();
    };
  }, []);

  const handleSpotlightApproval = async (spotlightId: string, isApproved: boolean) => {
    setIsProcessing(spotlightId);
    try {
      await updateDoc(doc(db, 'spotlights', spotlightId), {
        isApproved,
        isActive: true,
        updatedAt: serverTimestamp()
      });
      setSpotlights(prev => prev.map(s => s.id === spotlightId ? { ...s, isApproved } : s));
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `spotlights/${spotlightId}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleSpotlightDelete = async (spotlightId: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    setIsProcessing(spotlightId);
    try {
      await deleteDoc(doc(db, 'spotlights', spotlightId));
      setSpotlights(prev => prev.filter(s => s.id !== spotlightId));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `spotlights/${spotlightId}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleReportAction = async (reportId: string, status: 'resolved' | 'dismissed') => {
    setIsProcessing(reportId);
    try {
      await updateDoc(doc(db, 'reports', reportId), { status, updatedAt: serverTimestamp() });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `reports/${reportId}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleUserVerification = async (userId: string, isVerified: boolean) => {
    setIsProcessing(userId);
    try {
      await updateDoc(doc(db, 'users', userId), { isVerified, updatedAt: serverTimestamp() });
      await updateDoc(doc(db, 'public_profiles', userId), { isVerified, updatedAt: serverTimestamp() });
      setUsers(prev => prev.map(u => u.uid === userId ? { ...u, isVerified } : u));
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleStoreVerification = async (storeId: string, isVerified: boolean) => {
    setIsProcessing(storeId);
    try {
      await updateDoc(doc(db, 'stores', storeId), { isVerified, updatedAt: new Date().toISOString() });
      setStores(prev => prev.map(s => s.id === storeId ? { ...s, isVerified } : s));
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleProductVerification = async (productId: string, isVerified: boolean) => {
    setIsProcessing(productId);
    try {
      await updateDoc(doc(db, 'products', productId), { isVerified, updatedAt: new Date().toISOString() });
      setProducts(prev => prev.map(p => p.id === productId ? { ...p, isVerified } : p));
    } catch (err) {
      console.error(err);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleUserStatus = async (userId: string, newStatus: 'active' | 'suspended' | 'banned', days?: number, durationLabel?: string) => {
    setIsProcessing(userId);
    try {
      const updates: any = { status: newStatus, updatedAt: serverTimestamp() };
      
      if (newStatus === 'suspended' && days) {
        const suspensionEnd = new Date();
        suspensionEnd.setDate(suspensionEnd.getDate() + days);
        updates.suspensionEnd = suspensionEnd.toISOString();
        updates.suspensionDuration = durationLabel || `${days} days`;
      } else if (newStatus === 'active') {
        updates.suspensionEnd = null;
        updates.suspensionDuration = null;
      }

      const batch = writeBatch(db);
      batch.update(doc(db, 'users', userId), updates);
      batch.update(doc(db, 'public_profiles', userId), { status: newStatus, updatedAt: serverTimestamp() });
      
      await batch.commit();
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `users/${userId}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const handleWipeUser = async (userId: string) => {
    setIsProcessing(userId);
    try {
      // 1. Delete matching stores
      const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', userId));
      const storesSnap = await getDocs(storesQuery);
      if (!storesSnap.empty) {
        const storeBatch = writeBatch(db);
        storesSnap.forEach((d) => {
          storeBatch.delete(doc(db, 'stores', d.id));
        });
        await storeBatch.commit();
      }

      // 2. Delete matching products
      const productsQuery = query(collection(db, 'products'), where('ownerId', '==', userId));
      const productsSnap = await getDocs(productsQuery);
      if (!productsSnap.empty) {
        const productBatch = writeBatch(db);
        productsSnap.forEach((d) => {
          productBatch.delete(doc(db, 'products', d.id));
        });
        await productBatch.commit();
      }

      // 3. Delete user documents & public profiles
      const mainBatch = writeBatch(db);
      mainBatch.delete(doc(db, 'users', userId));
      mainBatch.delete(doc(db, 'public_profiles', userId));
      await mainBatch.commit();
      
      setPurgeUser(null);
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `users/${userId}`);
    } finally {
      setIsProcessing(null);
    }
  };

  const filteredReports = reports.filter(r => {
    const matchesStatus = statusFilter === 'all' || r.status === statusFilter;
    const matchesSearch = r.targetName.toLowerCase().includes(searchTerm.toLowerCase()) || 
                          r.reporterName.toLowerCase().includes(searchTerm.toLowerCase());
    return matchesStatus && matchesSearch;
  });

  const filteredUsers = users.filter(u => {
    const search = searchTerm.toLowerCase();
    return u.name?.toLowerCase().includes(search) || 
           u.email?.toLowerCase().includes(search) || 
           u.phone?.toLowerCase().includes(search) ||
           u.businessName?.toLowerCase().includes(search);
  });

  const filteredStores = stores.filter(s => {
    const search = searchTerm.toLowerCase();
    return s.name?.toLowerCase().includes(search) ||
           s.category?.toLowerCase().includes(search) ||
           s.ownerId?.toLowerCase().includes(search) ||
           s.address?.toLowerCase().includes(search);
  });

  const filteredProducts = products.filter(p => {
    const search = searchTerm.toLowerCase();
    return p.name?.toLowerCase().includes(search) ||
           p.category?.toLowerCase().includes(search) ||
           p.ownerId?.toLowerCase().includes(search) ||
           p.description?.toLowerCase().includes(search);
  });

  const pendingAdsCount = spotlights.filter(s => s.isApproved === false).length;

  const filteredSpotlights = spotlights.filter(s => {
    const search = searchTerm.toLowerCase();
    const matchesSearch = (s.title || '').toLowerCase().includes(search) ||
                          (s.authorName || '').toLowerCase().includes(search) ||
                          (s.content || '').toLowerCase().includes(search) ||
                          (s.category || '').toLowerCase().includes(search);
    
    if (!matchesSearch) return false;

    if (adFilter === 'pending') return s.isApproved === false;
    if (adFilter === 'approved') return s.isApproved === true || s.isApproved === undefined;
    return true;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-8"
    >
      {/* Header */}
      <header className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="w-14 h-14 bg-red-500 rounded-[1.5rem] flex items-center justify-center text-[#05070a] shadow-[0_0_20px_rgba(239,68,68,0.4)]">
            <ShieldAlert size={28} />
          </div>
          <div>
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Command Control Hub</h1>
            <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest flex items-center gap-2">
              <span className="w-2 h-2 bg-red-500 rounded-full animate-pulse" />
              Root Access Protocol: Active
            </p>
          </div>
        </div>

        <div className="flex bg-[#0d1117] border border-white/5 p-1 rounded-2xl flex-wrap gap-1">
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center",
              activeTab === 'users' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <Users size={14} />
            Users
          </button>
          <button 
            onClick={() => setActiveTab('stores')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center",
              activeTab === 'stores' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <Store size={14} />
            Stores ({stores.length})
          </button>
          <button 
            onClick={() => setActiveTab('products')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center",
              activeTab === 'products' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <ShoppingBag size={14} />
            Products ({products.length})
          </button>
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center",
              activeTab === 'reports' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <ShieldAlert size={14} />
            Abuse
            {reports.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-white text-red-500 px-1.5 py-0.5 rounded-full text-[8px] font-bold">{reports.filter(r => r.status === 'pending').length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('ads')}
            className={cn(
              "px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-1.5 flex items-center",
              activeTab === 'ads' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <Megaphone size={14} />
            Ads & Spotlights
            {pendingAdsCount > 0 && (
              <span className="bg-amber-400 text-black px-1.5 py-0.5 rounded-full text-[8px] font-black animate-pulse">{pendingAdsCount}</span>
            )}
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Users', value: users.length, icon: Users, color: 'text-primary' },
          { label: 'Active Stores', value: stores.length, icon: Store, color: 'text-neon-green' },
          { label: 'Listings / Products', value: products.length, icon: ShoppingBag, color: 'text-cyan-400' },
          { label: 'Active Conflicts', value: reports.filter(r => r.status === 'pending').length, icon: ShieldAlert, color: 'text-red-500' }
        ].map((stat, i) => (
          <div key={i} className="neon-card p-4 space-y-2 border-white/5 bg-[#0d1117]">
            <div className="flex items-center justify-between">
              <stat.icon className={stat.color} size={18} />
              <div className="text-xl font-black text-white italic tracking-tighter">{stat.value}</div>
            </div>
            <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">{stat.label}</p>
          </div>
        ))}
      </section>

      {/* Control Panel */}
      <section className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div className="relative flex-1 group">
            <Search className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-red-500 transition-colors" size={18} />
            <input 
              type="text" 
              placeholder={
                activeTab === 'reports' ? "Search conflicts..." : 
                activeTab === 'stores' ? "Search stores by name, category, or owner..." :
                activeTab === 'products' ? "Search products by name, category, or owner..." :
                activeTab === 'ads' ? "Search classified ads or spotlights by title or author..." :
                "Search users..."
              }
              className="w-full bg-[#0d1117] border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-white text-xs font-black uppercase tracking-tight outline-none focus:border-red-500/30 transition-all"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
          </div>
          
          {activeTab === 'reports' && (
            <div className="flex gap-2">
              {['all', 'pending', 'resolved', 'dismissed'].map((s) => (
                <button
                  key={s}
                  onClick={() => setStatusFilter(s as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all",
                    statusFilter === s ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-[#0d1117] border-white/5 text-gray-500 hover:text-white"
                  )}
                >
                  {s}
                </button>
              ))}
            </div>
          )}

          {activeTab === 'ads' && (
            <div className="flex gap-2">
              {[
                { id: 'pending', label: `Pending (${pendingAdsCount})` },
                { id: 'approved', label: 'Approved' },
                { id: 'all', label: `All (${spotlights.length})` }
              ].map((f) => (
                <button
                  key={f.id}
                  onClick={() => setAdFilter(f.id as any)}
                  className={cn(
                    "px-4 py-2 rounded-xl text-[8px] font-black uppercase tracking-widest border transition-all",
                    adFilter === f.id ? "bg-red-500/10 border-red-500/30 text-red-500" : "bg-[#0d1117] border-white/5 text-gray-500 hover:text-white"
                  )}
                >
                  {f.label}
                </button>
              ))}
            </div>
          )}
        </div>

        <AnimatePresence mode="wait">
          {activeTab === 'reports' ? (
            <motion.div 
              key="reports-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredReports.map((report, idx) => (
                <div key={`admin-rep-${report.id || idx}-${idx}`} className="neon-card p-5 space-y-4 border-white/5 hover:border-red-500/20 transition-all group">
                  <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div className="flex items-start gap-4">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center shrink-0",
                        report.status === 'pending' ? "bg-red-500/10 text-red-500 border border-red-500/20 shadow-[0_0_10px_rgba(239,68,68,0.2)]" : "bg-gray-800 text-gray-500"
                      )}>
                        {report.targetType === 'product' ? <ShoppingBag size={20} /> : report.targetType === 'store' ? <Store size={20} /> : <UserIcon size={20} />}
                      </div>
                      <div className="space-y-1">
                        <div className="flex items-center gap-3">
                          <h3 className="font-black text-white uppercase italic tracking-tighter text-lg leading-tight">{report.targetName}</h3>
                          <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest bg-white/5 px-2 py-0.5 rounded border border-white/5">
                            {report.targetType}
                          </span>
                        </div>
                        <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest">Type: {report.type}</p>
                      </div>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {report.status === 'pending' ? (
                        <>
                          <button 
                            onClick={() => handleReportAction(report.id, 'resolved')}
                            disabled={!!isProcessing}
                            className="px-4 py-2 bg-neon-green/10 border border-neon-green/30 text-neon-green text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-neon-green hover:text-black transition-all flex items-center gap-2"
                          >
                            {isProcessing === report.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />}
                            Archive Resolve
                          </button>
                          <button 
                            onClick={() => handleReportAction(report.id, 'dismissed')}
                            disabled={!!isProcessing}
                            className="px-4 py-2 bg-white/5 border border-white/10 text-gray-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-white/10 hover:text-white transition-all flex items-center gap-2"
                          >
                            {isProcessing === report.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />}
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <div className={cn(
                          "px-4 py-2 rounded-xl text-[9px] font-black uppercase tracking-widest border flex items-center gap-2",
                          report.status === 'resolved' ? "bg-neon-green/10 border-neon-green/20 text-neon-green" : "bg-gray-800 border-white/5 text-gray-500"
                        )}>
                          {report.status === 'resolved' ? <CheckCircle size={14} /> : <XCircle size={14} />}
                          Status: {report.status}
                        </div>
                      )}
                    </div>
                  </div>

                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4 col-span-full">
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                       <label className="text-[8px] font-black text-primary uppercase tracking-widest flex items-center gap-2">
                         <Info size={10} /> Report Intelligence
                       </label>
                       <p className="text-xs text-gray-300 font-medium leading-relaxed italic">"{report.details}"</p>
                    </div>
                    <div className="p-4 bg-white/5 rounded-2xl border border-white/5 grid grid-cols-2 gap-4">
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Reporter</p>
                        <p className="text-[10px] text-white font-bold">{report.reporterName}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Target ID</p>
                        <p className="text-[10px] text-white font-bold font-mono">{report.targetId.slice(0, 10)}</p>
                      </div>
                      <div className="space-y-1">
                        <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Date Logged</p>
                        <p className="text-[10px] text-white font-bold">{new Date(report.createdAt).toLocaleDateString()}</p>
                      </div>
                      <div className="space-y-1">
                         <button 
                          onClick={() => {
                            if (report.targetType === 'product') navigate(`/product/${report.targetId}`);
                            else if (report.targetType === 'store') navigate(`/store/${report.targetId}`);
                            else navigate(`/profile/${report.targetId}`);
                          }}
                          className="flex items-center gap-1 text-[8px] text-primary font-black uppercase tracking-widest hover:text-white transition-colors"
                         >
                           Inspect Link <ExternalLink size={10} />
                         </button>
                      </div>
                    </div>
                  </div>
                </div>
              ))}
              {filteredReports.length === 0 && (
                <div className="py-20 text-center space-y-4">
                  <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-700">
                    <CheckCircle size={32} />
                  </div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No Active Conflicts Detected</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'users' ? (
            <motion.div 
              key="users-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredUsers.map((user, idx) => (
                <div key={`admin-usr-${user.uid || idx}-${idx}`} className="neon-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="relative">
                      <div className="w-12 h-12 rounded-full border-2 border-white/10 bg-white/5 overflow-hidden flex items-center justify-center text-white font-black">
                        {user.avatar ? <img src={user.avatar} className="w-full h-full object-cover" /> : user.name.charAt(0)}
                      </div>
                      {user.status === 'suspended' && <div className="absolute -top-1 -right-1 w-5 h-5 bg-amber-500 rounded-full flex items-center justify-center text-black border-2 border-[#0d1117]"><Pause size={10} /></div>}
                      {user.status === 'banned' && <div className="absolute -top-1 -right-1 w-5 h-5 bg-red-500 rounded-full flex items-center justify-center text-white border-2 border-[#0d1117]"><XCircle size={10} /></div>}
                    </div>
                    <div>
                      <div className="flex items-center gap-2">
                        <h3 className="font-black text-white uppercase italic tracking-tighter">{user.name}</h3>
                        <span className={cn(
                          "text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border",
                          user.currentRole === 'supplier' ? "bg-primary/10 border-primary/20 text-primary" : "bg-white/5 border-white/10 text-gray-400"
                        )}>
                          {user.currentRole}
                        </span>
                        {user.isVerified && (
                          <span className="text-[7.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-neon-green/10 border-neon-green/30 text-neon-green flex items-center gap-1 shadow-[0_0_10px_rgba(57,255,20,0.15)]">
                            <Shield size={10} className="fill-current" /> Verified
                          </span>
                        )}
                        {user.status === 'suspended' && (
                          <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse shadow-[0_0_10px_rgba(245,158,11,0.15)]">
                            Quarantined for {user.suspensionDuration || '14 days'}
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold">{user.email || user.phone}</p>
                      {user.suspensionEnd && (
                        <p className="text-[8px] text-amber-500 font-black uppercase tracking-widest mt-1">Suspended until: {new Date(user.suspensionEnd).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {!user.isAdmin && user.email !== 'comfort.designszw@gmail.com' && (
                      <button 
                        onClick={() => handleUserVerification(user.uid, !user.isVerified)}
                        disabled={!!isProcessing}
                        className={cn(
                          "px-4 py-2 border text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                          user.isVerified 
                            ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" 
                            : "bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green hover:text-black shadow-[0_0_15px_rgba(57,255,20,0.15)]"
                        )}
                      >
                        {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Shield size={14} className={user.isVerified ? "" : "fill-current"} />}
                        {user.isVerified ? 'Revoke Verified' : 'Verify Operator'}
                      </button>
                    )}

                    {user.isAdmin || user.email === 'comfort.designszw@gmail.com' ? (
                      <span className="text-[8px] font-black uppercase tracking-widest px-3 py-1.5 rounded-xl border bg-primary/10 border-primary/35 text-primary shadow-[0_0_15px_rgba(255,0,212,0.1)]">
                        Admin Account
                      </span>
                    ) : user.status === 'suspended' ? (
                      <button 
                        onClick={() => handleUserStatus(user.uid, 'active')}
                        disabled={!!isProcessing}
                        className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-black transition-all flex items-center gap-2 shadow-[0_0_15px_rgba(245,158,11,0.15)] animate-pulse"
                      >
                         {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Play size={14} className="fill-current" />}
                         Reverse Quarantine
                      </button>
                    ) : user.status === 'banned' ? (
                      <button 
                        onClick={() => handleUserStatus(user.uid, 'active')}
                        disabled={!!isProcessing}
                        className="px-4 py-2 bg-neon-green/10 border border-neon-green/30 text-neon-green text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-neon-green hover:text-black transition-all flex items-center gap-2"
                      >
                         {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />}
                         Reactivate Account
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => setQuarantineUser(user)}
                          disabled={!!isProcessing}
                          className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-black transition-all flex items-center gap-2"
                        >
                           {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Pause size={14} />}
                           Quarantine
                        </button>
                        <button 
                          onClick={() => setPurgeUser(user)}
                          disabled={!!isProcessing}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                        >
                           {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                           Remove Access
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
              {filteredUsers.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <Users size={32} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No Users Located</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'stores' ? (
            <motion.div 
              key="stores-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredStores.map((store, idx) => (
                <div key={`admin-str-${store.id || idx}-${idx}`} className="neon-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-12 h-12 rounded-2xl border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center text-primary font-black shrink-0">
                      {store.logo ? <img src={store.logo} className="w-full h-full object-cover" /> : <Store size={20} />}
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-white uppercase italic tracking-tighter">{store.name}</h3>
                        <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-primary/10 border-primary/20 text-primary">
                          {store.category} Sector
                        </span>
                        {store.isVerified && (
                          <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-emerald-500/20 border-emerald-400/50 text-emerald-400 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                            <Check size={10} className="stroke-[3]" /> Verified Store
                          </span>
                        )}
                      </div>
                      <p className="text-[10px] text-gray-400 font-medium">{store.address || 'No location set'}</p>
                      
                      {/* Store Performance Stats for Admin */}
                      <div className="flex items-center gap-3 mt-2 flex-wrap text-[8.5px] font-bold">
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-cyan-300">
                          Order Clicks: <strong className="text-white font-black">{store.orderClicks || 0}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-emerald-300">
                          WhatsApp Engagements: <strong className="text-white font-black">{store.whatsappClicks || 0}</strong>
                        </span>
                        <span className="px-2 py-0.5 rounded-md bg-white/5 border border-white/10 text-primary">
                          Est. Sales: <strong className="text-white font-black">{formatCurrency(store.estimatedSalesUsd || 0, 'USD')}</strong>
                        </span>
                      </div>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => navigate(`/store/${store.id}`)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1 border border-white/10"
                    >
                      <ExternalLink size={12} /> View Store
                    </button>
                    <button 
                      onClick={() => handleStoreVerification(store.id, !store.isVerified)}
                      disabled={!!isProcessing}
                      className={cn(
                        "px-4 py-2 border text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                        store.isVerified 
                          ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" 
                          : "bg-emerald-500/20 border-emerald-400/50 text-emerald-400 hover:bg-emerald-500 hover:text-black shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                      )}
                    >
                      {isProcessing === store.id ? <Loader2 size={12} className="animate-spin" /> : <Shield size={14} className={store.isVerified ? "" : "fill-current"} />}
                      {store.isVerified ? 'Revoke Store Badge' : 'Verify Store Badge'}
                    </button>
                  </div>
                </div>
              ))}
              {filteredStores.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <Store size={32} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No Stores Located</p>
                </div>
              )}
            </motion.div>
          ) : activeTab === 'ads' ? (
            <motion.div 
              key="ads-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredSpotlights.map((ad, idx) => {
                const isClass = ad.isClassified || ad.type === 'classified';

                return (
                  <div key={`admin-ad-${ad.id || idx}-${idx}`} className="neon-card p-5 flex flex-col md:flex-row md:items-center justify-between gap-4 border-white/5 bg-[#0d1117] relative overflow-hidden">
                    <div className="flex items-start gap-4 flex-1">
                      <div className="w-20 h-20 rounded-2xl border border-white/10 bg-white/5 overflow-hidden shrink-0 flex items-center justify-center text-primary relative">
                        {ad.videoUrl ? (
                          <video src={ad.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                        ) : ad.image ? (
                          <img src={ad.image} className="w-full h-full object-cover" alt={ad.title} />
                        ) : (
                          <Megaphone size={32} />
                        )}
                        {ad.price && (
                          <div className="absolute bottom-0 inset-x-0 bg-primary text-[#05070a] font-black text-[8px] text-center py-0.5 truncate">
                            {ad.price}
                          </div>
                        )}
                      </div>

                      <div className="space-y-1.5 flex-1 min-w-0">
                        <div className="flex items-center gap-2 flex-wrap">
                          <h3 className="font-black text-white uppercase italic tracking-tighter text-sm truncate">{ad.title}</h3>
                          
                          {isClass ? (
                            <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-300">
                              Classified Ad
                            </span>
                          ) : (
                            <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-primary/10 border-primary/20 text-primary">
                              {ad.type || 'Spotlight'}
                            </span>
                          )}

                          {ad.category && (
                            <span className="text-[7.5px] font-bold uppercase tracking-wider px-2 py-0.5 rounded border bg-white/5 border-white/5 text-gray-400">
                              {ad.category}
                            </span>
                          )}

                          {ad.isApproved === false ? (
                            <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-amber-500/20 border-amber-400/50 text-amber-400 flex items-center gap-1 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                              <Clock size={10} /> Pending Approval
                            </span>
                          ) : (
                            <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-emerald-500/20 border-emerald-400/50 text-emerald-400 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.2)]">
                              <CheckCircle size={10} /> Approved & Live
                            </span>
                          )}
                        </div>

                        <p className="text-xs text-gray-300 font-medium line-clamp-2 leading-relaxed">
                          {ad.content}
                        </p>

                        <div className="flex items-center gap-4 text-[9px] text-gray-500 font-bold uppercase tracking-wider pt-1 flex-wrap">
                          <span>Author: <strong className="text-white">{ad.authorName || ad.authorId || 'Supplier'}</strong></span>
                          {ad.location && <span>Location: <strong className="text-gray-400">{ad.location}</strong></span>}
                          {ad.contactPhone && <span>Contact: <strong className="text-gray-400">{ad.contactPhone}</strong></span>}
                        </div>
                      </div>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 border-t md:border-t-0 pt-3 md:pt-0 border-white/5">
                      {ad.isApproved === false ? (
                        <button 
                          onClick={() => handleSpotlightApproval(ad.id, true)}
                          disabled={isProcessing === ad.id}
                          className="px-4 py-2.5 bg-emerald-500 hover:bg-emerald-600 text-[#05070a] font-black text-[9px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 shadow-[0_0_20px_rgba(16,185,129,0.3)] hover:scale-105 active:scale-95"
                        >
                          {isProcessing === ad.id ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />}
                          Approve Ad
                        </button>
                      ) : (
                        <button 
                          onClick={() => handleSpotlightApproval(ad.id, false)}
                          disabled={isProcessing === ad.id}
                          className="px-3.5 py-2.5 bg-amber-500/10 hover:bg-amber-500/20 text-amber-400 border border-amber-500/30 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5"
                        >
                          {isProcessing === ad.id ? <Loader2 size={12} className="animate-spin" /> : <XCircle size={14} />}
                          Revoke Approval
                        </button>
                      )}

                      <button 
                        onClick={() => handleSpotlightDelete(ad.id)}
                        disabled={isProcessing === ad.id}
                        className="p-2.5 bg-red-500/10 hover:bg-red-500 text-red-400 hover:text-white border border-red-500/20 font-black text-[9px] uppercase tracking-widest rounded-xl transition-all flex items-center justify-center"
                        title="Delete Ad"
                      >
                        {isProcessing === ad.id ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                      </button>
                    </div>
                  </div>
                );
              })}

              {filteredSpotlights.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <Megaphone size={32} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
                    {adFilter === 'pending' ? 'No Pending Ads Requiring Approval' : 'No Ads Located'}
                  </p>
                </div>
              )}
            </motion.div>
          ) : (
            <motion.div 
              key="products-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredProducts.map((product, idx) => (
                <div key={`admin-prd-${product.id || idx}-${idx}`} className="neon-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/5">
                  <div className="flex items-center gap-4">
                    <div className="w-14 h-14 rounded-2xl border border-white/10 bg-white/5 overflow-hidden shrink-0">
                      <img src={product.images[0]} className="w-full h-full object-cover" alt={product.name} />
                    </div>
                    <div>
                      <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="font-black text-white uppercase italic tracking-tighter">{product.name}</h3>
                        <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-primary/10 border-primary/20 text-primary">
                          {product.category}
                        </span>
                        {product.isVerified && (
                          <span className="text-[7.5px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-emerald-500/20 border-emerald-400/50 text-emerald-400 flex items-center gap-1 shadow-[0_0_12px_rgba(16,185,129,0.3)]">
                            <Check size={10} className="stroke-[3]" /> Verified Product
                          </span>
                        )}
                      </div>
                      <p className="text-xs font-black text-primary tracking-tight mt-0.5">{formatCurrency(product.price, product.currency)}</p>
                    </div>
                  </div>

                  <div className="flex items-center gap-2">
                    <button 
                      onClick={() => navigate(`/product/${product.id}`)}
                      className="px-3 py-2 bg-white/5 hover:bg-white/10 text-white text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1 border border-white/10"
                    >
                      <ExternalLink size={12} /> Inspect Item
                    </button>
                    <button 
                      onClick={() => handleProductVerification(product.id, !product.isVerified)}
                      disabled={!!isProcessing}
                      className={cn(
                        "px-4 py-2 border text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-2",
                        product.isVerified 
                          ? "bg-white/5 border-white/10 text-gray-400 hover:text-white" 
                          : "bg-emerald-500/20 border-emerald-400/50 text-emerald-400 hover:bg-emerald-500 hover:text-black shadow-[0_0_15px_rgba(16,185,129,0.25)]"
                      )}
                    >
                      {isProcessing === product.id ? <Loader2 size={12} className="animate-spin" /> : <Shield size={14} className={product.isVerified ? "" : "fill-current"} />}
                      {product.isVerified ? 'Revoke Product Badge' : 'Verify Product Badge'}
                    </button>
                  </div>
                </div>
              ))}
              {filteredProducts.length === 0 && (
                <div className="py-16 text-center space-y-3">
                  <ShoppingBag size={32} className="mx-auto text-gray-600" />
                  <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">No Products/Services Identified</p>
                </div>
              )}
            </motion.div>
          )}
        </AnimatePresence>
      </section>

      {/* Rules Notice */}
      <footer className="p-6 bg-red-500/5 rounded-[2rem] border border-red-500/10 space-y-3">
        <div className="flex items-center gap-2 text-red-500 font-black uppercase tracking-[0.2em] text-[10px]">
          <AlertCircle size={16} /> Automation Protocol Sigma
        </div>
        <p className="text-[9px] text-gray-500 leading-relaxed uppercase tracking-widest">
          Any user or item reported <span className="text-white">3 times</span> within a solar cycle (month) is automatically transitioned to <span className="text-amber-500">Quarantine Phase</span> for a duration of 14 units. Command overrides are permitted via this console.
        </p>
      </footer>

      {/* Quarantine configuration Modal */}
      <AnimatePresence>
        {quarantineUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md"
              onClick={() => setQuarantineUser(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0d1117] border border-white/10 rounded-[2rem] overflow-hidden shadow-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-amber-500/20 rounded-xl flex items-center justify-center text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.2)]">
                    <Pause size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase italic tracking-tighter">Suspend Account</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{quarantineUser.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setQuarantineUser(null)}
                  className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider leading-relaxed">
                  Select the suspension duration metrics for this user. The operator will be locked out and receive a warning prompt upon synchronization attempts.
                </p>

                <div className="grid grid-cols-1 gap-2">
                  {[
                    { label: '24 Hours', days: 1, durationLabel: '24 hrs' },
                    { label: '3 Days', days: 3, durationLabel: '3 days' },
                    { label: '1 Week', days: 7, durationLabel: '1 week' },
                    { label: '2 Weeks', days: 14, durationLabel: '2 weeks' },
                    { label: '1 Month', days: 30, durationLabel: '1 month' }
                  ].map((opt) => {
                    const isSelected = selectedDuration?.durationLabel === opt.durationLabel;
                    return (
                      <button
                        key={opt.durationLabel}
                        onClick={() => setSelectedDuration(opt)}
                        className={cn(
                          "flex items-center justify-between p-3 rounded-xl border text-left transition-all group",
                          isSelected
                            ? "bg-amber-500/10 border-amber-500 text-amber-500 shadow-[0_0_15px_rgba(245,158,11,0.15)]"
                            : "bg-white/5 border-white/5 hover:border-amber-500/30 hover:bg-amber-500/5 text-gray-400 hover:text-white"
                        )}
                      >
                        <span className={cn(
                          "text-xs font-black uppercase tracking-tight transition-colors",
                          isSelected ? "text-amber-500" : "text-white group-hover:text-amber-500"
                        )}>
                          {opt.label}
                        </span>
                        <span className={cn(
                          "text-[9px] font-bold uppercase tracking-widest px-2 py-0.5 rounded border transition-colors",
                          isSelected
                            ? "border-amber-500/30 text-amber-500 bg-amber-500/10"
                            : "bg-white/5 border-white/5 text-gray-500 group-hover:border-amber-500/20 group-hover:text-amber-500"
                        )}>
                          {opt.durationLabel}
                        </span>
                      </button>
                    );
                  })}
                </div>

                <AnimatePresence>
                  {selectedDuration && (
                    <motion.div
                      initial={{ opacity: 0, y: 10, height: 0 }}
                      animate={{ opacity: 1, y: 0, height: 'auto' }}
                      exit={{ opacity: 0, y: 10, height: 0 }}
                      className="pt-2"
                    >
                      <button
                        onClick={async () => {
                          if (!selectedDuration) return;
                          await handleUserStatus(quarantineUser.uid, 'suspended', selectedDuration.days, selectedDuration.durationLabel);
                          setQuarantineUser(null);
                        }}
                        disabled={!!isProcessing}
                        className="w-full py-4 bg-amber-500 hover:bg-amber-600 text-black text-[10px] font-black uppercase tracking-[0.2em] rounded-2xl transition-all shadow-[0_0_30px_rgba(245,158,11,0.4)] flex items-center justify-center gap-2 hover:scale-[1.02] active:scale-[0.98] border border-amber-400/50 animate-pulse"
                      >
                        {isProcessing === quarantineUser.uid ? (
                          <Loader2 size={14} className="animate-spin" />
                        ) : (
                          <Pause size={14} className="fill-current" />
                        )}
                        Suspend Account
                      </button>
                    </motion.div>
                  )}
                </AnimatePresence>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Purge user configuration Modal */}
      <AnimatePresence>
        {purgeUser && (
          <div className="fixed inset-0 z-[1000] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05070a]/95 backdrop-blur-md"
              onClick={() => setPurgeUser(null)}
            />
            
            <motion.div 
              initial={{ opacity: 0, scale: 0.95, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 20 }}
              className="relative w-full max-w-md bg-[#0d1117] border border-red-500/20 rounded-[2rem] overflow-hidden shadow-2xl p-6 space-y-6"
            >
              <div className="flex items-center justify-between border-b border-white/5 pb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-red-500/20 rounded-xl flex items-center justify-center text-red-500 shadow-[0_0_15px_rgba(239,68,68,0.3)]">
                    <AlertTriangle size={20} />
                  </div>
                  <div>
                    <h3 className="text-sm font-black text-white uppercase italic tracking-tighter text-red-500">Delete User</h3>
                    <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{purgeUser.name}</p>
                  </div>
                </div>
                <button 
                  onClick={() => setPurgeUser(null)}
                  className="w-8 h-8 bg-white/5 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 flex items-start gap-3">
                  <AlertTriangle size={18} className="shrink-0 mt-0.5" />
                  <div className="space-y-1">
                    <p className="text-[10px] font-black uppercase tracking-wider">CRITICAL WAR ROOM ACTION REQUIRED</p>
                    <p className="text-[9px] text-red-400 font-medium leading-relaxed uppercase">
                      This action will completely wipe all traces of this user from the system including:
                    </p>
                    <ul className="list-disc pl-4 text-[9px] text-red-300 font-medium uppercase space-y-0.5 mt-1">
                      <li>User Profile Registry</li>
                      <li>Public Profile Details</li>
                      <li>Active Stores and Products</li>
                      <li>All listed Products and Inventory Feed</li>
                    </ul>
                  </div>
                </div>
                
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest text-center">THIS OPERATION IS IRREVERSIBLE.</p>
              </div>

              <div className="flex gap-3">
                <button
                  onClick={() => setPurgeUser(null)}
                  className="flex-1 py-3 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white text-[10px] font-black uppercase tracking-widest transition-colors"
                >
                  Cancel
                </button>
                <button
                  onClick={() => handleWipeUser(purgeUser.uid)}
                  className="flex-1 py-3 bg-red-500 hover:bg-red-600 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-colors flex items-center justify-center gap-2 shadow-lg shadow-red-500/20"
                >
                  {isProcessing === purgeUser.uid ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                  Execute Wipe
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}
