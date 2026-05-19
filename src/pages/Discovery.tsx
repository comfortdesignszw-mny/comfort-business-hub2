import React, { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { 
  Search, MapPin, Filter, Star, Zap, ShoppingBag, Store, ArrowRight, 
  SlidersHorizontal, MessageSquare, Sparkles, X, Phone, Check, Loader2, MapPinned, CreditCard,
  Megaphone, Calendar, FileText, Building2, ExternalLink, Share2, Info, Users, Shield, Map as MapIcon, List, UserPlus, Heart
} from 'lucide-react';
import { UserProfile, Product, Store as StoreType, Message, Spotlight, PublicProfile } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
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
  const [userCount, setUserCount] = useState<number | null>(null);
  const [displayedUsers, setDisplayedUsers] = useState<PublicProfile[]>([]);
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [activeSpotlightIndex, setActiveSpotlightIndex] = useState(0);
  const [viewMode, setViewMode] = useState<'list' | 'map'>('list');
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
    const timer = setTimeout(fetchUserCount, 1000);
    return () => { isMounted = false; clearTimeout(timer); };
  }, []);

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

      {/* User Count Notification */}
      {profile && !profile.isGuest && userCount !== null && (
        <motion.div 
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          whileHover={{ scale: 1.02 }}
          whileTap={{ scale: 0.98 }}
          className="flex items-center justify-center gap-2 py-1 cursor-pointer group"
        >
          <AuthGuard 
            title="Access Hub Matrix" 
            message="Secure authentication is required to view the full neural network of supply chain partners."
            profile={profile}
          >
            <div onClick={openUserList} className="flex items-center gap-2">
              <div className="flex -space-x-1.5">
                {displayedUsers.slice(0, 3).map((u, i) => (
                  <div 
                    key={u.uid} 
                    className="w-5 h-5 rounded-full border border-[#05070a] bg-[#0d1117] flex items-center justify-center overflow-hidden ring-1 ring-white/10"
                  >
                    {u.avatar ? (
                      <img src={u.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <span className="text-[6px] font-black text-primary">{u.name.charAt(0)}</span>
                    )}
                  </div>
                ))}
                {userCount && userCount > 3 && (
                  <div className="w-5 h-5 rounded-full border border-[#05070a] bg-primary/20 flex items-center justify-center text-[6px] font-black text-primary ring-1 ring-primary/20">
                    +{userCount - 3}
                  </div>
                )}
              </div>
              <p className="text-[9px] font-black text-primary uppercase tracking-[0.15em] group-hover:text-white transition-colors">
                <span className="text-white group-hover:text-primary transition-colors">{userCount}</span> members synchronized with the Hub
              </p>
            </div>
          </AuthGuard>
        </motion.div>
      )}

      {/* Search Bar Section */}
      <section className="space-y-6 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-3">
            <div className="w-1.5 h-6 bg-primary rounded-full shadow-[0_0_15px_rgba(0,242,254,0.5)]" />
            <div className="space-y-0.5">
              <h2 className="text-xl sm:text-2xl font-black text-white italic tracking-tighter uppercase leading-none">
                {profile ? 'Synchronized' : 'Guest'}<br/>
                <span className="text-primary drop-shadow-[0_0_8px_rgba(0,242,254,0.3)]">Discovery Matrix</span>
              </h2>
            </div>
          </div>
        </div>

        <div className="relative group px-1">
          <div className="absolute inset-y-0 left-5 flex items-center pointer-events-none text-primary/40 group-focus-within:text-primary transition-colors">
            <Search size={18} />
          </div>
          <div className="relative flex items-center bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden shadow-2xl">
            <input 
              type="text"
              placeholder="Search authenticated nodes, inventory or supply patterns..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full py-4 pl-12 pr-12 text-xs font-medium text-white placeholder:text-gray-600 outline-none transition-all bg-transparent"
            />
            {profile && (
              <button 
                onClick={() => setViewMode(viewMode === 'list' ? 'map' : 'list')}
                className="absolute right-2 w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 hover:text-white transition-colors border border-white/5"
              >
                <SlidersHorizontal size={16} />
              </button>
            )}
          </div>
        </div>

        {profile && !profile.isGuest && (
          <div className="flex gap-2 overflow-x-auto pb-2 -mx-2 px-2 no-scrollbar scroll-smooth">
            {categories.map((cat) => (
              <button
                key={cat}
                onClick={() => setActiveCategory(cat)}
                className={cn(
                  "whitespace-nowrap px-5 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border",
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
                <p className="text-[9px] sm:text-[10px] text-gray-500 font-bold uppercase tracking-wider leading-none">Active Hub Node</p>
                <p className="text-xs sm:text-sm font-bold text-white group-hover:text-primary transition-colors truncate">
                  {userLocation ? `Detected: ${userLocation[0].toFixed(4)}, ${userLocation[1].toFixed(4)}` : (profile?.location?.city ? profile.location.city.toUpperCase() : (profile?.geohash ? `Node: ${profile.geohash}` : 'Harare CBD, ZW'))}
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
                  <p className="text-[10px] text-white font-bold truncate">Showing {nearbyStores.filter(s => s.lat && s.lng).length} active supply nodes on map</p>
                </div>
              </div>
            </div>
          </motion.section>
        )}
      </AnimatePresence>

      {/* Neural Member Matrix Section */}
      {profile && !profile.isGuest && (
        <section className="space-y-6 pt-2">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2 sm:gap-3">
            <div className="w-1 h-5 sm:w-1.5 sm:h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(0,242,254,0.5)]" />
            <div className="space-y-0.5">
              <h2 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-[0.15em] sm:tracking-[0.2em] italic">Neural Member Network</h2>
              <p className="text-[7px] sm:text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                <span className="text-primary font-black">{userCount || '0'}</span> nodes synced
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setNearbyOnly(!nearbyOnly)}
              className={cn(
                "text-[8px] sm:text-[9px] font-black uppercase tracking-widest flex items-center gap-1.5 sm:gap-2 py-1.5 px-3 rounded-full border transition-all",
                nearbyOnly ? "bg-primary text-[#05070a] border-primary" : "bg-primary/5 text-primary border-primary/10 hover:bg-primary/10"
              )}
            >
              <MapIcon size={10} /> {nearbyOnly ? 'Nearby Mode: Active' : 'Filter by Proximity'}
            </button>
            <AuthGuard 
              title="Matrix View Restricted" 
              message="Join the Network Hub to browse the full matrix of authenticated suppliers and partners."
              profile={profile}
            >
              <button 
                onClick={openUserList}
                className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1.5 sm:gap-2 bg-primary/5 py-1.5 px-3 rounded-full border border-primary/10"
              >
                Matrix <ExternalLink size={8} />
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
            title="Full Matrix Access" 
            message="Sign in to explore the complete directory of synchronized business nodes."
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
                <p className="text-[9px] font-black text-primary uppercase tracking-widest">Full Matrix</p>
                <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Connect with {userCount || 'All'} Nodes</p>
              </div>
            </motion.div>
          </AuthGuard>
        </div>
      </section>
      )}

      {/* Featured Promo / Spotlight */}
      <section className="relative overflow-hidden rounded-[2.5rem]">
        <AnimatePresence mode="wait">
          {spotlights.length > 0 ? (
            <motion.div 
              key={spotlights[activeSpotlightIndex].id}
              initial={{ opacity: 0, x: 20 }}
              animate={{ opacity: 1, x: 0 }}
              exit={{ opacity: 0, x: -20 }}
              className="neon-card relative h-48 sm:h-56 flex flex-col justify-end p-5 sm:p-8 group cursor-pointer overflow-hidden"
            >
              <div className="absolute inset-0 z-0">
                <OptimizedImage 
                  src={spotlights[activeSpotlightIndex].image || "https://images.unsplash.com/photo-1540350394557-8d14678e7f91?w=800&q=80"} 
                  className="w-full h-full object-cover opacity-40 group-hover:scale-110 transition-transform duration-1000" 
                  alt="Spotlight" 
                />
                <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/60 to-transparent"></div>
              </div>
              
              <div className="relative z-10 space-y-1.5 sm:space-y-2">
                <div className="flex items-center gap-2 mb-1 sm:mb-2">
                  <div className="glass-pill !text-primary !border-primary/20 flex items-center gap-1 sm:gap-1.5 shadow-[0_0_15px_rgba(0,242,254,0.15)] text-[8px] sm:text-[9px] py-0.5 sm:py-1">
                    <Megaphone size={8} className="animate-pulse sm:w-[10px] sm:h-[10px]" />
                    Market Spotlight
                  </div>
                  <div className="glass-pill !text-neon-green/80 !border-white/5 uppercase tracking-[0.2em] text-[7px] sm:text-[8px] py-0.5 sm:py-1">
                    {spotlights[activeSpotlightIndex].type}
                  </div>
                </div>
                
                <h3 className="text-lg sm:text-2xl font-black text-white italic leading-none tracking-tighter uppercase break-words line-clamp-2">
                  {spotlights[activeSpotlightIndex].title}
                </h3>

                {spotlights[activeSpotlightIndex].content && (
                  <p className="text-[10px] sm:text-[11px] text-gray-300 font-medium leading-relaxed line-clamp-2 mt-0.5 sm:mt-1">
                    {spotlights[activeSpotlightIndex].content}
                  </p>
                )}
                
                <div className="flex flex-wrap gap-2 sm:gap-4 pt-1 sm:pt-2">
                  {spotlights[activeSpotlightIndex].authorName && (
                    <div className="flex items-center gap-1 text-[8px] sm:text-[9px] text-primary font-black tracking-widest bg-primary/10 px-1.5 sm:px-2 py-0.5 rounded border border-primary/20">
                      <Store size={8} className="sm:w-[10px] sm:h-[10px]" /> {spotlights[activeSpotlightIndex].authorName}
                    </div>
                  )}
                </div>
              </div>

              <div className="absolute top-4 right-4 sm:top-8 sm:right-8 flex flex-col items-end">
                <div className="w-8 h-8 sm:w-12 sm:h-12 bg-primary/10 rounded-xl sm:rounded-2xl flex items-center justify-center border border-primary/20 text-primary animate-pulse">
                  <Zap size={16} className="sm:w-6 sm:h-6" />
                </div>
              </div>

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
        {profile && (
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
                  <div key={store.id} className="min-w-[240px] snap-center contents">
                    <AuthGuard
                      title="Access Node Infrastructure"
                      message="Secure authentication is required to audit this supplier's complete storefront and inventory matrix."
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
                <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No active nodes detected nearby</p>
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
            {filteredDeals.map((product) => (
              <div key={product.id} id={`product-${product.id}`} className={cn("contents", sharedProductId === product.id && "ring-2 ring-primary ring-offset-4 ring-offset-[#05070a] rounded-3xl")}>
                <AuthGuard
                  title="Access Detailed Intelligence"
                  message="Sign in to view full technical specifications, verified ratings, and secure procurement options for this node."
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
      triggerFeedback('Success', `You are now following ${store.name}'s node`, 'follow');
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
            message="Sign in to follow this node and receive real-time inventory updates and market signals."
            profile={profile}
            requireRealUser={true}
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
            requireRealUser={true}
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
          Enter Node <ArrowRight size={10} />
        </div>
      </div>
    </motion.div>
  );
}
