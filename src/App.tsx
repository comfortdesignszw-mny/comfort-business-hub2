/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { 
  Search, ShoppingBag, MessageSquare, User as UserIcon, Store, LayoutGrid, 
  Zap, Menu, Bell, ArrowLeft, X, Heart, Star, UserPlus 
} from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Role, Notification } from './types';
import { cn } from './lib/utils';

// Pages (to be implemented)
import Discovery from './pages/Discovery';
import DealRoom from './pages/DealRoom';
import Chat from './pages/Chat';
import Profile from './pages/Profile';
import Login from './pages/Login';
import SupplierSetup from './pages/SupplierSetup';
import SupplierDashboard from './pages/SupplierDashboard';
import CustomerSetup from './pages/CustomerSetup';
import StoreDetail from './pages/StoreDetail';
import ProductDetail from './pages/ProductDetail';
import { MessagingProvider } from './components/MessagingProvider';
import { NotificationProvider, useNotifications } from './components/NotificationProvider';

export default function App() {
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [hasStore, setHasStore] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  // Profile completion check
  const isProfileIncomplete = profile?.currentRole === 'customer' && (!profile.requiredProducts || profile.requiredProducts.length === 0);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      setUser(firebaseUser);
      if (firebaseUser) {
        const userPath = `users/${firebaseUser.uid}`;
        try {
          const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData);

            if (profileData.currentRole === 'supplier') {
              const { collection, query, where, getDocs } = await import('firebase/firestore');
              const storeRes = await getDocs(query(collection(db, 'stores'), where('ownerId', '==', firebaseUser.uid)));
              setHasStore(!storeRes.empty);
            }
          } else {
            setProfile(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, userPath);
        }
      } else {
        setProfile(null);
        setHasStore(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-[#05070a]">
        <div className="relative">
          <motion.div 
            animate={{ 
              scale: [1, 1.2, 1],
              opacity: [0.5, 1, 0.5]
            }}
            transition={{ repeat: Infinity, duration: 2 }}
            className="w-24 h-24 bg-primary rounded-3xl blur-2xl absolute -inset-2 opacity-50"
          />
          <motion.div 
            animate={{ rotate: 360 }}
            transition={{ repeat: Infinity, duration: 8, ease: "linear" }}
            className="text-primary font-bold text-4xl flex items-center justify-center relative z-10"
          >
            <Zap size={48} className="fill-current drop-shadow-[0_0_15px_rgba(0,242,254,0.8)]" />
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <Router>
      <div className="flex flex-col h-screen bg-[#05070a] relative shadow-2xl">
        {!user ? (
          <Routes>
            <Route path="/login" element={<Login />} />
            <Route path="*" element={<Navigate to="/login" replace />} />
          </Routes>
        ) : (
          <NotificationProvider profile={profile}>
            <MessagingProvider profile={profile}>
              <Header profile={profile} />
              <main className="flex-1 overflow-y-auto no-scrollbar pb-24">
                <div className="max-w-7xl mx-auto w-full">
                  <AnimatePresence mode="wait">
                    <Routes>
                      {isProfileIncomplete ? (
                        <Route path="*" element={<CustomerSetup profile={profile!} />} />
                      ) : (
                        <>
                          <Route path="/" element={<Discovery profile={profile} setProfile={setProfile} />} />
                          <Route path="/deals" element={<DealRoom profile={profile} />} />
                          <Route path="/chat" element={<Chat profile={profile} />} />
                          <Route path="/store/:id" element={<StoreDetail profile={profile} />} />
                          <Route path="/product/:id" element={<ProductDetail profile={profile} />} />
                          {profile?.currentRole === 'supplier' && !hasStore ? (
                            <Route path="/store" element={<SupplierSetup profile={profile!} />} />
                          ) : profile?.currentRole === 'supplier' ? (
                            <Route path="/store" element={<SupplierDashboard profile={profile!} />} />
                          ) : null}
                          <Route path="/profile" element={<Profile profile={profile} setProfile={setProfile} />} />
                          <Route path="*" element={<Navigate to="/" replace />} />
                        </>
                      )}
                    </Routes>
                  </AnimatePresence>
                </div>
              </main>
              <Navigation profile={profile} />
            </MessagingProvider>
          </NotificationProvider>
        )}
      </div>
    </Router>
  );
}

function Header({ profile }: { profile: UserProfile | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/' || location.pathname === '';
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);

  return (
    <header className="bg-white/5 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-4">
          {!isHome ? (
            <button 
              onClick={() => navigate(-1)}
              className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5"
            >
              <ArrowLeft size={20} />
            </button>
          ) : (
            <div className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5">
              <Menu size={20} />
            </div>
          )}
          <div className="flex items-center gap-2">
            <div className="w-10 h-10 bg-gradient-to-br from-primary to-primary-dark rounded-xl flex items-center justify-center text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.4)]">
              <Zap size={24} className="fill-current" />
            </div>
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none italic">Comfort Hub</h1>
              <div className="flex items-center gap-1.5 mt-1">
                <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
                <p className="text-[9px] text-gray-400 uppercase font-bold tracking-widest">
                  {profile?.currentRole === 'supplier' ? 'Supplier Node' : 'Customer Node'}
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button 
            onClick={() => setShowNotifications(true)}
            className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary transition-all relative group"
          >
            <Bell size={20} className="group-hover:scale-110" />
            {unreadCount > 0 && (
              <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent rounded-full border-2 border-[#05070a] shadow-[0_0_10px_rgba(240,147,251,0.5)]"></span>
            )}
          </button>
          
          <AnimatePresence>
            {showNotifications && (
              <NotificationsModal onClose={() => setShowNotifications(false)} />
            )}
          </AnimatePresence>

          <Link to="/profile" className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 hover:border-primary/50 transition-colors text-primary font-bold">
            <div className="w-full h-full bg-primary/20 flex items-center justify-center overflow-hidden">
              {profile?.name?.charAt(0).toUpperCase() || <UserIcon size={18} />}
            </div>
          </Link>
        </div>
      </div>
    </header>
  );
}

function NotificationsModal({ onClose }: { onClose: () => void }) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();

  return (
    <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.9, opacity: 0, y: 20 }} 
        className="relative w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[80vh]"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Event Streams</h3>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">System Alerts & Interlocks</p>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white"><X size={20} /></button>
        </div>

        <div className="flex-1 overflow-y-auto p-4 space-y-3 no-scrollbar">
          {notifications.length > 0 ? (
            notifications.map((n) => (
              <div 
                key={n.id}
                onClick={() => {
                  markAsRead(n.id);
                  if (n.type === 'engage' || n.type === 'buy') navigate('/chat');
                  if (n.type === 'like_product' || n.type === 'rate') navigate(`/product/${n.targetId}`);
                  if (n.type === 'follow' || n.type === 'like_store') navigate(`/store/${n.targetId}`);
                  onClose();
                }}
                className={cn(
                  "p-4 rounded-2xl border transition-all cursor-pointer group",
                  n.read 
                    ? "bg-transparent border-white/5 opacity-60" 
                    : "bg-white/5 border-primary/20 shadow-[0_0_15px_rgba(0,242,254,0.1)]"
                )}
              >
                <div className="flex gap-4">
                  <div className={cn(
                    "w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0 transition-transform group-hover:scale-110",
                    !n.read ? "bg-primary/20 text-primary" : "bg-white/5 text-gray-500"
                  )}>
                    {getNotificationIcon(n.type)}
                  </div>
                  <div className="flex-1 min-w-0">
                    <div className="flex justify-between items-start">
                      <h4 className="text-[10px] font-black text-white uppercase tracking-tight truncate">{n.title}</h4>
                      <span className="text-[8px] font-black text-gray-600 uppercase ml-2 whitespace-nowrap">
                        {n.createdAt?.toDate ? n.createdAt.toDate().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                      </span>
                    </div>
                    <p className="text-[10px] text-gray-400 mt-1 leading-relaxed line-clamp-2">{n.message}</p>
                  </div>
                </div>
              </div>
            ))
          ) : (
            <div className="py-20 text-center space-y-4">
              <Zap size={32} className="mx-auto text-gray-800" />
              <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">All systems clear - No events queued</p>
            </div>
          )}
        </div>

        <div className="p-4 bg-white/5 border-t border-white/5">
          <button 
            onClick={() => {
              markAllAsRead();
              onClose();
            }}
            className="w-full py-3 bg-white/5 hover:bg-white/10 rounded-xl text-[9px] font-black text-gray-400 hover:text-white uppercase tracking-widest transition-all"
          >
            Mark all read
          </button>
        </div>
      </motion.div>
    </div>
  );
}

function getNotificationIcon(type: Notification['type']) {
  switch (type) {
    case 'engage': return <Zap size={18} />;
    case 'buy': return <ShoppingBag size={18} />;
    case 'rate': return <Star size={18} />;
    case 'follow': return <UserPlus size={18} />;
    case 'like_store':
    case 'like_product': return <Heart size={18} />;
    default: return <Bell size={18} />;
  }
}

function Navigation({ profile }: { profile: UserProfile | null }) {
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: Search, label: 'Explore' },
    ...(profile?.currentRole === 'supplier' ? [{ path: '/store', icon: Store, label: 'Store' }] : []),
    { path: '/deals', icon: Zap, label: 'Markets' },
    { path: '/chat', icon: MessageSquare, label: 'Comms' },
    { path: '/profile', icon: UserIcon, label: 'Hub' },
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-7xl px-4 z-30 flex justify-center">
      <div className="bg-[#0d1117]/80 backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center justify-between w-full max-w-[400px]">
        {navItems.map((item) => {
          const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
          return (
            <Link 
              key={item.path} 
              to={item.path}
              className={cn(
                "relative flex-1 flex flex-col items-center gap-1 py-2 rounded-xl transition-all duration-300 group",
                isActive ? "text-primary" : "text-gray-500 hover:text-gray-300"
              )}
            >
              {isActive && (
                <motion.div 
                  layoutId="nav-glow"
                  className="absolute inset-0 bg-primary/10 rounded-xl blur-md"
                />
              )}
              <item.icon 
                size={22} 
                className={cn(
                  "transition-all duration-300 relative z-10",
                  isActive ? "scale-110 drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]" : "group-hover:scale-110"
                )} 
              />
              <span className={cn("text-[9px] font-black uppercase tracking-widest relative z-10 transition-all", isActive ? "opacity-100" : "opacity-0 group-hover:opacity-100")}>
                {item.label}
              </span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
