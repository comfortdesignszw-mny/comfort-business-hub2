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
import { cn, formatCurrency, safeShare } from '../lib/utils';
import ProductCard from '../components/ProductCard';
import AuthGuard from '../components/AuthGuard';
import ImageInput from '../components/ImageInput';
import ReportModal from '../components/ReportModal';
import { useModals } from '../context/ModalContext';
import { interactionService } from '../services/interactionService';
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

  const navigate = useNavigate();
  const isOwner = allowEdit && profile?.currentRole === 'supplier' && profile?.uid === store.ownerId;

  useEffect(() => {
    if (!profile || !store.ownerId || profile.uid === store.ownerId) return;

    // Check for connection in both directions
    const q1 = query(collection(db, 'connections'), where('senderId', '==', profile.uid), where('receiverId', '==', store.ownerId));
    const q2 = query(collection(db, 'connections'), where('senderId', '==', store.ownerId), where('receiverId', '==', profile.uid));

    const unsub1 = onSnapshot(q1, (snap) => {
      if (!snap.empty) setConnection({ id: snap.docs[0].id, ...snap.docs[0].data() } as Connection);
    });
    const unsub2 = onSnapshot(q2, (snap) => {
      if (!snap.empty) setConnection({ id: snap.docs[0].id, ...snap.docs[0].data() } as Connection);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [profile?.uid, store.ownerId]);

  const handleConnect = async () => {
    if (!profile || profile.isGuest) {
      navigate('/login');
      return;
    }
    if (connection) return;
    await interactionService.sendConnectionRequest(profile, { 
      uid: store.ownerId, 
      name: store.name, 
      avatar: store.logo 
    });
    triggerFeedback('Uplink Initialized', `Connection request sent to ${store.name}`, 'connect_request');
  };

  const handleFollow = async () => {
    if (!profile || profile.isGuest) {
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

  const handleLike = async () => {
    if (!profile || profile.isGuest) {
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
    const pq = query(
      collection(db, 'products'),
      where('storeId', '==', store.id),
      where('isActive', '==', true),
      limit(50)
    );
    
    const productsUnsub = onSnapshot(pq, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    });

    return () => productsUnsub();
  }, [store.id]);

  const handleShare = async () => {
    const shareUrl = `${window.location.origin}/store/${store.id}`;
    if (navigator.share) {
      await safeShare({
        title: store.name || 'Comfort Node',
        text: `Check out ${store.name} on Comfort Business Hub!`,
        url: shareUrl,
      });
    } else {
      navigator.clipboard.writeText(shareUrl);
      triggerFeedback('Link Copied', 'Node Link Copied to Clipboard!', 'message');
    }
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
                    <Camera size={14} /> Adjust Matrix Cover
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
                    placeholder="Node Identifier"
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
                <p className="text-[8px] sm:text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-1 bg-primary/10 w-fit px-2 py-0.5 rounded border border-primary/20 mx-auto transition-all">{store.category} Sector Hub</p>
              </div>
            )}
          </div>

          <div className="flex flex-wrap justify-center gap-2 pt-2">
            <div className="glass-pill !text-neon-green flex items-center gap-1.5 text-[9px] sm:text-xs">
              <Star size={10} className="fill-neon-green sm:w-3 sm:h-3" /> {store.rating.toFixed(1)} ({store.reviewCount})
            </div>
            {profile?.uid !== store.ownerId && (
              <AuthGuard
                title="Establish Node Interlock"
                message="Secure identity is required to establish a direct business partnership and private channel access."
                profile={profile}
                requireRealUser={true}
              >
                <button 
                  onClick={handleConnect}
                  disabled={!!connection}
                  className={cn(
                    "glass-pill flex items-center gap-1.5 text-[9px] sm:text-xs transition-all",
                    connection?.status === 'accepted' 
                      ? "border-neon-green/30 text-neon-green bg-neon-green/5 shadow-[0_0_15px_rgba(57,255,20,0.2)]" 
                      : connection?.status === 'pending'
                      ? "border-gray-500/30 text-gray-400 bg-white/5 opacity-50"
                      : "border-primary/30 text-primary bg-primary/5 hover:bg-primary/20 hover:shadow-[0_0_15px_rgba(0,242,254,0.3)] animate-pulse"
                  )}
                >
                  <Users size={10} className="sm:w-3 sm:h-3" /> 
                  {connection?.status === 'accepted' ? 'Trusted Partner' : connection?.status === 'pending' ? 'Request Sent' : 'Connect Node'}
                </button>
              </AuthGuard>
            )}
            {profile?.uid !== store.ownerId && (
              <AuthGuard
                title="Follow Strategic Feed"
                message="Join the Network Hub to follow this node and receive real-time supply chain updates."
                profile={profile}
                requireRealUser={true}
              >
                <button 
                  onClick={handleFollow}
                  className="glass-pill border-cyan-400/30 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-1.5 text-[9px] sm:text-xs transition-all animate-pulse"
                >
                  <UserPlus size={10} className="sm:w-3 sm:h-3" /> {store.followerCount || 0} Followers
                </button>
              </AuthGuard>
            )}
            {profile?.uid !== store.ownerId && (
              <AuthGuard
                title="Log Store Interest"
                message="Sign in to save this storefront to your private business registry."
                profile={profile}
                requireRealUser={true}
              >
                <button 
                  onClick={handleLike}
                  className="glass-pill border-cyan-400/30 text-cyan-400 bg-cyan-400/5 hover:bg-cyan-400/10 hover:shadow-[0_0_15px_rgba(34,211,238,0.4)] flex items-center gap-1.5 text-[9px] sm:text-xs transition-all"
                >
                  <Heart size={10} className="fill-cyan-400 sm:w-3 sm:h-3" /> {store.likeCount || 0} Likes
                </button>
              </AuthGuard>
            )}
            <button 
              onClick={handleShare}
              className="glass-pill hover:bg-white/10 flex items-center gap-1.5 text-[9px] sm:text-xs no-auth-guard"
            >
              <Share2 size={10} className="sm:w-3 sm:h-3" /> Share Node
            </button>
            {!isOwner && profile && (
              <button 
                onClick={() => setShowReportModal(true)}
                className="glass-pill border-red-500/30 text-red-500 bg-red-500/5 hover:bg-red-500/10 hover:shadow-[0_0_15px_rgba(239,68,68,0.4)] flex items-center gap-1.5 text-[9px] sm:text-xs transition-all"
              >
                <ShieldAlert size={10} className="sm:w-3 sm:h-3" /> Report Node
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
          <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Join the Enterprise Matrix</h3>
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
      
      {/* Store Location Node */}
      {showMap && (
        <section className="space-y-4">
          <div className="flex items-center gap-2 px-2">
            <MapPin size={20} className="text-primary" />
            <h3 className="font-black text-white uppercase tracking-tighter text-xl italic uppercase">Geographic Hub Node</h3>
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
                <p className="text-sm font-bold text-white italic">{store.address || 'Distributed Network Node'}</p>
              </div>
            </div>
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-white uppercase tracking-tighter text-xl italic flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            Inventory Node
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
              products.map((p) => (
                <ProductCard 
                  key={p.id} 
                  product={p} 
                  profile={profile} 
                  store={store}
                  isOwner={isOwner}
                />
              ))
            ) : (
              <div className="col-span-full py-20 text-center space-y-4 bg-white/5 rounded-3xl border border-white/5">
                <Info size={32} className="mx-auto text-gray-700" />
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">No active items found in this node</p>
              </div>
            )}
          </div>
        )}
      </section>

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
        setStore({ id: snap.id, ...snap.data() } as StoreType);
      } else {
        setError("Node not found in local subspace");
      }
      setLoading(false);
    }, (error) => {
      handleFirestoreError(error, OperationType.GET, `store-realtime-${id}`);
      setError("Error synchronizing with store node");
      setLoading(false);
    });

    return () => storeUnsub();
  }, [id]);

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Syncing Store Node...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="p-8 text-center space-y-4">
        <Building2 className="mx-auto text-gray-700" size={48} />
        <h3 className="text-lg font-black text-white italic uppercase">{error || "Node Offline"}</h3>
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
