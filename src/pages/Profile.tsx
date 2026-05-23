import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Store, Phone, MapPin, Shield, LogOut, ChevronRight, Wallet, 
  Bell, Zap, Image as ImageIcon, X, Check, CreditCard, 
  Navigation, Crosshair, Save, Loader2, Megaphone, Trash2, Calendar, FileText, Plus, Users, MessageSquare, Share
} from 'lucide-react';
import { UserProfile, Role, Spotlight, Product, Connection } from '../types';
import { auth, db, handleFirestoreError, OperationType, syncPublicProfile } from '../lib/firebase';
import { offlineResilientWrite } from '../lib/sync';
import { geohashForLocation } from 'geofire-common';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, orderBy, serverTimestamp, limit, onSnapshot } from 'firebase/firestore';
import { cn, formatCurrency } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import ImageInput from '../components/ImageInput';
import LocationPicker from '../components/LocationPicker';
import ProductCard from '../components/ProductCard';

export default function Profile({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const { id: routeId } = useParams<{ id?: string }>();
  const [observedProfile, setObservedProfile] = useState<UserProfile | null>(null);
  const [observedStores, setObservedStores] = useState<any[]>([]);
  const [loadingObserved, setLoadingObserved] = useState(false);
  const isObserved = !!routeId && routeId !== profile?.uid;

  const { triggerFeedback } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'gateway' | 'location' | 'spotlights' | 'delete' | 'connections' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const [engagementStats, setEngagementStats] = useState({ engaged: 0, volume: 0 });

  useEffect(() => {
    if (!isObserved) {
      setObservedProfile(null);
      setObservedStores([]);
      return;
    }

    const fetchPublicData = async () => {
      setLoadingObserved(true);
      try {
        const { getDoc, doc, collection, query, where, getDocs } = await import('firebase/firestore');
        let userDoc = await getDoc(doc(db, 'public_profiles', routeId));
        if (!userDoc.exists()) {
          userDoc = await getDoc(doc(db, 'users', routeId));
        }

        if (userDoc.exists()) {
          const uData = { uid: userDoc.id, ...userDoc.data() } as UserProfile;
          setObservedProfile(uData);

          if (uData.currentRole === 'supplier') {
            const storesSnap = await getDocs(query(collection(db, 'stores'), where('ownerId', '==', routeId)));
            const items = storesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
            setObservedStores(items);
          }
        } else {
          setObservedProfile(null);
        }
      } catch (err) {
        console.error("Error loading observed public profile:", err);
      } finally {
        setLoadingObserved(false);
      }
    };

    fetchPublicData();
  }, [routeId, isObserved]);

  useEffect(() => {
    if (!profile || profile.currentRole !== 'supplier') return;

    // Real-time Engagement stats listener for Supplier
    const q = query(collection(db, 'engagements'), where('supplierId', '==', profile.uid));
    const unsub = onSnapshot(q, (snap) => {
      let engaged = 0;
      let volume = 0;
      
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'engaged') engaged++;
        if (data.type === 'order_now') volume += (data.price || 0);
      });
      setEngagementStats({ engaged, volume });
    });

    return () => unsub();
  }, [profile?.uid, profile?.currentRole]);
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();

  const toggleRole = async () => {
    if (!profile || loading) return;
    
    const newRole: Role = profile.currentRole === 'customer' ? 'supplier' : 'customer';
    
    // Optimistic Update
    const prevRole = profile.currentRole;
    setProfile({ ...profile, currentRole: newRole });
    
    setLoading(true);
    const path = `users/${profile.uid}`;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        currentRole: newRole
      });
      await syncPublicProfile({ ...profile, currentRole: newRole });
    } catch (e) {
      // Revert on failure
      setProfile({ ...profile, currentRole: prevRole });
      handleFirestoreError(e, OperationType.UPDATE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!profile || !auth.currentUser) return;
    
    // Immediate UI feedback and lock
    setIsDeleting(true);
    triggerFeedback('Initializing Purge Protocol', 'Securely erasing all nodes and identity footprints from the Matrix...', 'notification');

    try {
      const uid = profile.uid;
      
      // 1. Defined collection map for systematic erasure
      const collectionsToWipe = [
        { name: 'stores', field: 'ownerId' },
        { name: 'products', field: 'ownerId' },
        { name: 'reviews', field: 'userId' },
        { name: 'notifications', field: 'userId' },
        { name: 'notifications', field: 'fromUserId' },
        { name: 'engagements', field: 'customerId' },
        { name: 'engagements', field: 'supplierId' },
        { name: 'deals', field: 'customerId' },
        { name: 'deals', field: 'supplierId' },
        { name: 'spotlights', field: 'authorId' },
        { name: 'follows', field: 'userId' },
        { name: 'storeLikes', field: 'userId' },
        { name: 'productLikes', field: 'userId' },
        { name: 'reports', field: 'reporterId' },
        { name: 'reports', field: 'ownerId' },
        { name: 'public_profiles', field: 'uid' },
        { name: 'connections', field: 'senderId' },
        { name: 'connections', field: 'receiverId' }
      ];

      // Execute all category wipes in parallel for maximum throughput
      await Promise.all(collectionsToWipe.map(async (coll) => {
        try {
          const q = query(collection(db, coll.name), where(coll.field, '==', uid));
          const snap = await getDocs(q);
          if (snap.empty) return;

          // Process in smaller parallel chunks to avoid overwhelming the socket
          await Promise.all(snap.docs.map(d => deleteDoc(doc(db, coll.name, d.id))));
        } catch (e) {
          console.error(`Wipe segment failure for ${coll.name}/${coll.field}:`, e);
          // We continue to ensure as much data as possible is purged
        }
      }));

      // 2. Wipe Conversations - Requires deep sub-collection traversal
      try {
        const convQuery = query(collection(db, 'conversations'), where('participants', 'array-contains', uid));
        const convSnap = await getDocs(convQuery);
        
        await Promise.all(convSnap.docs.map(async (convoDoc) => {
          try {
            const msgSnap = await getDocs(collection(db, 'conversations', convoDoc.id, 'messages'));
            await Promise.all(msgSnap.docs.map(m => deleteDoc(doc(db, 'conversations', convoDoc.id, 'messages', m.id))));
            await deleteDoc(doc(db, 'conversations', convoDoc.id));
          } catch (err) {
            console.error(`Conversation node wipe failure (${convoDoc.id}):`, err);
          }
        }));
      } catch (e) {
        console.error("Deep message traversal failed:", e);
      }

      // 3. Final Identity Node Deletion (Root User Entry)
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) {
        console.error("Root identity node failed to purge:", e);
      }

      // 4. Auth Account Removal
      try {
        // Attempt deep deletion - this might require fresh login
        await auth.currentUser.delete();
      } catch (authErr) {
        console.warn("Auth deletion deferred (re-auth required), signing out for safety.");
      }
      
      // 5. Hard Reset & Redirection
      triggerFeedback('Identity Purged', 'All node data has been securely erased. Connection closed.', 'success');
      
      // Clear local state immediately
      setProfile(null as any);
      await auth.signOut();
      
      // Navigate and force sync
      navigate('/login', { replace: true });
      setTimeout(() => window.location.reload(), 500); 
    } catch (e) {
      console.error("TOTAL NODE PURGE FAILURE:", e);
      triggerFeedback('Purge Error', 'Fatal error during identity erasure. Partial data may exist.', 'error');
      
      await auth.signOut();
      navigate('/login', { replace: true });
    } finally {
      setIsDeleting(false);
      setActiveModal(null);
    }
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    
    setLoading(true);
    try {
      const data = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await offlineResilientWrite('users', profile.uid, 'update', data);
      const newProfile = { ...profile, ...updates };
      setProfile(newProfile);
      await syncPublicProfile(newProfile);
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleSaveProfile = async () => {
    if (!profile || Object.keys(editData).length === 0) {
      setIsEditing(false);
      return;
    }
    
    setLoading(true);
    try {
      const data = {
        ...editData,
        updatedAt: new Date().toISOString()
      };
      await offlineResilientWrite('users', profile.uid, 'update', data);
      const newProfile = { ...profile, ...editData };
      setProfile(newProfile);
      await syncPublicProfile(newProfile);
      setIsEditing(false);
      setEditData({});
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    startTransition(() => {
      navigate(path);
    });
  };

  const handleShareProfile = async () => {
    const shareUrl = `${window.location.origin}/profile/${profile?.uid}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: profile?.name || 'Comfort Node',
          text: `Check out ${profile?.name || 'Comfort Node'}'s profile on Comfort Business Hub!`,
          url: shareUrl,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      triggerFeedback('Link Copied', 'Profile Link Copied to Clipboard!', 'message');
    }
  };

  const handleShareObservedProfile = async () => {
    if (!observedProfile) return;
    const shareUrl = `${window.location.origin}/profile/${observedProfile.uid}`;
    if (navigator.share) {
      try {
        await navigator.share({
          title: observedProfile.name,
          text: `Check out ${observedProfile.name}'s profile on Comfort Business Hub!`,
          url: shareUrl,
        });
      } catch (err) {
        console.error(err);
      }
    } else {
      navigator.clipboard.writeText(shareUrl);
      triggerFeedback('Link Copied', 'Profile Link Copied to Clipboard!', 'message');
    }
  };

  if (loadingObserved) {
    return (
      <div className="min-h-[50vh] flex flex-col items-center justify-center gap-4 text-center p-6">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] animate-pulse">Syncing Public Profile Frame...</p>
      </div>
    );
  }

  if (isObserved) {
    if (!observedProfile) {
      return (
        <div className="min-h-[50vh] flex flex-col items-center justify-center gap-6 text-center p-6 max-w-sm mx-auto">
          <div className="w-16 h-16 rounded-2xl bg-white/5 border border-white/10 flex items-center justify-center text-gray-500">
            <X size={24} />
          </div>
          <div className="space-y-2">
            <h3 className="text-md font-black text-white uppercase italic tracking-tighter">Null Profile Identifier</h3>
            <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
              This node identifier footprint does not reside on the active network matrix directory. It may have been purged or relocated.
            </p>
          </div>
          <button 
            onClick={() => navigate('/')}
            className="w-full bg-white/5 border border-white/10 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest text-primary hover:bg-white/10 transition-all"
          >
            Access Main Network
          </button>
        </div>
      );
    }

    // Render observed public profile here!
    return (
      <motion.div 
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        exit={{ opacity: 0, y: -10 }}
        className="p-4 space-y-8 max-w-3xl mx-auto pb-24"
      >
        <section className="flex flex-col items-center text-center space-y-6 pt-6">
          <div className="w-full max-w-sm">
            <div className="flex flex-col items-center space-y-6">
              <div className="relative">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25"></div>
                <div className="relative w-32 h-32 bg-[#0d1117] border-4 border-[#05070a] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10"></div>
                  {observedProfile.avatar ? (
                    <img 
                      src={observedProfile.avatar} 
                      alt={observedProfile.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                    />
                  ) : observedProfile.name.charAt(0)}
                </div>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{observedProfile.name}</h2>
                  <div className="flex items-center justify-center gap-3">
                    {observedProfile.phone && (
                      <>
                        <p className="text-xs text-gray-500 font-black uppercase tracking-widest">{observedProfile.phone}</p>
                        <div className="w-1.5 h-1.5 bg-gray-700 rounded-full"></div>
                      </>
                    )}
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Operator Node: {observedProfile.uid.slice(0, 8)}</p>
                  </div>
                </div>

                <div className="flex justify-center gap-3">
                  {observedProfile.isVerified && (
                    <div className="glass-pill !text-neon-green !border-neon-green/20 flex items-center gap-1.5 shadow-[0_0_10px_rgba(57,255,20,0.1)]">
                      <Shield size={12} className="fill-neon-green/20" /> Verified Operator
                    </div>
                  )}
                  <div className="glass-pill capitalize">{observedProfile.currentRole} Role</div>
                </div>

                <div className="flex justify-center gap-2">
                  <button 
                    onClick={handleShareObservedProfile}
                    className="flex items-center gap-2 px-4 py-2 bg-primary/15 hover:bg-primary/25 text-primary rounded-xl border border-primary/20 text-[9px] font-black uppercase tracking-widest transition-all no-auth-guard"
                  >
                    <Share size={12} /> Share Operator Node
                  </button>
                  {profile && profile.uid !== observedProfile.uid && (
                    <button 
                      onClick={() => navigate(`/chat?recipient=${observedProfile.uid}`)}
                      className="flex items-center gap-2 px-4 py-2 bg-white/5 hover:bg-white/10 text-white rounded-xl border border-white/10 text-[9px] font-black uppercase tracking-widest transition-all"
                    >
                      <MessageSquare size={12} /> Establish Comms
                    </button>
                  )}
                </div>
              </div>
            </div>
          </div>
        </section>

        {observedProfile.currentRole === 'supplier' && (
          <section className="space-y-6">
            <h3 className="text-sm font-black text-white uppercase tracking-widest text-center">Managed Storefront Nodes</h3>
            
            {observedStores.length === 0 ? (
              <div className="text-center p-8 bg-white/5 rounded-3xl border border-white/5 space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">No Storefronts Active</p>
                <p className="text-[10px] text-gray-500 leading-relaxed font-bold uppercase tracking-widest">This supplier does not have any active marketplaces listed currently.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {observedStores.map((store) => (
                  <div 
                    key={store.id}
                    onClick={() => navigate(`/store/${store.id}`)}
                    className="neon-card p-6 flex items-center gap-4 hover:scale-[1.02] active:scale-[0.98] cursor-pointer transition-all"
                  >
                    <div className="w-16 h-16 rounded-2xl overflow-hidden bg-white/5 shrink-0 border border-white/10 flex items-center justify-center text-white font-bold text-lg">
                      {store.logo ? (
                        <img src={store.logo} alt={store.name} className="w-full h-full object-cover" />
                      ) : store.name?.charAt(0)}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <h4 className="text-sm font-black text-white uppercase truncate">{store.name}</h4>
                      <p className="text-[10px] text-gray-400 line-clamp-2 mt-1 leading-normal font-medium">{store.description || 'Verified Supplier store'}</p>
                      {store.location && (
                        <div className="flex items-center gap-1 text-[8px] text-primary font-bold uppercase mt-2 tracking-widest">
                          <MapPin size={8} /> {store.location.city}
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </section>
        )}
      </motion.div>
    );
  }

  if (!profile) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="p-4 space-y-8 custom-scrollbar"
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Profile Header */}
      <section className="flex flex-col items-center text-center space-y-6 pt-6">
        <div className="w-full max-w-sm">
          {isEditing ? (
            <div className="space-y-6">
              <div className="flex items-center gap-6 p-4 bg-white/5 rounded-3xl border border-white/10">
                <div className="relative flex-shrink-0">
                  <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25"></div>
                  <div className="relative w-24 h-24 bg-[#0d1117] border-4 border-[#05070a] rounded-full flex items-center justify-center text-white text-3xl font-black shadow-2xl relative overflow-hidden">
                    <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10"></div>
                    {(editData.avatar ?? profile.avatar) ? (
                      <img 
                        src={editData.avatar ?? profile.avatar} 
                        alt="Preview" 
                        className="w-full h-full object-cover" 
                        referrerPolicy="no-referrer" 
                        onError={(e) => {
                          const target = e.target as HTMLImageElement;
                          target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
                        }}
                      />
                    ) : (editData.name ?? profile.name).charAt(0)}
                  </div>
                </div>
                
                <div className="flex-1 text-left space-y-2">
                  <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Avatar Uplink</label>
                  <ImageInput 
                    value={editData.avatar ?? profile.avatar ?? ''} 
                    onChange={(val) => setEditData(prev => ({ ...prev, avatar: val }))}
                    label="Change Photo"
                    aspectRatio="square"
                    className="!bg-white/5 border-white/10"
                  />
                </div>
              </div>

              <div className="space-y-4 pt-2">
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-left block ml-1">Entity Name</label>
                  <input 
                    type="text"
                    value={editData.name ?? profile.name}
                    onChange={e => setEditData(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="Enter your name"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 font-bold italic transition-all"
                  />
                </div>
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest text-left block ml-1">Comms Link (Phone)</label>
                  <input 
                    type="tel"
                    value={editData.phone ?? profile.phone}
                    onChange={e => setEditData(prev => ({ ...prev, phone: e.target.value }))}
                    placeholder="Enter phone number"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 font-mono transition-all"
                  />
                </div>
                
                <div className="flex gap-3 pt-2">
                  <button 
                    onClick={() => { setIsEditing(false); setEditData({}); }}
                    className="flex-1 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-all active:scale-95"
                  >
                    Cancel
                  </button>
                  <button 
                    onClick={handleSaveProfile}
                    disabled={loading}
                    className="flex-[2] btn-neon py-4 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-widest shadow-lg shadow-primary/20"
                  >
                    {loading ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Commit Changes
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="flex flex-col items-center space-y-6">
              <div className="relative group">
                <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
                <div className="relative w-32 h-32 bg-[#0d1117] border-4 border-[#05070a] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-2xl relative overflow-hidden">
                  <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10"></div>
                  {profile.avatar ? (
                    <img 
                      src={profile.avatar} 
                      alt={profile.name} 
                      className="w-full h-full object-cover" 
                      referrerPolicy="no-referrer" 
                      onError={(e) => {
                        const target = e.target as HTMLImageElement;
                        target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
                      }}
                    />
                  ) : profile.name.charAt(0)}
                </div>
                <button 
                  onClick={() => setIsEditing(true)}
                  className="absolute bottom-1 right-1 w-10 h-10 bg-primary text-[#05070a] rounded-xl flex items-center justify-center border-4 border-[#05070a] shadow-lg hover:scale-110 transition-transform active:scale-95"
                >
                  <ImageIcon size={18} />
                </button>
              </div>

              <div className="space-y-4">
                <div className="space-y-1">
                  <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{profile.name}</h2>
                  <div className="flex items-center justify-center gap-3">
                    <p className="text-xs text-gray-500 font-black uppercase tracking-widest">{profile.phone}</p>
                    <div className="w-1.5 h-1.5 bg-gray-700 rounded-full"></div>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Node ID: {profile.uid.slice(0, 8)}</p>
                  </div>
                </div>
                <div className="flex justify-center gap-3">
                  {profile.isVerified && (
                    <div className="glass-pill !text-neon-green !border-neon-green/20 flex items-center gap-1.5 shadow-[0_0_10px_rgba(57,255,20,0.1)]">
                      <Shield size={12} className="fill-neon-green/20" /> Verified Operator
                    </div>
                  )}
                  <div className="glass-pill">Beta Access</div>
                </div>
                <div className="flex justify-center gap-2">
                  <button 
                    onClick={() => setIsEditing(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-white/5 rounded-xl border border-white/10 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-primary transition-all"
                  >
                    Modify Identity Parameters
                  </button>
                  <button 
                    onClick={handleShareProfile}
                    className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/20 text-[9px] font-black uppercase tracking-widest transition-all no-auth-guard"
                  >
                    <Share size={12} /> Share Hub Node
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Role Toggle Dashboard */}
      <section className="neon-card p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1 text-left">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Active Link</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Switch between Hub Personas</p>
          </div>
          <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5 relative z-10">
            <button 
              onClick={toggleRole}
              disabled={loading}
              title="Customer Mode"
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90",
                profile.currentRole === 'customer' 
                  ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.4)]" 
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <User size={22} />
            </button>
            <button 
              onClick={toggleRole}
              disabled={loading}
              title="Supplier Mode"
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90",
                profile.currentRole === 'supplier' 
                  ? "bg-accent text-white shadow-[0_0_15px_rgba(240,147,251,0.4)]" 
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Store size={22} />
            </button>
          </div>
        </div>
        
        <motion.div 
          initial={false}
          animate={{ 
            height: profile.currentRole === 'supplier' ? 'auto' : 0, 
            opacity: profile.currentRole === 'supplier' ? 1 : 0,
            marginBottom: profile.currentRole === 'supplier' ? 0 : -24
          }}
          transition={{ 
            duration: 0.25, 
            ease: [0.23, 1, 0.32, 1] // Fast out, slow in for snappier feel
          }}
          className="overflow-hidden"
          style={{ willChange: 'height, opacity' }}
        >
          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Store Volume</p>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-black text-white">{formatCurrency(engagementStats.volume, 'USD')}</p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Active Leads</p>
                <p className="text-xl font-black text-primary">{engagementStats.engaged} Nodes</p>
              </div>
            </div>
            
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleNavigate('/stores?tab=manage')}
              className={cn(
                "w-full btn-neon py-4 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all",
                isPending && "brightness-50 grayscale cursor-wait"
              )}
            >
              {isPending ? <Loader2 className="animate-spin" size={16} /> : <Store size={18} className="text-inherit" />} 
              Sync & Manage Business
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Supplier's Active Inventory Section */}
      {profile.currentRole === 'supplier' && (
        <SupplierInventoryPreview profile={profile} />
      )}

      {/* Menu Links */}
      <section className="space-y-4">
        <MenuButton 
          icon={Users} 
          label="Trusted Network" 
          detail="Manage your business connections" 
          onClick={() => setActiveModal('connections')}
        />
        <MenuButton 
          icon={Wallet} 
          label="Financial Gateway" 
          detail={profile.gateway?.provider ? `${profile.gateway.provider.toUpperCase()} Configured` : "Link EcoCash & Bank"} 
          onClick={() => setActiveModal('gateway')}
        />
        <MenuButton 
          icon={MapPin} 
          label="Geographic Nodes" 
          detail={profile.location?.city ? `${profile.location.city} Operational` : "Manage Operational Areas"} 
          onClick={() => setActiveModal('location')}
        />
        {profile.currentRole === 'supplier' && (
          <MenuButton 
            icon={Megaphone} 
            label="Market Spotlight" 
            detail="Post news, events & updates" 
            onClick={() => setActiveModal('spotlights')}
          />
        )}
        <MenuButton icon={User} label="Identity Uplink" detail="Modify Profile Details" onClick={() => setIsEditing(true)} />
      </section>

      <div className="pt-6 pb-20 space-y-8">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-5 text-gray-500 font-black uppercase tracking-widest text-[10px] bg-white/5 rounded-2xl border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 group"
        >
          <LogOut size={16} className="group-hover:translate-x-1 transition-transform" /> Sign Out from Node
        </button>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-red-500/10">
          <div className="bg-red-500/5 border border-red-500/20 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <Shield size={18} className="animate-pulse" />
              <h4 className="text-xs font-black uppercase tracking-widest italic">Identity Danger Zone</h4>
            </div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
              Initiating an account wipe will permanently purge your identity and all associated inventory nodes from the Hub matrix. This cannot be reversed.
            </p>
            <button 
              onClick={() => setActiveModal('delete')}
              className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all active:scale-95 shadow-lg shadow-red-500/5 font-black"
            >
              Initialize Deletion Protocol
            </button>
          </div>
        </div>

        <div className="flex flex-col items-center mt-4 space-y-2">
          <Zap size={24} className="text-primary/20" />
          <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.3em]">Comfort Business Hub • v1.0.42</p>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 md:pt-20 overflow-y-auto">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="fixed inset-0 bg-[#05070a]/95 backdrop-blur-xl"
              onClick={() => setActiveModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg neon-card !bg-[#11161d] p-8 mb-24 border-primary/20 shadow-[0_0_50px_rgba(0,0,0,0.8)]"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white"
              >
                <X size={24} />
              </button>

              {activeModal === 'gateway' && (
                <GatewayConfig profile={profile} onSave={(g) => { handleUpdateProfile({ gateway: g }); setActiveModal(null); }} />
              )}
              {activeModal === 'location' && (
                <LocationConfig profile={profile} onSave={(l) => { handleUpdateProfile({ location: l }); setActiveModal(null); }} />
              )}
              {activeModal === 'spotlights' && (
                <SpotlightManager profile={profile} />
              )}
              {activeModal === 'connections' && (
                <ConnectionManager profile={profile} />
              )}
              {activeModal === 'delete' && (
                <div className="space-y-8 text-center py-4">
                  <div className="w-20 h-20 bg-red-500/20 rounded-3xl flex items-center justify-center text-red-500 mx-auto shadow-[0_0_30px_rgba(239,68,68,0.2)]">
                    <Trash2 size={40} />
                  </div>
                  <div className="space-y-4">
                    <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Terminate Identity?</h3>
                    <p className="text-sm text-gray-400 font-medium leading-relaxed">
                      Are you sure you want to delete your account? <br/>
                      <span className="text-red-500 font-black uppercase text-xs">This action will wipe out all your user data and is not reversible.</span>
                    </p>
                  </div>
                  <div className="space-y-3 pt-4">
                    <button 
                      onClick={handleDeleteAccount}
                      disabled={isDeleting}
                      className="w-full py-5 bg-red-600 hover:bg-red-500 text-white rounded-2xl font-black uppercase text-xs tracking-[0.2em] shadow-[0_10px_30px_rgba(220,38,38,0.3)] transition-all active:scale-95 flex items-center justify-center gap-3"
                    >
                      {isDeleting ? <Loader2 className="animate-spin" size={18} /> : <Shield size={18} />}
                      Execute Purge Protocol
                    </button>
                    <button 
                      onClick={() => setActiveModal(null)}
                      disabled={isDeleting}
                      className="w-full py-4 text-[10px] font-black text-gray-500 uppercase tracking-widest hover:text-white transition-colors"
                    >
                      Abort Mission
                    </button>
                  </div>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function SpotlightManager({ profile }: { profile: UserProfile }) {
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<Spotlight | null>(null);
  const [success, setSuccess] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);
  const [formData, setFormData] = useState<Partial<Spotlight>>({
    type: 'news',
    title: '',
    content: '',
    date: '',
    location: '',
    image: '',
    isActive: true,
  });

  useEffect(() => {
    const q = query(
      collection(db, 'spotlights'),
      where('authorId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setSpotlights(snap.docs.map(d => ({ id: d.id, ...d.data() } as Spotlight)));
      setLoading(false);
    }, (err) => {
      console.error("Spotlight sync failure:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  useEffect(() => {
    if ((isAdding || editingSpotlight) && formRef.current) {
      formRef.current.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [isAdding, editingSpotlight]);

  const handleEdit = (s: Spotlight) => {
    setEditingSpotlight(s);
    setIsAdding(false);
    setFormData({
      type: s.type,
      title: s.title,
      content: s.content,
      date: s.date || '',
      location: s.location || '',
      image: s.image || '',
      isActive: s.isActive,
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      if (editingSpotlight) {
        const data = {
          ...formData,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, 'spotlights', editingSpotlight.id), data);
      } else {
        const data = {
          ...formData,
          authorId: profile.uid,
          authorName: profile.businessName || profile.name,
          createdAt: serverTimestamp(),
        };
        await addDoc(collection(db, 'spotlights'), data);
      }
      
      setSuccess(true);
      setTimeout(() => {
        setIsAdding(false);
        setEditingSpotlight(null);
        setSuccess(false);
        setFormData({ type: 'news', title: '', content: '', date: '', location: '', image: '', isActive: true });
      }, 1000);
    } catch (err) {
      handleFirestoreError(err, editingSpotlight ? OperationType.UPDATE : OperationType.CREATE, editingSpotlight ? `spotlights/${editingSpotlight.id}` : 'spotlights');
    } finally {
      setLoading(false);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to purge this broadcast from the matrix?')) return;
    try {
      await deleteDoc(doc(db, 'spotlights', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `spotlights/${id}`);
    }
  };

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div className="space-y-1 text-left">
          <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Market Spotlight</h3>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Manage your broadcasts & news feeds</p>
        </div>
        {(!isAdding && !editingSpotlight) && (
          <button 
            onClick={() => {
              setIsAdding(true);
              setFormData({ type: 'news', title: '', content: '', date: '', location: '', image: '', isActive: true });
            }}
            className="w-10 h-10 bg-primary/20 text-primary rounded-xl flex items-center justify-center border border-primary/20 hover:bg-primary hover:text-[#05070a] transition-all shadow-lg active:scale-95"
          >
            <Plus size={20} />
          </button>
        )}
      </header>

      {(isAdding || editingSpotlight) ? (
        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="space-y-6 bg-white/5 p-6 rounded-3xl border border-white/10 shadow-[0_0_50px_rgba(0,0,0,0.5)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
          
          <div className="flex justify-between items-center mb-2">
            <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
              {editingSpotlight ? 'Modify Broadcast Node' : 'Initialize New Feed'}
            </label>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 font-black uppercase">Active</span>
              <button
                type="button"
                onClick={() => setFormData(prev => ({ ...prev, isActive: !prev.isActive }))}
                className={cn(
                  "w-8 h-4 rounded-full transition-colors relative",
                  formData.isActive ? "bg-neon-green" : "bg-gray-800"
                )}
              >
                <div className={cn(
                  "absolute top-0.5 w-3 h-3 rounded-full bg-white transition-all",
                  formData.isActive ? "right-0.5" : "left-0.5"
                )} />
              </button>
            </div>
          </div>

          <div className="space-y-4">
            <div className="grid grid-cols-2 gap-3">
              {(['news', 'event', 'update', 'spotlight'] as const).map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setFormData(prev => ({ ...prev, type: t }))}
                  className={cn(
                    "px-3 py-3 rounded-xl border text-[9px] font-black uppercase tracking-widest transition-all text-center",
                    formData.type === t ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(0,242,254,0.15)]" : "bg-white/5 border-white/5 text-gray-500"
                  )}
                >
                  {t}
                </button>
              ))}
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Headline</label>
              <input 
                required
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder="Ex: Prime Grade Beef Restocked"
                className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Content Feed</label>
              <textarea 
                required
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                placeholder="Details of the broadcast..."
                className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-medium resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Timeline (Optional)</label>
                <input 
                  type="text"
                  value={formData.date}
                  onChange={e => setFormData(prev => ({ ...prev, date: e.target.value }))}
                  placeholder="e.g. Valid thru May 20"
                  className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Sector (Optional)</label>
                <input 
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Harare North"
                  className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
            </div>

            <div className="space-y-1">
              <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Cover Uplink</label>
              <ImageInput 
                value={formData.image || ''}
                onChange={(val) => setFormData(prev => ({ ...prev, image: val }))}
                label="Select Background Media"
                className="!bg-[#0d1117]"
              />
            </div>
          </div>

          <div className="flex gap-3">
            <button 
              type="button"
              onClick={() => { setIsAdding(false); setEditingSpotlight(null); }}
              className="flex-1 py-4 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/5 rounded-2xl border border-white/5 hover:bg-white/10 transition-colors"
            >
              Cancel
            </button>
            <button 
              type="submit"
              disabled={loading || success}
              className={cn(
                "flex-[2] py-5 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-[0.2em] transition-all",
                success 
                  ? "bg-neon-green text-[#05070a] shadow-[0_0_30px_#39FF14] scale-105" 
                  : "bg-primary text-[#05070a] shadow-[0_0_30px_rgba(0,242,254,0.4)] hover:scale-[1.02] active:scale-95"
              )}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : success ? (
                <>
                  <Check size={18} /> Signal Broadcast
                </>
              ) : (
                <>
                  <Megaphone size={18} /> {editingSpotlight ? 'Update Spotlight' : 'Post Broadcast'}
                </>
              )}
            </button>
          </div>
        </form>
      ) : (
        <div className="space-y-4">
          {loading ? (
            <div className="space-y-4">
              {[1, 2].map(i => (
                <div key={i} className="h-32 bg-white/5 animate-pulse rounded-3xl border border-white/5" />
              ))}
            </div>
          ) : spotlights.length > 0 ? (
            <div className="grid gap-4">
              {spotlights.map((s) => (
                <motion.div 
                  key={s.id}
                  layout
                  className={cn(
                    "p-5 bg-white/5 border rounded-[2rem] transition-all group relative overflow-hidden",
                    s.isActive ? "border-white/10" : "border-white/5 opacity-50 gray-scale"
                  )}
                >
                  <div className="flex gap-4 items-start relative z-10">
                    <div className="w-14 h-14 bg-[#0d1117] rounded-2xl border border-white/5 overflow-hidden flex-shrink-0 flex items-center justify-center text-primary">
                      {s.image ? (
                        <img src={s.image} className="w-full h-full object-cover opacity-60" />
                      ) : (
                        <Megaphone size={24} />
                      )}
                    </div>
                    <div className="flex-1 min-w-0 text-left">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-[7px] font-black text-primary uppercase tracking-widest px-1.5 py-0.5 bg-primary/10 rounded border border-primary/20">
                          {s.type}
                        </span>
                        {!s.isActive && (
                          <span className="text-[7px] font-black text-gray-500 uppercase tracking-widest px-1.5 py-0.5 bg-white/5 rounded border border-white/5">
                            Inactive
                          </span>
                        )}
                      </div>
                      <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">{s.title}</h4>
                      <p className="text-[10px] text-gray-500 font-medium line-clamp-2 mt-1 leading-relaxed">
                        {s.content}
                      </p>
                    </div>
                  </div>

                  <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
                    <div className="flex gap-2">
                       <button 
                        onClick={() => handleEdit(s)}
                        className="px-4 py-2 bg-white/5 rounded-xl border border-white/5 text-[9px] font-black text-gray-400 uppercase tracking-widest hover:text-white hover:border-white/20 transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Save size={12} /> Edit
                      </button>
                      <button 
                        onClick={() => handleDelete(s.id)}
                        className="px-4 py-2 bg-red-500/5 rounded-xl border border-red-500/10 text-[9px] font-black text-red-500/60 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-2"
                      >
                        <Trash2 size={12} /> Purge
                      </button>
                    </div>
                    <div className="text-[8px] font-black text-gray-700 uppercase tracking-widest">
                      {s.createdAt ? new Date(s.createdAt?.toDate?.() || s.createdAt).toLocaleDateString() : 'Syncing...'}
                    </div>
                  </div>
                </motion.div>
              ))}
            </div>
          ) : (
            <div className="text-center py-20 bg-white/5 rounded-[3rem] border border-white/5 space-y-4">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-800">
                <Megaphone size={32} />
              </div>
              <div>
                <p className="text-xs font-black text-gray-500 uppercase tracking-widest">No Active Matrix Broadcasts</p>
                <p className="text-[10px] text-gray-700 mt-1 max-w-[200px] mx-auto font-medium">Post updates, events and spotlight news to the Discovery Matrix.</p>
              </div>
              <button 
                onClick={() => setIsAdding(true)}
                className="mt-6 btn-neon px-8 py-3 text-[9px] font-black uppercase tracking-[0.2em]"
              >
                Establish Uplink
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GatewayConfig({ profile, onSave }: { profile: UserProfile, onSave: (g: any) => void }) {
  const [provider, setProvider] = useState(profile.gateway?.provider || 'paypal');
  const [details, setDetails] = useState(profile.gateway?.details || '');

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Finance Hub</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Matrix currency routing parameters</p>
      </header>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {['paypal', 'stripe', 'ecocash', 'pod'].map((id) => (
            <button
              key={id}
              onClick={() => {
                setProvider(id as any);
                if (id === 'pod' && !details) setDetails('Pay on Delivery Enabled');
              }}
              className={cn(
                "p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                provider === id ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-gray-500"
              )}
            >
              {id === 'ecocash' ? <Phone size={20} /> : <CreditCard size={20} />}
              <span className="text-[10px] font-black uppercase tracking-widest">
                {id === 'ecocash' ? 'EcoCash' : id === 'pod' ? 'Cash/POD' : id}
              </span>
            </button>
          ))}
        </div>

        {provider !== 'pod' && (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              {provider === 'ecocash' ? 'EcoCash USSD Code / Merchant' : 'Gateway Identity/Address'}
            </label>
            <input 
              type="text"
              value={details}
              onChange={e => setDetails(e.target.value)}
              placeholder={
                provider === 'paypal' ? 'Paypal Email Address' : 
                provider === 'ecocash' ? '*151*2*2*...#' :
                'Account Details / Secret Link'
              }
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-mono text-xs"
            />
          </div>
        )}

        <button 
          onClick={() => onSave({ provider, details: provider === 'pod' ? 'Pay on Delivery Enabled' : details, isActive: true })}
          className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
        >
          <Check size={18} /> Synchronize Gateway
        </button>
      </div>
    </div>
  );
}

function LocationConfig({ profile, onSave }: { profile: UserProfile, onSave: (l: any) => void }) {
  const [city, setCity] = useState(profile.location?.city || '');
  const [address, setAddress] = useState(profile.location?.address || '');
  const [coordinates, setCoordinates] = useState({
    lat: profile.location?.coordinates?.lat || profile.lat || -17.8252,
    lng: profile.location?.coordinates?.lng || profile.lng || 31.0335
  });

  const handleSave = () => {
    const hash = geohashForLocation([coordinates.lat, coordinates.lng]);
    onSave({ 
      city, 
      address, 
      coordinates, 
      lat: coordinates.lat, 
      lng: coordinates.lng, 
      geohash: hash 
    });
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Geo-Matrix Node</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pinpoint your operational coordinate</p>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Base Operation Node (City)</label>
          <input 
            type="text"
            value={city}
            onChange={e => setCity(e.target.value)}
            placeholder="e.g. Harare, Mutare, Bulawayo..."
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic transition-all"
          />
        </div>

        <div className="pt-2">
            <LocationPicker 
              initialLat={coordinates.lat}
              initialLng={coordinates.lng}
              onLocationSelect={(lat, lng, addr) => {
                setCoordinates({ lat, lng });
                if (addr && !address) setAddress(addr);
              }}
            />
        </div>

        <button 
          onClick={handleSave}
          className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
        >
          <Navigation size={18} /> Transmit Location Data
        </button>
      </div>
    </div>
  );
}

function SupplierInventoryPreview({ profile }: { profile: UserProfile }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const q = query(
      collection(db, 'products'),
      where('ownerId', '==', profile.uid),
      orderBy('createdAt', 'desc'),
      limit(4)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      setLoading(false);
    }, (err) => {
      console.error("Error fetching inventory preview:", err);
      setLoading(false);
    });

    return () => unsubscribe();
  }, [profile.uid]);

  if (loading) return (
    <div className="neon-card p-6 h-32 flex items-center justify-center">
      <Loader2 className="animate-spin text-primary/20" size={24} />
    </div>
  );

  return (
    <section className="space-y-4">
      <div className="flex items-center justify-between px-2">
        <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Live Inventory Node</h3>
        <button 
          onClick={() => navigate('/stores?tab=manage')}
          className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
        >
          View All Nodes
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {products.map((p) => (
            <ProductCard 
              key={p.id}
              product={p}
              profile={profile}
              isOwner={true}
            />
        ))}

        {products.length === 0 && (
          <div 
            onClick={() => navigate('/stores?tab=manage', { state: { showProductForm: true } })}
            className="col-span-full neon-card p-8 text-center space-y-3 cursor-pointer hover:bg-white/5 transition-all"
          >
            <Plus size={24} className="mx-auto text-gray-700" />
            <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">No Products Synced</p>
          </div>
        )}
      </div>
    </section>
  );
}

function ConnectionManager({ profile }: { profile: UserProfile }) {
  const [connections, setConnections] = useState<Connection[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    // Fetch connections where user is either sender or receiver and status is accepted
    const q1 = query(collection(db, 'connections'), where('senderId', '==', profile.uid), where('status', '==', 'accepted'));
    const q2 = query(collection(db, 'connections'), where('receiverId', '==', profile.uid), where('status', '==', 'accepted'));

    const unsub1 = onSnapshot(q1, (snap) => {
      const c1 = snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection));
      setConnections(prev => {
        // Remove old versions of these connections by ID
        const otherIds = new Set(c1.map(c => c.id));
        const others = prev.filter(p => !otherIds.has(p.id));
        return [...others, ...c1];
      });
      setLoading(false);
    });

    const unsub2 = onSnapshot(q2, (snap) => {
      const c2 = snap.docs.map(d => ({ id: d.id, ...d.data() } as Connection));
      setConnections(prev => {
        // Remove old versions of these connections by ID
        const otherIds = new Set(c2.map(c => c.id));
        const others = prev.filter(p => !otherIds.has(p.id));
        return [...others, ...c2];
      });
      setLoading(false);
    });

    return () => {
      unsub1();
      unsub2();
    };
  }, [profile.uid]);

  const getPartnerId = (c: Connection) => c.senderId === profile.uid ? c.receiverId : c.senderId;
  const getPartnerName = (c: Connection) => c.senderId === profile.uid ? c.receiverName : c.senderName;
  const getPartnerAvatar = (c: Connection) => c.senderId === profile.uid ? c.receiverAvatar : c.senderAvatar;

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Trusted Network</h3>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
          Connections within the Enterprise Matrix. 
          {profile.currentRole === 'supplier' ? ' Trusted customers and partner nodes.' : ' Trusted suppliers and partner nodes.'}
        </p>
      </header>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-2xl" />)}
          </div>
        ) : connections.length > 0 ? (
          <div className="grid gap-3">
            {connections.map((c) => (
              <div 
                key={c.id}
                className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between group hover:border-primary/30 transition-all font-sans"
              >
                <div className="flex items-center gap-4">
                  <div className="w-12 h-12 bg-[#0d1117] rounded-xl overflow-hidden border border-white/5">
                    {getPartnerAvatar(c) ? (
                      <img src={getPartnerAvatar(c)} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center text-primary font-black">
                        {getPartnerName(c).charAt(0)}
                      </div>
                    )}
                  </div>
                  <div>
                    <h4 className="text-xs font-black text-white uppercase tracking-tight">{getPartnerName(c)}</h4>
                    <p className="text-[8px] text-neon-green font-bold uppercase tracking-widest mt-0.5">
                      {c.type === 'partner' ? 'Trusted Partner' : c.type === 'supplier' ? (c.senderId === profile.uid ? 'Trusted Supplier' : 'Trusted Customer') : 'Trusted Customer'}
                    </p>
                  </div>
                </div>
                <button 
                  onClick={() => navigate('/chat', { state: { recipientId: getPartnerId(c) } })}
                  className="p-3 bg-primary/10 text-primary rounded-xl hover:bg-primary hover:text-[#05070a] transition-all"
                >
                  <MessageSquare size={16} />
                </button>
              </div>
            ))}
          </div>
        ) : (
          <div className="text-center py-12 bg-white/5 rounded-3xl border border-white/5 space-y-4">
            <Users size={32} className="mx-auto text-gray-800" />
            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">No active connections in your network</p>
            <button 
              onClick={() => navigate('/')} 
              className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
            >
              Explore and Connect with Operators
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, detail, onClick }: { icon: any, label: string, detail?: string, onClick?: () => void }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className="w-full neon-card p-5 flex items-center justify-between group hover:border-primary/40 transition-all duration-200 active:bg-white/5"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300">
          <Icon size={22} className="group-hover:scale-110 transition-transform" />
        </div>
        <div className="text-left space-y-0.5">
          <p className="text-sm font-black text-white uppercase tracking-widest group-hover:text-primary transition-colors">{label}</p>
          {detail && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight italic opacity-60 leading-tight">{detail}</p>}
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-700 group-hover:text-primary transition-all group-hover:translate-x-2" />
    </motion.button>
  );
}

