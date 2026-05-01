import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Search, MapPin, Filter, Star, Zap, ShoppingBag, Store, ArrowRight, SlidersHorizontal, MessageSquare, Sparkles } from 'lucide-react';
import { UserProfile, Product, Store as StoreType } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db } from '../lib/firebase';
import { collection, query, limit, getDocs, where } from 'firebase/firestore';
import { BUSINESS_CATEGORIES } from '../constants';

export default function Discovery({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [nearbyDeals, setNearbyDeals] = useState<Product[]>([]);
  const [filteredDeals, setFilteredDeals] = useState<Product[]>([]);

  const categories = ['All', ...BUSINESS_CATEGORIES];
  const [matchedProducts, setMatchedProducts] = useState<Product[]>([]);

  useEffect(() => {
    let result = nearbyDeals;

    if (searchTerm) {
      result = result.filter(p => 
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        p.description.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }

    if (activeCategory !== 'All') {
      result = result.filter(p => p.category === activeCategory);
    }

    setFilteredDeals(result);
  }, [searchTerm, activeCategory, nearbyDeals]);

  useEffect(() => {
    const fetchDiscoveryData = async () => {
      setLoading(true);
      try {
        const q = query(
          collection(db, 'products'),
          where('isActive', '==', true),
          limit(50)
        );
        const querySnapshot = await getDocs(q);
        const allProducts = querySnapshot.docs.map(doc => ({
          id: doc.id,
          ...doc.data()
        } as Product));

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

        setNearbyDeals(allProducts);
      } catch (error) {
        console.error("Error fetching products:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchDiscoveryData();
  }, [profile]);

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8"
    >
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

      {/* Featured Promo */}
      <section className="neon-card relative h-48 flex flex-col justify-end p-6 group cursor-pointer">
        <div className="absolute inset-0 z-0">
          <img src="https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80" className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000" alt="Featured" />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/40 to-transparent"></div>
        </div>
        <div className="relative z-10 space-y-1">
          <div className="glass-pill inline-block mb-2 !text-primary !border-primary/20">Market Spotlight</div>
          <h3 className="text-2xl font-black text-white italic leading-tight">SUMMER<br/>AGRI-TECH EXPO</h3>
          <p className="text-xs text-gray-400 font-medium">Harare Showgrounds • May 15-20</p>
        </div>
        <div className="absolute top-6 right-6 flex flex-col items-end">
          <Zap size={32} className="text-primary animate-pulse" />
        </div>
      </section>

      {/* Discovery Feed */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
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
              <ProductCard key={product.id} product={product} profile={profile} />
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

function ProductCard({ product, profile }: { product: Product, profile: UserProfile | null, key?: React.Key }) {
  const [currentImageIndex, setCurrentImageIndex] = useState(0);
  const [storeName, setStoreName] = useState<string>('Verified Node');
  const [isStoreLoading, setIsStoreLoading] = useState(true);

  useEffect(() => {
    const fetchStoreName = async () => {
      try {
        const { getDoc, doc } = await import('firebase/firestore');
        const storeSnap = await getDoc(doc(db, 'stores', product.storeId));
        if (storeSnap.exists()) {
          setStoreName(storeSnap.data().name);
        }
      } catch (err) {
        console.error("Error fetching store name:", err);
      } finally {
        setIsStoreLoading(false);
      }
    };
    fetchStoreName();
  }, [product.storeId]);

  const handleAction = (type: 'shop' | 'engage') => {
    if (type === 'engage') {
      window.location.href = `/chat?productId=${product.id}&supplierId=${product.ownerId}`;
      return;
    }

    switch (product.buyButtonType) {
      case 'link':
        if (product.buyButtonLink) window.open(product.buyButtonLink, '_blank');
        break;
      case 'chat':
        window.location.href = `/chat?productId=${product.id}&supplierId=${product.ownerId}`;
        break;
      case 'checkout':
        window.location.href = `/deals?productId=${product.id}&action=checkout`;
        break;
    }
  };

  const getActionIcon = () => {
    switch (product.buyButtonType) {
      case 'link': return <ArrowRight size={22} />;
      case 'chat': return <MessageSquare size={22} />;
      default: return <Zap size={22} className="fill-current" />;
    }
  };

  const images = product.images && product.images.length > 0 ? product.images : ['https://images.unsplash.com/photo-1555529733-0e670560f7e1?q=80&w=600&auto=format&fit=crop'];

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
          />
        </AnimatePresence>
        
        <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-transparent to-transparent opacity-60 pointer-events-none"></div>
        
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
            <Star size={10} className="fill-primary text-primary" /> 4.9
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
                {storeName.charAt(0)}
              </div>
              <div>
                <p className="text-[8px] font-black text-gray-500 uppercase tracking-widest">Supplier Entity</p>
                <p className={cn(
                  "text-[10px] font-black text-white italic truncate max-w-[120px]",
                  isStoreLoading && "animate-pulse bg-white/5 rounded-sm h-3 w-20"
                )}>
                  {isStoreLoading ? '' : storeName}
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
              className="flex-1 py-3 px-4 bg-white/5 border border-white/10 rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-gray-400 hover:text-white hover:bg-white/10 transition-all group/btn"
            >
              <MessageSquare size={14} className="group-hover/btn:scale-110 transition-transform" />
              Engage
            </button>
            <button 
              onClick={() => handleAction('shop')}
              className="flex-1 py-3 px-4 bg-primary rounded-xl flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest text-[#05070a] shadow-lg shadow-primary/20 hover:scale-[1.02] active:scale-95 transition-all group/btn"
            >
              <ShoppingBag size={14} className="group-hover/btn:scale-110 transition-transform" />
              Shop
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
