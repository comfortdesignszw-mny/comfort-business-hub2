import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Search, Users, Shield, MapPin, Store as StoreIcon, Phone, ExternalLink, Loader2
} from 'lucide-react';
import { collection, query, limit, getDocs, orderBy, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, PublicProfile } from '../types';
import { cn } from '../lib/utils';

interface UserListModalProps {
  isOpen: boolean;
  onClose: () => void;
  onUserClick: (userId: string) => void;
}

export default function UserListModal({ isOpen, onClose, onUserClick }: UserListModalProps) {
  const [users, setUsers] = useState<PublicProfile[]>([]);
  const [searchTerm, setSearchTerm] = useState('');
  const [loading, setLoading] = useState(true);
  const listRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (isOpen) {
      window.scrollTo(0, 0);
      if (listRef.current) {
        listRef.current.scrollTo(0, 0);
        listRef.current.scrollTop = 0;
      }
    }
  }, [isOpen]);

  useEffect(() => {
    if (!isOpen) return;

    setLoading(true);
    const q = query(collection(db, 'public_profiles'), orderBy('name', 'asc'), limit(100));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      setUsers(snapshot.docs.map(doc => ({ uid: doc.id, ...doc.data() } as PublicProfile)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'public-profiles-list');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [isOpen]);

  const filteredUsers = users.filter(user => 
    user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
    (user as any).businessName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
    user.currentRole.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="user-list-modal-container" className="fixed inset-0 z-[2500] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-2xl bg-[#0d1117] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl safe-bottom max-h-[90vh] flex flex-col"
          >
            {/* Header */}
            <div className="p-6 sm:p-8 border-b border-white/5 space-y-6">
              <div className="flex items-center justify-between">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase flex items-center gap-3">
                    <Users className="text-primary" size={24} /> Neural Member Matrix
                  </h2>
                  <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
                    Registered accounts within the Comfort Hub ecosystem
                  </p>
                </div>
                <button 
                  onClick={onClose}
                  className="w-10 h-10 bg-white/5 rounded-2xl flex items-center justify-center text-gray-500 hover:text-white transition-colors border border-white/5"
                >
                  <X size={20} />
                </button>
              </div>

              {/* Search Bar */}
              <div className="relative group">
                <div className="absolute inset-y-0 left-4 flex items-center">
                  <Search size={16} className="text-gray-500 group-focus-within:text-primary transition-colors" />
                </div>
                <input 
                  type="text" 
                  placeholder="Filter by name, business or role..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className="w-full bg-white/5 border border-white/5 rounded-2xl pl-12 pr-4 py-4 text-xs font-bold text-white outline-none focus:border-primary/30 transition-all placeholder-gray-700"
                />
              </div>
            </div>

            {/* List */}
            <div ref={listRef} className="flex-1 overflow-y-auto custom-scrollbar p-4 sm:p-8">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <Loader2 className="animate-spin text-primary" size={32} />
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Searching for active signals...</p>
                </div>
              ) : filteredUsers.length > 0 ? (
                <div className="grid gap-3">
                  {filteredUsers.map((user, idx) => (
                    <motion.div 
                      key={`ulm-usr-${user.uid || idx}-${idx}`}
                      whileHover={{ x: 5 }}
                      onClick={() => onUserClick(user.uid)}
                      className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-primary/20 transition-all cursor-pointer"
                    >
                      <div className="flex items-center gap-4">
                        <div className="w-12 h-12 bg-[#11161d] rounded-xl border border-white/10 flex items-center justify-center text-primary font-black uppercase overflow-hidden shadow-inner">
                          {user.avatar ? (
                            <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                          ) : user.name.charAt(0)}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                             <h3 className="text-[11px] font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{user.name}</h3>
                             {user.isVerified && <Shield size={10} className="text-neon-green" />}
                          </div>
                          <div className="flex items-center gap-2 mt-0.5">
                            <span className={cn(
                              "text-[8px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded",
                              user.currentRole === 'supplier' ? "bg-accent/10 text-accent/80 border border-accent/20" : "bg-primary/10 text-primary/80 border border-primary/20"
                            )}>
                              {user.currentRole}
                            </span>
                            {user.location?.city && (
                              <span className="text-[8px] text-gray-600 font-bold uppercase tracking-widest flex items-center gap-1">
                                <MapPin size={8} /> {user.location.city}
                              </span>
                            )}
                          </div>
                        </div>
                      </div>
                      <div className="flex items-center gap-2">
                        <div className="text-[9px] font-black text-primary uppercase tracking-widest opacity-0 group-hover:opacity-100 transition-opacity">
                          View Node
                        </div>
                        <div className="w-8 h-8 rounded-lg bg-primary/5 flex items-center justify-center text-primary group-hover:bg-primary group-hover:text-[#05070a] transition-all">
                          <ExternalLink size={14} />
                        </div>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ) : (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5 space-y-4">
                   <Search size={32} className="mx-auto text-gray-800" />
                   <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">No users detected with matching parameters</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
