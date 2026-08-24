import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, MapPin, Filter, Star, Zap, ShoppingBag, Store, ArrowRight, 
  SlidersHorizontal, MessageSquare, Sparkles, X, Phone, Check, Loader2, MapPinned, CreditCard,
  Megaphone, Calendar, FileText, Building2, ExternalLink, Share2, Info, Users, Shield, Map as MapIcon, List, UserPlus, Heart,
  Tag, Clock, Flame, DollarSign, Send, RotateCcw, Video
} from 'lucide-react';
import { UserProfile, Product, Store as StoreType, Message, Spotlight, PublicProfile } from '../types';
import { cn, formatCurrency, openWhatsApp } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { localDB, INITIAL_OFFLINE_STORES, INITIAL_OFFLINE_PRODUCTS } from '../lib/db';
import { cacheCollection } from '../lib/dexieSyncManager';
import { localDataRepository } from '../lib/localDataRepository';
import { collection, query, limit, getDocs, where, addDoc, serverTimestamp, setDoc, doc, getDoc, orderBy, onSnapshot, getCountFromServer, startAt, endAt, deleteDoc } from 'firebase/firestore';
import { BUSINESS_CATEGORIES, PRODUCT_CATEGORIES } from '../constants';
import ProductCard from '../components/ProductCard';
import AuthGuard from '../components/AuthGuard';
import { useModals } from '../context/ModalContext';
import { useNotifications } from '../components/NotificationProvider';
import { interactionService } from '../services/interactionService';
import { viewHistoryService } from '../services/viewHistory';
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
  const [loading, setLoading] = useState(false);
  const [productsLoading, setProductsLoading] = useState(false);
  const [storesLoading, setStoresLoading] = useState(false);
  const [spotlightsLoading, setSpotlightsLoading] = useState(false);
  const [nearbyDeals, setNearbyDeals] = useState<Product[]>(INITIAL_OFFLINE_PRODUCTS as unknown as Product[]);
  const [nearbyStores, setNearbyStores] = useState<StoreType[]>(INITIAL_OFFLINE_STORES as unknown as StoreType[]);
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

  // Auto-rotate spotlights / classified ads (60 seconds per slide)
  useEffect(() => {
    if (spotlights.length <= 1) return;
    const interval = setInterval(() => {
      setActiveSpotlightIndex(prev => (prev + 1) % spotlights.length);
    }, 60000);
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
    // Phase 1: Instant Loading from Local Repository & Seed Fallbacks
    const tryLoadFromCache = async () => {
      try {
        const cachedProductsDoc = await localDB.cache.where('collection').equals('products').toArray();
        if (cachedProductsDoc.length > 0) {
          const cachedProducts = cachedProductsDoc.map(c => c.data as Product);
          const activeOnly = cachedProducts.filter(p => p.isActive !== false);
          activeOnly.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setNearbyDeals(activeOnly);
          setProductsLoading(false);
          setLoading(false);
        } else {
          // Fallback to local seed products if cache is empty
          const repoRes = await localDataRepository.getProducts();
          if (repoRes.data && repoRes.data.length > 0) {
            setNearbyDeals(repoRes.data as any);
          }
          setProductsLoading(false);
          setLoading(false);
        }
      } catch (err) {
        console.warn('Failed to load local DB cache for products', err);
        setProductsLoading(false);
        setLoading(false);
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
      } as Product)).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      setNearbyDeals(allProducts);
      setProductsLoading(false);
      
      // Update local cache for next time
      try {
        cacheCollection('products', allProducts);
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
      setProductsLoading(false);
      setLoading(false);
    });

    // Start Stores Loading
    const loadStores = async () => {
      try {
        const cachedStoresDoc = await localDB.cache.where('collection').equals('stores').toArray();
        if (cachedStoresDoc.length > 0) {
          const cachedStores = cachedStoresDoc.map(c => c.data as StoreType);
          cachedStores.sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
          setNearbyStores(cachedStores);
          setStoresLoading(false);
        } else {
          const repoStores = await localDataRepository.getStores();
          if (repoStores.data && repoStores.data.length > 0) {
            setNearbyStores(repoStores.data as any);
          }
          setStoresLoading(false);
        }
      } catch (err) {
        setStoresLoading(false);
      }
    };
    loadStores();

    const sq = query(collection(db, 'stores'), limit(150));
    const unsubscribeStores = onSnapshot(sq, async (snapshot) => {
      const allStores = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      } as StoreType)).sort((a, b) => new Date(b.createdAt || 0).getTime() - new Date(a.createdAt || 0).getTime());
      
      setNearbyStores(allStores);
      setStoresLoading(false);

      try {
        cacheCollection('stores', allStores);
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
      const now = new Date();
      const validSpotlights: Spotlight[] = [];

      snapshot.docs.forEach(d => {
        const item = { id: d.id, ...d.data() } as Spotlight;
        if (item.expiresAt && new Date(item.expiresAt) < now) {
          // Auto-delete expired classified ad and video from database to save space and bandwidth
          deleteDoc(doc(db, 'spotlights', d.id)).catch(() => {});
        } else if (item.isApproved !== false) {
          // Only show approved ads (or legacy ads where isApproved is undefined)
          validSpotlights.push(item);
        }
      });

      setSpotlights(validSpotlights);
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

  const { triggerFeedback } = useNotifications();
  const [selectedStoreId, setSelectedStoreId] = useState<string | null>(null);
  const [recTab, setRecTab] = useState<'products' | 'stores'>('products');

  const selectedStore = useMemo(() => {
    if (!selectedStoreId) return null;
    return nearbyStores.find(s => s.id === selectedStoreId) || null;
  }, [selectedStoreId, nearbyStores]);

  useEffect(() => {
    if (selectedStore) {
      viewHistoryService.recordStoreView(selectedStore.id, selectedStore.name, selectedStore.category);
    }
  }, [selectedStore]);

  const recommendations = useMemo(() => {
    const categoryPrefs = viewHistoryService.getCategoryPreferences();
    const viewedStoreIds = viewHistoryService.getViewedStoreIds();
    const viewedProductIds = viewHistoryService.getViewedProductIds();

    const categoryWeightMap = new Map(categoryPrefs.map(c => [c.category, c.weight]));
    const topCategoryNames = Array.from(new Set(categoryPrefs.map(c => c.category).filter(Boolean)));

    const hasHistory = categoryPrefs.length > 0 || viewedStoreIds.size > 0 || viewedProductIds.size > 0;

    // Deduplicate nearbyDeals by ID
    const uniqueNearbyDeals = Array.from(new Map(nearbyDeals.filter(p => p && p.id).map(p => [p.id, p])).values());

    // Score products
    const scoredProducts = uniqueNearbyDeals.map(product => {
      let score = 0;
      let reasons: string[] = [];

      const catWeight = categoryWeightMap.get(product.category) || 0;
      if (catWeight > 0) {
        score += catWeight * 10;
        reasons.push(`Category: ${product.category}`);
      }

      if (product.storeId && viewedStoreIds.has(product.storeId)) {
        score += 15;
        reasons.push('From a store you visited');
      }

      const store = storesMap[product.storeId];
      if (store && store.category && categoryWeightMap.has(store.category)) {
        score += (categoryWeightMap.get(store.category) || 0) * 5;
        if (!reasons.some(r => r.includes(store.category))) {
          reasons.push(`Store match: ${store.category}`);
        }
      }

      if (product.rating && product.rating >= 4.5) {
        score += 3;
      }
      if (product.likeCount) {
        score += Math.min(product.likeCount, 5);
      }

      return { product, score, reasons, store };
    });

    let recProductsList: typeof scoredProducts = [];
    if (hasHistory) {
      recProductsList = scoredProducts
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
    } else {
      recProductsList = [...scoredProducts];
    }

    if (recProductsList.length < 4) {
      const existingProductIds = new Set(recProductsList.map(p => p.product.id));
      const fallbackProducts = [...scoredProducts]
        .sort((a, b) => (b.product.rating || 0) - (a.product.rating || 0))
        .filter(p => !existingProductIds.has(p.product.id))
        .slice(0, 8 - recProductsList.length);

      fallbackProducts.forEach(f => {
        recProductsList.push({
          ...f,
          reasons: f.reasons.length > 0 ? f.reasons : ['Top Rated Node']
        });
      });
    }

    // Deduplicate recProductsList by product.id
    const finalProductsMap = new Map<string, typeof scoredProducts[0]>();
    recProductsList.forEach(item => {
      if (item.product && item.product.id && !finalProductsMap.has(item.product.id)) {
        finalProductsMap.set(item.product.id, item);
      }
    });
    const finalProductsList = Array.from(finalProductsMap.values());

    // Deduplicate nearbyStores by ID
    const uniqueNearbyStores = Array.from(new Map(nearbyStores.filter(s => s && s.id).map(s => [s.id, s])).values());

    // Score stores
    const scoredStores = uniqueNearbyStores.map(store => {
      let score = 0;
      let reasons: string[] = [];

      const catWeight = categoryWeightMap.get(store.category) || 0;
      if (catWeight > 0) {
        score += catWeight * 10;
        reasons.push(`Matches ${store.category}`);
      }

      if (viewedStoreIds.has(store.id)) {
        score += 12;
        reasons.push('Recently visited');
      }

      if (store.rating && store.rating >= 4.5) {
        score += 4;
      }

      return { store, score, reasons };
    });

    let recStoresList: typeof scoredStores = [];
    if (hasHistory) {
      recStoresList = scoredStores
        .filter(item => item.score > 0)
        .sort((a, b) => b.score - a.score);
    } else {
      recStoresList = [...scoredStores];
    }

    if (recStoresList.length < 3) {
      const existingStoreIds = new Set(recStoresList.map(s => s.store.id));
      const fallbackStores = [...scoredStores]
        .sort((a, b) => (b.store.rating || 0) - (a.store.rating || 0))
        .filter(s => !existingStoreIds.has(s.store.id))
        .slice(0, 6 - recStoresList.length);

      fallbackStores.forEach(f => {
        recStoresList.push({
          ...f,
          reasons: f.reasons.length > 0 ? f.reasons : ['Verified Supplier']
        });
      });
    }

    // Deduplicate recStoresList by store.id
    const finalStoresMap = new Map<string, typeof scoredStores[0]>();
    recStoresList.forEach(item => {
      if (item.store && item.store.id && !finalStoresMap.has(item.store.id)) {
        finalStoresMap.set(item.store.id, item);
      }
    });
    const finalStoresList = Array.from(finalStoresMap.values());

    return {
      hasHistory,
      topCategories: topCategoryNames.slice(0, 4),
      products: finalProductsList.slice(0, 8),
      stores: finalStoresList.slice(0, 6)
    };
  }, [nearbyDeals, nearbyStores, storesMap, profile]);

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

                {selectedSpotlightAd.videoUrl ? (
                  <div className="w-full h-60 sm:h-72 rounded-2xl overflow-hidden border border-primary/40 relative bg-black shadow-[0_0_30px_rgba(0,242,254,0.15)] group/modalmedia">
                    <video 
                      src={selectedSpotlightAd.videoUrl} 
                      controls 
                      autoPlay 
                      loop 
                      muted 
                      playsInline 
                      className="w-full h-full object-contain bg-black"
                    />
                    <div className="absolute top-3 left-3 bg-black/80 backdrop-blur-md text-neon-green border border-neon-green/40 px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 z-10 pointer-events-none">
                      <span className="w-2 h-2 rounded-full bg-neon-green animate-ping" /> Animated Video Ad (HD)
                    </div>
                    {selectedSpotlightAd.price && (
                      <div className="absolute bottom-3 left-3 bg-gradient-to-r from-primary to-accent text-[#05070a] font-black text-sm px-4 py-1.5 rounded-xl shadow-lg z-10">
                        {selectedSpotlightAd.price}
                      </div>
                    )}
                  </div>
                ) : selectedSpotlightAd.image ? (
                  <div className="w-full h-56 sm:h-64 rounded-2xl overflow-hidden border border-white/20 relative group/modalimage shadow-lg">
                    <img src={selectedSpotlightAd.image} className="w-full h-full object-cover transition-transform duration-700 group-hover/modalimage:scale-105" alt={selectedSpotlightAd.title} />
                    {selectedSpotlightAd.price && (
                      <div className="absolute bottom-3 left-3 bg-gradient-to-r from-primary to-accent text-[#05070a] font-black text-sm px-4 py-1.5 rounded-xl shadow-lg">
                        {selectedSpotlightAd.price}
                      </div>
                    )}
                  </div>
                ) : null}

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
                    <button
                      onClick={() => openWhatsApp(selectedSpotlightAd.whatsappNumber!, `Hi, I'm interested in your ad: ${selectedSpotlightAd.title}`)}
                      className="flex-1 py-3.5 bg-neon-green text-[#05070a] rounded-xl font-black text-xs uppercase tracking-wider flex items-center justify-center gap-2 shadow-[0_0_20px_#39FF14] hover:scale-105 transition-all cursor-pointer"
                    >
                      <MessageSquare size={16} /> Contact via WhatsApp
                    </button>
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

      {/* Top 2-Column Horizontal Grid layout on Desktop */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4 lg:items-stretch pt-2">
        
        {/* 1. Search Bar and Filters Section (Synchronized Discover) */}
        <section className="bg-[#0d1117]/90 backdrop-blur-md border border-white/10 rounded-[2rem] p-4 flex flex-col justify-between space-y-3 shadow-xl">
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <div className="w-1 h-4 bg-primary rounded-full shadow-[0_0_10px_rgba(0,242,254,0.5)]" />
                <h2 className="text-xs sm:text-sm font-black text-white italic tracking-tighter uppercase leading-none">
                  {profile ? 'Synchronized' : 'Guest'}{' '}
                  <span className="text-primary drop-shadow-[0_0_8px_rgba(0,242,254,0.3)]">Discover</span>
                </h2>
              </div>
              {profile && !profile.isGuest && (
                <div className="flex items-center gap-1 bg-[#05070a] border border-white/5 p-1 rounded-xl">
                  <button 
                    onClick={() => setViewMode('list')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      viewMode === 'list' ? "bg-primary text-[#05070a]" : "text-gray-500 hover:text-white"
                    )}
                    title="List View"
                  >
                    <List size={13} />
                  </button>
                  <button 
                    onClick={() => setViewMode('map')}
                    className={cn(
                      "p-1.5 rounded-lg transition-all",
                      viewMode === 'map' ? "bg-primary text-[#05070a]" : "text-gray-500 hover:text-white"
                    )}
                    title="Map View"
                  >
                    <MapIcon size={13} />
                  </button>
                </div>
              )}
            </div>

            <div className="relative flex items-center bg-[#05070a] border border-white/10 rounded-2xl overflow-hidden shadow-inner">
              <Search size={14} className="absolute left-3 text-primary/50 pointer-events-none" />
              <input 
                type="text"
                placeholder="Search suppliers, items or patterns..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="w-full py-2 pl-9 pr-8 text-[10px] font-medium text-white placeholder:text-gray-600 outline-none bg-transparent"
              />
              {searchTerm && (
                <button onClick={() => setSearchTerm('')} className="absolute right-2.5 text-gray-500 hover:text-white">
                  <X size={12} />
                </button>
              )}
            </div>

            {profile && (
              <div className="flex gap-1.5 overflow-x-auto pb-1 no-scrollbar scroll-smooth">
                {categories.map((cat, idx) => (
                  <button
                    key={`disc-cat-${cat}-${idx}`}
                    onClick={() => setActiveCategory(cat)}
                    className={cn(
                      "whitespace-nowrap px-2.5 py-1 rounded-lg text-[8px] font-black uppercase tracking-wider transition-all border shrink-0",
                      activeCategory === cat 
                        ? "bg-primary text-[#05070a] border-primary shadow-[0_0_10px_rgba(0,242,254,0.3)]" 
                        : "bg-white/5 text-gray-400 border-white/5 hover:bg-white/10 hover:text-white"
                    )}
                  >
                    {cat}
                  </button>
                ))}
              </div>
            )}
          </div>

          {profile && !profile.isGuest && (
            <div 
              onClick={handleGetLocation}
              className="flex items-center justify-between bg-white/5 border border-white/5 p-2 rounded-xl group cursor-pointer hover:border-primary/30 transition-all text-left mt-auto"
            >
              <div className="flex items-center gap-2 min-w-0">
                <MapPin size={13} className="text-primary shrink-0 group-hover:scale-110 transition-transform" />
                <div className="min-w-0">
                  <p className="text-[8px] text-gray-500 font-bold uppercase tracking-wider leading-none">Your Location</p>
                  <p className="text-[9px] font-bold text-white group-hover:text-primary transition-colors truncate">
                    {userLocation ? `${userLocation[0].toFixed(2)}, ${userLocation[1].toFixed(2)}` : (profile?.location?.city ? profile.location.city.toUpperCase() : 'Harare CBD')}
                  </p>
                </div>
              </div>
              <button 
                onClick={(e) => {
                  e.stopPropagation();
                  setNearbyOnly(!nearbyOnly);
                }}
                className={cn(
                  "text-[8px] font-black uppercase tracking-wider px-2 py-1 rounded-lg border transition-all shrink-0 ml-2",
                  nearbyOnly ? "bg-primary text-[#05070a] border-primary" : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
                )}
              >
                {nearbyOnly ? 'Near Me' : 'All'}
              </button>
            </div>
          )}
        </section>

        {/* 2. Market Spotlight / Classified Carousel Section (Marketing Spotlight) */}
        <section className="relative overflow-hidden rounded-[2.5rem] border border-primary/30 shadow-2xl bg-[#05070a] min-h-[220px]">
          <AnimatePresence mode="wait">
            {spotlights.length > 0 ? (
              (() => {
                const currentSpotlight = spotlights[activeSpotlightIndex];
                const isClassified = currentSpotlight.isClassified || currentSpotlight.type === 'classified';
                const timeInfo = getTimeLeftText(currentSpotlight.expiresAt);
                const hasMedia = !!(currentSpotlight.videoUrl || currentSpotlight.image);

                return (
                  <motion.div 
                    key={currentSpotlight.id ? `spotlight-${currentSpotlight.id}-${activeSpotlightIndex}` : `spotlight-idx-${activeSpotlightIndex}`}
                    initial={{ opacity: 0, y: 10, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: -10, scale: 0.98 }}
                    transition={{ duration: 0.35, ease: 'easeOut' }}
                    onClick={() => setSelectedSpotlightAd(currentSpotlight)}
                    className={cn(
                      "relative h-full min-h-[230px] p-4 sm:p-6 group cursor-pointer overflow-hidden rounded-[2.5rem] border transition-all text-left shadow-2xl flex flex-col justify-between",
                      isClassified 
                        ? "border-amber-500/40 shadow-[0_0_35px_rgba(245,158,11,0.2)] bg-gradient-to-br from-[#181108] via-[#0d1017] to-[#05070a]" 
                        : "border-primary/40 shadow-[0_0_35px_rgba(0,242,254,0.18)] bg-gradient-to-br from-[#07131e] via-[#080d14] to-[#05070a]"
                    )}
                  >
                    {/* Background Subtle Ambient Glow */}
                    <div className="absolute inset-0 z-0 overflow-hidden pointer-events-none">
                      {currentSpotlight.videoUrl ? (
                        <div className="absolute -right-20 -top-20 w-80 h-80 bg-primary/20 rounded-full blur-3xl animate-pulse" />
                      ) : (
                        <div className="absolute -right-20 -top-20 w-80 h-80 bg-amber-500/15 rounded-full blur-3xl animate-pulse" />
                      )}
                    </div>

                    {/* Main Content Layout - Split Grid when Media Exists */}
                    <div className="relative z-10 flex flex-col sm:flex-row items-stretch gap-4 sm:gap-6 flex-1">
                      
                      {/* Left Column: Badges, Title, Details, Action */}
                      <div className="flex-1 flex flex-col justify-between space-y-3 min-w-0">
                        {/* Header Row: Badges, Timer */}
                        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-white/10 pb-2">
                          <div className="flex items-center gap-1.5 min-w-0">
                            {isClassified ? (
                              <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-1 shrink-0 shadow-[0_0_10px_rgba(245,158,11,0.3)]">
                                <Tag size={11} /> Classified Ad
                              </div>
                            ) : (
                              <div className="px-2.5 py-1 rounded-full text-[9px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/40 flex items-center gap-1 shrink-0 shadow-[0_0_10px_rgba(0,242,254,0.3)]">
                                <Megaphone size={11} className="animate-pulse" /> Spotlight Broadcast
                              </div>
                            )}

                            {currentSpotlight.videoUrl && (
                              <div className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-red-500/20 text-red-400 border border-red-500/30 flex items-center gap-1 animate-pulse">
                                <span className="w-1.5 h-1.5 rounded-full bg-red-500 animate-ping" /> LIVE VIDEO
                              </div>
                            )}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {timeInfo && (
                              <span className={cn(
                                "px-2.5 py-1 rounded-full text-[8px] font-black uppercase tracking-wider border flex items-center gap-1 backdrop-blur-md",
                                timeInfo.expired 
                                  ? "bg-red-500/20 text-red-400 border-red-500/30" 
                                  : "bg-white/10 text-gray-300 border-white/15"
                              )}>
                                <Clock size={10} className="text-primary" /> {timeInfo.text}
                              </span>
                            )}
                          </div>
                        </div>

                        {/* Title & Price */}
                        <div className="space-y-1.5">
                          <div className="flex items-start justify-between gap-2">
                            <h3 className="text-sm sm:text-base font-black text-white uppercase tracking-tight leading-snug group-hover:text-primary transition-colors line-clamp-2">
                              {currentSpotlight.title}
                            </h3>
                            {currentSpotlight.price && (
                              <span className="px-2.5 py-1 bg-gradient-to-r from-primary to-accent text-[#05070a] font-black text-[10px] rounded-lg shrink-0 shadow-md">
                                {currentSpotlight.price}
                              </span>
                            )}
                          </div>

                          {currentSpotlight.content && (
                            <p className="text-[11px] text-gray-300 font-normal leading-relaxed line-clamp-2">
                              {currentSpotlight.content}
                            </p>
                          )}
                        </div>

                        {/* Author & Footer Controls */}
                        <div className="flex items-center justify-between gap-2 pt-2 border-t border-white/10 mt-auto">
                          {currentSpotlight.authorName ? (
                            <span className="text-[9px] text-gray-400 font-bold uppercase tracking-widest truncate">
                              By <span className="text-primary">{currentSpotlight.authorName}</span>
                            </span>
                          ) : <div />}

                          <button className="px-3.5 py-1.5 bg-primary hover:bg-primary/90 text-[#05070a] rounded-xl text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.3)] hover:scale-105 active:scale-95 transition-all ml-auto">
                            View Ad <ArrowRight size={11} />
                          </button>
                        </div>
                      </div>

                      {/* Right Column: Featured Crystal-Clear Media Frame with Animation */}
                      {hasMedia && (
                        <div className="w-full sm:w-48 md:w-56 h-36 sm:h-auto rounded-2xl border border-white/20 overflow-hidden relative group/media shrink-0 shadow-xl bg-black/80 flex items-center justify-center">
                          {currentSpotlight.videoUrl ? (
                            <div className="relative w-full h-full">
                              <video 
                                src={currentSpotlight.videoUrl} 
                                autoPlay 
                                loop 
                                muted 
                                playsInline 
                                className="w-full h-full object-cover transition-transform duration-700 group-hover/media:scale-105"
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/60 via-transparent to-transparent pointer-events-none" />
                              <div className="absolute bottom-2 left-2 right-2 flex items-center justify-between pointer-events-none">
                                <span className="px-2 py-0.5 bg-black/70 backdrop-blur-md text-neon-green border border-neon-green/40 rounded-md text-[8px] font-black uppercase tracking-widest flex items-center gap-1">
                                  <Video size={10} className="animate-pulse" /> Animated Ad
                                </span>
                              </div>
                            </div>
                          ) : (
                            <div className="relative w-full h-full overflow-hidden">
                              <OptimizedImage 
                                src={currentSpotlight.image || "https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80"} 
                                className="w-full h-full object-cover transition-transform duration-700 ease-out group-hover/media:scale-110" 
                                alt={currentSpotlight.title} 
                              />
                              <div className="absolute inset-0 bg-gradient-to-t from-black/50 via-transparent to-transparent pointer-events-none" />
                            </div>
                          )}

                          {/* Subtle glowing frame border animation */}
                          <div className="absolute inset-0 border border-primary/30 rounded-2xl pointer-events-none group-hover/media:border-primary/70 transition-colors" />
                        </div>
                      )}

                    </div>

                    {/* Pagination Dots at Bottom */}
                    {spotlights.length > 1 && (
                      <div className="relative z-10 flex justify-center gap-1.5 items-center pt-3 border-t border-white/10 mt-3">
                        {spotlights.map((s, idx) => (
                          <div 
                            key={`spotlight-dot-${s.id ? `${s.id}-${idx}` : idx}`} 
                            onClick={(e) => {
                              e.stopPropagation();
                              setActiveSpotlightIndex(idx);
                            }}
                            className={cn(
                              "h-1.5 rounded-full transition-all duration-300 cursor-pointer",
                              idx === activeSpotlightIndex ? "w-6 bg-primary shadow-[0_0_8px_#00f2fe]" : "w-1.5 bg-white/30 hover:bg-white/60"
                            )}
                          />
                        ))}
                      </div>
                    )}
                  </motion.div>
                );
              })()
            ) : (
              <div className="relative h-full min-h-[220px] flex flex-col justify-end p-5 group cursor-pointer">
                <div className="relative z-10 space-y-1 text-left">
                  <div className="glass-pill inline-block mb-1 !text-primary !border-primary/20 text-[8px]">Market Spotlight</div>
                  <h3 className="text-base font-black text-white italic leading-tight uppercase">Global Network Active</h3>
                  <p className="text-[9px] text-gray-400 font-medium uppercase tracking-widest">Scanning local news feeds & classified ads...</p>
                </div>
              </div>
            )}
          </AnimatePresence>
        </section>

      </div>

      {/* Recommended for You Section - Temporarily removed when user is actively searching */}
      {!searchTerm.trim() && (
        <section className="bg-gradient-to-r from-[#0d1117] via-[#080b10] to-[#0d1117] border border-primary/25 rounded-[2rem] p-4 sm:p-6 shadow-2xl space-y-4 relative overflow-hidden">
          {/* Glow backdrop */}
          <div className="absolute top-0 right-0 w-64 h-64 bg-primary/5 rounded-full blur-3xl pointer-events-none" />

          {/* Section Header */}
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 relative z-10">
            <div className="space-y-1 text-left">
              <div className="flex items-center gap-2">
                <div className="p-1.5 rounded-xl bg-primary/20 text-primary border border-primary/30 shrink-0">
                  <Sparkles size={16} className="animate-pulse" />
                </div>
                <h2 className="font-black text-white uppercase tracking-tighter text-base sm:text-lg italic">
                  Recommended For You
                </h2>
                <span className="px-2 py-0.5 rounded-full bg-primary/10 text-primary text-[8px] font-black border border-primary/20 uppercase tracking-widest shrink-0">
                  {recommendations.hasHistory ? 'Personalized' : 'Trending Node'}
                </span>
              </div>
              <p className="text-[10px] text-gray-400 font-medium leading-relaxed max-w-xl">
                {recommendations.hasHistory ? (
                  <span>
                    Curated based on your viewed stores and favorite categories:{' '}
                    {recommendations.topCategories.map((cat, i) => (
                      <span key={`rec-top-cat-${cat}-${i}`} className="text-primary font-bold">
                        {cat}{i < recommendations.topCategories.length - 1 ? ', ' : ''}
                      </span>
                    ))}
                  </span>
                ) : (
                  <span>Recommendations update automatically as you explore suppliers and product categories across the network.</span>
                )}
              </p>
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <div className="flex bg-[#05070a] p-1 rounded-xl border border-white/10">
                <button
                  onClick={() => setRecTab('products')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                    recTab === 'products'
                      ? "bg-primary text-[#05070a] shadow-[0_0_10px_rgba(0,242,254,0.3)]"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  <ShoppingBag size={11} /> Items ({recommendations.products.length})
                </button>
                <button
                  onClick={() => setRecTab('stores')}
                  className={cn(
                    "px-3 py-1.5 rounded-lg text-[9px] font-black uppercase tracking-wider transition-all flex items-center gap-1.5",
                    recTab === 'stores'
                      ? "bg-primary text-[#05070a] shadow-[0_0_10px_rgba(0,242,254,0.3)]"
                      : "text-gray-400 hover:text-white"
                  )}
                >
                  <Store size={11} /> Suppliers ({recommendations.stores.length})
                </button>
              </div>

              {recommendations.hasHistory && (
                <button
                  onClick={() => {
                    viewHistoryService.clearHistory();
                    triggerFeedback('History Reset', 'Your browsing history and category signals have been reset.', 'reminder');
                    setSearchTerm(prev => prev);
                  }}
                  title="Reset Recommendation Signals"
                  className="p-2 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-gray-400 hover:text-white text-[9px] transition-all"
                >
                  <RotateCcw size={12} />
                </button>
              )}
            </div>
          </div>

          {/* Category Signals Badges */}
          {recommendations.hasHistory && recommendations.topCategories.length > 0 && (
            <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pt-1">
              <span className="text-[8px] font-bold uppercase tracking-wider text-gray-500 shrink-0">Active Preference Signals:</span>
              {recommendations.topCategories.map((cat, idx) => (
                <button
                  key={`rec-signal-badge-${cat}-${idx}`}
                  onClick={() => setActiveCategory(cat)}
                  className="px-2.5 py-0.5 rounded-full bg-white/5 hover:bg-primary/20 border border-white/10 hover:border-primary/40 text-[8px] font-black text-gray-300 hover:text-primary transition-all flex items-center gap-1 shrink-0"
                >
                  <Tag size={9} className="text-primary" /> {cat}
                </button>
              ))}
            </div>
          )}

          {/* Recommended Horizontal Scroll Container */}
          {recTab === 'products' ? (
            <div className="space-y-3">
              {/* Single Horizontal Line Container: 4 cards visible on desktop, 1 card on phone */}
              <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory items-stretch overflow-y-hidden focus:outline-none">
                {recommendations.products.map(({ product, reasons }, idx) => (
                  <div 
                    key={`rec-prod-${product.id || idx}-${idx}`} 
                    className="w-[82vw] sm:w-[260px] lg:w-[calc((100%-2.25rem)/4)] shrink-0 snap-start flex flex-col"
                  >
                    <ProductCard
                      product={product}
                      profile={profile}
                      store={storesMap[product.storeId]}
                      recommendationReason={reasons[0]}
                      compact={true}
                    />
                  </div>
                ))}

                {/* Additional indicator card at the end of scroll row */}
                {recommendations.products.length > 4 && (
                  <div className="w-[180px] sm:w-[220px] shrink-0 snap-start flex flex-col justify-center items-center p-4 rounded-2xl border border-dashed border-primary/40 bg-primary/5 text-center space-y-2">
                    <Sparkles className="text-primary animate-pulse" size={24} />
                    <p className="text-[10px] font-black uppercase tracking-wider text-white leading-snug">
                      {Math.max(0, recommendations.products.length - 4)} more recommended for you...
                    </p>
                    <p className="text-[8px] text-gray-400 font-medium">Swipe left to reveal more curated items</p>
                  </div>
                )}
              </div>

              {/* Status bar showing hidden recommended count & swipe indicator */}
              <div className="flex flex-wrap items-center justify-between text-[9px] font-black uppercase tracking-wider text-gray-400 px-1 pt-2 border-t border-white/5 gap-2">
                <div className="flex items-center gap-1.5 text-primary">
                  <Sparkles size={11} className="animate-pulse" />
                  <span className="hidden lg:inline">
                    {recommendations.products.length > 4 
                      ? `${recommendations.products.length - 4} more recommended for you... (swipe left)` 
                      : '4 recommended items in view'}
                  </span>
                  <span className="lg:hidden">
                    {recommendations.products.length > 1 
                      ? `${recommendations.products.length - 1} more recommended for you... (swipe left)` 
                      : '1 recommended item in view'}
                  </span>
                </div>
                <div className="text-gray-500 font-medium text-[8px] tracking-widest flex items-center gap-1 ml-auto">
                  <span>← scroll horizontally →</span>
                </div>
              </div>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="flex gap-3 overflow-x-auto pb-3 pt-1 scroll-smooth snap-x snap-mandatory items-stretch overflow-y-hidden">
                {recommendations.stores.map(({ store, reasons }, idx) => (
                  <div key={`rec-store-${store.id || idx}-${idx}`} className="w-[82vw] sm:w-[260px] lg:w-[calc((100%-2.25rem)/4)] shrink-0 snap-start flex flex-col">
                    {reasons.length > 0 && (
                      <div className="mb-1">
                        <span className="px-2 py-0.5 rounded-full bg-accent/90 text-white text-[7.5px] font-black uppercase tracking-wider shadow-lg inline-flex items-center gap-1 backdrop-blur-md">
                          <Building2 size={8} /> {reasons[0]}
                        </span>
                      </div>
                    )}
                    <StoreCard
                      store={store}
                      profile={profile}
                      onSelect={(id) => {
                        viewHistoryService.recordStoreView(store.id, store.name, store.category);
                        setSelectedStoreId(id);
                      }}
                    />
                  </div>
                ))}
              </div>
              <div className="flex items-center justify-between text-[9px] font-black uppercase tracking-wider text-gray-400 px-1 pt-2 border-t border-white/5">
                <span className="text-primary flex items-center gap-1">
                  <Store size={11} /> Swipe horizontally to explore all {recommendations.stores.length} recommended suppliers
                </span>
              </div>
            </div>
          )}
        </section>
      )}

      {/* Discovery Feed */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1 pt-2">
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
            {Array.from(new Map<string, Product>(filteredDeals.filter(p => p && p.id).map(p => [p.id, p])).values()).map((product: any, idx: number) => (
              <div key={`disc-deal-${product.id || idx}-${idx}`} id={`product-${product.id}`} className={cn("contents", sharedProductId === product.id && "ring-2 ring-primary ring-offset-4 ring-offset-[#05070a] rounded-3xl")}>
                <ProductCard 
                  product={product} 
                  profile={profile} 
                  store={storesMap[product.storeId]}
                  isOwner={profile?.uid === product.ownerId}
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
