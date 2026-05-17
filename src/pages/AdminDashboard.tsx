import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  ShieldAlert, Users, Search, Filter, CheckCircle, Info, XCircle, ArrowRight, 
  Trash2, Pause, Play, AlertCircle, Calendar, Hash, Tag, User as UserIcon, Store, ShoppingBag, ExternalLink, Loader2
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, orderBy, onSnapshot, doc, updateDoc, getDocs, where, writeBatch, serverTimestamp } from 'firebase/firestore';
import { Report, UserProfile, Role } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { useNavigate } from 'react-router-dom';

export default function AdminDashboard({ profile }: { profile: UserProfile | null }) {
  const navigate = useNavigate();
  const [activeTab, setActiveTab] = useState<'reports' | 'users'>('reports');
  const [reports, setReports] = useState<Report[]>([]);
  const [users, setUsers] = useState<UserProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [statusFilter, setStatusFilter] = useState<'all' | 'pending' | 'resolved' | 'dismissed'>('all');
  const [isProcessing, setIsProcessing] = useState<string | null>(null);

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

    return () => {
      unsubscribeReports();
      unsubscribeUsers();
    };
  }, []);

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

  const handleUserStatus = async (userId: string, newStatus: 'active' | 'suspended' | 'banned', days?: number) => {
    setIsProcessing(userId);
    try {
      const updates: any = { status: newStatus, updatedAt: serverTimestamp() };
      
      if (newStatus === 'suspended' && days) {
        const suspensionEnd = new Date();
        suspensionEnd.setDate(suspensionEnd.getDate() + days);
        updates.suspensionEnd = suspensionEnd.toISOString();
      } else if (newStatus === 'active') {
        updates.suspensionEnd = null;
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

        <div className="flex bg-[#0d1117] border border-white/5 p-1 rounded-2xl">
          <button 
            onClick={() => setActiveTab('reports')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center",
              activeTab === 'reports' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <ShieldAlert size={14} />
            Abuse Feed
            {reports.filter(r => r.status === 'pending').length > 0 && (
              <span className="bg-white text-red-500 px-1.5 py-0.5 rounded-full text-[8px]">{reports.filter(r => r.status === 'pending').length}</span>
            )}
          </button>
          <button 
            onClick={() => setActiveTab('users')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all gap-2 flex items-center",
              activeTab === 'users' ? "bg-red-500 text-white shadow-lg shadow-red-500/20" : "text-gray-500 hover:text-white"
            )}
          >
            <Users size={14} />
            Node Management
          </button>
        </div>
      </header>

      {/* Stats Bar */}
      <section className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: 'Total Conflicts', value: reports.length, icon: ShieldAlert, color: 'text-red-500' },
          { label: 'Pending Dispatch', value: reports.filter(r => r.status === 'pending').length, icon: AlertCircle, color: 'text-amber-500' },
          { label: 'Node Network', value: users.length, icon: Users, color: 'text-primary' },
          { label: 'Quarantined', value: users.filter(u => u.status !== 'active' && u.status !== undefined).length, icon: XCircle, color: 'text-gray-500' }
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
              placeholder={activeTab === 'reports' ? "Search conflicts..." : "Search node registry..."}
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
              {filteredReports.map((report) => (
                <div key={report.id} className="neon-card p-5 space-y-4 border-white/5 hover:border-red-500/20 transition-all group">
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
          ) : (
            <motion.div 
              key="users-grid"
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -20 }}
              className="grid gap-4"
            >
              {filteredUsers.map((user) => (
                <div key={user.uid} className="neon-card p-5 flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-white/5">
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
                      </div>
                      <p className="text-[10px] text-gray-500 font-bold">{user.email || user.phone}</p>
                      {user.suspensionEnd && (
                        <p className="text-[8px] text-amber-500 font-black uppercase tracking-widest mt-1">Suspended until: {new Date(user.suspensionEnd).toLocaleDateString()}</p>
                      )}
                    </div>
                  </div>

                  <div className="flex flex-wrap gap-2">
                    {user.status === 'suspended' || user.status === 'banned' ? (
                      <button 
                        onClick={() => handleUserStatus(user.uid, 'active')}
                        disabled={!!isProcessing}
                        className="px-4 py-2 bg-neon-green/10 border border-neon-green/30 text-neon-green text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-neon-green hover:text-black transition-all flex items-center gap-2"
                      >
                         {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <CheckCircle size={14} />}
                         Reactivate Node
                      </button>
                    ) : (
                      <>
                        <button 
                          onClick={() => handleUserStatus(user.uid, 'suspended', 14)}
                          disabled={!!isProcessing}
                          className="px-4 py-2 bg-amber-500/10 border border-amber-500/30 text-amber-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-amber-500 hover:text-black transition-all flex items-center gap-2"
                        >
                           {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Pause size={14} />}
                           Quarantine (14d)
                        </button>
                        <button 
                          onClick={() => handleUserStatus(user.uid, 'banned')}
                          disabled={!!isProcessing}
                          className="px-4 py-2 bg-red-500/10 border border-red-500/30 text-red-500 text-[9px] font-black uppercase tracking-widest rounded-xl hover:bg-red-500 hover:text-white transition-all flex items-center gap-2"
                        >
                           {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={14} />}
                           Purge Access
                        </button>
                      </>
                    )}
                  </div>
                </div>
              ))}
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
          Any operational node or data-point reported <span className="text-white">3 times</span> within a solar cycle (month) is automatically transitioned to <span className="text-amber-500">Quarantine Phase</span> for a duration of 14 units. Command overrides are permitted via this console.
        </p>
      </footer>
    </motion.div>
  );
}
