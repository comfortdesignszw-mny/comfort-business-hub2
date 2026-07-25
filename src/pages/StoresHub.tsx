import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Store as StoreIcon, Search, MapPin, Star, ArrowRight, Building2, 
  MapPinned, SlidersHorizontal, ArrowLeft, Check, Sparkles, Package
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, limit, onSnapshot, where, getCountFromServer, getDocs } from 'firebase/firestore';
import { PublicProfile } from '../types';
import { useModals } from '../context/ModalContext';
import { Users, Shield, ExternalLink } from 'lucide-react';
import AuthGuard from '../components/AuthGuard';
import { UserProfile, Store as StoreType } from '../types';
import { BUSINESS_CATEGORIES } from '../constants';
import { cn } from '../lib/utils';
import SupplierDashboard from './SupplierDashboard';
import OptimizedImage from '../components/OptimizedImage';

export default function StoresHub({ profile }: { profile: UserProfile | null }) {
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'browse' | 'manage'>('browse');
  const [userCount, setUserCount] = useState<number | null>(null);
  const [displayedUsers, setDisplayedUsers] = useState<PublicProfile[]>([]);
  const { openUserList, openUserProfile } = useModals();

  useEffect(() => {
    const tabParam = searchParams.get('tab');
    if (tabParam === 'manage') {
      setActiveTab('manage');
    } else if (tabParam === 'browse') {
      setActiveTab('browse');
    }
  }, [searchParams]);

  useEffect(() => {
    window.scrollTo(0, 0);
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo(0, 0);
      main.scrollTop = 0;
    }
  }, [activeTab, activeCategory]);

  useEffect(() => {
    setLoading(true);
    const sq = query(collection(db, 'stores'), limit(50));
    const unsubscribe = onSnapshot(sq, (snapshot) => {
      setStores(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as StoreType)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores-hub');
      setLoading(false);
    });

    return () => unsubscribe();
  }, []);

  
  useEffect(() => {
    let isMounted = true;
    const fetchUserCount = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'public_profiles'));
        if (isMounted) setUserCount(snapshot.data().count);
        const usersSnap = await getDocs(query(collection(db, 'public_profiles'), limit(10)));
        if (isMounted) setDisplayedUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as PublicProfile)));
      } catch (err) {
        if (isMounted) {
          console.warn("Signal: User count temporarily unavailable.");
          setUserCount(null);
        }
      }
    };
    fetchUserCount();
    return () => { isMounted = false; };
  }, []);

  const filteredStores = stores.filter(s => {
    const matchesSearch = s.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         s.description.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesCategory = activeCategory === 'All' || s.category === activeCategory;
    return matchesSearch && matchesCategory;
  });

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 sm:p-8 space-y-12 pb-32 max-w-7xl mx-auto"
    >
      <header className="flex flex-col lg:flex-row lg:items-end justify-between gap-8">
        <div className="space-y-4">
          <div className="flex items-center gap-3">
             <div className="h-px w-8 bg-primary/50"></div>
             <p className="text-[10px] text-primary font-black uppercase tracking-[0.3em]">Business Directory</p>
          </div>
          <h1 className="text-4xl sm:text-6xl font-black text-white italic uppercase tracking-tighter leading-none">
            Stores <span className="text-outline-white">Hub</span>
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm font-medium max-w-md">
            Verified local suppliers integrated within the Comfort Business Hub.
          </p>
        </div>

        <div className="flex flex-col sm:flex-row gap-4 items-center">
          {profile?.currentRole === 'supplier' && (
            <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl w-full sm:w-fit">
              <button
                onClick={() => setActiveTab('browse')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-1/2 sm:w-auto",
                  activeTab === 'browse' ? "bg-primary text-[#05070a] shadow-[0_10px_20px_rgba(0,242,254,0.2)]" : "text-gray-500 hover:text-white"
                )}
              >
                Browse
              </button>
              <button
                onClick={() => setActiveTab('manage')}
                className={cn(
                  "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all w-1/2 sm:w-auto",
                  activeTab === 'manage' ? "bg-primary text-[#05070a] shadow-[0_10px_20px_rgba(0,242,254,0.2)]" : "text-gray-500 hover:text-white"
                )}
              >
                Manage
              </button>
            </div>
          )}
        </div>
      </header>

      {activeTab === 'manage' && profile?.currentRole === 'supplier' ? (
        <SupplierDashboard profile={profile} />
      ) : (
        <div className="space-y-12">

          {profile && !profile.isGuest && (
            <section className="space-y-6 pt-2">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2 sm:gap-3">
                <div className="w-1 h-5 sm:w-1.5 sm:h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(0,242,254,0.5)]" />
                <div className="space-y-0.5">
                  <h2 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-[0.15em] sm:tracking-[0.2em] italic">Neural Member Network</h2>
                  <p className="text-[7px] sm:text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                    <span className="text-primary font-black">{userCount || '0'}</span> users
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2">
                <AuthGuard 
                  title="View Restricted" 
                  message="Join the Network Hub to browse all signed in users."
                  profile={profile}
                >
                  <button 
                    onClick={openUserList}
                    className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1.5 sm:gap-2 bg-primary/5 py-1.5 px-3 rounded-full border border-primary/10"
                  >
                    Directory <ExternalLink size={8} />
                  </button>
                </AuthGuard>
              </div>
            </div>
            <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-2 px-2 custom-scrollbar snap-x no-scrollbar">
              {displayedUsers.map((user) => (
                <div key={`matrix-${user.uid}`} className="contents">
                  <AuthGuard 
                    title="View Partner Profile"
                    message="Enter the Hub network to connect with registered partners and view tactical intelligence."
                    profile={profile}
                  >
                    <motion.div
                      whileHover={{ y: -5, scale: 1.02 }}
                      whileTap={{ scale: 0.98 }}
                      onClick={() => openUserProfile(user.uid)}
                      className="flex-shrink-0 w-32 sm:w-36 bg-white/5 border border-white/5 rounded-[1.5rem] sm:rounded-[2rem] p-3 sm:p-4 flex flex-col items-center text-center space-y-2 sm:space-y-3 cursor-pointer group hover:border-primary/20 transition-all snap-start"
                    >
                    <div className="relative">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary/20 to-accent/20 rounded-full blur opacity-0 group-hover:opacity-100 transition-opacity" />
                      <div className="relative w-14 h-14 sm:w-16 sm:h-16 bg-[#0d1117] rounded-full border-2 border-white/5 flex items-center justify-center text-primary font-black overflow-hidden group-hover:border-primary/30 transition-all">
                        {user.avatar ? (
                          <img src={user.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : user.name.charAt(0)}
                      </div>
                      {user.isVerified && (
                        <div className="absolute -bottom-0.5 -right-0.5 w-5 h-5 sm:w-6 sm:h-6 bg-neon-green rounded-full flex items-center justify-center text-[#05070a] border-2 border-[#05070a] shadow-lg">
                          <Shield size={8} className="fill-current sm:w-[10px] sm:h-[10px]" />
                        </div>
                      )}
                    </div>
                    <div className="space-y-1 w-full">
                      <h3 className="text-[9px] sm:text-[10px] font-black text-white uppercase tracking-tight truncate group-hover:text-primary transition-colors">{user.name}</h3>
                      <div className="flex items-center justify-center gap-1.5 pt-0.5 sm:pt-1">
                        <span className={cn(
                          "text-[6px] sm:text-[7px] font-bold uppercase tracking-widest px-1.5 py-0.5 rounded-full border",
                          user.currentRole === 'supplier' ? "bg-accent/10 border-accent/20 text-accent" : "bg-primary/10 border-primary/20 text-primary"
                        )}>
                          {user.currentRole === 'supplier' ? 'Supplier' : 'Partner'}
                        </span>
                      </div>
                    </div>
                  </motion.div>
                </AuthGuard>
              </div>
            ))}
              <AuthGuard 
                title="View All Members" 
                message="Sign in to explore the complete member directory."
                profile={profile}
              >
                <motion.div
                  whileHover={{ scale: 1.02 }}
                  onClick={openUserList}
                  className="flex-shrink-0 w-36 bg-primary/5 border border-primary/10 rounded-[2rem] p-4 flex flex-col items-center justify-center text-center space-y-3 cursor-pointer group hover:bg-primary/10 transition-all snap-start border-dashed"
                >
                  <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                    <Users size={20} />
                  </div>
                  <div className="space-y-1">
                    <p className="text-[9px] font-black text-primary uppercase tracking-widest">All Members</p>
                    <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Connect with {userCount || 'All'} Members</p>
                  </div>
                </motion.div>
              </AuthGuard>
            </div>
          </section>
          )}

          {/* Featured Stores */}
          {!loading && stores.length > 0 && (
            <section className="space-y-6">
              <div className="flex items-center justify-between px-1">
                <div className="flex items-center gap-2">
                  <Sparkles size={18} className="text-primary" />
                  <h2 className="text-sm font-black text-white uppercase tracking-widest italic">Featured Stores</h2>
                </div>
              </div>
              <div className="flex gap-6 overflow-x-auto no-scrollbar pb-4 -mx-1 px-1">
                {stores.slice(0, 3).map(store => (
                   <motion.div 
                    key={`featured-${store.id}`}
                    whileHover={{ scale: 1.02 }}
                    className="flex-shrink-0 w-[240px] h-[140px] rounded-[1.5rem] bg-[#0d1117] border border-white/5 overflow-hidden relative group cursor-pointer"
                    onClick={() => navigate(`/store/${store.id}`)}
                   >
                     <img 
                      src={store.coverPhoto || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"} 
                      className="w-full h-full object-cover opacity-40 group-hover:opacity-60 transition-opacity"
                      alt={store.name}
                     />
                     <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-transparent to-transparent"></div>
                     <div className="absolute bottom-4 left-4 right-4">
                       <p className="text-[10px] font-black text-white uppercase tracking-tighter italic truncate">{store.name}</p>
                       <p className="text-[8px] text-primary font-bold uppercase tracking-widest">{store.category}</p>
                     </div>
                   </motion.div>
                ))}
              </div>
            </section>
          )}

          <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-center">
            <div className="lg:col-span-8 relative group">
              <Search className="absolute left-6 top-1/2 -translate-y-1/2 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
              <input 
                type="text" 
                placeholder="Search stores..."
                className="w-full pl-16 pr-6 py-6 bg-white/[0.02] border border-white/5 rounded-[2rem] text-white placeholder-gray-600 outline-none focus:border-primary/30 transition-all font-medium text-lg"
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
              />
            </div>
            <div className="lg:col-span-4 flex gap-2 overflow-x-auto no-scrollbar py-2">
              {['All', ...BUSINESS_CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-6 py-3 rounded-full text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all border",
                    activeCategory === cat 
                      ? "bg-primary border-primary text-[#05070a] shadow-[0_10px_20px_rgba(0,242,254,0.1)]" 
                      : "bg-white/5 text-gray-500 border-white/5 hover:border-white/20"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </div>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-8">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="h-64 bg-white/5 rounded-[2.5rem] animate-pulse" />
              ))
            ) : filteredStores.map(store => (
              <React.Fragment key={store.id}>
                <StoreCard store={store} profile={profile} />
              </React.Fragment>
            ))}

            {!loading && filteredStores.length === 0 && (
              <div className="col-span-full py-32 text-center space-y-6">
                 <div className="w-20 h-20 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-800 border border-white/5">
                  <StoreIcon size={32} />
                </div>
                <div className="space-y-2">
                  <p className="text-xl font-bold text-white italic uppercase tracking-tight">No match detected</p>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic leading-relaxed">
                    No stores found in <span className="text-primary">{activeCategory}</span> sector matching "{searchTerm}"
                  </p>
                </div>
              </div>
            )}
          </section>
        </div>
      )}
    </motion.div>
  );
}

interface StoreCardProps {
  store: StoreType;
  profile: UserProfile | null;
}

function StoreCard({ store, profile }: StoreCardProps) {
  const navigate = useNavigate();
  return (
    <motion.div 
      whileHover={{ y: -8 }}
      onClick={() => {
        navigate(`/store/${store.id}`);
      }}
      className="group relative bg-[#0d1117] border border-white/5 rounded-[2.5rem] overflow-hidden cursor-pointer hover:border-primary/40 transition-all duration-500 shadow-2xl flex flex-col h-full"
    >
      {/* Visual Identity Block */}
      <div className="aspect-[16/10] relative overflow-hidden bg-[#05070a]">
        <OptimizedImage 
          src={store.coverPhoto || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"} 
          className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-700 opacity-40 group-hover:opacity-70"
          alt={store.name}
        />
        <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/20 to-transparent"></div>
        
        {/* Verification Status */}
        <div className="absolute top-4 left-4 flex items-center gap-2">
          <div className="flex items-center gap-2 px-3 py-1 bg-black/60 backdrop-blur-md rounded-full border border-white/10">
            <div className="w-1.5 h-1.5 rounded-full bg-neon-green shadow-[0_0_8px_#39FF14]"></div>
            <span className="text-[8px] font-black text-white uppercase tracking-widest">Active Store</span>
          </div>
          {(store.isVerified || (store as any).verified) && (
            <div className="flex items-center gap-1 px-2.5 py-1 bg-emerald-500/20 backdrop-blur-md rounded-full border border-emerald-400/50 text-emerald-400 shadow-[0_0_12px_rgba(16,185,129,0.5)]">
              <Check size={9} className="stroke-[3]" />
              <span className="text-[8px] font-black uppercase tracking-widest">Verified</span>
            </div>
          )}
        </div>

        {/* Rating Floating Badge */}
        <div className="absolute top-4 right-4 bg-primary/20 backdrop-blur-md px-3 py-1.5 rounded-full border border-primary/20 flex items-center gap-1.5">
          <Star size={10} className="fill-primary text-primary" />
          <span className="text-[10px] font-black text-white">{store.rating.toFixed(1)}</span>
        </div>
      </div>

      {/* Content Block */}
      <div className="p-6 flex-1 flex flex-col justify-between">
        <div className="space-y-4">
          <div className="flex items-start justify-between gap-4">
            <div className="space-y-1.5">
              <h3 className="text-xl font-black text-white uppercase tracking-tighter italic group-hover:text-primary transition-colors leading-tight">
                {store.name}
              </h3>
              <div className="flex items-center gap-2 flex-wrap">
                 <span className="text-[9px] text-primary font-black uppercase tracking-widest bg-primary/10 px-2 py-0.5 rounded border border-primary/10">
                   {store.category}
                 </span>
                 <span className="text-[8px] text-gray-500 font-bold uppercase tracking-wider flex items-center gap-1">
                   <MapPin size={8} /> {store.address || 'Local Area'}
                 </span>
              </div>
            </div>
            
            <div className="w-14 h-14 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center p-2.5 group-hover:border-primary/40 group-hover:bg-primary/5 transition-all duration-500 flex-shrink-0 overflow-hidden">
              {store.logo ? (
                <OptimizedImage src={store.logo} className="w-full h-full object-contain filter group-hover:brightness-110 transition-all" />
              ) : (
                <StoreIcon size={24} className="text-gray-500 group-hover:text-primary" />
              )}
            </div>
          </div>

          <p className="text-[11px] text-gray-500 font-medium line-clamp-2 leading-relaxed opacity-80 group-hover:opacity-100 transition-opacity">
            {store.description}
          </p>
        </div>

        <div className="pt-6 mt-6 border-t border-white/5 flex items-center justify-between">
           <div className="flex items-center gap-4 text-gray-600">
             <div className="flex items-center gap-1.5">
               <Package size={12} className="text-primary/60" />
               <span className="text-[9px] font-black uppercase tracking-widest">Inventory Live</span>
             </div>
           </div>
           <motion.div 
             className="flex items-center gap-2 text-[10px] text-primary font-black uppercase tracking-widest"
             whileHover={{ x: 4 }}
           >
             Open Interface <ArrowRight size={14} />
           </motion.div>
        </div>
      </div>
      
      {/* Decorative Accent */}
      <div className="absolute bottom-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary/0 to-transparent group-hover:via-primary transition-all duration-700"></div>
    </motion.div>
  );
}
