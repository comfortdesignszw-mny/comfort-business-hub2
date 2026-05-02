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
import { collection, query, limit, getDocs, where, addDoc, serverTimestamp, setDoc, doc, getDoc, orderBy, onSnapshot } from 'firebase/firestore';
import { BUSINESS_CATEGORIES, PRODUCT_CATEGORIES } from '../constants';

export default function Discovery({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const navigate = useNavigate();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [nearbyDeals, setNearbyDeals] = useState<Product[]>([]);
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
  const [filteredDeals, setFilteredDeals] = useState<Product[]>([]);
  const [filteredStores, setFilteredStores] = useState<StoreType[]>([]);
  const [activeModal, setActiveModal] = useState<{ type: 'checkout' | 'ecocash' | 'pod', product: Product } | null>(null);
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
      pResult = pResult.filter(p => p.category === activeCategory);
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
      limit(50)
    );
    
    const unsubscribeProducts = onSnapshot(pq, (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product));
      
      setNearbyDeals(allProducts);

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
    const sq = query(collection(db, 'stores'), limit(20));
    const unsubscribeStores = onSnapshot(sq, (snapshot) => {
      const allStores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoreType));
      setNearbyStores(allStores);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores-feed');
    });

    // Fetch Spotlights
    const spq = query(
      collection(db, 'spotlights'),
      where('isActive', '==', true),
      orderBy('createdAt', 'desc'),
      limit(5)
    );
    const unsubscribeSpotlights = onSnapshot(spq, (snapshot) => {
      setSpotlights(snapshot.docs.map(d => ({ id: d.id, ...d.data() } as Spotlight)));
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'spotlights-feed');
    });

    return () => {
      unsubscribeProducts();
      unsubscribeStores();
      unsubscribeSpotlights();
    };
  }, [profile]);

  useEffect(() => {
    if (spotlights.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSpotlightIndex(prev => (prev + 1) % spotlights.length);
    }, 8000);
    return () => clearInterval(interval);
  }, [spotlights.length]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8"
    >
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
                <ProductCard product={product} profile={profile} />
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
                <img 
                  src={spotlights[activeSpotlightIndex].image || "https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80"} 
                  className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000" 
                  alt="Spotlight" 
                  referrerPolicy="no-referrer" 
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
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-white uppercase tracking-tighter text-lg">Active Supply Nodes</h2>
            <div className="px-1.5 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded border border-primary/20 uppercase tracking-widest">Network</div>
          </div>
        </div>

        {loading ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 shadow-inner">
            {[1, 2, 3].map(i => (
              <div key={i} className="min-w-[200px] h-40 bg-white/5 rounded-3xl animate-pulse" />
            ))}
          </div>
        ) : filteredStores.length > 0 ? (
          <div className="flex gap-4 overflow-x-auto no-scrollbar pb-4 snap-x px-1">
            {filteredStores.map((store) => (
              <div key={store.id} className="min-w-[240px] snap-center">
                <StoreCard store={store} />
              </div>
            ))}
          </div>
        ) : (
          <div className="bg-white/5 border border-white/5 rounded-3xl p-8 text-center">
            <Building2 className="mx-auto text-gray-700 mb-2" size={24} />
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No active nodes in this category</p>
          </div>
        )}

        <div className="flex items-center justify-between px-1 pt-4">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-white uppercase tracking-tighter text-lg">Local Inventory</h2>
            <div className="px-1.5 py-0.5 bg-neon-green/10 text-neon-green text-[8px] font-black rounded border border-neon-green/20 uppercase tracking-widest">Live</div>
          </div>
          <button className="text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors">View All Scan</button>
        </div>

        {loading ? (
          <div className="grid grid-cols-1 gap-6">
            {[1, 2].map(i => (
              <div key={i} className="neon-card h-72 animate-pulse" />
            ))}
          </div>
        ) : filteredDeals.length > 0 ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6 px-1">
            {filteredDeals.map((product) => (
              <ProductCard 
                key={product.id} 
                product={product} 
                profile={profile} 
                onAction={(prod) => setActiveModal({ type: 'checkout', product: prod })}
              />
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

      <AnimatePresence>
        {activeModal && activeModal.type === 'checkout' && (
          <UnifiedCheckoutModal 
            product={activeModal.product} 
            profile={profile}
            onClose={() => setActiveModal(null)}
            onSwitchModal={(type) => setActiveModal({ type, product: activeModal.product })}
          />
        )}
        {activeModal && activeModal.type === 'ecocash' && (
          <EcoCashModal 
            product={activeModal.product} 
            profile={profile}
            onClose={() => setActiveModal(null)} 
          />
        )}
        {activeModal && activeModal.type === 'pod' && (
          <PodModal 
            product={activeModal.product} 
            profile={profile}
            onClose={() => setActiveModal(null)} 
          />
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function UnifiedCheckoutModal({ product, profile, onClose, onSwitchModal }: { 
  product: Product, 
  profile: UserProfile | null, 
  onClose: () => void,
  onSwitchModal: (type: 'ecocash' | 'pod') => void 
}) {
  const [supplierProfile, setSupplierProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    const fetchSupplier = async () => {
      try {
        const docSnap = await getDoc(doc(db, 'users', product.ownerId));
        if (docSnap.exists()) {
          setSupplierProfile(docSnap.data() as UserProfile);
        }
      } finally {
        setLoading(false);
      }
    };
    fetchSupplier();
  }, [product.ownerId]);

  const handleSelection = (method: 'paypal' | 'stripe' | 'ecocash' | 'pod') => {
    setErrorMessage(null);
    
    // Check if supplier has this configured
    const isConfigured = supplierProfile?.gateway?.provider === method && supplierProfile?.gateway?.isActive;
    
    if (method === 'ecocash') {
      if (isConfigured) {
        onSwitchModal('ecocash');
      } else {
        setErrorMessage("Supplier not configure this payment type, Try another payment type");
      }
      return;
    }

    if (method === 'pod') {
      onSwitchModal('pod');
      return;
    }

    if (!isConfigured) {
      setErrorMessage("Supplier not configure this payment type, Try another payment type");
      return;
    }

    // Handle external gateways
    if (method === 'paypal' || method === 'stripe') {
      const details = supplierProfile?.gateway?.details;
      if (details) window.location.href = details;
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }} className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" onClick={onClose} />
      <motion.div initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} exit={{ scale: 0.9, opacity: 0 }} className="relative w-full max-w-sm neon-card p-0 overflow-hidden">
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Financial Uplink</h3>
            <p className="text-[9px] text-primary font-black uppercase tracking-widest leading-none">Select Secure Payment Protocol</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="p-6 space-y-6">
          <div className="flex gap-4 items-center p-4 bg-white/5 rounded-2xl border border-white/5">
            <div className="w-12 h-12 bg-white/5 rounded-xl overflow-hidden">
              <img src={product.images[0]} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            </div>
            <div>
              <p className="text-[10px] font-black text-white uppercase italic">{product.name}</p>
              <p className="text-sm font-black text-primary">{formatCurrency(product.price, product.currency)}</p>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {[
              { id: 'paypal', label: 'PayPal', icon: CreditCard },
              { id: 'stripe', label: 'Stripe', icon: CreditCard },
              { id: 'ecocash', label: 'EcoCash', icon: Phone },
              { id: 'pod', label: 'Cash/POD', icon: MapPinned }
            ].map((m) => (
              <button 
                key={m.id}
                onClick={() => handleSelection(m.id as any)}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center gap-2 hover:bg-white/10 hover:border-primary/30 transition-all group"
              >
                <m.icon size={20} className="text-gray-500 group-hover:text-primary" />
                <span className="text-[9px] font-black text-gray-400 uppercase tracking-widest group-hover:text-white">{m.label}</span>
              </button>
            ))}
          </div>

          <AnimatePresence>
            {errorMessage && (
              <motion.div 
                initial={{ height: 0, opacity: 0 }}
                animate={{ height: 'auto', opacity: 1 }}
                exit={{ height: 0, opacity: 0 }}
                className="p-4 bg-red-500/10 border border-red-500/20 rounded-xl flex items-center gap-3"
              >
                <div className="w-8 h-8 bg-red-500/20 rounded-lg flex items-center justify-center shrink-0">
                  <X size={14} className="text-red-500" />
                </div>
                <p className="text-[10px] font-bold text-red-400 leading-tight">
                  {errorMessage}
                </p>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        <div className="p-4 bg-black/40 text-center">
          <p className="text-[8px] text-gray-700 font-black uppercase tracking-[0.2em]">Matrix Secured Node {product.ownerId.slice(0,8)}</p>
        </div>
      </motion.div>
    </div>
  );
}

function EcoCashModal({ product, profile, onClose }: { product: Product, profile: UserProfile | null, onClose: () => void }) {
  const [ussd, setUssd] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchUSSD = async () => {
      try {
        const userSnap = await getDoc(doc(db, 'users', product.ownerId));
        if (userSnap.exists()) {
          const data = userSnap.data();
          if (data.gateway?.provider === 'ecocash') {
            setUssd(data.gateway.details);
          }
        }
      } finally {
        setLoading(false);
      }
    };
    fetchUSSD();

    // Log engagement when opening payment modal
    if (profile && product.ownerId) {
      const customerName = profile.name || profile.businessName || profile.email?.split('@')[0] || 'Member';
      addDoc(collection(db, 'engagements'), {
        productId: product.id,
        productName: product.name,
        customerId: profile.uid,
        customerName: customerName,
        supplierId: product.ownerId,
        type: 'interested',
        createdAt: serverTimestamp()
      }).catch(console.error);
    }
  }, [product.ownerId, product.id, profile]);

  const handleDial = () => {
    if (ussd) {
      // Encode # as %23 for USSD codes in tel: links to ensure compatibility
      const encodedUssd = ussd.replace(/#/g, '%23');
      window.location.href = `tel:${encodedUssd}`;
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }} 
        className="relative w-full max-w-sm neon-card p-8 text-center space-y-6"
      >
        <div className="w-20 h-20 bg-primary/20 rounded-3xl flex items-center justify-center mx-auto text-primary">
          <Phone size={40} className="animate-pulse" />
        </div>
        <div className="space-y-2">
          <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">EcoCash Matrix</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Execute USSD Uplink to Secure Item</p>
        </div>

        <div className="space-y-4">
          <div className="p-4 bg-primary/5 border border-primary/10 rounded-2xl">
            <p className="text-[10px] font-bold text-gray-300 leading-relaxed">
              <span className="text-primary font-black">NOTE:</span> You are being redirected to pay your products with your EcoCash wallet. Make sure you have sufficient funds in your wallet to process the payment.
            </p>
          </div>

          <button 
            onClick={handleDial}
            disabled={loading || !ussd}
            className="w-full btn-neon py-4 text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 disabled:opacity-50"
          >
            {loading ? <Loader2 className="animate-spin" size={14} /> : <Phone size={14} />} 
            Dial Payment Command
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function PodModal({ product, profile, onClose }: { product: Product, profile: UserProfile | null, onClose: () => void }) {
  const navigate = useNavigate();
  const [formData, setFormData] = useState({
    name: '',
    phone: '',
    quantity: 1,
    address: ''
  });
  const [submitting, setSubmitting] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setSubmitting(true);

    try {
      // Log engagement
      const customerName = profile.name || profile.businessName || profile.email?.split('@')[0] || 'Member';
      await addDoc(collection(db, 'engagements'), {
        productId: product.id,
        productName: product.name,
        customerId: profile.uid,
        customerName: customerName,
        supplierId: product.ownerId,
        type: 'interested',
        createdAt: serverTimestamp()
      });

      if (!product.ownerId || !profile.uid) {
        throw new Error("Invalid session or missing node ID");
      }
      // 1. Ensure/Create Conversation
      const convoId = [profile.uid, product.ownerId].sort().join('_');
      await setDoc(doc(db, 'conversations', convoId), {
        id: convoId,
        participants: [profile.uid, product.ownerId],
        updatedAt: serverTimestamp(),
        lastMessage: `POD ORDER: ${product.name}`
      }, { merge: true });

      // 2. Send POD details as message
      const orderMessage = `🚀 PAY ON DELIVERY ORDER INITIATED\n\n` +
        `• ITEM: ${product.name}\n` +
        `• QUANTITY: ${formData.quantity}\n` +
        `• TOTAL: ${formatCurrency(product.price * formData.quantity, product.currency)}\n\n` +
        `📦 CUSTOMER DETAILS:\n` +
        `• NAME: ${formData.name}\n` +
        `• CONTACT: ${formData.phone}\n` +
        `• ADDRESS: ${formData.address}\n\n` +
        `Please confirm delivery sequence via this encrypted link.`;

      await addDoc(collection(db, 'conversations', convoId, 'messages'), {
        conversationId: convoId,
        senderId: profile.uid,
        text: orderMessage,
        type: 'text',
        payload: {
          type: 'pod_order',
          productId: product.id,
          orderDetails: formData
        },
        createdAt: serverTimestamp()
      });

      onClose();
      navigate(`/chat?id=${convoId}`);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'pod-order');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0 }} 
        animate={{ scale: 1, opacity: 1 }} 
        exit={{ scale: 0.9, opacity: 0 }} 
        className="relative w-full max-w-lg neon-card p-0 flex flex-col max-h-[90vh] overflow-hidden"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center">
          <div className="space-y-1">
            <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Pay on Delivery</h3>
            <p className="text-[9px] text-primary/60 font-black uppercase tracking-widest leading-none">Complete your delivery details below</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white p-2">
            <X size={24} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-8 space-y-6 overflow-y-auto no-scrollbar">
          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Customer Name</label>
                <input 
                  required
                  type="text"
                  value={formData.name}
                  onChange={e => setFormData({ ...formData, name: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Phone Number</label>
                <input 
                  required
                  type="tel"
                  value={formData.phone}
                  onChange={e => setFormData({ ...formData, phone: e.target.value })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 font-mono text-xs"
                />
              </div>
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Product Name</label>
                <div className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-gray-400 text-[10px] font-black italic">
                  {product.name}
                </div>
              </div>
              <div className="space-y-1.5">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Quantity</label>
                <input 
                  required
                  type="number"
                  min="1"
                  value={formData.quantity}
                  onChange={e => setFormData({ ...formData, quantity: parseInt(e.target.value) })}
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1.5">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Delivery Address</label>
              <textarea 
                required
                value={formData.address}
                onChange={e => setFormData({ ...formData, address: e.target.value })}
                rows={3}
                placeholder="Enter physical address for delivery..."
                className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-medium"
              />
            </div>
          </div>

          <div className="p-4 bg-primary/5 rounded-2xl border border-primary/10 flex items-center justify-between">
            <p className="text-[10px] font-black text-primary uppercase tracking-widest italic">Total Delivery Value</p>
            <p className="text-xl font-black text-white italic tracking-tighter">
              {formatCurrency(product.price * formData.quantity, product.currency)}
            </p>
          </div>

          <button 
            type="submit"
            disabled={submitting}
            className="w-full btn-neon py-5 text-[10px] font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
          >
            {submitting ? <Loader2 className="animate-spin" size={18} /> : <Check size={18} />} Secure Delivery Sequence
          </button>
        </form>
      </motion.div>
    </div>
  );
}

function StoreCard({ store }: { store: StoreType }) {
  const navigate = useNavigate();
  return (
    <motion.div 
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => navigate(`/store/${store.id}`)}
      className="neon-card p-5 space-y-4 cursor-pointer group"
    >
      <div className="flex items-center gap-4">
        <div className="w-14 h-14 rounded-2xl bg-gradient-to-br from-primary/20 to-accent/20 border border-white/10 flex items-center justify-center text-primary font-black text-xl shadow-[0_0_15px_rgba(0,242,254,0.1)] group-hover:scale-110 transition-transform">
          {store.logo ? (
            <img src={store.logo} className="w-full h-full object-cover rounded-2xl" referrerPolicy="no-referrer" />
          ) : (
            store.name.charAt(0)
          )}
        </div>
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{store.name}</h3>
            <Check size={12} className="text-neon-green" />
          </div>
          <div className="flex items-center gap-1.5 text-[8px] text-gray-500 font-black uppercase tracking-widest bg-white/5 px-1.5 py-0.5 rounded border border-white/5 w-fit">
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

function ProductCard({ product, profile, onAction }: { product: Product, profile: UserProfile | null, onAction?: (prod: Product) => void, key?: React.Key }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [storeData, setStoreData] = useState<{ name: string; rating: number; reviewCount: number }>({
    name: 'Verified Node',
    rating: 5.0,
    reviewCount: 0
  });
  const [isStoreLoading, setIsStoreLoading] = useState(true);
  const [isEngaging, setIsEngaging] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchStoreData = async () => {
      try {
        const storeSnap = await getDoc(doc(db, 'stores', product.storeId));
        if (storeSnap.exists()) {
          const data = storeSnap.data();
          setStoreData({
            name: data.name || 'Verified Node',
            rating: data.rating || 5.0,
            reviewCount: data.reviewCount || 0
          });
        }
      } catch (err) {
        console.error("Error fetching store data:", err);
      } finally {
        setIsStoreLoading(false);
      }
    };
    fetchStoreData();
  }, [product.storeId]);

  const logEngagement = async (type: 'engaged' | 'interested') => {
    if (!profile || !product.ownerId) return;
    
    try {
      // Use a consistent name to satisfy rules size check if missing
      const customerName = profile.name || profile.businessName || profile.email?.split('@')[0] || 'Member';
      
      await addDoc(collection(db, 'engagements'), {
        productId: product.id,
        productName: product.name,
        customerId: profile.uid,
        customerName: customerName,
        supplierId: product.ownerId,
        type,
        createdAt: serverTimestamp()
      });
    } catch (err) {
      console.error("Error logging engagement:", err);
      // We don't block the UI for logging errors
    }
  };

  const handleAction = async (type: 'shop' | 'engage') => {
    if (type === 'engage') {
      if (!profile) {
        navigate('/profile');
        return;
      }
      
      setIsEngaging(true);
      await logEngagement('engaged');
      const convoId = [profile.uid, product.ownerId].sort().join('_');
      const customerName = profile.name || profile.businessName || 'A Customer';
      const interestMessage = `Hie, I am ${customerName}. I am interested in this Product/Service: ${product.name}`;

      try {
        // Ensure conversation exists with metadata
        await setDoc(doc(db, 'conversations', convoId), {
          id: convoId,
          participants: [profile.uid, product.ownerId],
          updatedAt: serverTimestamp(),
          lastMessage: interestMessage,
          initiatorId: profile.uid,
          initiatorName: customerName
        }, { merge: true });

        // Add the initial interest message
        await addDoc(collection(db, 'conversations', convoId, 'messages'), {
          conversationId: convoId,
          senderId: profile.uid,
          text: interestMessage,
          type: 'text',
          payload: { 
            type: 'product_interest',
            productId: product.id,
            productName: product.name
          },
          createdAt: serverTimestamp()
        });

        navigate(`/chat?id=${convoId}`);
      } catch (err) {
        setIsEngaging(false);
        handleFirestoreError(err, OperationType.CREATE, 'engage-chat');
      }
      return;
    }

    // Purchase path
    if (profile) {
      await logEngagement('interested');
    }

    if (onAction) {
      onAction(product);
      return;
    }

    switch (product.buyButtonType) {
      case 'link':
        if (product.buyButtonLink) window.open(product.buyButtonLink, '_blank');
        break;
      case 'chat':
        if (profile) {
          const cid = [profile.uid, product.ownerId].sort().join('_');
          navigate(`/chat?id=${cid}`);
        } else {
          navigate('/profile');
        }
        break;
      case 'checkout':
        window.location.href = `/deals?productId=${product.id}&action=checkout`;
        break;
      case 'ecocash':
        break;
      case 'pod':
        break;
    }
  };

  const getActionIcon = () => {
    switch (product.buyButtonType) {
      case 'link': return <ArrowRight size={14} />;
      case 'chat': return <MessageSquare size={14} />;
      case 'ecocash': return <Phone size={14} />;
      case 'pod': return <MapPinned size={14} />;
      default: return <Zap size={14} className="fill-current" />;
    }
  };

  const images = product.images && product.images.length > 0 ? product.images : ['https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=600&auto=format&fit=crop'];

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/discovery?productId=${product.id}`;
    if (navigator.share) {
      navigator.share({
        title: product.name,
        text: `Check out ${product.name} on Comfort Business Hub!`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Node Link Copied to Clipboard!');
    }
  };

  const nextImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev + 1) % images.length);
  };

  const prevImage = (e: React.MouseEvent) => {
    e.stopPropagation();
    setCurrentImageIndex((prev) => (prev - 1 + images.length) % images.length);
  };

  return (
    <motion.div 
      whileTap={{ scale: 0.98 }}
      className="neon-card group relative overflow-hidden"
    >
      <div className="aspect-[16/10] relative overflow-hidden">
        <AnimatePresence mode="wait">
          <motion.img 
            key={currentImageIndex}
            src={images[currentImageIndex]} 
            alt={product.name}
            initial={{ opacity: 0, x: 20 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -20 }}
            className="w-full h-full object-cover"
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
            }}
          />
        </AnimatePresence>
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60 pointer-events-none"></div>

        {/* Share Button Overlay */}
        <button 
          onClick={(e) => {
            e.stopPropagation();
            const shareUrl = `${window.location.origin}/discovery?productId=${product.id}`;
            if (navigator.share) {
              navigator.share({
                title: product.name,
                text: `Check out ${product.name} on Comfort Business Hub!`,
                url: shareUrl,
              }).catch(console.error);
            } else {
              navigator.clipboard.writeText(shareUrl);
              alert('Node Link Copied to Clipboard!');
            }
          }}
          className="absolute top-4 right-4 p-2 bg-[#05070a]/80 backdrop-blur-md rounded-xl border border-white/10 text-white hover:text-primary transition-colors hover:scale-110 active:scale-95 shadow-xl z-20"
          title="Share Node"
        >
          <Share2 size={14} />
        </button>
        
        {images.length > 1 && (
          <div className="absolute inset-0 flex items-center justify-between px-4 opacity-0 group-hover:opacity-100 transition-opacity">
            <button 
              onClick={prevImage}
              className="w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-primary hover:text-black transition-all"
            >
              <ArrowRight size={14} className="rotate-180" />
            </button>
            <button 
              onClick={nextImage}
              className="w-8 h-8 bg-black/40 backdrop-blur-md rounded-full flex items-center justify-center text-white hover:bg-primary hover:text-black transition-all"
            >
              <ArrowRight size={14} />
            </button>
          </div>
        )}

        {/* Indicators */}
        {images.length > 1 && (
          <div className="absolute bottom-4 left-1/2 -translate-x-1/2 flex gap-1">
            {images.map((_, idx) => (
              <div 
                key={idx} 
                className={cn(
                  "w-1 h-1 rounded-full transition-all duration-300",
                  idx === currentImageIndex ? "w-4 bg-primary" : "bg-white/30"
                )}
              />
            ))}
          </div>
        )}

        <div className="absolute top-4 left-4 flex flex-col gap-2">
          <span className="glass-pill flex items-center gap-1 group-hover:border-primary/50 transition-colors">
            <Star size={10} className="fill-primary text-primary" /> {storeData.rating.toFixed(1)}
          </span>
          <span className="glass-pill text-[8px] uppercase tracking-widest">{product.category}</span>
        </div>
      </div>
      
      <div className="p-5 space-y-4">
        <div className="flex justify-between items-start gap-4">
          <div className="space-y-1 flex-1">
            <h3 className="text-sm font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors line-clamp-1">{product.name}</h3>
            <p className="text-[10px] text-gray-500 font-medium line-clamp-2 leading-relaxed">{product.description}</p>
          </div>
          <div className="flex flex-col items-end shrink-0">
            <span className="text-xl font-black text-white tracking-tighter">{formatCurrency(product.price, product.currency)}</span>
            <span className="text-[7px] text-primary font-black uppercase tracking-widest">Global Sync</span>
          </div>
        </div>
        
        <div className="pt-4 border-t border-white/5 space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2.5">
              <div className="w-9 h-9 rounded-xl bg-white/5 border border-white/5 flex items-center justify-center text-[10px] font-black text-primary group-hover:bg-primary/10 transition-all">
                {storeData.name.charAt(0)}
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest flex items-center gap-2">
                  Supplier Entity
                  <span className="flex items-center gap-0.5 ml-1">
                    {[1, 2, 3, 4, 5].map((star) => (
                      <Star 
                        key={star} 
                        size={6} 
                        className={cn(
                          "transition-colors",
                          star <= Math.round(storeData.rating) ? "fill-primary text-primary" : "text-gray-600"
                        )} 
                      />
                    ))}
                    <span className="text-[6px] text-gray-400 font-bold ml-1">({storeData.reviewCount})</span>
                  </span>
                </p>
                <p className={cn(
                  "text-[10px] font-black text-white italic truncate max-w-[120px]",
                  isStoreLoading && "animate-pulse bg-white/5 rounded-sm h-3 w-20"
                )}>
                  {isStoreLoading ? '' : storeData.name}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-1 text-neon-green">
              <Sparkles size={10} />
              <span className="text-[8px] font-black uppercase tracking-widest">Active Node</span>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <button 
              onClick={() => handleAction('engage')}
              disabled={isEngaging}
              className="flex-1 py-3 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all group/btn disabled:opacity-50"
            >
              {isEngaging ? (
                <Loader2 size={14} className="animate-spin text-primary" />
              ) : (
                <MessageSquare size={14} className="group-hover/btn:scale-110 transition-transform" />
              )}
              {isEngaging ? 'Linking...' : 'Engage'}
            </button>
            <button 
              onClick={() => handleAction('shop')}
              className="flex-1 py-3 px-4 bg-primary rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#05070a] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all group/btn"
            >
              {getActionIcon()}
              {product.buyButtonType === 'chat' ? 'Buy Now' : 'Pay Now'}
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
