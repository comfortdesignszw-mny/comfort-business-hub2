import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import {
  Search, Shield, Pause, Play, CheckCircle, XCircle, Trash2, Loader2,
  ChevronLeft, ChevronRight, Copy, Check, Eye, Users, RefreshCw, Filter,
  SlidersHorizontal, UserCheck, ShieldAlert, AlertTriangle, ArrowUpDown,
  Phone, Mail, Building, Calendar, MapPin, CreditCard, ChevronDown, ChevronUp
} from 'lucide-react';
import { UserProfile } from '../types';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, getCountFromServer } from 'firebase/firestore';
import { cn } from '../lib/utils';

interface AdminUserDataTableProps {
  users: UserProfile[];
  profile: UserProfile | null;
  isProcessing: string | null;
  onVerifyUser: (userId: string, isVerified: boolean) => Promise<void>;
  onStatusChange: (userId: string, status: 'active' | 'suspended' | 'banned', days?: number, durationLabel?: string) => Promise<void>;
  onToggleAdminRole?: (userId: string, makeAdmin: boolean) => Promise<void>;
  onQuarantineClick: (user: UserProfile) => void;
  onPurgeClick: (user: UserProfile) => void;
  onRefreshData?: () => void;
}

export const AdminUserDataTable: React.FC<AdminUserDataTableProps> = ({
  users,
  profile,
  isProcessing,
  onVerifyUser,
  onStatusChange,
  onToggleAdminRole,
  onQuarantineClick,
  onPurgeClick,
  onRefreshData
}) => {
  // Search & Filter States
  const [searchQuery, setSearchQuery] = useState('');
  const [roleFilter, setRoleFilter] = useState<'all' | 'supplier' | 'customer' | 'admin'>('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'active' | 'suspended' | 'banned' | 'verified'>('all');
  const [sortBy, setSortBy] = useState<'name' | 'role' | 'status' | 'updated'>('updated');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('desc');

  // Pagination States
  const [currentPage, setCurrentPage] = useState(1);
  const [pageSize, setPageSize] = useState(10);

  // Server Count & Analytics
  const [serverUserCount, setServerUserCount] = useState<number | null>(null);
  const [isCounting, setIsCounting] = useState(false);

  // Expanded detail drawer
  const [expandedUserId, setExpandedUserId] = useState<string | null>(null);
  const [copiedUid, setCopiedUid] = useState<string | null>(null);

  // Fetch total count directly from Firestore server aggregation
  const fetchTotalCount = async () => {
    setIsCounting(true);
    try {
      const snap = await getCountFromServer(collection(db, 'users'));
      setServerUserCount(snap.data().count);
    } catch (err) {
      console.warn('Could not fetch server user count:', err);
      setServerUserCount(users.length);
    } finally {
      setIsCounting(false);
    }
  };

  useEffect(() => {
    fetchTotalCount();
  }, [users.length]);

  // Compute analytics
  const analytics = useMemo(() => {
    const total = serverUserCount !== null ? serverUserCount : users.length;
    const active = users.filter(u => u.status !== 'suspended' && u.status !== 'banned').length;
    const verified = users.filter(u => u.isVerified).length;
    const quarantined = users.filter(u => u.status === 'suspended').length;
    const banned = users.filter(u => u.status === 'banned').length;
    const admins = users.filter(u => u.isAdmin || u.email === 'comfort.designszw@gmail.com').length;
    const suppliers = users.filter(u => u.currentRole === 'supplier').length;
    const customers = users.filter(u => u.currentRole === 'customer').length;

    return { total, active, verified, quarantined, banned, admins, suppliers, customers };
  }, [users, serverUserCount]);

  // Filtered and Sorted Users
  const filteredUsers = useMemo(() => {
    return users.filter(u => {
      const query = searchQuery.toLowerCase().trim();
      const matchesSearch =
        !query ||
        (u.name && u.name.toLowerCase().includes(query)) ||
        (u.email && u.email.toLowerCase().includes(query)) ||
        (u.phone && u.phone.toLowerCase().includes(query)) ||
        (u.businessName && u.businessName.toLowerCase().includes(query)) ||
        (u.uid && u.uid.toLowerCase().includes(query));

      const matchesRole =
        roleFilter === 'all' ||
        (roleFilter === 'admin' ? (u.isAdmin || u.email === 'comfort.designszw@gmail.com') : u.currentRole === roleFilter);

      let matchesStatus = true;
      if (statusFilter === 'active') matchesStatus = u.status !== 'suspended' && u.status !== 'banned';
      else if (statusFilter === 'suspended') matchesStatus = u.status === 'suspended';
      else if (statusFilter === 'banned') matchesStatus = u.status === 'banned';
      else if (statusFilter === 'verified') matchesStatus = u.isVerified === true;

      return matchesSearch && matchesRole && matchesStatus;
    }).sort((a, b) => {
      let compA: any = '';
      let compB: any = '';

      if (sortBy === 'name') {
        compA = (a.name || '').toLowerCase();
        compB = (b.name || '').toLowerCase();
      } else if (sortBy === 'role') {
        compA = a.currentRole || '';
        compB = b.currentRole || '';
      } else if (sortBy === 'status') {
        compA = a.status || 'active';
        compB = b.status || 'active';
      } else if (sortBy === 'updated') {
        const getMs = (val: any) => {
          if (!val) return 0;
          if (typeof val.toMillis === 'function') return val.toMillis();
          if (typeof val === 'string') return new Date(val).getTime();
          return 0;
        };
        compA = getMs(a.updatedAt || a.createdAt);
        compB = getMs(b.updatedAt || b.createdAt);
      }

      if (compA < compB) return sortOrder === 'asc' ? -1 : 1;
      if (compA > compB) return sortOrder === 'asc' ? 1 : -1;
      return 0;
    });
  }, [users, searchQuery, roleFilter, statusFilter, sortBy, sortOrder]);

  // Reset to page 1 on filter changes
  useEffect(() => {
    setCurrentPage(1);
  }, [searchQuery, roleFilter, statusFilter, pageSize]);

  // Pagination calculation
  const totalItems = filteredUsers.length;
  const totalPages = Math.max(1, Math.ceil(totalItems / pageSize));
  const safeCurrentPage = Math.min(currentPage, totalPages);

  const paginatedUsers = useMemo(() => {
    const startIdx = (safeCurrentPage - 1) * pageSize;
    return filteredUsers.slice(startIdx, startIdx + pageSize);
  }, [filteredUsers, safeCurrentPage, pageSize]);

  const handleCopyUid = (uid: string) => {
    navigator.clipboard.writeText(uid);
    setCopiedUid(uid);
    setTimeout(() => setCopiedUid(null), 2000);
  };

  const formatDate = (val: any) => {
    if (!val) return 'N/A';
    try {
      if (typeof val.toDate === 'function') return val.toDate().toLocaleDateString();
      if (typeof val === 'string') return new Date(val).toLocaleDateString();
    } catch {
      return 'N/A';
    }
    return 'N/A';
  };

  return (
    <div className="space-y-6">
      {/* Total Number of Users Analytics Header */}
      <div className="grid grid-cols-2 sm:grid-cols-4 lg:grid-cols-6 gap-3">
        <div className="neon-card p-4 border-white/5 bg-[#0d1117] flex flex-col justify-between space-y-1">
          <div className="flex items-center justify-between text-gray-400">
            <span className="text-[9px] font-black uppercase tracking-widest text-primary">Total Users</span>
            <button
              onClick={fetchTotalCount}
              title="Refresh Firestore user count"
              className="hover:text-primary transition-colors"
            >
              <RefreshCw size={12} className={isCounting ? 'animate-spin text-primary' : ''} />
            </button>
          </div>
          <div className="text-xl sm:text-2xl font-black text-white italic tracking-tight">
            {analytics.total}
          </div>
          <p className="text-[7.5px] text-gray-500 font-bold uppercase tracking-widest">
            {serverUserCount !== null ? 'Verified via Firestore' : 'Snapshot loaded'}
          </p>
        </div>

        <div className="neon-card p-4 border-white/5 bg-[#0d1117] flex flex-col justify-between space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-emerald-400">Active</span>
          <div className="text-xl sm:text-2xl font-black text-emerald-400 italic tracking-tight">
            {analytics.active}
          </div>
          <p className="text-[7.5px] text-gray-500 font-bold uppercase tracking-widest">Operational</p>
        </div>

        <div className="neon-card p-4 border-white/5 bg-[#0d1117] flex flex-col justify-between space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-neon-green">Verified</span>
          <div className="text-xl sm:text-2xl font-black text-neon-green italic tracking-tight">
            {analytics.verified}
          </div>
          <p className="text-[7.5px] text-gray-500 font-bold uppercase tracking-widest">Shield Approved</p>
        </div>

        <div className="neon-card p-4 border-white/5 bg-[#0d1117] flex flex-col justify-between space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">System Admins</span>
          <div className="text-xl sm:text-2xl font-black text-purple-400 italic tracking-tight">
            {analytics.admins}
          </div>
          <p className="text-[7.5px] text-gray-500 font-bold uppercase tracking-widest">Command Tier</p>
        </div>

        <div className="neon-card p-4 border-white/5 bg-[#0d1117] flex flex-col justify-between space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-amber-400">Quarantined / Banned</span>
          <div className="text-xl sm:text-2xl font-black text-amber-400 italic tracking-tight flex items-baseline gap-1">
            <span className="text-amber-400">{analytics.quarantined}</span>
            <span className="text-gray-600">/</span>
            <span className="text-red-500">{analytics.banned}</span>
          </div>
          <p className="text-[7.5px] text-gray-500 font-bold uppercase tracking-widest">Restricted Access</p>
        </div>

        <div className="neon-card p-4 border-white/5 bg-[#0d1117] flex flex-col justify-between space-y-1">
          <span className="text-[9px] font-black uppercase tracking-widest text-purple-400">Suppliers / Cust</span>
          <div className="text-base sm:text-lg font-black text-white italic tracking-tight flex items-baseline gap-1">
            <span className="text-primary">{analytics.suppliers}</span>
            <span className="text-gray-600">/</span>
            <span className="text-cyan-400">{analytics.customers}</span>
          </div>
          <p className="text-[7.5px] text-gray-500 font-bold uppercase tracking-widest">Ratio</p>
        </div>
      </div>

      {/* Control Bar: Search, Filters, Page Size */}
      <div className="neon-card p-4 bg-[#0d1117] border-white/5 flex flex-col lg:flex-row gap-3 items-stretch lg:items-center justify-between">
        {/* Search Field */}
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={14} />
          <input
            type="text"
            value={searchQuery}
            onChange={e => setSearchQuery(e.target.value)}
            placeholder="Filter by Name, Email, Phone, Business, or UID..."
            className="w-full bg-white/5 border border-white/10 rounded-xl pl-10 pr-4 py-2 text-xs text-white placeholder:text-gray-600 focus:outline-none focus:border-red-500/50 transition-colors"
          />
          {searchQuery && (
            <button
              onClick={() => setSearchQuery('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white text-[10px] font-bold uppercase"
            >
              Clear
            </button>
          )}
        </div>

        {/* Dropdown Filters */}
        <div className="flex flex-wrap items-center gap-2">
          {/* Role Filter */}
          <select
            value={roleFilter}
            onChange={e => setRoleFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-white tracking-wider focus:outline-none focus:border-red-500/50 cursor-pointer"
          >
            <option value="all" className="bg-[#0d1117] text-white">All Roles</option>
            <option value="supplier" className="bg-[#0d1117] text-white">Suppliers</option>
            <option value="customer" className="bg-[#0d1117] text-white">Customers / Partners</option>
            <option value="admin" className="bg-[#0d1117] text-white">Admins</option>
          </select>

          {/* Status Filter */}
          <select
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value as any)}
            className="bg-white/5 border border-white/10 rounded-xl px-3 py-2 text-[10px] font-black uppercase text-white tracking-wider focus:outline-none focus:border-red-500/50 cursor-pointer"
          >
            <option value="all" className="bg-[#0d1117] text-white">All Statuses</option>
            <option value="active" className="bg-[#0d1117] text-white">Active Only</option>
            <option value="verified" className="bg-[#0d1117] text-white">Verified Only</option>
            <option value="suspended" className="bg-[#0d1117] text-white">Quarantined</option>
            <option value="banned" className="bg-[#0d1117] text-white">Banned</option>
          </select>

          {/* Sort By */}
          <div className="flex items-center gap-1 bg-white/5 border border-white/10 rounded-xl px-2 py-1">
            <select
              value={sortBy}
              onChange={e => setSortBy(e.target.value as any)}
              className="bg-transparent text-[10px] font-black uppercase text-white tracking-wider focus:outline-none cursor-pointer"
            >
              <option value="updated" className="bg-[#0d1117] text-white">Sort: Last Active</option>
              <option value="name" className="bg-[#0d1117] text-white">Sort: Name</option>
              <option value="role" className="bg-[#0d1117] text-white">Sort: Role</option>
              <option value="status" className="bg-[#0d1117] text-white">Sort: Status</option>
            </select>
            <button
              onClick={() => setSortOrder(prev => (prev === 'asc' ? 'desc' : 'asc'))}
              title={`Toggle sort order (${sortOrder.toUpperCase()})`}
              className="text-gray-400 hover:text-white p-1"
            >
              <ArrowUpDown size={12} />
            </button>
          </div>

          {/* Page Size Selector */}
          <div className="flex items-center gap-1.5 text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            <span>Show:</span>
            <select
              value={pageSize}
              onChange={e => setPageSize(Number(e.target.value))}
              className="bg-white/5 border border-white/10 rounded-xl px-2 py-1 text-[10px] font-black text-white focus:outline-none cursor-pointer"
            >
              <option value={10} className="bg-[#0d1117] text-white">10</option>
              <option value={25} className="bg-[#0d1117] text-white">25</option>
              <option value={50} className="bg-[#0d1117] text-white">50</option>
              <option value={100} className="bg-[#0d1117] text-white">100</option>
            </select>
          </div>

          {onRefreshData && (
            <button
              onClick={onRefreshData}
              title="Sync with latest Firestore data"
              className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-400 hover:text-white transition-colors"
            >
              <RefreshCw size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Main Paginated Data Table Container */}
      <div className="neon-card p-0 bg-[#0d1117] border-white/5 overflow-hidden">
        <div className="overflow-x-auto custom-scrollbar">
          <table className="w-full text-left border-collapse min-w-[850px]">
            <thead>
              <tr className="border-b border-white/10 bg-white/5 text-[9px] font-black text-gray-400 uppercase tracking-widest select-none">
                <th className="py-3.5 px-4">Operator / Account</th>
                <th className="py-3.5 px-4">Contact & Entity</th>
                <th className="py-3.5 px-4">Role / Access Tier</th>
                <th className="py-3.5 px-4">Status & Shield</th>
                <th className="py-3.5 px-4">Last Activity</th>
                <th className="py-3.5 px-4 text-right">Tactical Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-white/5 text-xs">
              {paginatedUsers.map((user, idx) => {
                const isExpanded = expandedUserId === user.uid;
                const isSelf = profile?.uid === user.uid;
                const isPrimaryAdmin = user.email === 'comfort.designszw@gmail.com' || user.isAdmin;

                return (
                  <React.Fragment key={`user-row-${user.uid || idx}-${idx}`}>
                    <tr className="hover:bg-white/[0.02] transition-colors group">
                      {/* Operator / Account Column */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-3">
                          <div className="relative">
                            <div className="w-10 h-10 rounded-full border border-white/10 bg-white/5 overflow-hidden flex items-center justify-center text-white font-black shrink-0">
                              {user.avatar ? (
                                <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" alt="" />
                              ) : (
                                (user.name || 'U').charAt(0).toUpperCase()
                              )}
                            </div>
                            {user.status === 'suspended' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-amber-500 rounded-full flex items-center justify-center text-black border-2 border-[#0d1117]">
                                <Pause size={8} />
                              </div>
                            )}
                            {user.status === 'banned' && (
                              <div className="absolute -top-1 -right-1 w-4 h-4 bg-red-500 rounded-full flex items-center justify-center text-white border-2 border-[#0d1117]">
                                <XCircle size={8} />
                              </div>
                            )}
                          </div>

                          <div className="space-y-0.5 min-w-0">
                            <div className="flex items-center gap-1.5 flex-wrap">
                              <span className="font-black text-white uppercase italic tracking-tight truncate max-w-[140px] sm:max-w-[180px]">
                                {user.name || user.displayName || 'Anonymous Operator'}
                              </span>
                              {isPrimaryAdmin && (
                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-primary/20 border border-primary/30 text-primary">
                                  Admin
                                </span>
                              )}
                              {isSelf && (
                                <span className="text-[7px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded bg-cyan-500/20 border border-cyan-500/30 text-cyan-400">
                                  You
                                </span>
                              )}
                            </div>

                            <div className="flex items-center gap-1.5 text-[9px] text-gray-500 font-mono">
                              <span className="truncate max-w-[110px]" title={user.uid}>
                                ID: {user.uid ? `${user.uid.substring(0, 10)}...` : 'N/A'}
                              </span>
                              <button
                                onClick={() => handleCopyUid(user.uid)}
                                title="Copy UID to clipboard"
                                className="text-gray-500 hover:text-white transition-colors"
                              >
                                {copiedUid === user.uid ? <Check size={10} className="text-neon-green" /> : <Copy size={10} />}
                              </button>
                            </div>
                          </div>
                        </div>
                      </td>

                      {/* Contact & Entity Column */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          <div className="flex items-center gap-1.5 text-[10px] text-gray-300 font-medium">
                            <Mail size={11} className="text-gray-500 shrink-0" />
                            <span className="truncate max-w-[160px]" title={user.email || 'No Email'}>
                              {user.email || 'No Email Registered'}
                            </span>
                          </div>

                          {user.phone && (
                            <div className="flex items-center gap-1.5 text-[9.5px] text-gray-400">
                              <Phone size={10} className="text-gray-500 shrink-0" />
                              <span>{user.phone}</span>
                            </div>
                          )}

                          {user.businessName && (
                            <div className="flex items-center gap-1.5 text-[9px] text-primary font-bold uppercase tracking-wider">
                              <Building size={10} className="shrink-0" />
                              <span className="truncate max-w-[140px]">{user.businessName}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Role & Access Tier */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1">
                          {isPrimaryAdmin ? (
                            <span className="inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-purple-500/20 border-purple-500/40 text-purple-300 shadow-[0_0_10px_rgba(168,85,247,0.15)]">
                              Admin Role
                            </span>
                          ) : (
                            <span
                              className={cn(
                                "inline-block text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border",
                                user.currentRole === 'supplier'
                                  ? "bg-accent/10 border-accent/30 text-accent"
                                  : "bg-primary/10 border-primary/30 text-primary"
                              )}
                            >
                              {user.currentRole === 'supplier' ? 'Supplier' : 'Customer / Partner'}
                            </span>
                          )}

                          {user.authMethod && (
                            <div className="text-[8px] text-gray-500 uppercase tracking-widest font-bold">
                              Auth: <span className="text-gray-400">{user.authMethod}</span>
                            </div>
                          )}
                        </div>
                      </td>

                      {/* Status & Shield */}
                      <td className="py-3.5 px-4">
                        <div className="space-y-1.5">
                          <div className="flex items-center gap-1.5 flex-wrap">
                            {user.status === 'suspended' ? (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-amber-500/10 border-amber-500/30 text-amber-400 animate-pulse flex items-center gap-1">
                                <Pause size={9} /> Quarantined
                              </span>
                            ) : user.status === 'banned' ? (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-red-500/10 border-red-500/30 text-red-500 flex items-center gap-1">
                                <XCircle size={9} /> Banned
                              </span>
                            ) : (
                              <span className="text-[8px] font-black uppercase tracking-widest px-2 py-0.5 rounded border bg-emerald-500/10 border-emerald-500/30 text-emerald-400 flex items-center gap-1">
                                <CheckCircle size={9} /> Active
                              </span>
                            )}

                            {user.isVerified && (
                              <span className="text-[7.5px] font-black uppercase tracking-widest px-1.5 py-0.5 rounded border bg-neon-green/10 border-neon-green/30 text-neon-green flex items-center gap-1">
                                <Shield size={9} className="fill-current" /> Verified
                              </span>
                            )}
                          </div>

                          {user.status === 'suspended' && user.suspensionEnd && (
                            <p className="text-[7.5px] text-amber-500 font-bold uppercase tracking-widest">
                              Until: {new Date(user.suspensionEnd).toLocaleDateString()}
                            </p>
                          )}
                        </div>
                      </td>

                      {/* Last Activity */}
                      <td className="py-3.5 px-4 text-[10px] text-gray-400 font-mono">
                        {formatDate(user.updatedAt || user.createdAt)}
                      </td>

                      {/* Tactical Actions */}
                      <td className="py-3.5 px-4 text-right">
                        <div className="flex items-center justify-end gap-1.5">
                          {/* Toggle expand drawer */}
                          <button
                            onClick={() => setExpandedUserId(isExpanded ? null : user.uid)}
                            title="Inspect detailed metadata"
                            className="p-1.5 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white transition-colors"
                          >
                            <Eye size={12} />
                          </button>

                          {/* Promote / Demote Admin Role Button */}
                          {onToggleAdminRole && (
                            <button
                              onClick={() => onToggleAdminRole(user.uid, !isPrimaryAdmin)}
                              disabled={!!isProcessing}
                              title={
                                isPrimaryAdmin
                                  ? (analytics.admins <= 1 ? 'Cannot demote last active admin account' : 'Demote from Admin role')
                                  : 'Promote user to Admin role'
                              }
                              className={cn(
                                "p-1.5 border text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1",
                                isPrimaryAdmin
                                  ? "bg-purple-500/20 border-purple-500/40 text-purple-300 hover:bg-purple-500 hover:text-white"
                                  : "bg-purple-500/10 border-purple-500/20 text-purple-400 hover:bg-purple-500 hover:text-white"
                              )}
                            >
                              {isProcessing === user.uid ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <ShieldAlert size={12} className={isPrimaryAdmin ? "fill-current" : ""} />
                              )}
                            </button>
                          )}

                          {!isPrimaryAdmin && (
                            <button
                              onClick={() => onVerifyUser(user.uid, !user.isVerified)}
                              disabled={!!isProcessing}
                              title={user.isVerified ? 'Revoke Verification' : 'Verify Operator'}
                              className={cn(
                                "p-1.5 border text-[9px] font-black uppercase tracking-widest rounded-lg transition-all flex items-center gap-1",
                                user.isVerified
                                  ? "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                  : "bg-neon-green/10 border-neon-green/30 text-neon-green hover:bg-neon-green hover:text-black"
                              )}
                            >
                              {isProcessing === user.uid ? (
                                <Loader2 size={12} className="animate-spin" />
                              ) : (
                                <Shield size={12} className={user.isVerified ? "" : "fill-current"} />
                              )}
                            </button>
                          )}

                          {(!isPrimaryAdmin || analytics.admins > 1) && !isSelf && (
                            <>
                              {user.status === 'suspended' || user.status === 'banned' ? (
                                <button
                                  onClick={() => onStatusChange(user.uid, 'active')}
                                  disabled={!!isProcessing}
                                  title="Reactivate Account"
                                  className="p-1.5 bg-emerald-500/10 border border-emerald-500/30 text-emerald-400 hover:bg-emerald-500 hover:text-black rounded-lg transition-all"
                                >
                                  {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Play size={12} />}
                                </button>
                              ) : (
                                <button
                                  onClick={() => onQuarantineClick(user)}
                                  disabled={!!isProcessing}
                                  title="Quarantine User"
                                  className="p-1.5 bg-amber-500/10 border border-amber-500/30 text-amber-500 hover:bg-amber-500 hover:text-black rounded-lg transition-all"
                                >
                                  {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Pause size={12} />}
                                </button>
                              )}

                              <button
                                onClick={() => onPurgeClick(user)}
                                disabled={!!isProcessing}
                                title="Remove / Purge Access"
                                className="p-1.5 bg-red-500/10 border border-red-500/30 text-red-500 hover:bg-red-500 hover:text-white rounded-lg transition-all"
                              >
                                {isProcessing === user.uid ? <Loader2 size={12} className="animate-spin" /> : <Trash2 size={12} />}
                              </button>
                            </>
                          )}
                        </div>
                      </td>
                    </tr>

                    {/* Expanded Detail Drawer */}
                    {isExpanded && (
                      <tr className="bg-white/[0.015] border-b border-white/10">
                        <td colSpan={6} className="p-4 sm:p-5">
                          <div className="grid grid-cols-1 md:grid-cols-3 gap-4 text-xs bg-[#05070a] p-4 rounded-2xl border border-white/10">
                            {/* Metadata Column */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5">
                                <Users size={12} /> Account Specifications
                              </h4>
                              <div className="space-y-1 text-[11px] text-gray-300">
                                <p><span className="text-gray-500 font-bold">Full UID:</span> <code className="text-white text-[10px] font-mono select-all">{user.uid}</code></p>
                                <p><span className="text-gray-500 font-bold">Email Verified:</span> {user.phoneVerified ? 'Yes' : 'Unverified'}</p>
                                <p><span className="text-gray-500 font-bold">Auth Method:</span> {user.authMethod || 'Google / Standard'}</p>
                                <p><span className="text-gray-500 font-bold">WhatsApp:</span> {user.whatsappNumber || 'None'}</p>
                              </div>
                            </div>

                            {/* Location Column */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-cyan-400 uppercase tracking-widest flex items-center gap-1.5">
                                <MapPin size={12} /> Tactical Location
                              </h4>
                              <div className="space-y-1 text-[11px] text-gray-300">
                                <p><span className="text-gray-500 font-bold">City:</span> {user.location?.city || 'Not specified'}</p>
                                <p><span className="text-gray-500 font-bold">Address:</span> {user.location?.address || 'Not registered'}</p>
                                {user.lat && user.lng && (
                                  <p><span className="text-gray-500 font-bold">Coords:</span> {user.lat.toFixed(4)}, {user.lng.toFixed(4)}</p>
                                )}
                              </div>
                            </div>

                            {/* Payment / Gateway Config */}
                            <div className="space-y-2">
                              <h4 className="text-[10px] font-black text-accent uppercase tracking-widest flex items-center gap-1.5">
                                <CreditCard size={12} /> Financial Gateway Configuration
                              </h4>
                              <div className="space-y-1 text-[11px] text-gray-300">
                                <p><span className="text-gray-500 font-bold">Gateway Provider:</span> {user.gateway?.provider || 'Standard'}</p>
                                <p><span className="text-gray-500 font-bold">Gateway Active:</span> {user.gateway?.isActive ? 'Yes' : 'No'}</p>
                                {user.paymentMethods && (
                                  <p><span className="text-gray-500 font-bold">Enabled Gateways:</span> {
                                    Object.keys(user.paymentMethods)
                                      .filter(k => user.paymentMethods?.[k]?.enabled)
                                      .join(', ') || 'None'
                                  }</p>
                                )}
                              </div>
                            </div>

                            {/* Admin Privilege Control Strip */}
                            <div className="md:col-span-3 border-t border-white/10 pt-3 mt-1 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 bg-white/[0.02] p-3 rounded-xl">
                              <div className="flex items-center gap-2">
                                <ShieldAlert size={16} className={isPrimaryAdmin ? "text-purple-400" : "text-gray-500"} />
                                <div>
                                  <p className="text-[10px] font-black uppercase tracking-wider text-white">
                                    Admin Status: {isPrimaryAdmin ? 'System Admin (Command Tier)' : 'Standard User'}
                                  </p>
                                  <p className="text-[9px] text-gray-400">
                                    {isPrimaryAdmin
                                      ? (analytics.admins <= 1 ? 'Protected: Last remaining Admin account in the system.' : 'Grants full administrative capabilities across all app controls.')
                                      : 'Promote this operator to grant complete administrative control.'}
                                  </p>
                                </div>
                              </div>

                              {onToggleAdminRole && (
                                <button
                                  onClick={() => onToggleAdminRole(user.uid, !isPrimaryAdmin)}
                                  disabled={!!isProcessing || (isPrimaryAdmin && analytics.admins <= 1)}
                                  className={cn(
                                    "px-3.5 py-2 border text-[9px] font-black uppercase tracking-widest rounded-xl transition-all flex items-center gap-1.5 shrink-0",
                                    isPrimaryAdmin
                                      ? (analytics.admins <= 1
                                          ? "bg-gray-800 border-gray-700 text-gray-500 cursor-not-allowed"
                                          : "bg-purple-500/10 border-purple-500/30 text-purple-300 hover:bg-purple-500 hover:text-white")
                                      : "bg-primary/20 border-primary/40 text-primary hover:bg-primary hover:text-white shadow-[0_0_12px_rgba(255,0,212,0.15)]"
                                  )}
                                >
                                  {isProcessing === user.uid ? (
                                    <Loader2 size={12} className="animate-spin" />
                                  ) : (
                                    <ShieldAlert size={12} />
                                  )}
                                  {isPrimaryAdmin ? (analytics.admins <= 1 ? 'Protected Last Admin' : 'Demote Admin') : 'Promote to Admin'}
                                </button>
                              )}
                            </div>
                          </div>
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })}

              {paginatedUsers.length === 0 && (
                <tr>
                  <td colSpan={6} className="py-12 text-center space-y-3">
                    <div className="w-12 h-12 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-600">
                      <Users size={24} />
                    </div>
                    <p className="text-xs font-black text-gray-400 uppercase tracking-widest">
                      No matching user records found
                    </p>
                    <p className="text-[10px] text-gray-600">
                      Try clearing or adjusting search filters.
                    </p>
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="p-4 border-t border-white/10 bg-white/5 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs">
          <div className="text-[10px] font-bold text-gray-400 uppercase tracking-wider">
            Showing <span className="text-white font-black">{totalItems > 0 ? (safeCurrentPage - 1) * pageSize + 1 : 0}</span> to{' '}
            <span className="text-white font-black">{Math.min(safeCurrentPage * pageSize, totalItems)}</span> of{' '}
            <span className="text-white font-black">{totalItems}</span> filtered users
            {serverUserCount !== null && (
              <span className="text-gray-500 ml-1.5">({serverUserCount} total registered)</span>
            )}
          </div>

          {/* Navigation Controls */}
          <div className="flex items-center gap-1.5">
            <button
              onClick={() => setCurrentPage(1)}
              disabled={safeCurrentPage <= 1}
              className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            >
              First
            </button>
            <button
              onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
              disabled={safeCurrentPage <= 1}
              className="p-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            >
              <ChevronLeft size={16} />
            </button>

            {/* Page number buttons */}
            <div className="flex items-center gap-1 px-1">
              {Array.from({ length: totalPages }, (_, i) => i + 1)
                .filter(p => p === 1 || p === totalPages || Math.abs(p - safeCurrentPage) <= 1)
                .map((p, i, arr) => {
                  const prevP = arr[i - 1];
                  const showEllipsis = prevP && p - prevP > 1;

                  return (
                    <React.Fragment key={`page-btn-${p}`}>
                      {showEllipsis && <span className="text-gray-600 px-1 text-[10px]">...</span>}
                      <button
                        onClick={() => setCurrentPage(p)}
                        className={cn(
                          "w-7 h-7 rounded-lg text-[10px] font-black transition-colors",
                          safeCurrentPage === p
                            ? "bg-red-500 text-white shadow-md shadow-red-500/20"
                            : "bg-white/5 text-gray-400 hover:text-white border border-white/10"
                        )}
                      >
                        {p}
                      </button>
                    </React.Fragment>
                  );
                })}
            </div>

            <button
              onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
              disabled={safeCurrentPage >= totalPages}
              className="p-1 bg-white/5 border border-white/10 rounded-lg text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            >
              <ChevronRight size={16} />
            </button>
            <button
              onClick={() => setCurrentPage(totalPages)}
              disabled={safeCurrentPage >= totalPages}
              className="px-2 py-1 bg-white/5 border border-white/10 rounded-lg text-[10px] font-black uppercase text-gray-400 hover:text-white disabled:opacity-30 disabled:hover:text-gray-400 transition-colors"
            >
              Last
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
