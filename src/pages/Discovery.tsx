import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { Search, MapPin, Filter, Star, Zap, ShoppingBag, Store, ArrowRight, 
  SlidersHorizontal, MessageSquare, Sparkles, X, Phone, Check, Loader2, MapPinned, CreditCard,
  Megaphone, Calendar, FileText, Building2, ExternalLink, Share2, Info
} from 'lucide-react';
import { UserProfile, Product, Store as StoreType, Message, Spotlight } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, query, limit, getDocs, where, addDoc, serverTimestamp, setDoc, doc, getDoc, orderBy, onSnapshot, getCountFromServer } from 'firebase/firestore';
import { BUSINESS_CATEGORIES, PRODUCT_CATEGORIES } from '../constants';
import ProductCard from '../components/ProductCard';
import { StoreDetailContent } from './StoreDetail';
import OptimizedImage from '../components/OptimizedImage';

export default function Discovery({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(true);
  const [spotlightsLoading, setSpotlightsLoading] = useState(true);
  const [nearbyDeals, setNearbyDeals] = useState<Product[]>([]);
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>([]);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);

  // Auto-rotate spotlights
  useEffect(() => {
    if (spotlights.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSpotlightIndex(prev => (prev + 1) % spotlights.length);
    }, 6000);
    return () => clearInterval(interval);
  }, [spotlights.length]);
  const [filteredDeals, setFilteredDeals] = useState<Product[]>([]);
  const [filteredStores, setFilteredStores] = useState<StoreType[]>([]);
  const [searchParams] = useSearchParams();
  const sharedProductId = searchParams.get('productId');

  const categories = ['All', ...new Set([...BUSINESS_CATEGORIES, ...PRODUCT_CATEGORIES])];
  const [matchedProducts, setMatchedProducts] = useState<Product[]>([]);

  useEffect(() => {
    let pResult = nearbyDeals;
    let sResult = nearbyStores;

    if (sharedProductId) {
      pResult = nearbyDeals.filter(p => p.id === sharedProductId);
      if (pResult.length > 0) {
        // If we found the shared product, we might want to prioritize it or filter just for it
      }
    } else if (searchTerm) {
      const term = searchTerm.toLowerCase();
      pResult = pResult.filter(p => 
        p.name.toLowerCase().includes(term) ||
        p.description.toLowerCase().includes(term)
      );
      sResult = sResult.filter(s => 
        s.name.toLowerCase().includes(term) ||
        s.description.toLowerCase().includes(term) ||
        s.category.toLowerCase().includes(term)
      );
    }

    if (activeCategory !== 'All' && !sharedProductId) {
      pResult = pResult.filter(p => {
        const matchesProductCategory = p.category === activeCategory;
        const store = storesMap[p.storeId];
        const matchesStoreCategory = store?.category === activeCategory;
        return matchesProductCategory || matchesStoreCategory;
      });
      sResult = sResult.filter(s => s.category === activeCategory);
    }

    setFilteredDeals(pResult);
    setFilteredStores(sResult);
  }, [searchTerm, activeCategory, nearbyDeals, nearbyStores, sharedProductId]);

  useEffect(() => {
    setLoading(true);
    
    // Real-time listener for products
    const pq = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      limit(100)
    );
    
    const unsubscribeProducts = onSnapshot(pq, (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setNearbyDeals(allProducts);
      setProductsLoading(false);

      // Matching logic
      if (profile?.currentRole === 'customer' && profile.requiredProducts) {
        const matched = allProducts.filter(p => 
          profile.requiredProducts?.some(need => 
            p.name.toLowerCase().includes(need.toLowerCase()) || 
            p.description.toLowerCase().includes(need.toLowerCase()) ||
            p.category.toLowerCase().includes(need.toLowerCase())
          )
        );
        setMatchedProducts(matched);
      }
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'products-feed');
    });

    // Real-time listener for stores
    const sq = query(collection(db, 'stores'), limit(150));
    const unsubscribeStores = onSnapshot(sq, (snapshot) => {
      const allStores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoreType)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      setNearbyStores(allStores);
      setStoresLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores-feed');
      setStoresLoading(false);
    });

    // Fetch Spotlights
    const spq = query(
      collection(db, 'spotlights'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(10)
    );
    const unsubscribeSpotlights = onSnapshot(spq, (snapshot) => {
      setSpotlights(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Spotlight)));
      setSpotlightsLoading(false);
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'spotlights-feed');
      setSpotlightsLoading(false);
      setLoading(false);
    });

    return () => {
      unsubscribeProducts();
      unsubscribeStores();
      unsubscribeSpotlights();
    };
  }, [profile]);

  useEffect(() => {
    let isMounted = true;

    const fetchUserCount = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'users'));
        if (isMounted) {
          setUserCount(snapshot.data().count);
        }
      } catch (err) {
        if (isMounted) {
          console.warn("Signal: User count temporarily unavailable.");
          setUserCount(null);
        }
      }
    };

    const timer = setTimeout(() => {
      fetchUserCount();
    }, 1000);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, []);

  const sharedProductRef = React.useRef<HTMLDivElement>(null);

  const storesMap = useMemo(() => {
    return nearbyStores.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {} as Record<string, StoreType>);
  }, [nearbyStores]);

  useEffect(() => {
    if (sharedProductId && !loading && filteredDeals.length > 0) {
      const element = document.getElementById(`product-${sharedProductId}`);
      if (element) {
        element.scrollIntoView({ behavior: 'smooth', block: 'center' });
      }
    }
  }, [sharedProductId, loading, filteredDeals]);

  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return nearbyStores.find(s => s.id === selectedStoreId) || null;
  }, [selectedStoreId, nearbyStores]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8"
    >
      <AnimatePresence>
        {selectedStore && (
          <div className="fixed inset-0 z-[2000] flex items-end justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedStoreId(null)}
              className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-sm"
            />
            <motion.div 
              initial={{ y: "100%" }}
              animate={{ y: 0 }}
              exit={{ y: "100%" }}
              transition={{ type: "spring", damping: 25, stiffness: 300 }}
              className="relative w-full max-w-2xl bg-[#0d1117] border border-white/10 rounded-[2.5rem] overflow-hidden shadow-2xl safe-bottom max-h-[90vh] overflow-y-auto custom-scrollbar"
            >
              <div className="sticky top-0 right-0 p-6 z-50 flex justify-end">
                <button 
                  onClick={() => setSelectedStoreId(null)}
                  className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-colors"
                >
                  <X size={20} />
                </button>
              </div>
              <StoreDetailContent store={selectedStore} profile={profile} showMap={false} allowEdit={false} />
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Shared Link Header */}
      {sharedProductId && (
        <motion.div 
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-4 bg-primary/10 border border-primary/20 rounded-3xl flex items-center justify-between"
        >
          <div className="flex items-center gap-3">
            <Sparkles className="text-primary" size={20} />
            <div>
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Shared Node Uplink</p>
              <p className="text-[9px] text-gray-400 font-medium">Viewing specific item from secure network link</p>
            </div>
          </div>
          <button 
            onClick={() => {
              const newParams = new URLSearchParams(searchParams);
              newParams.delete('productId');
              navigate(`/discovery?${newParams.toString()}`);
            }}
            className="p-2 hover:bg-white/5 rounded-full transition-colors"
          >
            <X size={16} className="text-gray-500" />
          </button>
        </motion.div>
      )}

      {!profile && sharedProductId && (
        <div className="p-6 neon-card bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 text-center space-y-4">
          <Info className="mx-auto text-primary" size={28} />
          <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Expand Your Reach</h3>
          <p className="text-[11px] text-gray-300 leading-relaxed max-w-xs mx-auto">
            You're viewing this product as a guest. Join the <span className="text-primary font-black">Comfort Business Hub</span> today to unlock a massive variety of local products and directly engage with top suppliers.
          </p>
          <button 
            onClick={() => navigate('/login')}
            className="btn-neon w-full py-3 text-[10px] uppercase font-black tracking-widest"
          >
            Join Comfort Business Hub
          </button>
        </div>
      )}

      {/* User Count Notification */}
      {userCount !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex items-center justify-center gap-2 py-1"
        >
          <div className="flex -space-x-1">
             {[1, 2, 3].map(i => (
              <div key={i} className="w-5 h-5 rounded-full border border-[#05070a] bg-gray-800 bg-cover bg-center" style={{ backgroundImage: `url(https://i.pravatar.cc/100?img=${i+40})` }} />
            ))}
          </div>
          <p className="text-[9px] font-black text-primary uppercase tracking-[0.15em]">
            <span className="text-white">{userCount}</span> members synchronized with the Hub
          </p>
        </motion.div>
      )}

      {/* Search & Location Bar */}
      <section className="space-y-4">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-20 group-focus-within:opacity-40 transition duration-1000 group-focus-within:duration-200"></div>
          <div className="relative flex items-center bg-[#0d1117] border border-white/5 rounded-2xl overflow-hidden shadow-2xl">
            <Search className="ml-4 text-gray-500 group-focus-within:text-primary transition-colors" size={20} />
            <input 
              type="text" 
              placeholder="Search local supply chain..."
              className="w-full pl-3 pr-12 py-5 bg-transparent text-white placeholder-gray-600 outline-none font-medium"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
            />
            <button className="absolute right-3 w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors">
              <SlidersHorizontal size={18} />
            </button>
          </div>
        </div>

        <div className="flex items-center justify-between px-2">
          <div className="flex items-center gap-2 group cursor-pointer">
            <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center">
              <MapPin size={14} className="text-primary group-hover:scale-110 transition-transform" />
            </div>
            <div>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-wider">Active Hub Node</p>
              <p className="text-sm font-bold text-white group-hover:text-primary transition-colors">
                {profile?.location?.city ? profile.location.city.toUpperCase() : (profile?.geohash ? `Node: ${profile.geohash}` : 'Harare CBD, ZW')}
              </p>
            </div>
          </div>
          <div className="flex -space-x-2">
            {[1, 2, 3].map(i => (
              <div key={i} className="w-8 h-8 rounded-lg border-2 border-[#05070a] bg-gray-800 bg-cover bg-center" style={{ backgroundImage: `url(https://i.pravatar.cc/100?img=${i+10})` }} />
            ))}
            <div className="w-8 h-8 rounded-lg border-2 border-[#05070a] bg-primary/20 flex items-center justify-center text-[10px] font-bold text-primary">
              +12
            </div>
          </div>
        </div>
      </section>

      {/* Suggested Matches Section */}
      {matchedProducts.length > 0 && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
             <div className="flex items-center gap-2">
              <Sparkles className="text-primary animate-pulse" size={18} />
              <h2 className="font-black text-white uppercase tracking-tighter text-xl italic">Neural Matches</h2>
            </div>
            <span className="text-[9px] font-black text-neon-green uppercase tracking-widest">Optimized for You</span>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x px-1">
            {matchedProducts.map((product) => (
              <div key={product.id} className="min-w-[300px] snap-center">
                <ProductCard 
                  product={product} 
                  profile={profile} 
                  store={storesMap[product.storeId]}
                />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Supplier's Own Nodes Section */}
      {profile?.currentRole === 'supplier' && nearbyStores.some(s => s.ownerId === profile.uid) && (
        <section className="space-y-4">
          <div className="flex items-center justify-between px-2">
            <div className="flex items-center gap-2">
              <div className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14] animate-pulse"></div>
              <h2 className="font-black text-white uppercase tracking-tighter text-lg italic">Your Active Matrix Nodes</h2>
            </div>
            <button 
              onClick={() => navigate('/stores?tab=manage')}
              className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
            >
              Manage Dashboard
            </button>
          </div>
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x px-1">
            {nearbyStores.filter(s => s.ownerId === profile.uid).map((store) => (
              <div key={`own-${store.id}`} className="min-w-[280px] snap-center">
                <StoreCard store={store} profile={profile} onSelect={setSelectedStoreId} />
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Category Pills */}
      <section className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
        {categories.map((cat) => (
          <button
            key={cat}
            onClick={() => setActiveCategory(cat)}
            className={cn(
              "px-5 py-2.5 rounded-xl text-xs font-black uppercase tracking-widest whitespace-nowrap transition-all duration-300",
              activeCategory === cat 
                ? "bg-primary text-[#05070a] shadow-[0_0_20px_rgba(0,242,254,0.4)] scale-105" 
                : "bg-white/5 text-gray-500 border border-white/5 hover:border-white/10"
            )}
          >
            {cat}
          </button>
        ))}
      </section>

      {/* Featured Promo / Spotlight */}
      <section className="relative overflow-hidden rounded-[2.5rem]">
        <AnimatePresence mode="wait">
          {spotlights.length > 0 ? (
            <motion.div 
              key={spotlights[activeSpotlightIndex].id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neon-card relative h-56 flex flex-col justify-end p-8 group cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 z-0">
                <OptimizedImage 
                  src={spotlights[activeSpotlightIndex].image || "https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80"} 
                  className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000" 
                  alt="Spotlight" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/60 to-transparent"></div>
              </div>
              
              <div className="relative z-10 space-y-2">
                <div className="flex items-center gap-2 mb-2">
                  <div className="glass-pill !text-primary !border-primary/20 flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.15)]">
                    <Megaphone size={10} className="animate-pulse" />
                    Market Spotlight
                  </div>
                  <div className="glass-pill !text-neon-green/80 !border-white/5 uppercase tracking-[0.2em] text-[8px]">
                    {spotlights[activeSpotlightIndex].type}
                  </div>
                </div>
                
                <h3 className="text-2xl font-black text-white italic leading-none tracking-tighter uppercase break-words line-clamp-2">
                  {spotlights[activeSpotlightIndex].title}
                </h3>

                {spotlights[activeSpotlightIndex].content && (
                  <p className="text-[11px] text-gray-300 font-medium leading-relaxed line-clamp-2 mt-1">
                    {spotlights[activeSpotlightIndex].content}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-4 pt-2">
                  {spotlights[activeSpotlightIndex].authorName && (
                    <div className="flex items-center gap-1.5 text-[9px] text-primary font-black tracking-widest bg-primary/10 px-2 py-0.5 rounded border border-primary/20">
                      <Store size={10} /> {spotlights[activeSpotlightIndex].authorName}
                    </div>
                  )}
                  {spotlights[activeSpotlightIndex].location && (
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold tracking-widest">
                      <MapPin size={10} className="text-primary" /> {spotlights[activeSpotlightIndex].location}
                    </div>
                  )}
                  {spotlights[activeSpotlightIndex].date && (
                    <div className="flex items-center gap-1.5 text-[9px] text-gray-400 font-bold tracking-widest">
                      <Calendar size={10} className="text-primary" /> {spotlights[activeSpotlightIndex].date}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute top-8 right-8 flex flex-col items-end">
                <div className="w-12 h-12 bg-primary/10 rounded-2xl flex items-center justify-center border border-primary/20 text-primary animate-pulse">
                  <Zap size={24} />
                </div>
              </div>

              {/* Slider Dots */}
              {spotlights.length > 1 && (
                <div className="absolute bottom-6 right-8 flex gap-1.5">
                  {spotlights.map((_, idx) => (
                    <div 
                      key={idx} 
                      className={cn(
                        "h-1 rounded-full transition-all duration-500",
                        idx === activeSpotlightIndex ? "w-6 bg-primary" : "w-2 bg-white/20"
                      )}
                    />
                  ))}
                </div>
              )}
            </motion.div>
          ) : (
            <motion.section 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              className="neon-card relative h-48 flex flex-col justify-end p-6 group cursor-pointer"
            >
              <div className="absolute inset-0 z-0">
                <img 
                  src="https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80" 
                  className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000" 
                  alt="Featured" 
                  referrerPolicy="no-referrer" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/40 to-transparent"></div>
              </div>
              <div className="relative z-10 space-y-1">
                <div className="glass-pill inline-block mb-2 !text-primary !border-primary/20">Market Spotlight</div>
                <h3 className="text-2xl font-black text-white italic leading-tight uppercase">Global Network<br/>Active Status</h3>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Scanning local news feeds...</p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </section>

      {/* Discovery Feed */}
      <section className="space-y-6">
        <section className="space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2">
              <h2 className="font-black text-white uppercase tracking-tighter text-lg">Active Supply Nodes</h2>
              <div className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded border border-primary/20 uppercase tracking-widest">Network</div>
            </div>
          </div>

          {storesLoading ? (
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4">
              {[1, 2, 3].map(i => (
                <div key={i} className="min-w-[240px] h-40 bg-white/5 rounded-3xl animate-pulse border border-white/5" />
              ))}
            </div>
          ) : filteredStores.length > 0 ? (
            <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x px-1">
              {filteredStores.map((store) => (
                <div key={store.id} className="min-w-[240px] snap-center">
                  <StoreCard store={store} profile={profile} onSelect={setSelectedStoreId} />
                </div>
              ))}
            </div>
          ) : (
            <div className="bg-white/5 border border-white/5 rounded-3xl p-8 text-center">
              <Building2 className="mx-auto text-gray-700 mb-2" size={24} />
              <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No active nodes in this category</p>
            </div>
          )}
        </section>

        <div className="flex items-center justify-between px-1 pt-4">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-white uppercase tracking-tighter text-lg">Local Inventory</h2>
            <div className="px-1.5 py-0.5 bg-neon-green/10 text-neon-green text-[8px] font-black rounded border border-neon-green/20 uppercase tracking-widest">Live</div>
          </div>
          <button className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors">View All Scan</button>
        </div>

        {productsLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
            {[1, 2, 3, 4].map(i => (
              <div key={i} className="neon-card h-72 animate-pulse" />
            ))}
          </div>
        ) : filteredDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
            {filteredDeals.map((product) => (
              <div key={product.id} id={`product-${product.id}`} className={cn(sharedProductId === product.id && "ring-2 ring-primary ring-offset-4 ring-offset-[#05070a] rounded-3xl")}>
                <ProductCard 
                  product={product} 
                  profile={profile} 
                  store={storesMap[product.storeId]}
                />
              </div>
            ))}
          </div>
        ) : (
          <div className="neon-card p-12 text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-700">
              <Search size={32} />
            </div>
            <div className="space-y-1">
              <p className="text-xs font-black text-white/50 uppercase tracking-widest">No Matches Detected</p>
              <p className="text-[10px] text-gray-600">Try adjusting your search or category filters</p>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function StoreCard({ store, profile, onSelect }: { store: StoreType, profile: UserProfile | null, onSelect: (id: string) => void }) {
  const navigate = useNavigate();
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => {
        onSelect(store.id);
      }}
      className="neon-card p-3.5 sm:p-5 space-y-3 sm:space-y-4 cursor-pointer group"
    >
      <div className="flex items-center gap-3 sm:gap-4">
        <div className="w-10 h-10 sm:w-14 sm:h-14 rounded-lg sm:rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-primary font-black text-base sm:text-xl shadow-[0_0_15px_rgba(0,242,254,0.1)] group-hover:scale-110 transition-transform flex-shrink-0 overflow-hidden">
          {store.logo ? (
            <OptimizedImage src={store.logo} className="w-full h-full object-cover" />
          ) : (
            store.name.charAt(0)
          )}
        </div>
        <div className="space-y-0.5 sm:space-y-1 min-w-0">
          <div className="flex items-center gap-1 sm:gap-2">
            <h3 className="text-[10px] sm:text-sm font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors truncate">{store.name}</h3>
            <Check size={8} className="text-neon-green flex-shrink-0" />
          </div>
          <div className="flex items-center gap-1.5 text-[6px] sm:text-[8px] text-gray-500 font-black uppercase tracking-widest bg-white/5 px-1 sm:px-1.5 py-0.5 rounded border border-white/5 w-fit">
            <Building2 size={8} className="text-primary" /> {store.category}
          </div>
        </div>
      </div>

      <p className="text-[10px] text-gray-400 font-medium line-clamp-2 leading-relaxed h-7">
        {store.description}
      </p>

      <div className="flex items-center justify-between pt-2 border-t border-white/5">
        <div className="flex items-center gap-1">
          <Star size={10} className="fill-primary text-primary" />
          <span className="text-[10px] font-black text-white">{store.rating.toFixed(1)}</span>
          <span className="text-[8px] text-gray-600 font-black ml-1">({store.reviewCount})</span>
        </div>
        <div className="flex items-center gap-1 text-[8px] text-primary font-black uppercase tracking-widest group-hover:translate-x-1 transition-transform">
          Enter Node <ArrowRight size={10} />
        </div>
      </div>
    </motion.div>
  );
}
