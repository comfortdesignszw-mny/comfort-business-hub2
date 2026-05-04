import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate } from 'react-router-dom';
import { 
  Store as StoreIcon, Search, MapPin, Star, ArrowRight, Building2, 
  MapPinned, SlidersHorizontal, ArrowLeft, Check, Sparkles
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, limit, onSnapshot, where } from 'firebase/firestore';
import { UserProfile, Store as StoreType } from '../types';
import { BUSINESS_CATEGORIES } from '../constants';
import { cn } from '../lib/utils';
import SupplierDashboard from './SupplierDashboard';

export default function StoresHub({ profile }: { profile: UserProfile | null }) {
  const navigate = useNavigate();
  const [stores, setStores] = useState<StoreType[]>([]);
  const [loading, setLoading] = useState(true);
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [activeTab, setActiveTab] = useState<'browse' | 'manage'>('browse');

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
      className="p-4 space-y-8 pb-32"
    >
      {profile?.currentRole === 'supplier' && (
        <div className="flex p-1 bg-white/5 border border-white/5 rounded-2xl w-fit mx-auto lg:mx-0">
          <button
            onClick={() => setActiveTab('browse')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'browse' ? "bg-primary text-[#05070a] shadow-lg" : "text-gray-500 hover:text-white"
            )}
          >
            Directory
          </button>
          <button
            onClick={() => setActiveTab('manage')}
            className={cn(
              "px-6 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all",
              activeTab === 'manage' ? "bg-primary text-[#05070a] shadow-lg" : "text-gray-500 hover:text-white"
            )}
          >
            Management
          </button>
        </div>
      )}

      {activeTab === 'manage' && profile?.currentRole === 'supplier' ? (
        <SupplierDashboard profile={profile} />
      ) : (
        <>
          <header className="space-y-4">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary shadow-[0_0_15px_rgba(0,242,254,0.2)]">
                <StoreIcon size={24} />
              </div>
              <div>
                <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">Stores Hub</h1>
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest mt-1">Matrix Verified Supply Nodes</p>
              </div>
            </div>

            <div className="relative group">
              <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000"></div>
              <div className="relative flex items-center bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
                <Search className="ml-4 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
                <input 
                  type="text" 
                  placeholder="Search business nodes..."
                  className="w-full pl-3 pr-12 py-5 bg-transparent text-white placeholder-gray-600 outline-none font-medium"
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                />
              </div>
            </div>

            <div className="flex gap-2 overflow-x-auto no-scrollbar pb-2">
              {['All', ...BUSINESS_CATEGORIES].map(cat => (
                <button
                  key={cat}
                  onClick={() => setActiveCategory(cat)}
                  className={cn(
                    "px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest whitespace-nowrap transition-all",
                    activeCategory === cat 
                      ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" 
                      : "bg-white/5 text-gray-500 border border-white/5 hover:border-white/10"
                  )}
                >
                  {cat}
                </button>
              ))}
            </div>
          </header>

          <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {loading ? (
              Array.from({ length: 6 }).map((_, i) => (
                <div key={i} className="neon-card h-48 animate-pulse" />
              ))
            ) : filteredStores.map(store => (
              <React.Fragment key={store.id}>
                <StoreCard store={store} profile={profile} />
              </React.Fragment>
            ))}

            {!loading && filteredStores.length === 0 && (
              <div className="col-span-full py-20 text-center space-y-4">
                 <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-800">
                  <StoreIcon size={32} />
                </div>
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic leading-relaxed">
                  No active nodes detected within <br/> 
                  <span className="text-primary">{activeCategory}</span> sector matching "{searchTerm}"
                </p>
              </div>
            )}
          </section>
        </>
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
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        if (!profile) {
          navigate('/login');
          return;
        }
        navigate(`/store/${store.id}`);
      }}
      className="neon-card p-5 space-y-4 cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-primary font-black text-xl shadow-[0_0_15px_rgba(0,242,254,0.1)] group-hover:scale-110 transition-transform overflow-hidden">
          {store.logo ? (
            <img src={store.logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
          ) : (
            store.name.charAt(0)
          )}
        </div>
        <div className="flex-1 space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors italic">{store.name}</h3>
            <div className="w-2.5 h-2.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
          </div>
          <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-black uppercase tracking-widest bg-white/5 px-2 py-1 rounded border border-white/5 w-fit">
            <Building2 size={10} className="text-primary" /> {store.category}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed min-h-[30px]">
        {store.description}
      </p>

      <div className="flex items-center justify-between pt-4 border-t border-white/5">
        <div className="flex items-center gap-3">
          <div className="flex items-center gap-1">
            <Star size={12} className="fill-primary text-primary" />
            <span className="text-xs font-black text-white">{store.rating.toFixed(1)}</span>
            <span className="text-[10px] text-gray-600 font-black ml-1">({store.reviewCount})</span>
          </div>
        </div>
        <div className="flex items-center gap-2 text-[10px] text-primary font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
          Connect <ArrowRight size={14} />
        </div>
      </div>
    </motion.div>
  );
}
