import React, { useState, useTransition, useEffect, useRef } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Store, Phone, MapPin, Shield, LogOut, ChevronRight, Wallet, 
  Bell, Zap, Image as ImageIcon, X, Check, CheckCircle, CreditCard, 
  Navigation, Crosshair, Save, Loader2, Megaphone, Trash2, Calendar, FileText, Plus, Users, MessageSquare, Share, RefreshCw, Download
, Network, ExternalLink, Fingerprint, Compass, BellRing, Clock, Tag, Flame, Sparkles, DollarSign, Layers, MessageCircle, MapPinned, Landmark, Star, Video } from 'lucide-react';
import BiometricAuthModal from '../components/BiometricAuthModal';
import AppTutorialModal from '../components/AppTutorialModal';
import PushNotificationSettingsModal from '../components/PushNotificationSettingsModal';
import { UserProfile, Role, Spotlight, Product, Connection } from '../types';
import { auth, db, handleFirestoreError, OperationType, syncPublicProfile } from '../lib/firebase';
import { localDB } from '../lib/db';
import { offlineResilientWrite } from '../lib/sync';
import { geohashForLocation } from 'geofire-common';
import { doc, updateDoc, collection, addDoc, query, where, getDocs, deleteDoc, orderBy, serverTimestamp, limit, onSnapshot , getCountFromServer } from 'firebase/firestore';
import { cn, formatCurrency } from '../lib/utils';
import { useNotifications } from '../components/NotificationProvider';
import { interactionService } from '../services/interactionService';
import ImageInput from '../components/ImageInput';
import VideoInput from '../components/VideoInput';
import LocationPicker from '../components/LocationPicker';
import ProductCard from '../components/ProductCard';
import AuthGuard from '../components/AuthGuard';
import UserListModal from '../components/UserListModal';

export default function Profile({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const { id: routeId } = useParams<{ id?: string }>();
  const [observedProfile, setObservedProfile] = useState<UserProfile | null>(null);
  const [observedStores, setObservedStores] = useState<any[]>([]);
  const [loadingObserved, setLoadingObserved] = useState(false);
  const isObserved = !!routeId && routeId !== profile?.uid;

  const { triggerFeedback } = useNotifications();
  const [isEditing, setIsEditing] = useState(false);
  const [userCount, setUserCount] = useState<number | null>(null);
  const [displayedUsers, setDisplayedUsers] = useState<any[]>([]);
  const [isUserListOpen, setIsUserListOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'gateway' | 'location' | 'spotlights' | 'delete' | 'connections' | 'notifications' | null>(null);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isBiometricModalOpen, setIsBiometricModalOpen] = useState(false);
  const [showTutorialModal, setShowTutorialModal] = useState(false);
  const [showPushModal, setShowPushModal] = useState(false);
  const [editData, setEditData] = useState<Partial<UserProfile>>({});
  const [engagementStats, setEngagementStats] = useState({ engaged: 0, volume: 0 });
  const [myStores, setMyStores] = useState<any[]>([]);
  const modalContainerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    // Whenever an item is clicked in Profile (modal opened, edit mode toggled, biometric modal or user list opened)
    window.scrollTo(0, 0);
    const main = document.querySelector('main');
    if (main) {
      main.scrollTo(0, 0);
      main.scrollTop = 0;
    }
    if (modalContainerRef.current) {
      modalContainerRef.current.scrollTo(0, 0);
      modalContainerRef.current.scrollTop = 0;
    }
    const scrollableOverlays = document.querySelectorAll('.fixed .overflow-y-auto, .fixed.overflow-y-auto');
    scrollableOverlays.forEach((el) => {
      el.scrollTo(0, 0);
      el.scrollTop = 0;
    });
  }, [activeModal, isEditing, isBiometricModalOpen, isUserListOpen, routeId]);

  useEffect(() => {
    let isMounted = true;
    const fetchUserCount = async () => {
      try {
        const snapshot = await getCountFromServer(collection(db, 'public_profiles'));
        if (isMounted) setUserCount(snapshot.data().count);
        const usersSnap = await getDocs(query(collection(db, 'public_profiles'), limit(10)));
        if (isMounted) setDisplayedUsers(usersSnap.docs.map(d => ({ uid: d.id, ...d.data() } as any)));
      } catch (err) {
        if (isMounted) {
          console.warn("Signal: User count temporarily unavailable.");
          setUserCount(null);
        }
      }
    };
    fetchUserCount();
    return () => { isMounted = false; };
  }, []);

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

    // Real-time Store performance listener for Supplier
    const qStores = query(collection(db, 'stores'), where('ownerId', '==', profile.uid));
    const unsubStores = onSnapshot(qStores, (snap) => {
      const items = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      setMyStores(items);
    });

    return () => {
      unsub();
      unsubStores();
    };
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

  const handleForceRefresh = async () => {
    try {
      await localDB.outbox.clear();
      triggerFeedback('Sync Terminated', 'All background data tasks cleared. Refreshing system...', 'engage');
      setTimeout(() => {
        window.location.reload();
      }, 1000);
    } catch (e) {
      console.error(e);
      window.location.reload();
    }
  };

  const handleDownloadData = () => {
    const data = JSON.stringify(profile, null, 2);
    const blob = new Blob([data], { type: 'text/plain' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'my-information.txt';
    a.click();
    URL.revokeObjectURL(url);
  };
  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const handleDeleteAccount = async () => {
    if (!profile || !auth.currentUser) return;
    
    // Immediate UI feedback and lock
    setIsDeleting(true);
    triggerFeedback('Deleting your account...', 'Removing all your data...', 'engage');

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
            console.error(`Conversation delete failure (${convoDoc.id}):`, err);
          }
        }));
      } catch (e) {
        console.error("Deep message traversal failed:", e);
      }

      // 3. Final Identity Node Deletion (Root User Entry)
      try {
        await deleteDoc(doc(db, 'users', uid));
      } catch (e) {
        console.error("Failed to delete root account:", e);
      }

      // 4. Auth Account Removal
      try {
        // Attempt deep deletion - this might require fresh login
        await auth.currentUser.delete();
      } catch (authErr) {
        console.warn("Auth deletion deferred (re-auth required), signing out for safety.");
      }
      
      // 5. Hard Reset & Redirection
      triggerFeedback('Account Deleted', 'All your data has been permanently removed.', 'engage');
      
      // Clear local state immediately
      setProfile(null as any);
      await auth.signOut();
      
      // Navigate and force sync
      navigate('/login', { replace: true });
      setTimeout(() => window.location.reload(), 500); 
    } catch (e) {
      console.error("TOTAL ACCOUNT DELETION FAILURE:", e);
      triggerFeedback('Account Deletion Error', "Something went wrong on our end. We're retrying automatically.", 'engage');
      
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
    
    if (document.querySelectorAll('[data-uploading="true"]').length > 0) {
      alert("Please wait for your images to finish saving before saving.");
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
          title: profile?.name || 'User Profile',
          text: `Check out ${profile?.name || 'User Profile'}'s profile on Comfort Business Hub!`,
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
        <p className="text-xs font-black text-gray-500 uppercase tracking-[0.2em] animate-pulse">Loading public profile...</p>
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
              This user could not be found. They may have deleted their account.
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
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">User ID: {observedProfile.uid.slice(0, 8)}</p>
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
                    <Share size={12} /> Share Profile
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
            <h3 className="text-sm font-black text-white uppercase tracking-widest text-center">Your Stores</h3>
            
            {observedStores.length === 0 ? (
              <div className="text-center p-8 bg-white/5 rounded-3xl border border-white/5 space-y-2">
                <p className="text-xs font-black text-gray-400 uppercase tracking-wider">No Storefronts Active</p>
                <p className="text-[10px] text-gray-500 leading-relaxed font-bold uppercase tracking-widest">This supplier does not have any active marketplaces listed currently.</p>
              </div>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                {Array.from(new Map(observedStores.filter(s => s && s.id).map(s => [s.id, s])).values()).map((store, idx) => (
                  <div 
                    key={`prof-obs-store-${store.id || idx}-${idx}`}
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
                  <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em] ml-1">Profile Picture</label>
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
                <div className="space-y-1">
                  <label className="text-[10px] font-black text-emerald-400 uppercase tracking-widest text-left block ml-1">Preferred WhatsApp Uplink Number</label>
                  <input 
                    type="tel"
                    value={editData.whatsappNumber ?? profile.whatsappNumber ?? profile.phone ?? ''}
                    onChange={e => setEditData(prev => ({ ...prev, whatsappNumber: e.target.value }))}
                    placeholder="e.g. 263771234567"
                    className="w-full bg-white/5 border border-emerald-500/30 rounded-2xl px-5 py-4 text-emerald-300 outline-none focus:border-emerald-400 font-mono transition-all"
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
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest">Profile ID: {profile.uid.slice(0, 8)}</p>
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
                <div className="flex flex-wrap justify-center gap-2">
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
                    <Share size={12} /> Share Profile
                  </button>
                  <button 
                    onClick={() => setShowTutorialModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl border border-primary/30 text-[9px] font-black uppercase tracking-widest transition-all shadow-[0_0_12px_rgba(0,242,254,0.15)]"
                  >
                    <Compass size={12} className="animate-spin-slow" /> How To Navigate
                  </button>
                  <button 
                    onClick={() => setShowPushModal(true)}
                    className="flex items-center gap-2 px-3 py-2 bg-neon-green/10 hover:bg-neon-green/20 text-neon-green rounded-xl border border-neon-green/30 text-[9px] font-black uppercase tracking-widest transition-all shadow-[0_0_12px_rgba(57,255,20,0.15)]"
                  >
                    <BellRing size={12} /> Push Alert Protocol
                  </button>
                </div>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Active Link & Neural Member Network (Horizontally aligned on desktop) */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6 items-stretch">
        {/* Role Toggle Dashboard */}
        <section className="neon-card p-8 relative overflow-hidden group flex flex-col justify-between">
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all pointer-events-none"></div>
          
          <div>
            <div className="flex items-center justify-between mb-8">
              <div className="space-y-1 text-left">
                <h3 className="text-sm font-black text-white uppercase tracking-widest">Active Link</h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Switch Account Type</p>
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
                    <p className="text-xl font-black text-primary">{engagementStats.engaged} Connections</p>
                  </div>
                </div>

                {myStores.length > 0 && (
                  <div className="space-y-3 pt-2">
                    <p className="text-[9px] text-gray-400 font-black uppercase tracking-widest text-left">Store Performance Stats</p>
                    {myStores.map((st, idx) => (
                      <div key={`my-store-${st.id || idx}-${idx}`} className="bg-white/5 p-4 rounded-2xl border border-white/10 space-y-3 text-left">
                        <div className="flex justify-between items-center border-b border-white/5 pb-2">
                          <span className="text-xs font-black text-white italic uppercase">{st.name}</span>
                          <span className="text-[8px] font-black uppercase text-emerald-400 bg-emerald-500/10 px-2 py-0.5 rounded border border-emerald-500/20">Active Store</span>
                        </div>
                        <div className="grid grid-cols-3 gap-2">
                          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <p className="text-[7.5px] text-gray-400 font-bold uppercase tracking-wider">Order Clicks</p>
                            <p className="text-sm font-black text-cyan-400 mt-0.5">{st.orderClicks || 0}</p>
                          </div>
                          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <p className="text-[7.5px] text-gray-400 font-bold uppercase tracking-wider">WhatsApp Clicks</p>
                            <p className="text-sm font-black text-emerald-400 mt-0.5">{st.whatsappClicks || 0}</p>
                          </div>
                          <div className="bg-black/30 p-2.5 rounded-xl border border-white/5">
                            <p className="text-[7.5px] text-gray-400 font-bold uppercase tracking-wider">Est. Sales (USD)</p>
                            <p className="text-sm font-black text-primary mt-0.5">{formatCurrency(st.estimatedSalesUsd || 0, 'USD')}</p>
                          </div>
                        </div>
                      </div>
                    ))}
                    <p className="text-[8px] text-gray-400 italic font-medium leading-relaxed bg-white/5 p-2.5 rounded-xl border border-white/5 text-left">
                      Note: This is an estimated sales calculation based on checkout interactions and WhatsApp engagements. Actual sales volume may be higher or lower.
                    </p>
                  </div>
                )}
                
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
          </div>
        </section>

        {/* Neural Member Network */}
        <section className="neon-card p-6 relative overflow-hidden flex flex-col justify-between space-y-6">
          <div className="flex items-center justify-between px-1">
            <div className="flex items-center gap-2 sm:gap-3">
              <div className="w-1 h-5 sm:w-1.5 sm:h-6 bg-primary rounded-full shadow-[0_0_10px_rgba(0,242,254,0.5)]" />
              <div className="space-y-0.5">
                <h2 className="text-[10px] sm:text-xs font-black text-white uppercase tracking-[0.15em] sm:tracking-[0.2em] italic">Neural Member Network</h2>
                <p className="text-[7px] sm:text-[8px] text-gray-500 font-bold uppercase tracking-widest leading-none">
                  <span className="text-primary font-black">{userCount || '0'}</span> users
                </p>
              </div>
            </div>
            <div className="flex items-center gap-2">
              <AuthGuard 
                title="View Restricted" 
                message="Join the Network Hub to browse all signed in users."
                profile={profile}
              >
                <button 
                  onClick={() => setIsUserListOpen(true)}
                  className="text-[8px] sm:text-[9px] font-black text-primary uppercase tracking-widest hover:text-white transition-colors flex items-center gap-1.5 sm:gap-2 bg-primary/5 py-1.5 px-3 rounded-full border border-primary/10"
                >
                  Directory <ExternalLink size={8} />
                </button>
              </AuthGuard>
            </div>
          </div>
          <div className="flex gap-4 overflow-x-auto pb-4 pt-2 -mx-2 px-2 custom-scrollbar snap-x no-scrollbar">
            {Array.from(new Map(displayedUsers.filter(u => u && u.uid).map(u => [u.uid, u])).values()).map((user, idx) => (
              <div key={`prof-user-${user.uid || idx}-${idx}`} className="contents">
                <AuthGuard 
                  title="View Partner Profile"
                  message="Enter the Hub network to connect with registered partners and view tactical intelligence."
                  profile={profile}
                >
                  <motion.div
                    whileHover={{ y: -5, scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                    onClick={() => handleNavigate(`/profile/${user.uid}`)}
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
              title="View All Members" 
              message="Sign in to explore the complete member directory."
              profile={profile}
            >
              <motion.div
                whileHover={{ scale: 1.02 }}
                onClick={() => setIsUserListOpen(true)}
                className="flex-shrink-0 w-36 bg-primary/5 border border-primary/10 rounded-[2rem] p-4 flex flex-col items-center justify-center text-center space-y-3 cursor-pointer group hover:bg-primary/10 transition-all snap-start border-dashed"
              >
                <div className="w-12 h-12 rounded-full bg-primary/20 flex items-center justify-center text-primary">
                  <Users size={20} />
                </div>
                <div className="space-y-1">
                  <p className="text-[9px] font-black text-primary uppercase tracking-widest">All Members</p>
                  <p className="text-[7px] text-gray-500 font-bold uppercase tracking-widest leading-tight">Connect with {userCount || 'All'} Members</p>
                </div>
              </motion.div>
            </AuthGuard>
          </div>
        </section>
      </div>

      {/* Block 2: 4 Menu Cards (Trusted Networks, Financial Gateway, Geographical Connections, Market Spotlight) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
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
          label="Geographic Connections" 
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
      </section>

      {/* Block 3: 4 Menu Cards (My Profile, Biometric Vault, Notification Settings, My Information) */}
      <section className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
        <MenuButton icon={User} label="My Profile" detail="Modify Profile Details" onClick={() => setIsEditing(true)} />
        <MenuButton 
          icon={Fingerprint} 
          label="Biometric Vault" 
          detail="Touch ID / Face ID Session Unlock" 
          onClick={() => setIsBiometricModalOpen(true)} 
        />
        <MenuButton icon={Bell} label="Notification Settings" detail="Manage your alerts" onClick={() => setActiveModal('notifications')} />
        <MenuButton icon={Download} label="My Information" detail="Download my data" onClick={handleDownloadData} />
      </section>

      {/* Block 4: Supplier's Active Inventory Section */}
      {profile.currentRole === 'supplier' && (
        <SupplierInventoryPreview profile={profile} />
      )}

      {/* Biometric Hardware Vault Modal */}
      <BiometricAuthModal 
        isOpen={isBiometricModalOpen} 
        onClose={() => setIsBiometricModalOpen(false)} 
        profile={profile} 
        mode="settings" 
      />

      <div className="pt-6 pb-20 space-y-4">
        <button 
          onClick={handleForceRefresh}
          className="w-full flex items-center justify-center gap-3 py-5 text-gray-500 font-black uppercase tracking-widest text-[10px] bg-white/5 rounded-2xl border border-white/5 hover:bg-neon-green/10 hover:text-neon-green hover:border-neon-green/30 transition-all active:scale-95 group"
        >
          <RefreshCw size={16} className="group-hover:rotate-180 transition-transform duration-500" /> Refresh the Software
        </button>

        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-5 text-gray-500 font-black uppercase tracking-widest text-[10px] bg-white/5 rounded-2xl border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 group"
        >
          <LogOut size={16} className="group-hover:translate-x-1 transition-transform" /> Sign Out
        </button>

        {/* Danger Zone */}
        <div className="pt-4 border-t border-red-500/10">
          <div className="bg-red-500/5 border border-red-500/20 rounded-[2rem] p-6 space-y-4">
            <div className="flex items-center gap-3 text-red-500">
              <Shield size={18} className="animate-pulse" />
              <h4 className="text-xs font-black uppercase tracking-widest italic">Identity Danger Zone</h4>
            </div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest leading-relaxed">
              Deleting your account will permanently remove all your data. This cannot be undone.
            </p>
            <button 
              onClick={() => setActiveModal('delete')}
              className="w-full py-4 bg-red-500/10 hover:bg-red-500 text-red-500 hover:text-white rounded-2xl text-[10px] font-black uppercase tracking-widest border border-red-500/20 transition-all active:scale-95 shadow-lg shadow-red-500/5 font-black"
            >
              Delete Account
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
          <div ref={modalContainerRef} className="fixed inset-0 z-50 flex items-start justify-center p-4 pt-12 md:pt-20 overflow-y-auto">
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
                <GatewayConfig profile={profile} onSave={(data) => { handleUpdateProfile(data); setActiveModal(null); }} />
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
              {activeModal === 'notifications' && (
                <NotificationSettings profile={profile} onSave={(p) => { handleUpdateProfile(p); setActiveModal(null); }} />
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
                      Delete Account
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
        {isUserListOpen && (
          <UserListModal isOpen={isUserListOpen} onClose={() => setIsUserListOpen(false)} onUserClick={(uid) => { setIsUserListOpen(false); handleNavigate(`/profile/${uid}`); }} />
        )}
        <AppTutorialModal isOpen={showTutorialModal} onClose={() => setShowTutorialModal(false)} />
        <PushNotificationSettingsModal isOpen={showPushModal} onClose={() => setShowPushModal(false)} />
      </AnimatePresence>
    </motion.div>
  );
}

function SpotlightManager({ profile }: { profile: UserProfile }) {
  const { triggerFeedback } = useNotifications();
  const [spotlights, setSpotlights] = useState<Spotlight[]>([]);
  const [loading, setLoading] = useState(true);
  const [isAdding, setIsAdding] = useState(false);
  const [editingSpotlight, setEditingSpotlight] = useState<Spotlight | null>(null);
  const [success, setSuccess] = useState(false);
  const [lastSubmittedIsApproved, setLastSubmittedIsApproved] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  // Form Mode: 'classified' vs 'spotlight'
  const [postMode, setPostMode] = useState<'classified' | 'spotlight'>('classified');
  const [formData, setFormData] = useState<Partial<Spotlight>>({
    type: 'classified',
    title: '',
    content: '',
    date: '',
    location: profile.location?.city || '',
    image: '',
    videoUrl: '',
    isActive: true,
    isClassified: true,
    category: 'Electronics & Tech',
    price: '',
    badge: '🔥 HOT DEAL',
    durationHours: 168, // 7 Days
    contactPhone: profile.phone || '',
    whatsappNumber: profile.phone || '',
    actionUrl: '',
    targetType: 'whatsapp',
    tier: 'featured',
  });

  const CATEGORIES = [
    'Electronics & Tech',
    'Vehicles & Motors',
    'Real Estate & Housing',
    'Services & Repairs',
    'Jobs & Careers',
    'Fashion & Apparel',
    'Agriculture & Fresh Produce',
    'Wholesale & Goods',
    'General Merchandise'
  ];

  const BADGES = [
    '🔥 HOT DEAL',
    '⚡ URGENT SALE',
    '⭐ FEATURED AD',
    '💎 VIP SPOTLIGHT',
    '🎁 SPECIAL PROMO',
    '🏷️ CLEARANCE'
  ];

  const DURATIONS = [
    { hours: 24, label: '⚡ 24 Hours (Flash Ad)' },
    { hours: 72, label: '🔥 3 Days (Spotlight)' },
    { hours: 168, label: '⭐ 7 Days (1 Week)' },
    { hours: 336, label: '🚀 14 Days (2 Weeks)' },
    { hours: 720, label: '💎 30 Days (1 Month)' }
  ];

  useEffect(() => {
    const q = query(
      collection(db, 'spotlights'),
      where('authorId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      const now = new Date();
      const validSpotlights: Spotlight[] = [];

      snap.docs.forEach(d => {
        const item = { id: d.id, ...d.data() } as Spotlight;
        if (item.expiresAt && new Date(item.expiresAt) < now) {
          // Auto delete expired classified ad and video from DB to save space and bandwidth
          deleteDoc(doc(db, 'spotlights', d.id)).catch(console.error);
        } else {
          validSpotlights.push(item);
        }
      });

      setSpotlights(validSpotlights);
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
    const isClass = s.isClassified || s.type === 'classified';
    setPostMode(isClass ? 'classified' : 'spotlight');
    setFormData({
      type: s.type || 'classified',
      title: s.title || '',
      content: s.content || '',
      date: s.date || '',
      location: s.location || profile.location?.city || '',
      image: s.image || '',
      videoUrl: s.videoUrl || '',
      isActive: s.isActive ?? true,
      isClassified: isClass,
      category: s.category || 'Electronics & Tech',
      price: s.price || '',
      badge: s.badge || '🔥 HOT DEAL',
      durationHours: s.durationHours || 168,
      contactPhone: s.contactPhone || profile.phone || '',
      whatsappNumber: s.whatsappNumber || profile.phone || '',
      actionUrl: s.actionUrl || '',
      targetType: s.targetType || 'whatsapp',
      tier: s.tier || 'featured',
    });
  };

  const calculateExpiresAt = (hours: number) => {
    const now = new Date();
    return new Date(now.getTime() + hours * 60 * 60 * 1000).toISOString();
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      const isClassified = postMode === 'classified';
      const duration = formData.durationHours || 168;
      // Calculate expiresAt for both classifieds and spotlights so video ads auto-delete after duration
      const expiresAt = calculateExpiresAt(duration);
      const isAdminUser = profile?.isAdmin || profile?.email === 'comfort.designszw@gmail.com';
      const isApproved = isAdminUser ? true : false;

      const payload = {
        ...formData,
        type: isClassified ? 'classified' : (formData.type === 'classified' ? 'news' : formData.type || 'news'),
        isClassified,
        isApproved,
        expiresAt: expiresAt,
        authorId: profile.uid,
        authorName: profile.businessName || profile.name,
      };

      // Safeguard against payload size limit (Firestore 1MB limit)
      if (JSON.stringify(payload).length > 950000) {
        triggerFeedback('Video Payload Exceeds Database Limit', 'The video or ad content is too large to fit in cloud storage. Please compress your video or use a "Direct Video URL".', 'report');
        setLoading(false);
        return;
      }

      let createdDocId = editingSpotlight?.id;
      if (editingSpotlight) {
        const data = {
          ...payload,
          updatedAt: serverTimestamp(),
        };
        await updateDoc(doc(db, 'spotlights', editingSpotlight.id), data);
      } else {
        const data = {
          ...payload,
          createdAt: serverTimestamp(),
        };
        const docRef = await addDoc(collection(db, 'spotlights'), data);
        createdDocId = docRef.id;
      }

      // If created or edited by a non-admin, notify available Admin(s) via push notification
      if (!isApproved) {
        await interactionService.notifyAdminsOfPendingAd(
          payload.title || 'New Ad / Spotlight',
          profile.businessName || profile.name || 'Supplier',
          profile.uid,
          createdDocId
        );
      }

      setLastSubmittedIsApproved(isApproved);
      setSuccess(true);
      setTimeout(() => {
        setIsAdding(false);
        setEditingSpotlight(null);
        setSuccess(false);
        setFormData({
          type: 'classified',
          title: '',
          content: '',
          date: '',
          location: profile.location?.city || '',
          image: '',
          videoUrl: '',
          isActive: true,
          isClassified: true,
          category: 'Electronics & Tech',
          price: '',
          badge: '🔥 HOT DEAL',
          durationHours: 168,
          contactPhone: profile.phone || '',
          whatsappNumber: profile.phone || '',
          actionUrl: '',
          targetType: 'whatsapp',
          tier: 'featured',
        });
      }, 3500);
    } catch (err) {
      handleFirestoreError(err, editingSpotlight ? OperationType.UPDATE : OperationType.CREATE, editingSpotlight ? `spotlights/${editingSpotlight.id}` : 'spotlights');
    } finally {
      setLoading(false);
    }
  };

  const handleRenew = async (s: Spotlight) => {
    try {
      const duration = s.durationHours || 168;
      const newExpiry = calculateExpiresAt(duration);
      await updateDoc(doc(db, 'spotlights', s.id), {
        expiresAt: newExpiry,
        isActive: true,
        updatedAt: serverTimestamp(),
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `spotlights/${s.id}`);
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Are you sure you want to delete this listing?')) return;
    try {
      await deleteDoc(doc(db, 'spotlights', id));
    } catch (err) {
      handleFirestoreError(err, OperationType.DELETE, `spotlights/${id}`);
    }
  };

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

  return (
    <div className="space-y-8 pb-12">
      <header className="flex justify-between items-center">
        <div className="space-y-1 text-left">
          <div className="flex items-center gap-2">
            <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Market Spotlight & Classifieds</h3>
            <span className="px-2 py-0.5 rounded-full text-[8px] font-black uppercase tracking-wider bg-primary/20 text-primary border border-primary/30">Live Ads</span>
          </div>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Create appealing timeframed ads & spotlight broadcasts for Explorer</p>
        </div>
        {(!isAdding && !editingSpotlight) && (
          <button 
            onClick={() => {
              setIsAdding(true);
              setPostMode('classified');
              setFormData({
                type: 'classified',
                title: '',
                content: '',
                date: '',
                location: profile.location?.city || '',
                image: '',
                isActive: true,
                isClassified: true,
                category: 'Electronics & Tech',
                price: '',
                badge: '🔥 HOT DEAL',
                durationHours: 168,
                contactPhone: profile.phone || '',
                whatsappNumber: profile.phone || '',
                actionUrl: '',
                targetType: 'whatsapp',
                tier: 'featured',
              });
            }}
            className="px-4 py-2 bg-gradient-to-r from-primary to-accent text-[#05070a] font-black text-[10px] uppercase tracking-wider rounded-xl flex items-center gap-2 shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:scale-105 transition-all active:scale-95"
          >
            <Plus size={16} /> Post Classified Ad
          </button>
        )}
      </header>

      {(isAdding || editingSpotlight) ? (
        <form 
          ref={formRef}
          onSubmit={handleSubmit} 
          className="space-y-6 bg-white/5 p-6 rounded-3xl border border-primary/30 shadow-[0_0_50px_rgba(0,242,254,0.15)] relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-full h-[2px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
          
          <div className="flex justify-between items-center mb-2">
            <div className="flex items-center gap-2">
              <label className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">
                {editingSpotlight ? 'Edit Listing' : 'New Listing Creation'}
              </label>
            </div>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-400 font-black uppercase">Active Status</span>
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

          {/* Mode Switcher: Classified Ad vs Broadcast Spotlight */}
          <div className="p-1.5 bg-[#0d1117] rounded-2xl border border-white/10 grid grid-cols-2 gap-2">
            <button
              type="button"
              onClick={() => {
                setPostMode('classified');
                setFormData(prev => ({ ...prev, isClassified: true, type: 'classified' }));
              }}
              className={cn(
                "py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                postMode === 'classified'
                  ? "bg-gradient-to-r from-primary/30 to-accent/30 text-primary border border-primary/50 shadow-[0_0_15px_rgba(0,242,254,0.2)]"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Tag size={14} /> Timeframed Classified Ad
            </button>
            <button
              type="button"
              onClick={() => {
                setPostMode('spotlight');
                setFormData(prev => ({ ...prev, isClassified: false, type: 'news' }));
              }}
              className={cn(
                "py-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2",
                postMode === 'spotlight'
                  ? "bg-gradient-to-r from-primary/30 to-accent/30 text-primary border border-primary/50 shadow-[0_0_15px_rgba(0,242,254,0.2)]"
                  : "text-gray-400 hover:text-white"
              )}
            >
              <Megaphone size={14} /> General Spotlight / News
            </button>
          </div>

          <div className="space-y-4">
            {/* If Classified Ad, show Classified Ad Options */}
            {postMode === 'classified' && (
              <div className="p-4 bg-primary/5 border border-primary/20 rounded-2xl space-y-4">
                <div className="flex items-center gap-2 text-primary font-black text-xs uppercase tracking-wider">
                  <Flame size={16} /> Classified Ad Specification
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Category */}
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Market Category</label>
                    <select
                      value={formData.category || 'Electronics & Tech'}
                      onChange={e => setFormData(prev => ({ ...prev, category: e.target.value }))}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                    >
                      {CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#0d1117] text-white">{cat}</option>
                      ))}
                    </select>
                  </div>

                  {/* Price Tag */}
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Price / Offer Tag</label>
                    <input 
                      type="text"
                      value={formData.price || ''}
                      onChange={e => setFormData(prev => ({ ...prev, price: e.target.value }))}
                      placeholder="e.g. $120, Negotiable, or FREE"
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                    />
                  </div>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  {/* Badge */}
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Prominence Badge</label>
                    <select
                      value={formData.badge || '🔥 HOT DEAL'}
                      onChange={e => setFormData(prev => ({ ...prev, badge: e.target.value }))}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                    >
                      {BADGES.map(b => (
                        <option key={b} value={b} className="bg-[#0d1117] text-white">{b}</option>
                      ))}
                    </select>
                  </div>

                  {/* Duration Timeframe */}
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Active Timeframe</label>
                    <select
                      value={formData.durationHours || 168}
                      onChange={e => setFormData(prev => ({ ...prev, durationHours: Number(e.target.value) }))}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                    >
                      {DURATIONS.map(d => (
                        <option key={d.hours} value={d.hours} className="bg-[#0d1117] text-white">{d.label}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Contact CTA options */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Primary Call-To-Action</label>
                    <select
                      value={formData.targetType || 'whatsapp'}
                      onChange={e => setFormData(prev => ({ ...prev, targetType: e.target.value as any }))}
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                    >
                      <option value="whatsapp" className="bg-[#0d1117] text-white">📱 WhatsApp Direct Contact</option>
                      <option value="chat" className="bg-[#0d1117] text-white">💬 In-App Hub Chat</option>
                      <option value="call" className="bg-[#0d1117] text-white">📞 Direct Phone Call</option>
                      <option value="store" className="bg-[#0d1117] text-white">🏪 Visit Store Page</option>
                      <option value="external" className="bg-[#0d1117] text-white">🌐 External Web Link</option>
                    </select>
                  </div>

                  <div className="space-y-1 text-left">
                    <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact WhatsApp / Phone</label>
                    <input 
                      type="text"
                      value={formData.whatsappNumber || formData.contactPhone || ''}
                      onChange={e => setFormData(prev => ({ ...prev, whatsappNumber: e.target.value, contactPhone: e.target.value }))}
                      placeholder="+263 77 123 4567"
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                    />
                  </div>
                </div>
              </div>
            )}

            {/* General Spotlight Type (if spotlight mode) */}
            {postMode === 'spotlight' && (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
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
            )}

            {/* Headline */}
            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                {postMode === 'classified' ? 'Ad Title / Item Name' : 'Headline'}
              </label>
              <input 
                required
                type="text"
                value={formData.title}
                onChange={e => setFormData(prev => ({ ...prev, title: e.target.value }))}
                placeholder={postMode === 'classified' ? 'e.g., iPhone 15 Pro Max 256GB - Brand New Sealed' : 'e.g., Prime Grade Beef Restocked'}
                className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
              />
            </div>

            {/* Content Body */}
            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">
                {postMode === 'classified' ? 'Ad Description & Specs' : 'Content Details'}
              </label>
              <textarea 
                required
                value={formData.content}
                onChange={e => setFormData(prev => ({ ...prev, content: e.target.value }))}
                rows={4}
                placeholder={postMode === 'classified' ? 'Describe item condition, key features, availability, and delivery options...' : 'Details of the broadcast update...'}
                className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-medium resize-none leading-relaxed"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Location / City</label>
                <input 
                  type="text"
                  value={formData.location}
                  onChange={e => setFormData(prev => ({ ...prev, location: e.target.value }))}
                  placeholder="e.g. Harare Central / Bulawayo"
                  className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
              <div className="space-y-1 text-left">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Optional External Link</label>
                <input 
                  type="url"
                  value={formData.actionUrl || ''}
                  onChange={e => setFormData(prev => ({ ...prev, actionUrl: e.target.value }))}
                  placeholder="https://example.com/item"
                  className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
            </div>

            {/* Image upload */}
            <div className="space-y-1 text-left">
              <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Cover Image / Photo</label>
              <ImageInput 
                value={formData.image || ''}
                onChange={(val) => setFormData(prev => ({ ...prev, image: val }))}
                label="Select Classified Cover Photo"
                className="!bg-[#0d1117]"
              />
            </div>

            {/* Video upload for Classified Ads */}
            <VideoInput 
              value={formData.videoUrl || ''}
              onChange={(val) => setFormData(prev => ({ ...prev, videoUrl: val }))}
              label="Classified Promo Video (Optional: <5MB, <10s or Direct URL)"
              className="!bg-[#0d1117] p-3 rounded-2xl border border-white/5"
            />
          </div>

          <div className="flex gap-3 pt-2">
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
                "flex-[2] py-4 px-3 flex items-center justify-center gap-2 text-[10px] font-black uppercase tracking-wider rounded-2xl transition-all text-center leading-snug",
                success 
                  ? (lastSubmittedIsApproved 
                      ? "bg-neon-green text-[#05070a] shadow-[0_0_30px_#39FF14] scale-105" 
                      : "bg-amber-400 text-[#05070a] shadow-[0_0_30px_rgba(251,191,36,0.6)] scale-105")
                  : "bg-gradient-to-r from-primary to-accent text-[#05070a] shadow-[0_0_30px_rgba(0,242,254,0.4)] hover:scale-[1.02] active:scale-95"
              )}
            >
              {loading ? (
                <Loader2 className="animate-spin" size={16} />
              ) : success ? (
                <span className="flex items-center justify-center gap-2 font-black">
                  <Check size={18} className="shrink-0" />
                  {lastSubmittedIsApproved 
                    ? "Published to Explorer & Live on Hub" 
                    : "Ad or Spotlight created, now pending approval to show on the Hub"
                  }
                </span>
              ) : (
                <>
                  <Sparkles size={18} /> {editingSpotlight ? 'Update Listing' : 'Publish to Market'}
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
                <div key={i} className="h-36 bg-white/5 animate-pulse rounded-3xl border border-white/5" />
              ))}
            </div>
          ) : spotlights.length > 0 ? (
            <div className="grid gap-4">
              {Array.from(new Map(spotlights.filter(s => s && s.id).map(s => [s.id, s])).values()).map((s, idx) => {
                const isClass = s.isClassified || s.type === 'classified';
                const timeInfo = getTimeLeftText(s.expiresAt);

                return (
                  <motion.div 
                    key={`prof-spotlight-${s.id || idx}-${idx}`}
                    layout
                    className={cn(
                      "p-5 bg-white/5 border rounded-[2rem] transition-all group relative overflow-hidden text-left",
                      s.isActive && (!timeInfo || !timeInfo.expired)
                        ? "border-primary/30 shadow-[0_0_20px_rgba(0,242,254,0.05)]" 
                        : "border-white/5 opacity-60"
                    )}
                  >
                    <div className="flex gap-4 items-start relative z-10">
                      <div className="w-24 h-24 sm:w-28 sm:h-28 bg-[#0d1117] rounded-2xl border border-white/20 overflow-hidden shrink-0 flex items-center justify-center text-primary relative shadow-lg group-hover:border-primary/50 transition-colors">
                        {s.videoUrl ? (
                          <div className="relative w-full h-full">
                            <video src={s.videoUrl} autoPlay loop muted playsInline className="w-full h-full object-cover" />
                            <div className="absolute top-1 right-1 bg-black/70 backdrop-blur-md text-neon-green p-1 rounded-md border border-neon-green/30">
                              <Video size={10} className="animate-pulse" />
                            </div>
                          </div>
                        ) : s.image ? (
                          <img src={s.image} className="w-full h-full object-cover transition-transform duration-500 group-hover:scale-105" alt={s.title} />
                        ) : (
                          <Tag size={28} />
                        )}
                        {s.price && (
                          <div className="absolute bottom-0 inset-x-0 bg-primary/90 text-[#05070a] text-[9px] font-black text-center py-0.5 truncate">
                            {s.price}
                          </div>
                        )}
                      </div>

                      <div className="flex-1 min-w-0">
                        <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
                          {isClass ? (
                            <span className="text-[8px] font-black text-amber-300 uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/30 flex items-center gap-1">
                              <Tag size={10} /> Classified Ad
                            </span>
                          ) : (
                            <span className="text-[8px] font-black text-primary uppercase tracking-widest px-2 py-0.5 bg-primary/10 rounded-full border border-primary/20">
                              {s.type}
                            </span>
                          )}

                          {s.badge && (
                            <span className="text-[8px] font-black text-neon-green uppercase tracking-wider px-2 py-0.5 bg-neon-green/10 rounded-full border border-neon-green/20">
                              {s.badge}
                            </span>
                          )}

                          {s.category && (
                            <span className="text-[8px] font-bold text-gray-400 uppercase px-2 py-0.5 bg-white/5 rounded-full border border-white/5">
                              {s.category}
                            </span>
                          )}

                          {s.isApproved === false ? (
                            <span className="text-[8px] font-black text-amber-400 uppercase tracking-widest px-2 py-0.5 bg-amber-500/10 rounded-full border border-amber-500/30 flex items-center gap-1">
                              <Clock size={10} /> Pending Admin Approval
                            </span>
                          ) : (
                            <span className="text-[8px] font-black text-neon-green uppercase tracking-widest px-2 py-0.5 bg-neon-green/10 rounded-full border border-neon-green/30 flex items-center gap-1">
                              <CheckCircle size={10} /> Approved & Live
                            </span>
                          )}

                          {/* Time left countdown badge */}
                          {timeInfo && (
                            <span className={cn(
                              "text-[8px] font-black uppercase tracking-wider px-2 py-0.5 rounded-full border flex items-center gap-1 ml-auto",
                              timeInfo.expired 
                                ? "bg-red-500/20 text-red-400 border-red-500/30" 
                                : "bg-primary/20 text-primary border-primary/30"
                            )}>
                              <Clock size={10} /> {timeInfo.text}
                            </span>
                          )}
                        </div>

                        <h4 className="text-sm font-black text-white uppercase tracking-tight truncate">{s.title}</h4>
                        <p className="text-[11px] text-gray-400 font-medium line-clamp-2 mt-1 leading-relaxed">
                          {s.content}
                        </p>
                      </div>
                    </div>

                    <div className="flex items-center justify-between mt-5 pt-4 border-t border-white/5">
                      <div className="flex flex-wrap gap-2">
                        <button 
                          onClick={() => handleEdit(s)}
                          className="px-3 py-1.5 bg-white/5 rounded-xl border border-white/10 text-[9px] font-black text-gray-300 uppercase tracking-widest hover:text-white hover:border-white/20 transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <Save size={12} /> Edit
                        </button>

                        {/* Renew button if expired or classified */}
                        {isClass && (
                          <button 
                            onClick={() => handleRenew(s)}
                            className="px-3 py-1.5 bg-primary/10 rounded-xl border border-primary/30 text-[9px] font-black text-primary uppercase tracking-widest hover:bg-primary hover:text-[#05070a] transition-all active:scale-95 flex items-center gap-1.5"
                          >
                            <RefreshCw size={12} /> Renew (+7d)
                          </button>
                        )}

                        <button 
                          onClick={() => handleDelete(s.id)}
                          className="px-3 py-1.5 bg-red-500/10 rounded-xl border border-red-500/20 text-[9px] font-black text-red-400 uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all active:scale-95 flex items-center gap-1.5"
                        >
                          <Trash2 size={12} /> Delete
                        </button>
                      </div>

                      <div className="text-[8px] font-black text-gray-500 uppercase tracking-widest">
                        {s.createdAt ? new Date(s.createdAt?.toDate?.() || s.createdAt).toLocaleDateString() : 'Just posted'}
                      </div>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          ) : (
            <div className="text-center py-16 bg-white/5 rounded-[3rem] border border-white/5 space-y-4">
              <div className="w-16 h-16 bg-primary/10 rounded-full flex items-center justify-center mx-auto text-primary border border-primary/20">
                <Tag size={32} />
              </div>
              <div>
                <p className="text-xs font-black text-gray-300 uppercase tracking-widest">No Active Spotlights or Classified Ads</p>
                <p className="text-[10px] text-gray-500 mt-1 max-w-[260px] mx-auto font-medium">Post timeframed deals, hot classified ads, or broadcast news to reach all buyers on the Explorer page.</p>
              </div>
              <button 
                onClick={() => {
                  setIsAdding(true);
                  setPostMode('classified');
                }}
                className="px-5 py-2.5 bg-primary text-[#05070a] rounded-xl font-black text-[10px] uppercase tracking-wider shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:scale-105 transition-all"
              >
                Create Your First Classified Ad
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

function GatewayConfig({ profile, onSave }: { profile: UserProfile, onSave: (data: any) => void }) {
  const existingMethods = (profile as any)?.paymentMethods || {};
  const primaryProvider = profile.gateway?.provider || 'paypal';

  const [primary, setPrimary] = useState<string>(primaryProvider);
  const [saveMessage, setSaveMessage] = useState<string | null>(null);

  const [methods, setMethods] = useState({
    paypal: {
      enabled: existingMethods.paypal?.enabled ?? (primaryProvider === 'paypal' && profile.gateway?.isActive !== false),
      details: existingMethods.paypal?.details || (primaryProvider === 'paypal' ? profile.gateway?.details || '' : '')
    },
    stripe: {
      enabled: existingMethods.stripe?.enabled ?? (primaryProvider === 'stripe' && profile.gateway?.isActive !== false),
      details: existingMethods.stripe?.details || (primaryProvider === 'stripe' ? profile.gateway?.details || '' : '')
    },
    ecocash: {
      enabled: existingMethods.ecocash?.enabled ?? (primaryProvider === 'ecocash' && profile.gateway?.isActive !== false),
      details: existingMethods.ecocash?.details || (primaryProvider === 'ecocash' ? profile.gateway?.details || '' : '')
    },
    paynow: {
      enabled: existingMethods.paynow?.enabled ?? (primaryProvider === 'paynow' && profile.gateway?.isActive !== false),
      details: existingMethods.paynow?.details || (primaryProvider === 'paynow' ? profile.gateway?.details || '' : '')
    },
    bank: {
      enabled: existingMethods.bank?.enabled ?? false,
      details: existingMethods.bank?.details || '',
      bankName: existingMethods.bank?.bankName || '',
      accountNumber: existingMethods.bank?.accountNumber || '',
      branchCode: existingMethods.bank?.branchCode || '',
      accountName: existingMethods.bank?.accountName || ''
    },
    pod: {
      enabled: existingMethods.pod?.enabled ?? (primaryProvider === 'pod' && profile.gateway?.isActive !== false),
      details: existingMethods.pod?.details || 'Cash or Mobile Transfer accepted upon delivery'
    }
  });

  const [activeTab, setActiveTab] = useState<'paypal' | 'stripe' | 'ecocash' | 'paynow' | 'bank' | 'pod'>('paypal');

  const handleSave = () => {
    const keys = Object.keys(methods) as Array<keyof typeof methods>;
    const chosenPrimary = (methods[primary as keyof typeof methods]?.enabled ? primary : keys.find(k => methods[k].enabled)) || 'paypal';

    let primaryDetails = methods[chosenPrimary as keyof typeof methods]?.details || '';
    if (chosenPrimary === 'bank') {
      const b = methods.bank;
      primaryDetails = [b.bankName, b.accountNumber, b.accountName].filter(Boolean).join(' - ') || b.details;
    }

    const gatewayData = {
      provider: chosenPrimary,
      details: primaryDetails || (chosenPrimary === 'pod' ? 'Cash / POD Enabled' : ''),
      isActive: true
    };

    setSaveMessage("✓ Payment Methods Saved & Synced for Buyer Checkout!");

    setTimeout(() => {
      onSave({
        gateway: gatewayData,
        paymentMethods: methods
      });
    }, 600);
  };

  const providerInfo = [
    { id: 'paypal', label: 'PayPal', icon: CreditCard, color: 'text-blue-400', badgeBg: 'bg-blue-500/20 text-blue-400 border-blue-500/30' },
    { id: 'stripe', label: 'Stripe', icon: CreditCard, color: 'text-purple-400', badgeBg: 'bg-purple-500/20 text-purple-400 border-purple-500/30' },
    { id: 'ecocash', label: 'EcoCash', icon: Phone, color: 'text-emerald-400', badgeBg: 'bg-emerald-500/20 text-emerald-400 border-emerald-500/30' },
    { id: 'paynow', label: 'Paynow', icon: Wallet, color: 'text-cyan-400', badgeBg: 'bg-cyan-500/20 text-cyan-400 border-cyan-500/30' },
    { id: 'bank', label: 'Bank Transfer', icon: Landmark, color: 'text-amber-400', badgeBg: 'bg-amber-500/20 text-amber-400 border-amber-500/30' },
    { id: 'pod', label: 'Cash / POD', icon: MapPinned, color: 'text-rose-400', badgeBg: 'bg-rose-500/20 text-rose-400 border-rose-500/30' }
  ];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Payment Methods Settings</h3>
        <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">Configure & enable how you receive payments for your products and services</p>
      </header>

      {saveMessage && (
        <motion.div 
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="p-3 bg-emerald-500/20 border border-emerald-500/40 rounded-xl text-emerald-400 text-xs font-bold text-center flex items-center justify-center gap-2"
        >
          <Check size={16} /> {saveMessage}
        </motion.div>
      )}

      {/* Grid of payment options */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
        {providerInfo.map(m => {
          const isEnabled = methods[m.id as keyof typeof methods]?.enabled;
          const isSelected = activeTab === m.id;
          const isPrimary = primary === m.id;

          return (
            <button
              key={m.id}
              type="button"
              onClick={() => setActiveTab(m.id as any)}
              className={cn(
                "p-3 rounded-2xl border flex flex-col justify-between transition-all relative overflow-hidden text-left min-h-[95px]",
                isSelected ? "bg-primary/20 border-primary text-white shadow-[0_0_15px_rgba(0,242,254,0.15)]" : "bg-white/5 border-white/5 text-gray-400 hover:border-white/20"
              )}
            >
              <div className="flex items-center justify-between w-full">
                <m.icon size={18} className={m.color} />
                <div className="flex items-center gap-1">
                  {isPrimary && (
                    <span className="text-[7px] font-black uppercase px-1 py-0.5 rounded bg-amber-500/20 text-amber-300 border border-amber-500/40 flex items-center gap-0.5">
                      <Star size={8} className="fill-amber-300" /> Primary
                    </span>
                  )}
                  <span className={cn(
                    "text-[7px] font-black uppercase tracking-wider px-1.5 py-0.5 rounded-full border",
                    isEnabled ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" : "bg-gray-500/10 text-gray-500 border-gray-500/20"
                  )}>
                    {isEnabled ? 'Active' : 'Off'}
                  </span>
                </div>
              </div>
              <div>
                <span className="text-[10px] font-black uppercase tracking-wider w-full block text-left mt-2 text-white">
                  {m.label}
                </span>
                <p className="text-[8px] text-gray-400 truncate">
                  {methods[m.id as keyof typeof methods]?.details || 'Not set'}
                </p>
              </div>
            </button>
          );
        })}
      </div>

      {/* Active Tab Configurator */}
      <div className="bg-white/5 p-5 rounded-2xl border border-white/10 space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between border-b border-white/10 pb-3 gap-2">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <h4 className="text-xs font-black text-white uppercase tracking-wider">{activeTab.toUpperCase()} Configuration</h4>
              {primary === activeTab && (
                <span className="text-[8px] font-black text-amber-400 bg-amber-500/20 px-2 py-0.5 rounded-full border border-amber-500/30 uppercase tracking-widest">
                  Primary Gateway
                </span>
              )}
            </div>
            <p className="text-[9px] text-gray-400 font-bold">Configure details for buyers checking out with {activeTab.toUpperCase()}</p>
          </div>

          <div className="flex items-center gap-2">
            {activeTab !== primary && (
              <button
                type="button"
                onClick={() => setPrimary(activeTab)}
                className="px-2.5 py-1.5 rounded-xl text-[8px] font-black uppercase tracking-widest bg-amber-500/10 text-amber-300 border border-amber-500/30 hover:bg-amber-500/20 transition-all flex items-center gap-1 cursor-pointer"
              >
                <Star size={10} /> Set as Primary
              </button>
            )}
            <button
              type="button"
              onClick={() => setMethods(prev => ({
                ...prev,
                [activeTab]: { ...prev[activeTab], enabled: !prev[activeTab].enabled }
              }))}
              className={cn(
                "px-3 py-1.5 rounded-xl text-[9px] font-black uppercase tracking-widest transition-all border cursor-pointer",
                methods[activeTab].enabled 
                  ? "bg-emerald-500/20 text-emerald-400 border-emerald-500/40" 
                  : "bg-white/5 text-gray-400 border-white/10 hover:text-white"
              )}
            >
              {methods[activeTab].enabled ? '✓ Enabled' : 'Enable Method'}
            </button>
          </div>
        </div>

        {activeTab === 'bank' ? (
          <div className="space-y-3">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Bank Name</label>
                <input 
                  type="text"
                  value={methods.bank.bankName}
                  onChange={e => setMethods(prev => ({ ...prev, bank: { ...prev.bank, bankName: e.target.value } }))}
                  placeholder="e.g. Stanbic / CBZ / FBC"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Holder Name</label>
                <input 
                  type="text"
                  value={methods.bank.accountName}
                  onChange={e => setMethods(prev => ({ ...prev, bank: { ...prev.bank, accountName: e.target.value } }))}
                  placeholder="Full Account Holder Name"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-primary/50 text-xs font-bold"
                />
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Account Number</label>
                <input 
                  type="text"
                  value={methods.bank.accountNumber}
                  onChange={e => setMethods(prev => ({ ...prev, bank: { ...prev.bank, accountNumber: e.target.value } }))}
                  placeholder="e.g. 914000123456"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-primary/50 font-mono text-xs"
                />
              </div>
              <div className="space-y-1">
                <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest ml-1">Branch Code / Swift</label>
                <input 
                  type="text"
                  value={methods.bank.branchCode}
                  onChange={e => setMethods(prev => ({ ...prev, bank: { ...prev.bank, branchCode: e.target.value } }))}
                  placeholder="e.g. 31024 or STANZWHA"
                  className="w-full bg-white/5 border border-white/10 rounded-xl px-3.5 py-2.5 text-white outline-none focus:border-primary/50 font-mono text-xs"
                />
              </div>
            </div>
            <p className="text-[8px] text-gray-400 italic">Buyers will be presented with these exact bank deposit details at checkout.</p>
          </div>
        ) : activeTab === 'pod' ? (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Pay on Delivery Notes & Terms</label>
            <input 
              type="text"
              value={methods.pod.details}
              onChange={e => setMethods(prev => ({
                ...prev,
                pod: { ...prev.pod, details: e.target.value }
              }))}
              placeholder="e.g. Cash or Mobile Transfer accepted upon delivery"
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-primary/50 font-medium text-xs"
            />
            <p className="text-[8px] text-gray-400 italic">Instructions provided to buyers when placing Cash / Pay on Delivery orders.</p>
          </div>
        ) : (
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">
              {activeTab === 'ecocash' ? 'EcoCash USSD Code / Merchant Number / Phone' : 
               activeTab === 'paynow' ? 'Paynow Integration Link / Merchant Email / Key' : 
               'Payment Handle / Checkout Link / Account Email'}
            </label>
            <input 
              type="text"
              value={methods[activeTab].details}
              onChange={e => setMethods(prev => ({
                ...prev,
                [activeTab]: { ...prev[activeTab], details: e.target.value }
              }))}
              placeholder={
                activeTab === 'paypal' ? 'paypal.me/yourbusiness or sales@domain.com' :
                activeTab === 'stripe' ? 'https://buy.stripe.com/5kA... or Stripe Account ID' :
                activeTab === 'ecocash' ? '*151*2*2*077123456# or Merchant 077...' :
                activeTab === 'paynow' ? 'https://www.paynow.co.zw/Payment/Link/... or email@domain.com' :
                'Account Details'
              }
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-3.5 text-white outline-none focus:border-primary/50 font-mono text-xs"
            />
            <p className="text-[8px] text-gray-500 italic">
              {activeTab === 'ecocash' ? 'Buyers can dial this code directly or auto-generate their EcoCash command.' : 
               activeTab === 'paynow' ? 'Used to launch direct Paynow payment interface at checkout.' :
               'Directs buyers straight to your configured receiving gateway.'}
            </p>
          </div>
        )}
      </div>

      <button 
        type="button"
        onClick={handleSave}
        className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2 cursor-pointer"
      >
        <Check size={18} /> Save Payment Configuration
      </button>
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
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Location Settings</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pinpoint your operational coordinate</p>
      </header>

      <div className="space-y-6">
        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">City</label>
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
        <h3 className="text-sm font-black text-white uppercase tracking-widest italic">Your Live Inventory</h3>
        <button 
          onClick={() => navigate('/stores?tab=manage')}
          className="text-[9px] font-black text-primary uppercase tracking-widest hover:underline"
        >
          View All Connections
        </button>
      </div>

      <div className="grid grid-cols-2 gap-4">
        {Array.from(new Map<string, Product>(products.filter(p => p && p.id).map(p => [p.id, p])).values()).map((p, idx) => (
            <ProductCard 
              key={`prof-prod-${p.id || idx}-${idx}`}
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
          Your Connections 
          {profile.currentRole === 'supplier' ? ' Trusted customers and partners.' : ' Trusted suppliers and partners.'}
        </p>
      </header>

      <div className="space-y-4">
        {loading ? (
          <div className="space-y-3">
            {[1, 2, 3].map(i => <div key={i} className="h-20 bg-white/5 animate-pulse rounded-2xl" />)}
          </div>
        ) : connections.length > 0 ? (
          <div className="grid gap-3">
            {Array.from(new Map(connections.filter(c => c && c.id).map(c => [c.id, c])).values()).map((c, idx) => (
              <div 
                key={`prof-conn-${c.id || idx}-${idx}`}
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

function NotificationSettings({ profile, onSave }: { profile: UserProfile, onSave: (p: Partial<UserProfile>) => void }) {
  const [prefs, setPrefs] = useState({
    purchases: profile.notificationPrefs?.purchases ?? true,
    messages: profile.notificationPrefs?.messages ?? true,
    social: profile.notificationPrefs?.social ?? false,
    highPriority: profile.notificationPrefs?.highPriority ?? true
  });
  
  const [permission, setPermission] = useState(Notification.permission);

  const requestPermission = async () => {
    const p = await Notification.requestPermission();
    setPermission(p);
  };

  const handleToggle = (key: keyof typeof prefs) => {
    setPrefs(prev => ({ ...prev, [key]: !prev[key] }));
  };

  const save = () => {
    onSave({ notificationPrefs: prefs });
  };

  return (
    <div className="space-y-8">
      <div>
        <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Notification Settings</h3>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest mt-1">Manage your alerts</p>
      </div>

      {permission !== 'granted' && (
        <div className="bg-yellow-500/10 border border-yellow-500/20 p-4 rounded-2xl flex items-start gap-4">
          <Bell className="text-yellow-500 shrink-0 mt-1" size={20} />
          <div>
            <p className="text-sm font-bold text-yellow-500">Alerts are turned off in your browser settings</p>
            <p className="text-xs text-yellow-500/70 mt-1">Turn on notifications to receive important updates.</p>
            <button 
              onClick={requestPermission}
              className="mt-3 bg-yellow-500 text-black px-4 py-2 rounded-xl text-xs font-black uppercase tracking-widest hover:bg-yellow-400 transition-colors"
            >
              Enable Notifications
            </button>
          </div>
        </div>
      )}

      <div className="space-y-4">
        {[
          { key: 'highPriority', label: 'High Priority Alerts', desc: 'Wake device & immediate alert for urgent events', icon: Zap, color: 'text-neon-green' },
          { key: 'purchases', label: 'Purchases & Orders', desc: 'Alerts for new orders and status changes', icon: Wallet, color: 'text-primary' },
          { key: 'messages', label: 'Private Messages', desc: 'Direct messages from buyers or sellers', icon: MessageSquare, color: 'text-blue-400' },
          { key: 'social', label: 'Social Activity', desc: 'New followers, likes, and engagement', icon: Users, color: 'text-purple-400' },
        ].map(({ key, label, desc, icon: Icon, color }) => (
          <div key={key} className="flex items-center justify-between p-4 bg-white/5 border border-white/5 rounded-2xl cursor-pointer hover:bg-white/10 transition-colors" onClick={() => handleToggle(key as keyof typeof prefs)}>
            <div className="flex items-center gap-4">
              <div className={`w-10 h-10 rounded-full flex items-center justify-center bg-white/5 ${color}`}>
                <Icon size={18} />
              </div>
              <div>
                <h4 className="text-sm font-bold text-white">{label}</h4>
                <p className="text-xs text-gray-500">{desc}</p>
              </div>
            </div>
            <div className={`w-12 h-6 rounded-full p-1 transition-colors ${prefs[key as keyof typeof prefs] ? 'bg-primary' : 'bg-gray-700'}`}>
              <div className={`w-4 h-4 bg-white rounded-full transition-transform ${prefs[key as keyof typeof prefs] ? 'translate-x-6' : 'translate-x-0'}`} />
            </div>
          </div>
        ))}
      </div>

      <button onClick={save} className="w-full bg-primary text-black font-black uppercase tracking-widest py-4 rounded-2xl hover:bg-white transition-colors">
        Save Preferences
      </button>
    </div>
  );
}

