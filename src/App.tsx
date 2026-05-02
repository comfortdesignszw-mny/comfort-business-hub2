/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType } from './lib/firebase';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { Search, ShoppingBag, MessageSquare, User as UserIcon, Store, LayoutGrid, Zap, Menu, Bell, ArrowLeft } from 'lucide-react';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Role } from './types';
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
import { MessagingProvider } from './components/MessagingProvider';

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
        )}
      </div>
    </Router>
  );
}

function Header({ profile }: { profile: UserProfile | null }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/' || location.pathname === '';

  return (
    <header className="bg-white/5 backdrop-blur-xl border-b border-white/5 p-4 sticky top-0 z-20">
      <div className="max-w-7xl mx-auto flex items-center justify-between">
        <div className="flex items-center gap-3">
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
          <button className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary transition-all relative group">
            <Bell size={20} className="group-hover:scale-110" />
            <span className="absolute top-2.5 right-2.5 w-2 h-2 bg-accent rounded-full border-2 border-[#05070a] shadow-[0_0_10px_rgba(240,147,251,0.5)]"></span>
          </button>
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
