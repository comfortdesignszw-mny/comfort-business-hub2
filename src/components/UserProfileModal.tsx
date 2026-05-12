import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, User, Shield, MapPin, MessageSquare, Users, Check, Loader2, Star, Building2, Store as StoreIcon
} from 'lucide-react';
import { doc, getDoc, collection, query, where, onSnapshot } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, Store, Connection } from '../types';
import { cn } from '../lib/utils';
import { interactionService } from '../services/interactionService';
import { useNavigate } from 'react-router-dom';

interface UserProfileModalProps {
  userId: string;
  isOpen: boolean;
  onClose: () => void;
  currentUserProfile: UserProfile | null;
}

export default function UserProfileModal({ userId, isOpen, onClose, currentUserProfile }: UserProfileModalProps) {
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [stores, setStores] = useState<Store[]>([]);
  const [loading, setLoading] = useState(true);
  const [connection, setConnection] = useState<Connection | null>(null);
  const [isConnecting, setIsConnecting] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    if (!isOpen || !userId) return;

    setLoading(true);
    const fetchProfile = async () => {
      try {
        // First try public_profiles which is open to all signed-in users
        const publicSnap = await getDoc(doc(db, 'public_profiles', userId));
        if (publicSnap.exists()) {
          setProfile({ uid: publicSnap.id, ...publicSnap.data() } as any);
        }

        // Then attempt to get full profile (includes PII like phone)
        // This will only work if the user is the owner or a connected member
        try {
          const docSnap = await getDoc(doc(db, 'users', userId));
          if (docSnap.exists()) {
            setProfile({ uid: docSnap.id, ...docSnap.data() } as UserProfile);
          }
        } catch (e: any) {
          // If it's a permission error, we just stick with the public profile
          if (!e.message?.includes('permission')) {
             throw e;
          }
        }
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `public-node/${userId}`);
      } finally {
        setLoading(false);
      }
    };

    fetchProfile();

    // Fetch stores if supplier
    const q = query(collection(db, 'stores'), where('ownerId', '==', userId));
    const unsubStores = onSnapshot(q, (snap) => {
      setStores(snap.docs.map(d => ({ id: d.id, ...d.data() } as Store)));
    });

    // Check connection status
    if (currentUserProfile && currentUserProfile.uid !== userId) {
      const q1 = query(collection(db, 'connections'), where('senderId', '==', currentUserProfile.uid), where('receiverId', '==', userId));
      const q2 = query(collection(db, 'connections'), where('senderId', '==', userId), where('receiverId', '==', currentUserProfile.uid));

      const unsubConn1 = onSnapshot(q1, (snap) => {
        if (!snap.empty) setConnection({ id: snap.docs[0].id, ...snap.docs[0].data() } as Connection);
      });
      const unsubConn2 = onSnapshot(q2, (snap) => {
        if (!snap.empty) setConnection({ id: snap.docs[0].id, ...snap.docs[0].data() } as Connection);
      });

      return () => {
        unsubStores();
        unsubConn1();
        unsubConn2();
      };
    }

    return () => unsubStores();
  }, [userId, isOpen, currentUserProfile?.uid]);

  const handleConnect = async () => {
    if (!currentUserProfile) {
      navigate('/login');
      return;
    }
    if (connection || userId === currentUserProfile.uid) return;

    setIsConnecting(true);
    try {
      await interactionService.sendConnectionRequest(currentUserProfile, {
        uid: profile!.uid,
        name: profile!.name,
        avatar: profile!.avatar
      });
    } catch (err) {
      console.error("Connection failed:", err);
    } finally {
      setIsConnecting(false);
    }
  };

  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[3000] flex items-center justify-center p-4 sm:p-6">
          <motion.div 
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-xl"
          />
          <motion.div 
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-xl bg-[#0d1117] border border-white/10 rounded-[3rem] overflow-hidden shadow-2xl safe-bottom max-h-[90vh] flex flex-col"
          >
            {/* Header / Close */}
            <div className="absolute top-6 right-6 z-10">
              <button 
                onClick={onClose}
                className="w-10 h-10 bg-white/5 backdrop-blur-md rounded-full flex items-center justify-center text-white border border-white/10 hover:bg-white/10 transition-colors"
              >
                <X size={20} />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto custom-scrollbar p-6 pt-12 sm:p-10">
              {loading ? (
                <div className="flex flex-col items-center justify-center py-20 space-y-4">
                  <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
                  <p className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Synchronizing Identity...</p>
                </div>
              ) : profile ? (
                <div className="space-y-8">
                  {/* Profile Info */}
                  <div className="flex flex-col items-center text-center space-y-6">
                    <div className="relative group">
                      <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25"></div>
                      <div className="relative w-32 h-32 bg-[#0d1117] border-4 border-[#05070a] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-2xl overflow-hidden">
                        {profile.avatar ? (
                          <img src={profile.avatar} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
                        ) : profile.name.charAt(0)}
                      </div>
                    </div>

                    <div className="space-y-3">
                      <div className="space-y-1">
                        <h2 className="text-3xl font-black text-white italic tracking-tighter uppercase">{profile.name}</h2>
                        <div className="flex items-center justify-center gap-3">
                          <p className="text-[10px] text-primary font-black uppercase tracking-widest">
                            Node ID: {profile.uid.slice(0, 8)}
                          </p>
                          {profile.isVerified && (
                             <div className="flex items-center gap-1.5 text-[9px] text-neon-green font-black uppercase tracking-widest">
                              <Shield size={12} className="fill-neon-green/20" /> Verified Hub Member
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="flex justify-center flex-wrap gap-2 pt-2">
                        <div className="glass-pill !text-gray-400 !border-white/5 uppercase tracking-widest text-[9px]">
                          {profile.currentRole === 'supplier' ? 'Supplier Matrix' : 'Customer Node'}
                        </div>
                        {profile.location?.city && (
                          <div className="glass-pill !text-gray-400 !border-white/5 flex items-center gap-1.5 uppercase tracking-widest text-[9px]">
                            <MapPin size={10} /> {profile.location.city}
                          </div>
                        )}
                      </div>
                    </div>
                  </div>

                  {/* Action Bar */}
                  {currentUserProfile && currentUserProfile.uid !== userId && (
                    <div className="flex gap-3">
                      <button 
                         onClick={handleConnect}
                         disabled={!!connection || isConnecting}
                         className={cn(
                           "flex-1 py-4 rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] transition-all flex items-center justify-center gap-2",
                           connection?.status === 'accepted' 
                             ? "bg-neon-green text-[#05070a] shadow-[0_0_20px_rgba(57,255,20,0.3)]"
                             : connection?.status === 'pending'
                             ? "bg-white/5 text-gray-500 border border-white/10"
                             : "bg-primary text-[#05070a] shadow-[0_0_20px_rgba(0,242,254,0.3)] hover:scale-[1.02] active:scale-95"
                         )}
                      >
                        {isConnecting ? (
                          <Loader2 className="animate-spin" size={16} />
                        ) : connection?.status === 'accepted' ? (
                          <><Users size={16} /> Trusted Partner</>
                        ) : connection?.status === 'pending' ? (
                          <><Check size={16} /> Request Sent</>
                        ) : (
                          <><Users size={16} /> Connect Node</>
                        )}
                      </button>
                      <button 
                        onClick={() => {
                          onClose();
                          navigate('/chat', { state: { recipientId: userId } });
                        }}
                        className="w-14 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center text-primary hover:bg-white/10 transition-all border-primary/20"
                      >
                        <MessageSquare size={20} />
                      </button>
                    </div>
                  )}

                  {/* Stores / Business Nodes */}
                  {profile.currentRole === 'supplier' && (
                    <div className="space-y-4 pt-4 border-t border-white/5">
                      <div className="flex items-center gap-2 px-1">
                        <StoreIcon size={16} className="text-primary" />
                        <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Operational Matrix Nodes</h3>
                      </div>
                      
                      <div className="grid gap-3">
                        {stores.length > 0 ? (
                          stores.map(store => (
                            <div 
                              key={store.id}
                              onClick={() => {
                                onClose();
                                navigate(`/store/${store.id}`);
                              }}
                              className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between group hover:border-primary/20 transition-all cursor-pointer"
                            >
                              <div className="flex items-center gap-3">
                                <div className="w-12 h-12 bg-[#0d1117] rounded-xl border border-white/10 overflow-hidden flex items-center justify-center text-primary font-black uppercase">
                                  {store.logo ? <img src={store.logo} className="w-full h-full object-cover" /> : store.name.charAt(0)}
                                </div>
                                <div>
                                  <h4 className="text-xs font-black text-white uppercase tracking-tight group-hover:text-primary transition-colors">{store.name}</h4>
                                  <div className="flex items-center gap-2 mt-0.5">
                                    <div className="flex items-center gap-1 text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                                      <Building2 size={8} /> {store.category}
                                    </div>
                                    <div className="flex items-center gap-1 text-[8px] text-primary font-bold uppercase tracking-widest">
                                      <Star size={8} className="fill-primary" /> {store.rating.toFixed(1)}
                                    </div>
                                  </div>
                                </div>
                              </div>
                              <div className="text-[9px] font-black text-primary uppercase tracking-widest group-hover:translate-x-1 transition-transform">
                                Explore
                              </div>
                            </div>
                          ))
                        ) : (
                          <div className="p-8 text-center bg-white/5 rounded-2xl border border-white/5">
                            <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest">No active nodes detected</p>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              ) : (
                <div className="text-center py-20 bg-white/5 rounded-3xl border border-white/5">
                  <p className="text-xs font-black text-gray-500 uppercase tracking-widest">Identity purge or data failure</p>
                </div>
              )}
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
