import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store as StoreIcon, MapPin, Star, MessageSquare, ArrowLeft, Share2, 
  Info, Loader2, Building2, Zap, ShoppingBag, Heart, UserPlus, Navigation, Camera, Check, X, Edit3, Plus, Users, ShieldAlert
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, limit, updateDoc } from 'firebase/firestore';
import { UserProfile, Product, Store as StoreType, Connection } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { executeShare, getStoreSharePayload, updateMetaTags } from '../lib/shareUtils';
import ProductCard from '../components/ProductCard';
import AuthGuard from '../components/AuthGuard';
import ImageInput from '../components/ImageInput';
import ReportModal from '../components/ReportModal';
import FiveStarRating from '../components/FiveStarRating';
import { useModals } from '../context/ModalContext';
import { localDB } from '../lib/db';
import { cacheCollection } from '../lib/dexieSyncManager';
import { interactionService } from '../services/interactionService';
import { viewHistoryService } from '../services/viewHistory';
import { useNotifications } from '../components/NotificationProvider';

import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

export function StoreDetailContent({ store, profile, onGuestLogin, showMap = true, allowEdit = true }: { store: StoreType, profile: UserProfile | null, onGuestLogin?: () => void, showMap?: boolean, allowEdit?: boolean }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const { triggerFeedback } = useNotifications();
  
  // Store Edit State
  const [isEditingCover, setIsEditingCover] = useState(false);
  const [isEditingInfo, setIsEditingInfo] = useState(false);
  const [editData, setEditData] = useState<Partial<StoreType>>({});
  const [isSaving, setIsSaving] = useState(false);
  const [localCover, setLocalCover] = useState<string | null>(null);
  const [showReportModal, setShowReportModal] = useState(false);

  const [connection, setConnection] = useState<Connection | null>(null);
  const { openUserProfile } = useModals();

  // Store Ratings & Reviews State
  const [storeReviews, setStoreReviews] = useState<any[]>([]);
  const [showRatingForm, setShowRatingForm] = useState(false);
  const [showStoreRatingModal, setShowStoreRatingModal] = useState(false);
  const [newRating, setNewRating] = useState(5);
  const [newComment, setNewComment] = useState('');
  const [isSubmittingRating, setIsSubmittingRating] = useState(false);

  const navigate = useNavigate();
  const isOwner = allowEdit && profile?.currentRole === 'supplier' && profile?.uid === store.ownerId;

  useEffect(() => {
    if (!store.id) return;
    const srq = query(
      collection(db, 'storeReviews'),
      where('storeId', '==', store.id),
      limit(25)
    );
    const unsubStoreReviews = onSnapshot(srq, (snap) => {
      setStoreReviews(snap.docs.map(d => ({ id: d.id, ...d.data() })));
    }, (err) => console.error('Error fetching store reviews:', err));

    return () => unsubStoreReviews();
  }, [store.id]);

  const handleSubmitStoreRating = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile || !store.id) return;
    setIsSubmittingRating(true);
    try {
      await interactionService.submitStoreReview(
        store.id,
        store.ownerId,
        profile,
        newRating,
        newComment
      );
      triggerFeedback('Rating Submitted', `You rated ${store.name} with ${newRating} stars!`, 'rate');
      setNewComment('');
      setShowRatingForm(false);
      setShowStoreRatingModal(false);
    } catch (err) {
      console.error(err);
    } finally {
      setIsSubmittingRating(false);
    }
  };

  useEffect(() => {
    if (!profile || !store.ownerId || profile.uid === store.ownerId) return;

    // Check for connection in both directions
    const q1 = query(collection(db, 'connections'), where('senderId', '==', profile.uid), where('receiverId', '==', store.ownerId));
    const q2 = query(collection(db, 'connections'), where('senderId', '==', store.ownerId), where('receiverId', '==', profile.uid));

    const unsub1 = onSnapshot(q1, (snap) => {
      if (!snap.empty) setConnection({ id: snap.docs[0].id, ...snap.docs[0].data() } as Connection);
    }, (err) => console.warn('StoreDetail connection q1 notice:', err));
    const unsub2 = onSnapshot(q2, (snap) => {
      if (!snap.empty) setConnection({ id: snap.docs[0].id, ...snap.docs[0].data() } as Connection);
    }, (err) => console.warn('StoreDetail connection q2 notice:', err));

    return () => {
      unsub1();
      unsub2();
    };
  }, [profile?.uid, store.ownerId]);

  const handleConnect = async () => {
    if (!profile) {
      navigate('/login');
      return;
    }
    if (connection) return;
    await interactionService.sendConnectionRequest(profile, { 
      uid: store.ownerId, 
      name: store.name, 
      avatar: store.logo 
    });
    triggerFeedback('Connection Request Sent', `Connection request sent to ${store.name}`, 'connect_request');
  };

  const handleFollow = async () => {
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

  const handleLike = async () => {
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

  // Sync local cover with store prop
  useEffect(() => {
    if (!isEditingCover) {
      setLocalCover(store.coverPhoto || null);
    }
  }, [store.coverPhoto, isEditingCover]);

  const handleUpdateStore = async (updates: Partial<StoreType>) => {
    if (!store.id) return;
    setIsSaving(true);
    try {
      await updateDoc(doc(db, 'stores', store.id), {
        ...updates,
        updatedAt: new Date().toISOString()
      });
      if (updates.coverPhoto !== undefined) {
        setLocalCover(updates.coverPhoto || null);
      }
      setIsEditingCover(false);
      setIsEditingInfo(false);
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `stores/${store.id}`);
    } finally {
      setIsSaving(false);
    }
  };

  useEffect(() => {
    if (!store.id) return;
    setLoading(true);

    // 1. Unify instant local DB cache lookup to allow super fast sub-10ms UI display
    localDB.cache
      .where('collection')
      .equals('products')
      .toArray()
      .then((cachedDocs) => {
        const storeCachedProducts = cachedDocs
          .map((item) => item.data as Product)
          .filter((p) => p.storeId === store.id && p.isActive);
        
        if (storeCachedProducts.length > 0) {
          storeCachedProducts.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());
          setProducts(storeCachedProducts);
          setLoading(false); // Instant render!
        }
      })
      .catch((e) => console.error('[Store cache load error]:', e));

    const pq = query(
      collection(db, 'products'),
      where('storeId', '==', store.id),
      where('isActive', '==', true),
      limit(50)
    );
    
    const productsUnsub = onSnapshot(pq, async (snap) => {
      const dbProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      // 2. Put incoming products into Cache so subsequent loads are immediate
      cacheCollection('products', dbProducts);

      setProducts(dbProducts);
      setLoading(false);
    }, (err) => {
      console.warn('StoreDetail products listener notice:', err);
      setLoading(false);
    });

    return () => productsUnsub();
  }, [store.id]);

  useEffect(() => {
    if (store) {
      updateMetaTags({
        title: `${store.name} - Comfort Business Hub`,
        description: store.description || `Visit ${store.name}'s official store on Comfort Business Hub`,
        image: store.logo || store.coverPhoto,
        url: `${window.location.origin}/store/${store.id}?store=${encodeURIComponent(store.name)}`
      });
    }
  }, [store]);

  const handleShare = async () => {
    if (!store) return;
    const payload = getStoreSharePayload({
      id: store.id,
      name: store.name,
      description: store.description,
      logo: store.logo,
      coverPhoto: store.coverPhoto,
      category: store.category,
      verified: store.isVerified
    });
    await executeShare(payload);
  };

  return (
    <div className="space-y-8 pb-12">
       <header className="relative py-4 sm:py-12 rounded-[2.5rem] overflow-hidden neon-card border-none bg-[#0d1117] shadow-2xl">
         <div className="absolute inset-0 z-0 h-full w-full">
          <img 
            src={(isEditingCover && editData.coverPhoto) ? editData.coverPhoto : (localCover || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80")} 
            className="w-full h-full object-cover opacity-60 brightness-90 saturate-[1.2] scale-105 transition-all duration-700" 
            alt="Banner" 
            referrerPolicy="no-referrer" 
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/20 to-transparent"></div>
        </div>

        {isOwner && (
          <div className="absolute top-6 right-6 z-20 flex gap-2">
            {isEditingCover ? (
              <div className="flex gap-2">
                <button 
                  onClick={() => handleUpdateStore({ coverPhoto: editData.coverPhoto })}
                  disabled={isSaving}
                  className="w-10 h-10 bg-neon-green/20 backdrop-blur-md rounded-xl flex items-center justify-center text-neon-green border border-neon-green/30 hover:bg-neon-green hover:text-black transition-all"
                >
                  {isSaving ? <Loader2 size={18} className="animate-spin" /> : <Check size={18} />}
                </button>
                <button 
                  onClick={() => setIsEditingCover(false)}
                  className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-all"
                >
                  <X size={18} />
                </button>
              </div>
            ) : (
              <>
                <button 
                  onClick={() => {
                    if (isEditingInfo) {
                       handleUpdateStore({ name: editData.name, address: editData.address });
                    } else {
                       setIsEditingInfo(true);
                       setEditData({ name: store.name, address: store.address });
                    }
                  }}
                  className={cn(
                    "flex items-center gap-2 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest border transition-all",
                    isEditingInfo 
                      ? "bg-neon-green text-black border-neon-green shadow-[0_0_15px_rgba(57,255,20,0.3)]" 
                      : "bg-black/40 text-white border-white/10 hover:bg-white/10"
                  )}
                >
                  {isEditingInfo ? (isSaving ? <Loader2 size={14} className="animate-spin" /> : <Check size={14} />) : <Edit3 size={14} />} 
                  {isEditingInfo ? 'Commit Changes' : 'Manage Profile'}
                </button>
                {isEditingInfo && (
                  <button 
                    onClick={() => setIsEditingInfo(false)}
                    className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-xl flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-all"
                  >
                    <X size={18} />
                  </button>
                )}
                {!isEditingInfo && (
                  <button 
                    onClick={() => {
                      setEditData({ coverPhoto: store.coverPhoto || '' });
                      setIsEditingCover(true);
                    }}
                    className="flex items-center gap-2 bg-black/40 backdrop-blur-md px-4 py-2 rounded-xl text-[10px] font-black uppercase tracking-widest text-white border border-white/10 hover:bg-primary hover:text-black transition-all"
                  >
                    <Camera size={14} /> Edit Cover Image
                  </button>
                )}
              </>
            )}
          </div>
        )}

        <div className="relative z-10 flex flex-col items-center text-center space-y-4 sm:space-y-6 px-4 sm:px-6">
          {isEditingCover && isOwner ? (
            <div className="w-full max-w-lg mb-8">
               <ImageInput 
                value={editData.coverPhoto || ''} 
                onChange={(val) => setEditData(prev => ({ ...prev, coverPhoto: val }))}
                label="Store Cover Photo (Recommended: Landscape)"
                aspectRatio="video"
              />
            </div>
          ) : (
            <div 
              onClick={() => openUserProfile(store.ownerId)}
              className="w-16 h-16 sm:w-24 sm:h-24 rounded-2xl sm:rounded-3xl bg-[#0d1117] border-2 border-primary/30 sm:border-4 border-[#05070a] shadow-2xl overflow-hidden flex items-center justify-center text-primary font-black text-xl sm:text-4xl cursor-pointer hover:border-primary transition-all group/logo shrink-0"
            >
              {store.logo ? (
                <img src={store.logo} className="w-full h-full object-cover group-hover/logo:scale-110 transition-transform" referrerPolicy="no-referrer" />
              ) : store.name.charAt(0)}
            </div>
          )}
          
          <div className="space-y-1.5 sm:space-y-2 w-full max-w-lg">
            {isEditingInfo && isOwner ? (
              <div className="space-y-3 pt-4">
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] block mb-1">Entity Name</label>
                   <input 
                    type="text"
                    placeholder="Store Name"
                    value={editData.name ?? store.name}
                    onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-center font-black italic uppercase tracking-tighter outline-none focus:border-primary/40"
                  />
                </div>
                <div className="space-y-1">
                   <label className="text-[8px] font-black text-primary uppercase tracking-[0.2em] block mb-1">Geographic Manifestation</label>
                   <input 
                    type="text"
                    placeholder="Physical Hub Address"
                    value={editData.address ?? store.address}
                    onChange={e => setEditData(prev => ({ ...prev, address: e.target.value }))}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white text-[10px] text-center font-bold outline-none focus:border-primary/40"
                  />
                </div>
              </div>
            ) : (
              <div 
                className="cursor-pointer group/title"
                onClick={() => openUserProfile(store.ownerId)}
              >
                <h2 className="text-xl sm:text-3xl font-black text-white italic uppercase tracking-tighter leading-tight group-hover/title:text-primary transition-colors">{store.name}</h2>
                <div className="flex items-center justify-center gap-2 mt-1 flex-wrap">
                  <p className="text-[8px] sm:text-[9px] text-primary font-black uppercase tracking-[0.2em] bg-primary/10 px-2 py-0.5 rounded border border-primary/20 transition-all">{store.category} Sector Hub</p>
                  {(store.isVerified || (store as any).verified) && (
                    <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-emerald-500/20 border border-emerald-400/50 text-emerald-400 text-[8px] sm:text-[9px] font-black uppercase tracking-wider shadow-[0_0_12px_rgba(16,185,129,0.5)]">
                      <Check size={10} className="stroke-[3] text-emerald-400" />
                      Verified Store
                    </span>
                  )}
                </div>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center items-center gap-2 pt-2">
            <button 
              type="button"
              onClick={() => {
                if (isOwner) {
                  triggerFeedback('Owner Notice', 'You are the owner of this store.', 'rate');
                  return;
                }
                setShowStoreRatingModal(true);
                setShowRatingForm(true);
              }}
              className="glass-pill !border-amber-400/50 bg-amber-400/10 hover:bg-amber-400/20 hover:border-amber-400 flex items-center gap-2 py-1 px-3 cursor-pointer transition-all shadow-[0_0_12px_rgba(251,191,36,0.2)]"
              title="Click to view & submit store rating"
            >
              <FiveStarRating value={store.rating || 5.0} size="sm" readOnly count={store.reviewCount || storeReviews.length || 0} countLabel="rating" />
            </button>

            {!isOwner && (
              <AuthGuard
                title="Rate Storefront"
                message="Sign in to rate and review this store."
                profile={profile}
              >
                <button 
                  type="button"
                  onClick={() => {
                    setShowStoreRatingModal(true);
                    setShowRatingForm(true);
                  }}
                  className="glass-pill border-amber-400/50 text-amber-300 bg-amber-400/15 hover:bg-amber-400/25 hover:shadow-[0_0_15px_rgba(251,191,36,0.4)] hover:scale-105 active:scale-95 flex items-center gap-1.5 text-[10px] sm:text-xs font-black transition-all cursor-pointer"
                  title="Submit rating & review for this store"
                >
                  <Star size={12} className="fill-amber-400 text-amber-400" />
                  Rate Store
                </button>
              </AuthGuard>
            )}

            {profile?.uid !== store.ownerId && (
              <AuthGuard
                title="Connect"
                message="Secure identity is required to establish a direct business partnership and private channel access."
                profile={profile}
              >
                <button 
                  onClick={handleConnect}
                  disabled={!!connection}
                  className={cn(
                    "glass-pill flex items-center gap-1.5 text-[10px] sm:text-xs font-black transition-all",
                    connection?.status === 'accepted' 
                      ? "border-neon-green/30 text-neon-green bg-neon-green/5 shadow-[0_0_15px_rgba(57,255,20,0.2)]" 
                      : connection?.status === 'pending'
                      ? "border-gray-500/30 text-gray-400 bg-white/5 opacity-50"
                      : "border-primary/30 text-primary bg-primary/10 hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(0,242,254,0.3)] animate-pulse"
                  )}
                >
                  <Users size={12} className="text-primary" /> 
                  {connection?.status === 'accepted' ? 'Trusted Partner' : connection?.status === 'pending' ? 'Request Sent' : 'Connect'}
                </button>
              </AuthGuard>
            )}

            {profile?.uid !== store.ownerId && (
              <AuthGuard
                title="Follow Storefront"
                message="Sign in to follow this store and receive updates."
                profile={profile}
              >
                <button 
                  onClick={handleFollow}
                  className="glass-pill border-cyan-400/40 text-cyan-300 bg-cyan-400/10 hover:bg-cyan-400/20 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-1.5 text-[10px] sm:text-xs font-black transition-all"
                >
                  <UserPlus size={12} className="text-cyan-400" /> + Follow ({store.followerCount || 0})
                </button>
              </AuthGuard>
            )}

            {profile?.uid !== store.ownerId && (
              <AuthGuard
                title="Log Store Interest"
                message="Sign in to save this storefront to your private business registry."
                profile={profile}
              >
                <button 
                  onClick={handleLike}
                  className="glass-pill border-red-400/30 text-red-400 bg-red-400/10 hover:bg-red-400/20 hover:shadow-[0_0_15px_rgba(248,113,113,0.4)] flex items-center gap-1.5 text-[10px] sm:text-xs font-black transition-all"
                >
                  <Heart size={12} className="fill-red-400 text-red-400" /> {store.likeCount || 0} Likes
                </button>
              </AuthGuard>
            )}

            <button 
              onClick={handleShare}
              className="glass-pill hover:bg-white/10 flex items-center gap-1.5 text-[10px] sm:text-xs font-black no-auth-guard"
            >
              <Share2 size={12} className="text-white" /> Share Store
            </button>

            {!isOwner && profile && (
              <button 
                onClick={() => setShowReportModal(true)}
                className="glass-pill border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 flex items-center gap-1.5 text-[10px] sm:text-xs transition-all"
              >
                <ShieldAlert size={12} /> Report
              </button>
            )}
          </div>

          <div className="w-full max-w-lg pt-4 border-t border-white/10 mt-2 sm:mt-4">
             {store.address && (
              <div className="flex items-center justify-center gap-1.5 mb-3">
                <MapPin size={10} className="text-primary" />
                <p className="text-[9px] sm:text-[11px] text-gray-300 font-bold uppercase tracking-widest">{store.address}</p>
              </div>
            )}
            <p className="text-[10px] sm:text-xs text-gray-400 leading-relaxed font-medium">
              {store.description}
            </p>
          </div>
        </div>
      </header>

      {!profile && (
        <section className="p-6 neon-card bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 text-center space-y-4">
          <Zap className="mx-auto text-primary animate-pulse" size={28} />
          <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Create an Account</h3>
          <p className="text-[11px] text-gray-300 leading-relaxed max-w-xs mx-auto">
            You're browsing this store's inventory as a quest. <span className="text-primary font-black">Comfort Business Hub</span> members get direct supplier channels, lower rates, and unified checkouts.
          </p>
          <div className="flex flex-col gap-3">
             <button 
                onClick={() => {
                  if (onGuestLogin) onGuestLogin();
                  else navigate('/login');
                }}
                className="btn-neon w-full py-3 text-[10px] uppercase font-black tracking-widest"
              >
                {onGuestLogin ? 'Transact as Guest' : 'Create Hub Identity'}
              </button>
              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Connect with verified local suppliers instantly</p>
          </div>
        </section>
      )}
      
      {/* Store Location */}
      {showMap && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <MapPin size={20} className="text-primary" />
            <h3 className="font-black text-white uppercase tracking-tighter text-xl italic uppercase">Location</h3>
          </div>
          <div className="neon-card p-4 space-y-4 overflow-hidden">
            <div className="h-48 sm:h-64 rounded-2xl overflow-hidden border border-white/5 shadow-inner">
              {(store.lat && store.lng) ? (
                <MapContainer 
                  center={[store.lat, store.lng]} 
                  zoom={14} 
                  style={{ height: '100%', width: '100%' }}
                  zoomControl={false}
                  dragging={false}
                  touchZoom={false}
                  scrollWheelZoom={false}
                >
                  <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                    url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                  />
                  <Marker position={[store.lat, store.lng]} />
                </MapContainer>
              ) : (
                <div className="w-full h-full bg-white/5 flex flex-col items-center justify-center gap-2">
                  <Navigation size={24} className="text-gray-700" />
                  <p className="text-[10px] text-gray-700 font-black uppercase tracking-widest">Coordinates not synchronized</p>
                </div>
              )}
            </div>
            <div className="flex items-start gap-3 px-2 py-1">
              <div className="w-8 h-8 bg-primary/10 rounded-lg flex items-center justify-center flex-shrink-0 text-primary">
                <Building2 size={16} />
              </div>
              <div className="space-y-0.5">
                <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest">Physical Manifestation</p>
                <p className="text-sm font-bold text-white italic">{store.address || 'No location set'}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-white uppercase tracking-tighter text-xl italic flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            Inventory
          </h3>
          <div className="flex items-center gap-4">
            <span className="text-[9px] font-black text-neon-green uppercase tracking-widest">{products.length} Items Live</span>
            {isOwner && profile?.currentRole === 'supplier' && (
              <button 
                onClick={() => navigate('/stores', { state: { activeTab: 'manage', showProductForm: true, activeStore: store } })}
                className="w-8 h-8 bg-primary/20 rounded-lg border border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-black transition-all"
                title="Add New Entry"
              >
                <Plus size={18} />
              </button>
            )}
          </div>
        </div>

        {loading ? (
           <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
             {[1, 2, 3, 4].map(i => <div key={i} className="neon-card h-64 animate-pulse" />)}
           </div>
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
            {products.length > 0 ? (
              Array.from(new Map<string, Product>(products.filter(p => p && p.id).map(p => [p.id, p])).values()).map((p, idx) => (
                <ProductCard 
                  key={`sd-prod-${p.id || idx}-${idx}`} 
                  product={p} 
                  profile={profile} 
                  store={store}
                  isOwner={isOwner}
                />
              ))
            ) : (
              <div className="col-span-full py-20 text-center space-y-4 bg-white/5 rounded-3xl border border-white/5">
                <Info size={32} className="mx-auto text-gray-700" />
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">No items found</p>
              </div>
            )}
          </div>
        )}
      </section>

      {/* Storefront 5-Star Ratings & Reviews Section */}
      <section id="store-rating-section" className="space-y-6 pt-6 border-t border-white/10">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 px-2">
          <div>
            <h3 className="font-black text-white uppercase tracking-tighter text-xl italic flex items-center gap-2">
              <Star size={20} className="fill-amber-400 text-amber-400" />
              Storefront Ratings & Feedback
            </h3>
            <p className="text-[10px] sm:text-xs text-gray-400 font-medium">
              Verified community ratings and direct store feedback ({store.reviewCount || storeReviews.length || 0} {store.reviewCount === 1 ? 'rating' : 'ratings'})
            </p>
          </div>

          {!isOwner && (
            <AuthGuard
              title="Rate Storefront"
              message="Sign in to submit your 5-star rating for this store."
              profile={profile}
            >
              <button
                onClick={() => {
                  setShowStoreRatingModal(true);
                  setShowRatingForm(true);
                }}
                className="px-4 py-2.5 rounded-xl bg-gradient-to-r from-amber-400 to-amber-500 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 shadow-[0_0_20px_rgba(251,191,36,0.3)] hover:scale-105 active:scale-95 transition-all cursor-pointer"
              >
                <Star size={14} className="fill-black" />
                Rate This Store
              </button>
            </AuthGuard>
          )}
        </div>

        {/* Rating Submission Form */}
        <AnimatePresence>
          {showRatingForm && (
            <motion.form
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: 'auto' }}
              exit={{ opacity: 0, height: 0 }}
              onSubmit={handleSubmitStoreRating}
              className="p-5 sm:p-6 bg-gradient-to-br from-amber-400/10 via-black/40 to-black/80 rounded-2xl border border-amber-400/30 space-y-4"
            >
              <h4 className="text-sm font-black text-amber-300 uppercase tracking-wide">
                Submit 5-Star Store Rating
              </h4>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">
                  Select Rating
                </label>
                <FiveStarRating
                  value={newRating}
                  onChange={(r) => setNewRating(r)}
                  size="xl"
                  showLabel
                />
              </div>

              <div className="space-y-2">
                <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">
                  Storefront Review / Feedback
                </label>
                <textarea
                  value={newComment}
                  onChange={(e) => setNewComment(e.target.value)}
                  placeholder="Share your experience with this supplier node..."
                  required
                  rows={3}
                  className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-400/50 resize-none placeholder:text-gray-600"
                />
              </div>

              <div className="flex justify-end gap-3 pt-2">
                <button
                  type="button"
                  onClick={() => setShowRatingForm(false)}
                  className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmittingRating}
                  className="px-6 py-2 rounded-xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-amber-300 disabled:opacity-50"
                >
                  {isSubmittingRating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                  Publish Rating
                </button>
              </div>
            </motion.form>
          )}
        </AnimatePresence>

        {/* Reviews List */}
        <div className="grid gap-4">
          {storeReviews.length > 0 ? (
            storeReviews.map((rev) => (
              <div
                key={rev.id}
                className="p-4 bg-white/5 border border-white/5 rounded-2xl flex flex-col sm:flex-row sm:items-start justify-between gap-3 hover:border-amber-400/20 transition-all"
              >
                <div className="flex items-start gap-3">
                  <div className="w-10 h-10 bg-black rounded-full border border-white/10 overflow-hidden flex items-center justify-center text-amber-400 font-black text-sm shrink-0">
                    {rev.userAvatar ? (
                      <img src={rev.userAvatar} alt={rev.userName} className="w-full h-full object-cover" />
                    ) : (
                      rev.userName?.charAt(0) || 'U'
                    )}
                  </div>
                  <div className="space-y-1">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="text-xs font-black text-white">{rev.userName}</span>
                      <FiveStarRating value={rev.rating || 5} size="sm" readOnly />
                    </div>
                    <p className="text-xs text-gray-300 leading-relaxed font-medium">
                      {rev.comment}
                    </p>
                  </div>
                </div>
                {rev.createdAt?.toDate && (
                  <span className="text-[9px] text-gray-500 font-mono shrink-0">
                    {rev.createdAt.toDate().toLocaleDateString()}
                  </span>
                )}
              </div>
            ))
          ) : (
            <div className="p-8 text-center bg-white/5 border border-white/5 rounded-2xl space-y-2">
              <Star size={24} className="mx-auto text-amber-400/40" />
              <p className="text-xs font-bold text-gray-400">No storefront ratings yet.</p>
              <p className="text-[10px] text-gray-500">Be the first to rate and review this supplier storefront!</p>
            </div>
          )}
        </div>
      </section>

      {/* Storefront Rating Modal Overlay */}
      <AnimatePresence>
        {showStoreRatingModal && (
          <div 
            className="fixed inset-0 z-[9999] flex items-center justify-center p-4 bg-black/80 backdrop-blur-md"
            onClick={() => setShowStoreRatingModal(false)}
          >
            <motion.div 
              initial={{ scale: 0.9, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              exit={{ scale: 0.9, opacity: 0 }}
              className="bg-[#0d1117] border border-amber-400/40 rounded-3xl p-6 max-w-md w-full space-y-5 relative shadow-[0_0_50px_rgba(251,191,36,0.25)]"
              onClick={(e) => e.stopPropagation()}
            >
              <button 
                type="button"
                onClick={() => setShowStoreRatingModal(false)}
                className="absolute top-4 right-4 w-8 h-8 rounded-full bg-white/5 border border-white/10 flex items-center justify-center text-gray-400 hover:text-white hover:bg-white/10 transition-all cursor-pointer"
              >
                <X size={16} />
              </button>

              <div className="flex items-center gap-3">
                <div className="w-12 h-12 rounded-2xl bg-amber-400/10 border border-amber-400/30 flex items-center justify-center text-amber-400 shrink-0">
                  <Star size={24} className="fill-amber-400" />
                </div>
                <div>
                  <h3 className="text-lg font-black text-white italic uppercase tracking-tight">
                    Rate {store.name}
                  </h3>
                  <div className="flex items-center gap-1.5 mt-0.5">
                    <FiveStarRating value={store.rating || 5.0} size="sm" readOnly count={store.reviewCount || storeReviews.length || 0} countLabel="rating" />
                  </div>
                </div>
              </div>

              <form onSubmit={handleSubmitStoreRating} className="space-y-4">
                <div className="space-y-2 bg-black/40 p-4 rounded-2xl border border-white/5">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">
                    Your Rating Score
                  </label>
                  <FiveStarRating
                    value={newRating}
                    onChange={(r) => setNewRating(r)}
                    size="xl"
                    showLabel
                  />
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">
                    Quick Review Highlights
                  </label>
                  <div className="flex flex-wrap gap-1.5">
                    {['Top Supplier', 'Fast Communication', 'High Quality Items', 'Trusted Business', 'Excellent Experience'].map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        onClick={() => {
                          setNewComment(prev => prev ? `${prev} • ${tag}` : tag);
                        }}
                        className="px-2.5 py-1 rounded-lg bg-white/5 border border-white/10 text-[9px] font-bold text-gray-300 hover:border-amber-400/50 hover:text-amber-300 transition-all cursor-pointer"
                      >
                        + {tag}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="space-y-2">
                  <label className="text-[10px] font-black uppercase tracking-widest text-gray-300 block">
                    Storefront Review Feedback
                  </label>
                  <textarea
                    value={newComment}
                    onChange={(e) => setNewComment(e.target.value)}
                    placeholder="Share your experience dealing with this supplier storefront..."
                    required
                    rows={3}
                    className="w-full bg-black/60 border border-white/10 rounded-xl p-3 text-white text-xs outline-none focus:border-amber-400/50 resize-none placeholder:text-gray-600"
                  />
                </div>

                <div className="flex justify-end gap-3 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowStoreRatingModal(false)}
                    className="px-4 py-2 rounded-xl bg-white/5 text-gray-400 text-xs font-bold hover:bg-white/10 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={isSubmittingRating}
                    className="px-6 py-2 rounded-xl bg-amber-400 text-black font-black text-xs uppercase tracking-wider flex items-center gap-2 hover:bg-amber-300 active:scale-95 transition-all shadow-[0_0_15px_rgba(251,191,36,0.4)] disabled:opacity-50 cursor-pointer"
                  >
                    {isSubmittingRating ? <Loader2 size={12} className="animate-spin" /> : <Check size={12} />}
                    Submit Store Rating
                  </button>
                </div>
              </form>
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {profile && (
        <ReportModal 
          isOpen={showReportModal}
          onClose={() => setShowReportModal(false)}
          targetId={store.id}
          targetType="store"
          targetName={store.name}
          ownerId={store.ownerId}
          reporterId={profile.uid}
          reporterName={profile.name || profile.businessName || 'Anonymous User'}
        />
      )}
    </div>
  );
}

export default function StoreDetail({ profile, onGuestLogin }: { profile: UserProfile | null, onGuestLogin?: () => void }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreType | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    setLoading(true);
    
    // Real-time Store Listener
    const storeUnsub = onSnapshot(doc(db, 'stores', id), (snap) => {
      if (snap.exists()) {
        const storeData = { id: snap.id, ...snap.data() } as StoreType;
        setStore(storeData);
        viewHistoryService.recordStoreView(storeData.id, storeData.name, storeData.category);
      } else {
        setError("Store not found");
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `store-realtime-${id}`);
      setError("Error loading store");
      setLoading(false);
    });

    return () => storeUnsub();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Loading store details...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="p-8 text-center space-y-4">
        <Building2 className="mx-auto text-gray-700" size={48} />
        <h3 className="text-lg font-black text-white italic uppercase">{error || "Store Unavailable"}</h3>
        <button onClick={() => navigate('/')} className="btn-neon px-8 py-3 text-[10px] font-black uppercase">Return to Hub</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4"
    >
      <StoreDetailContent store={store} profile={profile} onGuestLogin={onGuestLogin} />
    </motion.div>
  );
}
