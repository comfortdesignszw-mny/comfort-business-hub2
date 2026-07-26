import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, MapPin, Filter, Star, Zap, ShoppingBag, Store, ArrowRight, 
  SlidersHorizontal, MessageSquare, Sparkles, X, Phone, Check, Loader2, MapPinned, CreditCard,
  Megaphone, Calendar, FileText, Building2, ExternalLink, Share2, Info, Users, Shield, Map as MapIcon, List, UserPlus, Heart,
  Tag, Clock, Flame, DollarSign, Send
} from 'lucide-react';
import { UserProfile, Product, Store as StoreType, Message, Spotlight, PublicProfile } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { localDB } from '../lib/db';
import { collection, query, limit, getDocs, where, addDoc, serverTimestamp, setDoc, doc, getDoc, orderBy, onSnapshot, getCountFromServer, startAt, endAt } from 'firebase/firestore';
import { BUSINESS_CATEGORIES, PRODUCT_CATEGORIES } from '../constants';
import ProductCard from '../components/ProductCard';
import AuthGuard from '../components/AuthGuard';
import { useModals } from '../context/ModalContext';
import { useNotifications } from '../components/NotificationProvider';
import { interactionService } from '../services/interactionService';
import { StoreDetailContent } from './StoreDetail';
import OptimizedImage from '../components/OptimizedImage';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';
import { distanceBetween } from 'geofire-common';

function MapController({ center, isFollowing }: { center: [number, number], isFollowing: boolean }) {
  const map = useMap();
  useEffect(() => {
    if (center && isFollowing) {
      map.setView(center, map.getZoom());
    }
  }, [center, isFollowing, map]);
  return null;
}

export default function Discovery({ profile, setProfile, onGuestLogin }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void, onGuestLogin?: () => void }) {
  const navigate = useNavigate();
  const { openUserList, openUserProfile } = useModals();
  const [searchTerm, setSearchTerm] = useState('');
  const [activeCategory, setActiveCategory] = useState('All');
  const [loading, setLoading] = useState(true);
  const [productsLoading, setProductsLoading] = useState(true);
  const [storesLoading, setStoresLoading] = useState(true);
  const [spotlightsLoading, setSpotlightsLoading] = useState(true);
  const [nearbyDeals, setNearbyDeals] = useState<Product[]>([]);
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
  const [selectedSpotlightAd, setSelectedSpotlightAd] = useState<Spotlight | null>(null);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');

  const getTimeLeftText = (expiresAt: any) => {
    if (!expiresAt) return null;
    const expiryDate = new Date(expiresAt?.toDate?.() || expiresAt);
    const diffMs = expiryDate.getTime() - Date.now();
    if (diffMs <= 0) return { expired: true, text: 'Expired' };

    const totalHours = Math.floor(diffMs / (1000 * 60 * 60));
    const days = Math.floor(totalHours / 24);
    const hours = totalHours % 24;
    if (days >= 1) return { expired: false, text: `${days}d ${hours}h left` };
    return { expired: false, text: `${hours}h left` };
  };
  const [userLocation, setUserLocation] = useState<[number, number] | null>(null);
  const [mapCenter, setMapCenter] = useState<[number, number]>([-17.8252, 31.0335]); // Harare
  const [isFollowingUser, setIsFollowingUser] = useState(false);
  const [nearbyOnly, setNearbyOnly] = useState(false);
  const radiusKm = 50;

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

  const storesMap = useMemo(() => {
    return nearbyStores.reduce((acc, s) => {
      acc[s.id] = s;
      return acc;
    }, {} as Record<string, StoreType>);
  }, [nearbyStores]);

  useEffect(() => {
    let pResult = nearbyDeals;
    let sResult = nearbyStores;

    if (sharedProductId) {
      pResult = nearbyDeals.filter(p => p.id === sharedProductId);
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

    if (nearbyOnly && userLocation) {
        sResult = sResult.filter(s => {
          if (!s.lat || !s.lng) return false;
          const dist = distanceBetween([s.lat, s.lng], userLocation);
          return dist <= radiusKm;
        });
        const nearbyStoreIds = new Set(sResult.map(s => s.id));
        pResult = pResult.filter(p => nearbyStoreIds.has(p.storeId));
    }

    setFilteredDeals(pResult);
    setFilteredStores(sResult);
  }, [searchTerm, activeCategory, nearbyDeals, nearbyStores, sharedProductId, nearbyOnly, userLocation, storesMap]);

  useEffect(() => {
    // Phase 1: Fast Loading from Local Cache
    const tryLoadFromCache = async () => {
      try {
        const cachedProductsDoc = await localDB.cache.where('collection').equals('products').toArray();
        if (cachedProductsDoc.length > 0) {
          const cachedProducts = cachedProductsDoc.map(c => c.data as Product);
          const activeOnly = cachedProducts.filter(p => p.isActive !== false);
          activeOnly.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNearbyDeals(activeOnly);
          setProductsLoading(false);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load local DB cache for products', err);
      }
    };

    tryLoadFromCache();

    // Phase 2: Real-time listener for products
    const pq = query(
      collection(db, 'products'),
      where('isActive', '==', true),
      limit(100)
    );
    
    const unsubscribeProducts = onSnapshot(pq, async (snapshot) => {
      const allProducts = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as Product)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setNearbyDeals(allProducts);
      setProductsLoading(false);
      
      // Update local cache for next time
      try {
        for (const p of allProducts) {
          await localDB.cache.put({ id: `products:${p.id}`, collection: 'products', docId: p.id, data: p, updatedAt: Date.now() });
        }
      } catch (e) {
        console.error('Cache update failed', e);
      }

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

    // Start Stores Loading
    const loadStores = async () => {
      try {
        const cachedStoresDoc = await localDB.cache.where('collection').equals('stores').toArray();
        if (cachedStoresDoc.length > 0) {
          const cachedStores = cachedStoresDoc.map(c => c.data as StoreType);
          cachedStores.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
          setNearbyStores(cachedStores);
          setStoresLoading(false);
        }
      } catch (err) {}
    };
    loadStores();

    const sq = query(collection(db, 'stores'), limit(150));
    const unsubscribeStores = onSnapshot(sq, async (snapshot) => {
      const allStores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoreType)).sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
      
      setNearbyStores(allStores);
      setStoresLoading(false);

      try {
        for (const s of allStores) {
          await localDB.cache.put({ id: `stores:${s.id}`, collection: 'stores', docId: s.id, data: s, updatedAt: Date.now() });
        }
      } catch (e) {}
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, 'stores-feed');
      setStoresLoading(false);
    });

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
    if (viewMode === 'map' && !userLocation) {
      handleGetLocation();
    }
  }, [viewMode]);

  const handleGetLocation = () => {
    if ("geolocation" in navigator) {
      navigator.geolocation.getCurrentPosition((position) => {
        const { latitude, longitude } = position.coords;
        setUserLocation([latitude, longitude]);
        setMapCenter([latitude, longitude]);
        setIsFollowingUser(true);
      }, (error) => {
        console.error("Location access denied:", error);
      });
    }
  };

  useEffect(() => {
    if (sharedProductId && !loading && filteredDeals.length > 0) {
      const element = document.getElementById(`product-${sharedProductId}`);
      if (element) element.scrollIntoView({ behavior: 'smooth', block: 'center' });
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

        {/* Classified Ad / Spotlight Detail Modal */}
        {selectedSpotlightAd && (
          <div className="fixed inset-0 z-[2100] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              onClick={() => setSelectedSpotlightAd(null)}
              className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md"
            />
            <motion.div 
              initial={{ scale: 0.9, opacity: 0, y: 20 }}
              animate={{ scale: 1, opacity: 1, y: 0 }}
              exit={{ scale: 0.9, opacity: 0, y: 20 }}
              className="relative w-full max-w-lg bg-[#0d1117] border border-primary/40 rounded-[2.5rem] p-6 sm:p-8 overflow-hidden shadow-[0_0_60px_rgba(0,242,254,0.2)] z-10 text-left space-y-6"
            >
              <button 
                onClick={() => setSelectedSpotlightAd(null)}
                className="absolute top-6 right-6 w-9 h-9 bg-white/5 hover:bg-white/10 rounded-full flex items-center justify-center text-gray-400 hover:text-white transition-colors"
              >
                <X size={18} />
              </button>

              <div className="space-y-4">
                <div className="flex flex-wrap items-center gap-2">
                  {(selectedSpotlightAd.isClassified || selectedSpotlightAd.type === 'classified') ? (
                    <span className="px-3 py-1 bg-amber-500/10 text-amber-300 border border-amber-500/30 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1">
                      <Tag size={12} /> Classified Listing
                    </span>
                  ) : (
                    <span className="px-3 py-1 bg-primary/10 text-primary border border-primary/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                      {selectedSpotlightAd.type}
                    </span>
                  )}

                  {selectedSpotlightAd.badge && (
                    <span className="px-3 py-1 bg-neon-green/10 text-neon-green border border-neon-green/30 rounded-full text-[9px] font-black uppercase tracking-wider">
                      {selectedSpotlightAd.badge}
                    </span>
                  )}

                  {getTimeLeftText(selectedSpotlightAd.expiresAt) && (
                    <span className="px-3 py-1 bg-white/5 text-gray-400 border border-white/10 rounded-full text-[9px] font-black uppercase tracking-wider flex items-center gap-1 ml-auto">
                      <Clock size={12} className="text-primary" /> {getTimeLeftText(selectedSpotlightAd.expiresAt)?.text}
                    </span>
                  )}
                </div>

                {selectedSpotlightAd.image && (
                  <div className="w-full h-48 sm:h-56 rounded-2xl overflow-hidden border border-white/10 relative">
                    <img src={selectedSpotlightAd.image} className="w-full h-full object-cover" />
                    {selectedSpotlightAd.price && (
                      <div className="absolute bottom-3 left-3 bg-primary text-[#05070a] font-black text-sm px-4 py-1.5 rounded-xl shadow-lg">
                        {selectedSpotlightAd.price}
                      </div>
                    )}
                  </div>
                )}

                <div>
                  <h3 className="text-xl sm:text-2xl font-black text-white italic uppercase tracking-tight">{selectedSpotlightAd.title}</h3>
                  {selectedSpotlightAd.authorName && (
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-1">By {selectedSpotlightAd.authorName}</p>
                  )}
                </div>

                <div className="p-4 bg-white/5 rounded-2xl border border-white/5 space-y-2">
                  <p className="text-xs text-gray-300 font-medium leading-relaxed whitespace-pre-line">{selectedSpotlightAd.content}</p>
                  {selectedSpotlightAd.location && (
                    <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider pt-2 border-t border-white/5 flex items-center gap-1">
                      <MapPin size={12} className="text-primary" /> Location: {selectedSpotlightAd.location}
                    </p>
                  )}
                </div>

                <div className="flex flex-col sm:flex-row gap-3 pt-2">
                  {selectedSpotlightAd.whatsappNumber && (
                    <a
                      href={`https://wa.me/${selectedSpotlightAd.whatsappNumber.replace(/[^0-9]/g, '')}?text=${encodeURIComponent(`Hi, I'm interested in your ad: ${selectedSpotlightAd.title}`)}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="flex-1 py-3.5 bg-neon-green text-[#05070a] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_#39FF14] hover:scale-105 transition-all"
                    >
                      <MessageSquare size={16} /> Contact via WhatsApp
                    </a>
                  )}

                  {selectedSpotlightAd.contactPhone && (
                    <a
                      href={`tel:${selectedSpotlightAd.contactPhone}`}
                      className="flex-1 py-3.5 bg-primary text-[#05070a] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_rgba(0,242,254,0.4)] hover:scale-105 transition-all"
                    >
                      <Phone size={16} /> Direct Call
                    </a>
                  )}

                  {selectedSpotlightAd.actionUrl && (
                    <a
                      href={selectedSpotlightAd.actionUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="py-3.5 px-4 bg-white/5 border border-white/10 text-white rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 hover:bg-white/10 transition-all"
                    >
                      <ExternalLink size={16} />
                    </a>
                  )}
                </div>
              </div>
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
              <p className="text-[10px] font-black text-primary uppercase tracking-widest">Shared Link</p>
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

      {/* Search Bar Section */}
      <section className="space-y-6 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-1 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(0,242,254,0.5)]" />
            <div className="space-y-0.5">
              <h2 className="text-sm sm:text-base font-black text-white italic tracking-tighter uppercase leading-none">
                {profile ? 'Synchronized' : 'Guest'}<br/>
                <span className="text-primary drop-shadow-[0_0_8px_rgba(0,242,254,0.3)]">Discover</span>
              </h2>
            </div>
          </div>
        </div>

        <div className="relative group px-1">
          <div className="absolute inset-y-0 left-3 flex items-center pointer-events-none text-primary/40 group-focus-within:text-primary transition-colors">
            <Search size={14} />
          </div>
          <div className="relative flex items-center bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <input 
              type="text"
              placeholder="Search signed in suppliers, items or supply patterns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-2 pl-10 pr-10 text-[10px] font-medium text-white placeholder:text-gray-600 outline-none transition-all bg-transparent"
            />
            {profile && (
              <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
                className="absolute right-1.5 w-7 h-7 bg-white/5 rounded-lg flex items-center justify-center text-gray-500 hover:text-white transition-colors border border-white/5"
              >
                <SlidersHorizontal size={12} />
              </button>
            )}
          </div>
        </div>

        {profile && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar scroll-smooth">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "whitespace-nowrap px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-widest transition-all border",
                  activeCategory === cat 
                    ? "bg-primary text-[#05070a] border-primary shadow-[0_0_15px_rgba(0,242,254,0.3)]" 
                    : "bg-white/5 text-gray-500 border-white/5 hover:bg-white/10 hover:text-white"
                )}
              >
                {cat}
              </button>
            ))}
          </div>
        )}

      <div className="flex items-center justify-between px-2">
        {profile && !profile.isGuest && (
          <>
            <div 
              onClick={handleGetLocation}
              className="flex items-center gap-2 group cursor-pointer"
            >
              <div className="w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center shrink-0">
                <MapPin size={14} className="text-primary group-hover:scale-110 transition-transform" />
              </div>
              <div className="min-w-0">
                <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-none">Your Location</p>
                <p className="text-xs sm:text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                  {userLocation ? `Detected: ${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)}` : (profile?.location?.city ? profile.location.city.toUpperCase() : (profile?.geohash ? `Location: ${profile.geohash}` : 'Harare CBD, ZW'))}
                </p>
              </div>
            </div>
            
            <div className="flex items-center gap-2">
              <div className="bg-[#0d1117] border border-white/5 p-1 rounded-xl flex">
                <button 
                  onClick={() => setViewMode('list')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'list' ? "bg-primary text-[#05070a]" : "text-gray-500 hover:text-white"
                  )}
                >
                  <List size={16} />
                </button>
                <button 
                  onClick={() => setViewMode('map')}
                  className={cn(
                    "p-2 rounded-lg transition-all",
                    viewMode === 'map' ? "bg-primary text-[#05070a]" : "text-gray-500 hover:text-white"
                  )}
                >
                  <MapIcon size={16} />
                </button>
              </div>

              <button 
                onClick={() => setNearbyOnly(!nearbyOnly)}
                className={cn(
                  "p-2 rounded-lg transition-all ml-2",
                  nearbyOnly ? "bg-primary text-[#05070a]" : "text-gray-500 bg-[#0d1117] border border-white/5 hover:text-white"
                )}
                title={nearbyOnly ? 'Nearby Mode: Active' : 'Filter by Proximity'}
              >
                <MapIcon size={16} />
              </button>

            </div>
          </>
        )}
      </div>
      </section>

      {/* Map View Integration */}
      <AnimatePresence mode="wait">
        {viewMode === 'map' && (
          <motion.section 
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: '400px' }}
            exit={{ opacity: 0, height: 0 }}
            className="relative overflow-hidden rounded-[2.5rem] border border-white/10 shadow-2xl"
          >
            <MapContainer 
              center={mapCenter} 
              zoom={13} 
              style={{ height: '100%', width: '100%' }}
              zoomControl={false}
              className="z-0"
            >
              <TileLayer
                url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
              />
              <MapController center={mapCenter} isFollowing={isFollowingUser} />
              
              {nearbyStores.filter(s => s.lat && s.lng).map(store => (
                <Marker 
                  key={`marker-${store.id}`} 
                  position={[store.lat!, store.lng!]}
                  icon={L.divIcon({
                    className: 'custom-div-icon',
                    html: `
                      <div class="w-8 h-8 rounded-full border-2 border-primary bg-[#05070a] flex items-center justify-center overflow-hidden shadow-[0_0_15px_rgba(0,242,254,0.5)]">
                        ${store.logo ? `<img src="${store.logo}" style="width:100%; height:100%; object-fit:cover;" />` : `<span style="color:#00f2fe; font-weight:900; font-size:10px;">${store.name.charAt(0)}</span>`}
                      </div>
                    `,
                    iconSize: [32, 32],
                    iconAnchor: [16, 32]
                  })}
                  eventHandlers={{
                    click: () => setSelectedStoreId(store.id)
                  }}
                >
                  <Popup className="neon-popup">
                    <div className="p-2 space-y-1">
                      <h4 className="text-xs font-black text-white uppercase italic">{store.name}</h4>
                      <p className="text-[10px] text-primary font-bold">{store.category}</p>
                    </div>
                  </Popup>
                </Marker>
              ))}

              {profile && userLocation && (
                <Marker 
                  position={userLocation}
                  icon={L.divIcon({
                    className: 'user-marker',
                    html: `
                      <div class="relative flex items-center justify-center">
                        <div class="absolute w-8 h-8 bg-primary/20 rounded-full animate-ping"></div>
                        <div class="w-4 h-4 bg-primary rounded-full border-2 border-white shadow-lg"></div>
                      </div>
                    `
                  })}
                />
              )}
            </MapContainer>
            
            <div className="absolute top-4 right-4 z-[1000] flex flex-col gap-2">
              <button 
                onClick={handleGetLocation}
                className="w-10 h-10 bg-[#0d1117]/80 backdrop-blur-md border border-white/10 rounded-xl flex items-center justify-center text-primary hover:bg-primary hover:text-[#05070a] transition-all shadow-xl"
              >
                <MapPin size={20} />
              </button>
            </div>
            
            <div className="absolute bottom-6 left-1/2 -translate-x-1/2 z-[1000] w-full max-w-xs px-4">
              <div className="bg-[#0d1117]/90 backdrop-blur-md border border-white/10 p-3 rounded-2xl flex items-center gap-3 shadow-2xl">
                <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary shrink-0">
                  <MapPinned size={20} />
                </div>
                <div className="min-w-0">
                  <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">Spatial Search</p>
                  <p className="text-[10px] text-white font-bold truncate">Showing {nearbyStores.filter(s => s.lat && s.lng).length} active stores on map</p>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Featured Promo / Classified Carousel */}
      <section className="relative overflow-hidden rounded-[2.5rem]">
        <AnimatePresence mode="wait">
          {spotlights.length > 0 ? (
            (() => {
              const currentSpotlight = spotlights[activeSpotlightIndex];
              const isClassified = currentSpotlight.isClassified || currentSpotlight.type === 'classified';
              const timeInfo = getTimeLeftText(currentSpotlight.expiresAt);

              return (
                <motion.div 
                  key={currentSpotlight.id}
                  initial={{ opacity: 0, scale: 0.98, x: 20 }}
                  animate={{ opacity: 1, scale: 1, x: 0 }}
                  exit={{ opacity: 0, scale: 0.98, x: -20 }}
                  transition={{ duration: 0.4 }}
                  onClick={() => setSelectedSpotlightAd(currentSpotlight)}
                  className={cn(
                    "relative min-h-[220px] sm:min-h-[240px] flex flex-col justify-between p-5 sm:p-7 group cursor-pointer overflow-hidden rounded-[2.5rem] border transition-all text-left shadow-2xl",
                    isClassified 
                      ? "border-amber-500/40 shadow-[0_0_40px_rgba(245,158,11,0.2)] bg-gradient-to-br from-[#181108] via-[#0d1017] to-[#05070a]" 
                      : "border-primary/30 shadow-[0_0_40px_rgba(0,242,254,0.15)] bg-[#05070a]"
                  )}
                >
                  {/* Background Image & Gradient */}
                  <div className="absolute inset-0 z-0">
                    <OptimizedImage 
                      src={currentSpotlight.image || "https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80"} 
                      className="w-full h-full object-cover opacity-25 group-hover:scale-105 transition-transform duration-1000" 
                      alt="Spotlight Ad" 
                    />
                    <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/80 to-[#05070a]/40"></div>
                  </div>

                  {/* Header Row: Badges, Timer, Type */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-3 mb-2">
                    <div className="flex flex-wrap items-center gap-2">
                      {isClassified ? (
                        <div className="px-3 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1.5 shadow-[0_0_12px_rgba(245,158,11,0.2)]">
                          <Tag size={11} /> Timeframed Classified Ad
                        </div>
                      ) : (
                        <div className="glass-pill !text-primary !border-primary/30 flex items-center gap-1.5 text-[9px] py-1 px-3">
                          <Megaphone size={11} className="animate-pulse" /> Market Spotlight
                        </div>
                      )}

                      {currentSpotlight.category && (
                        <span className="text-[9px] font-bold text-gray-300 uppercase tracking-widest px-2.5 py-1 bg-white/5 rounded-full border border-white/10">
                          {currentSpotlight.category}
                        </span>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      {currentSpotlight.badge && (
                        <span className="px-2.5 py-1 bg-neon-green/20 text-neon-green border border-neon-green/40 rounded-full text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_#39FF14]">
                          {currentSpotlight.badge}
                        </span>
                      )}

                      {timeInfo && (
                        <span className={cn(
                          "px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider border flex items-center gap-1 backdrop-blur-md",
                          timeInfo.expired 
                            ? "bg-red-500/20 text-red-400 border-red-500/30" 
                            : "bg-primary/20 text-primary border-primary/30"
                        )}>
                          <Clock size={11} /> {timeInfo.text}
                        </span>
                      )}

                      <div className="w-7 h-7 bg-primary/10 rounded-lg flex items-center justify-center border border-primary/20 text-primary">
                        <Zap size={14} />
                      </div>
                    </div>
                  </div>

                  {/* Middle Main Content */}
                  <div className="relative z-10 space-y-1.5 my-1">
                    <div className="flex flex-wrap items-baseline justify-between gap-3">
                      <h3 className="text-base sm:text-xl font-black text-white uppercase tracking-tight leading-snug break-words line-clamp-2 max-w-2xl">
                        {currentSpotlight.title}
                      </h3>
                      {currentSpotlight.price && (
                        <span className="px-3 py-1 bg-gradient-to-r from-primary to-accent text-[#05070a] font-black text-xs sm:text-sm rounded-xl shadow-[0_0_15px_rgba(0,242,254,0.3)] whitespace-nowrap flex-shrink-0">
                          {currentSpotlight.price}
                        </span>
                      )}
                    </div>

                    {currentSpotlight.content && (
                      <p className="text-xs text-gray-300 font-normal leading-relaxed line-clamp-2">
                        {currentSpotlight.content}
                      </p>
                    )}
                  </div>

                  {/* Footer Row: Author/Location, Dots & Action Button */}
                  <div className="relative z-10 flex flex-wrap items-center justify-between gap-3 pt-3 mt-2 border-t border-white/10">
                    <div className="flex flex-wrap items-center gap-2">
                      {currentSpotlight.authorName && (
                        <div className="flex items-center gap-1.5 text-[9px] sm:text-[10px] text-primary font-bold uppercase tracking-wider bg-primary/10 px-2.5 py-1 rounded-lg border border-primary/20">
                          <Store size={11} /> {currentSpotlight.authorName}
                        </div>
                      )}
                      {currentSpotlight.location && (
                        <div className="flex items-center gap-1 text-[9px] sm:text-[10px] text-gray-400 font-semibold uppercase tracking-wider bg-white/5 px-2.5 py-1 rounded-lg border border-white/5">
                          <MapPin size={11} className="text-primary" /> {currentSpotlight.location}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-4 ml-auto">
                      {/* Carousel Indicators */}
                      {spotlights.length > 1 && (
                        <div className="flex gap-1.5 items-center">
                          {spotlights.map((_, idx) => (
                            <div 
                              key={idx} 
                              onClick={(e) => {
                                e.stopPropagation();
                                setActiveSpotlightIndex(idx);
                              }}
                              className={cn(
                                "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                                idx === activeSpotlightIndex ? "w-5 bg-primary" : "w-1.5 bg-white/30 hover:bg-white/60"
                              )}
                            />
                          ))}
                        </div>
                      )}

                      <button className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-[#05070a] rounded-xl text-[10px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.25)] hover:scale-105 transition-all whitespace-nowrap">
                        View Ad Details <ArrowRight size={12} />
                      </button>
                    </div>
                  </div>
                </motion.div>
              );
            })()
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
              <div className="relative z-10 space-y-1 text-left">
                <div className="glass-pill inline-block mb-2 !text-primary !border-primary/20">Market Spotlight</div>
                <h3 className="text-2xl font-black text-white italic leading-tight uppercase">Global Network<br/>Active Status</h3>
                <p className="text-xs text-gray-400 font-medium uppercase tracking-widest">Scanning local news feeds & classified ads...</p>
              </div>
            </motion.section>
          )}
        </AnimatePresence>
      </section>

      {/* Discovery Feed */}
      <section className="space-y-6">
        {profile && (
          <section className="space-y-6">
            <div className="flex items-center justify-between px-1">
              <div className="flex items-center gap-2">
                <h2 className="font-black text-white uppercase tracking-tighter text-lg">Active Stores</h2>
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
                {Array.from(new Map(filteredStores.map(s => [s.id, s])).values()).map((store) => (
                  <div key={store.id} className="min-w-[240px] snap-center contents">
                    <AuthGuard
                      title="Access Features"
                      message="Sign in to view this supplier's store and items."
                      profile={profile}
                      allowGuest={true}
                      onGuestContinue={onGuestLogin}
                    >
                      <StoreCard store={store} profile={profile} onSelect={setSelectedStoreId} />
                    </AuthGuard>
                  </div>
                ))}
              </div>
            ) : (
              <div className="bg-white/5 border border-white/5 rounded-3xl p-8 text-center">
                <Building2 className="mx-auto text-gray-700 mb-2" size={24} />
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No stores found nearby</p>
              </div>
            )}
          </section>
        )}

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
            {Array.from(new Map<string, Product>(filteredDeals.map(p => [p.id, p])).values()).map((product: any) => (
              <div key={product.id} id={`product-${product.id}`} className={cn("contents", sharedProductId === product.id && "ring-2 ring-primary ring-offset-4 ring-offset-[#05070a] rounded-3xl")}>
                <AuthGuard
                  title="Access Detailed Intelligence"
                  message="Sign in to view full technical specifications, verified ratings, and secure purchasing options for this store."
                  profile={profile}
                  allowGuest={true}
                  onGuestContinue={onGuestLogin}
                >
                  <ProductCard 
                    product={product} 
                    profile={profile} 
                    store={storesMap[product.storeId]}
                    isOwner={profile?.uid === product.ownerId}
                  />
                </AuthGuard>
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
              <p className="text-[10px] text-gray-600">Try adjusting your filters or expansion radius</p>
            </div>
          </div>
        )}
      </section>
    </motion.div>
  );
}

function StoreCard({ store, profile, onSelect }: { store: StoreType, profile: UserProfile | null, onSelect: (id: string) => void }) {
  const navigate = useNavigate();
  const { triggerFeedback } = useNotifications();

  const handleFollow = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) {
      navigate('/login');
      return;
    }
    try {
      await interactionService.followStore(store.id, store.ownerId, profile);
      triggerFeedback('Success', `You are now following ${store.name}`, 'follow');
    } catch (err) {
      console.error(err);
    }
  };

  const handleLike = async (e: React.MouseEvent) => {
    e.stopPropagation();
    if (!profile) {
      navigate('/login');
      return;
    }
    try {
      await interactionService.likeStore(store.id, store.ownerId, profile);
      triggerFeedback('Success', `You liked ${store.name}'s storefront`, 'like_store');
    } catch (err) {
      console.error(err);
    }
  };

  return (
    <motion.div 
      whileHover={{ y: -5 }}
      whileTap={{ scale: 0.98 }}
      onClick={() => onSelect(store.id)}
      className="neon-card p-3.5 sm:p-5 space-y-3 sm:space-y-4 cursor-pointer group relative"
    >
      {profile?.uid !== store.ownerId && (
        <div className="absolute top-2 right-2 flex gap-1 z-10 opacity-0 group-hover:opacity-100 transition-opacity">
          <AuthGuard 
            title="Follow this Storefront" 
            message="Sign in to follow this store and receive updates on their products."
            profile={profile}
          >
            <button 
              onClick={handleFollow}
              className="p-1.5 bg-[#05070a]/80 backdrop-blur-md rounded-lg border border-white/10 text-primary hover:bg-primary hover:text-[#05070a] transition-all"
            >
              <UserPlus size={10} />
            </button>
          </AuthGuard>
          <AuthGuard 
            title="Save for Later"
            message="Join the network to save this storefront to your private dashboard."
            profile={profile}
          >
            <button 
              onClick={handleLike}
              className="p-1.5 bg-[#05070a]/80 backdrop-blur-md rounded-lg border border-white/10 text-red-500 hover:bg-red-500 hover:text-white transition-all"
            >
              <Heart size={10} className={cn(store.likeCount ? "fill-current" : "")} />
            </button>
          </AuthGuard>
        </div>
      )}

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
          Visit Store <ArrowRight size={10} />
        </div>
      </div>
    </motion.div>
  );
}
