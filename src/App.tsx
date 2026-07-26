/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, lazy, Suspense } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, Link, useLocation, useNavigate } from 'react-router-dom';
import { onAuthStateChanged, User } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, syncPublicProfile } from './lib/firebase';
import { doc, getDoc, setDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { 
  Search, ShoppingBag, MessageSquare, User as UserIcon, Store, LayoutGrid, 
  Zap, Menu, Bell, ArrowLeft, ArrowRight, X, Heart, Star, UserPlus, Check, Loader2, Users, ShieldAlert,
  LogIn, Download, Compass, Settings, HelpCircle
} from 'lucide-react';
import AppTutorialModal from './components/AppTutorialModal';
import PushNotificationSettingsModal from './components/PushNotificationSettingsModal';
import AppLogo from './components/AppLogo';
import { motion, AnimatePresence } from 'motion/react';
import { UserProfile, Role, AppNotification } from './types';
import { cn } from './lib/utils';
import { MessagingProvider, useMessaging } from './components/MessagingProvider';
import { NotificationProvider, useNotifications } from './components/NotificationProvider';
import { ModalProvider } from './context/ModalContext';
import SyncIndicator from './components/SyncIndicator';
import { interactionService } from './services/interactionService';
import PWAPrompt from './components/PWAPrompt';
import { ErrorBoundary } from './components/ErrorBoundary';
import { useMobileHeight } from './hooks/useMobileHeight';

// Lazy loaded pages for performance
const Discovery = lazy(() => import('./pages/Discovery'));
const DealRoom = lazy(() => import('./pages/DealRoom'));
const Chat = lazy(() => import('./pages/Chat'));
const Profile = lazy(() => import('./pages/Profile'));
import Login from './pages/Login';
import SignUp from './pages/SignUp';
const SupplierSetup = lazy(() => import('./pages/SupplierSetup'));
const SupplierDashboard = lazy(() => import('./pages/SupplierDashboard'));
const CustomerSetup = lazy(() => import('./pages/CustomerSetup'));
const StoreDetail = lazy(() => import('./pages/StoreDetail'));
const StoresHub = lazy(() => import('./pages/StoresHub'));
const ProductDetail = lazy(() => import('./pages/ProductDetail'));
const AdminDashboard = lazy(() => import('./pages/AdminDashboard'));
const TermsOfService = lazy(() => import('./pages/TermsOfService'));
const PrivacyPolicy = lazy(() => import('./pages/PrivacyPolicy'));

import Footer from './components/Footer';

// Loading component for suspense
const PageLoader = () => (
  <div className="flex items-center justify-center h-[50vh]">
    <motion.div 
      animate={{ rotate: 360 }}
      transition={{ repeat: Infinity, duration: 1, ease: "linear" }}
      className="text-primary"
    >
      <Zap size={24} />
    </motion.div>
  </div>
);

// Global Scroll To Top component
const ScrollToTop = () => {
  const location = useLocation();

  useEffect(() => {
    // Explicitly set browser scroll restoration to manual so standard browser history navigation does not battle our reset
    if (typeof window !== 'undefined' && 'scrollRestoration' in window.history) {
      window.history.scrollRestoration = 'manual';
    }
  }, []);

  useEffect(() => {
    const performScrollReset = () => {
      // Scroll the main content pane
      const main = document.querySelector('main');
      if (main) {
        main.scrollTo(0, 0);
        main.scrollTop = 0;
      }

      // Scroll window frame elements
      window.scrollTo(0, 0);
      if (document.documentElement) document.documentElement.scrollTop = 0;
      if (document.body) document.body.scrollTop = 0;

      // Scroll any active modal / overlay containers
      const scrollableElements = document.querySelectorAll('.overflow-y-auto, .overflow-auto');
      scrollableElements.forEach((el) => {
        el.scrollTo(0, 0);
        el.scrollTop = 0;
      });
    };

    // Reset scroll immediately
    performScrollReset();

    // Defer a tiny bit to run clean-ups after React finishes its layout cycles and content gets painted
    const animationFrameId = requestAnimationFrame(performScrollReset);
    const timeoutId = setTimeout(performScrollReset, 20);

    return () => {
      cancelAnimationFrame(animationFrameId);
      clearTimeout(timeoutId);
    };
  }, [location.pathname, location.search, location.hash]);

  return null;
};

export default function App() {
  useMobileHeight();
  const [user, setUser] = useState<User | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [isGuest, setIsGuest] = useState<boolean>(false);
  const [hasStore, setHasStore] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);

  const [showSidebar, setShowSidebar] = useState(false);

  useEffect(() => {
    if ('serviceWorker' in navigator) {
      navigator.serviceWorker.addEventListener('message', (event) => {
        if (event.data && event.data.type === 'SYNC_TRIGGERED') {
          console.log('[Background Sync] Triggered via SW', event.data.tag);
          import('./lib/sync').then(({ processOutbox }) => {
            processOutbox();
          });
        }
      });
      
      // Attempt to register sync if online
      navigator.serviceWorker.ready.then((registration) => {
        if ('sync' in registration) {
          // @ts-ignore
          registration.sync.register('sync-data-mutations').catch(console.error);
        }
      });
    }
  }, []);

  // Profile completion check
  const isProfileIncomplete = profile?.currentRole === 'customer' && (!profile.requiredProducts || profile.requiredProducts.length === 0);

  useEffect(() => {
    // Check for guest session on mount
    const savedGuestProfile = localStorage.getItem('guest_profile');
    if (savedGuestProfile && !user) {
      try {
        const guestData = JSON.parse(savedGuestProfile);
        setProfile(guestData);
        setIsGuest(true);
      } catch (e) {
        console.error("Failed to parse guest profile", e);
      }
    }

    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setIsGuest(false);
        localStorage.removeItem('guest_profile');
        const userPath = `users/${firebaseUser.uid}`;

        // 1. Instantly restore from local cache for blazing fast load!
        try {
          const cachedProfile = localStorage.getItem(`profile_cache_${firebaseUser.uid}`);
          if (cachedProfile) {
            const data = JSON.parse(cachedProfile);
            setProfile(data);
            setUser(firebaseUser);
            if (localStorage.getItem(`has_store_${firebaseUser.uid}`) === 'true') {
              setHasStore(true);
            }
            setLoading(false); // unblock UI immediately
          }
        } catch(e) {}

        // Immediate sync termination for the 30-sec rule enforcement
        if (!localStorage.getItem('sync_cleared_30s_rule_v2')) {
          import('./lib/db').then(({ localDB }) => {
             localDB.outbox.clear().then(() => {
               localStorage.setItem('sync_cleared_30s_rule_v2', 'true');
               console.log('[Sync] Forcefully terminated all active syncing and cleared queue.');
             });
          });
        }

        try {
          const docSnap = await getDoc(doc(db, 'users', firebaseUser.uid));
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            
            // Update cache
            localStorage.setItem(`profile_cache_${firebaseUser.uid}`, JSON.stringify(profileData));
            
            if (profileData.status === 'suspended') {
              localStorage.setItem('quarantine_temp', JSON.stringify({
                duration: profileData.suspensionDuration || '14 days'
              }));
              await auth.signOut();
              setUser(null);
              setProfile(null);
              setLoading(false);
              return;
            }
          }
          
          setUser(firebaseUser);
          if (docSnap.exists()) {
            const profileData = docSnap.data() as UserProfile;
            setProfile(profileData); // update with fresh data
            
            // Sync verification status and profile info with Firebase Auth
            let needsUpdate = false;
            const updates: any = {};
 
            if (profileData.isVerified !== firebaseUser.emailVerified) {
              updates.isVerified = firebaseUser.emailVerified;
              needsUpdate = true;
            }
 
            if (!profileData.avatar && firebaseUser.photoURL) {
              updates.avatar = firebaseUser.photoURL;
              needsUpdate = true;
            }
 
            if (!profileData.email && firebaseUser.email) {
              updates.email = firebaseUser.email;
              needsUpdate = true;
            }
 
            if (needsUpdate) {
              updates.updatedAt = serverTimestamp();
              await updateDoc(doc(db, 'users', firebaseUser.uid), updates);
              // Optimistically update local profile (minus serverTimestamp which is complex to represent locally without causing dev server vs rules issues)
              setProfile({ ...profileData, ...updates, updatedAt: new Date().toISOString() });
            } else {
              setProfile(profileData);
            }
 
            // Proactively sync public profile for matrix visibility
            syncPublicProfile(profileData);
 
            if (profileData.currentRole === 'supplier') {
              const { collection, query, where, getDocs } = await import('firebase/firestore');
              const storeRes = await getDocs(query(collection(db, 'stores'), where('ownerId', '==', firebaseUser.uid)));
              const userHasStore = !storeRes.empty;
              setHasStore(userHasStore);
              if (userHasStore) {
                localStorage.setItem(`has_store_${firebaseUser.uid}`, 'true');
              } else {
                localStorage.setItem(`has_store_${firebaseUser.uid}`, 'false');
              }
            }
          } else {
            setProfile(null);
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.GET, userPath);
        }
      } else {
        setUser(null);
        setProfile(null);
        setHasStore(false);
      }
      setLoading(false);
    });
    return unsubscribe;
  }, [user]);

  const handleGuestLogin = () => {
    const guestUid = `guest_${Math.random().toString(36).substring(2, 11)}`;
    const guestProfile: UserProfile = {
      uid: guestUid,
      isGuest: true,
      name: 'Guest User',
      phone: '',
      currentRole: 'customer',
      isVerified: false,
      updatedAt: new Date().toISOString()
    };
    setProfile(guestProfile);
    setIsGuest(true);
    localStorage.setItem('guest_profile', JSON.stringify(guestProfile));
  };

  const handleLogout = async () => {
    if (isGuest) {
      setProfile(null);
      setIsGuest(false);
      localStorage.removeItem('guest_profile');
    } else {
      await auth.signOut();
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen-mobile bg-[#05070a]">
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
            className="w-24 h-24 relative z-10 flex items-center justify-center"
          >
            <div className="p-1 shadow-[0_0_20px_rgba(0,242,254,0.3)] animate-pulse">
              <AppLogo size="xl" />
            </div>
          </motion.div>
        </div>
      </div>
    );
  }

  return (
    <ErrorBoundary>
      <Router>
        <ScrollToTop />
        <div className="flex flex-col h-screen-mobile bg-[#05070a] relative shadow-2xl">
          <AnimatePresence mode="wait">
            <Suspense fallback={<PageLoader />}>
              <Routes>
                <Route path="/*" element={
                  <NotificationProvider profile={profile}>
                    <MessagingProvider profile={profile}>
                      <ModalProvider profile={profile}>
                        <Header profile={profile} onMenuClick={() => setShowSidebar(true)} onLogout={handleLogout} />
                        <AnimatePresence>
                          {showSidebar && (
                            <Sidebar 
                              profile={profile} 
                              onClose={() => setShowSidebar(false)} 
                              onLogout={handleLogout}
                            />
                          )}
                        </AnimatePresence>
                        <main className="flex-1 overflow-y-auto custom-scrollbar pb-24">
                          <div className="max-w-7xl mx-auto w-full min-h-full flex flex-col">
                            <div className="flex-1">
                              <AnimatePresence mode="wait">
                                <Suspense fallback={<PageLoader />}>
                                  <Routes>
                                    {/* Public Routes */}
                                    <Route path="/" element={<Discovery profile={profile} setProfile={setProfile} onGuestLogin={handleGuestLogin} />} />
                                    <Route path="/store/:id" element={<StoreDetail profile={profile} onGuestLogin={handleGuestLogin} />} />
                                    <Route path="/product/:id" element={<ProductDetail profile={profile} onGuestLogin={handleGuestLogin} />} />
                                    <Route path="/profile/:id" element={<Profile profile={profile} setProfile={setProfile} />} />
                                    <Route path="/terms" element={<TermsOfService />} />
                                    <Route path="/privacy" element={<PrivacyPolicy />} />
                                    <Route path="/login" element={user ? <Navigate to="/" replace /> : <Login />} />
                                    <Route path="/signup" element={user ? <Navigate to="/" replace /> : <SignUp />} />

                                    {/* Protected Content */}
                                    {!user ? (
                                      <Route path="*" element={<Navigate to="/login" replace />} />
                                    ) : (
                                      <>
                                        {isProfileIncomplete ? (
                                          <Route path="*" element={<CustomerSetup profile={profile!} />} />
                                        ) : (
                                          <>
                                            <Route 
                                              path="/stores" 
                                              element={
                                                profile?.currentRole === 'supplier' 
                                                  ? <StoresHub profile={profile} /> 
                                                  : <Navigate to="/" replace />
                                              } 
                                            />
                                            <Route path="/deals" element={<DealRoom profile={profile} />} />
                                            <Route path="/chat" element={<Chat profile={profile} />} />
                                            <Route path="/admin" element={<AdminDashboard profile={profile} />} />
                                            <Route path="/profile" element={<Profile profile={profile} setProfile={setProfile} />} />
                                            <Route path="*" element={<Navigate to="/" replace />} />
                                          </>
                                        )}
                                      </>
                                    )}
                                  </Routes>
                                </Suspense>
                              </AnimatePresence>
                            </div>
                            <Footer />
                          </div>
                        </main>
                        <Navigation profile={profile} />
                        <PWAPrompt />
                      </ModalProvider>
                    </MessagingProvider>
                  </NotificationProvider>
                } />
              </Routes>
            </Suspense>
          </AnimatePresence>
        </div>
      </Router>
    </ErrorBoundary>
  );
}

function Header({ profile, onMenuClick, onLogout }: { profile: UserProfile | null, onMenuClick?: () => void, onLogout?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const isHome = location.pathname === '/' || location.pathname === '';
  const { unreadCount } = useNotifications();
  const [showNotifications, setShowNotifications] = useState(false);
  const [showTutorial, setShowTutorial] = useState(false);

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
            <button 
              onClick={onMenuClick}
              className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white transition-colors border border-white/5"
            >
              <Menu size={20} />
            </button>
          )}
          <div className="flex items-center gap-2">
            <AppLogo size="md" />
            <div>
              <h1 className="text-sm font-black text-white uppercase tracking-tighter leading-none italic">Comfort Hub</h1>
              <div className="flex items-center gap-2 mt-1">
                <SyncIndicator />
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setShowTutorial(true)}
            className="flex items-center gap-1.5 px-2.5 py-2 bg-white/5 hover:bg-white/10 text-gray-300 hover:text-white border border-white/10 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all"
            title="How To Navigate App Tutorial"
          >
            <Compass size={14} className="text-primary animate-spin-slow" />
            <span className="hidden md:inline">Tutorial</span>
          </button>

          {profile ? (
            <>
              <button 
                onClick={() => setShowNotifications(true)}
                className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-primary transition-all relative group"
              >
                <Bell size={20} className="group-hover:scale-110" />
                {unreadCount > 0 && (
                  <span className="absolute -top-1 -right-1 min-w-[18px] h-[18px] px-1 bg-red-600 rounded-full border-2 border-[#05070a] shadow-[0_0_10px_rgba(255,0,0,0.5)] flex items-center justify-center text-[8px] font-black text-white">
                    {unreadCount > 9 ? '9+' : unreadCount}
                  </span>
                )}
              </button>
              
              <AnimatePresence>
                {showNotifications && (
                  <NotificationsModal profile={profile} onClose={() => setShowNotifications(false)} />
                )}
              </AnimatePresence>

              <AppTutorialModal 
                isOpen={showTutorial} 
                onClose={() => setShowTutorial(false)} 
              />

              <Link to="/profile" className="w-10 h-10 rounded-xl overflow-hidden border border-white/10 hover:border-primary/50 transition-colors text-primary font-bold">
                <div className="w-full h-full bg-primary/20 flex items-center justify-center overflow-hidden">
                  {profile?.name?.charAt(0).toUpperCase() || <UserIcon size={18} />}
                </div>
              </Link>

              {profile?.isGuest && (
                <button 
                  onClick={onLogout}
                  className="w-10 h-10 bg-red-500/10 rounded-xl flex items-center justify-center text-red-500 hover:bg-red-500 hover:text-white transition-all border border-red-500/20"
                  title="Logout Guest Agent"
                >
                  <X size={20} />
                </button>
              )}
            </>
          ) : (
            <Link 
              to="/login"
              className="bg-primary px-4 py-2 rounded-xl text-[10px] font-black uppercase text-[#05070a] tracking-widest hover:shadow-[0_0_15px_rgba(0,242,254,0.3)] transition-all flex items-center gap-2"
            >
              <LogIn size={14} />
              Login
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}

function Sidebar({ profile, onClose, onLogout }: { profile: UserProfile | null, onClose: () => void, onLogout?: () => void }) {
  const { unreadMessagesCount } = useMessaging();
  const location = useLocation();
  const navItems = [
    { path: '/', icon: Search, label: 'Explore' },
    ...(profile ? [
      ...(profile.currentRole === 'supplier' ? [{ path: '/stores', icon: Store, label: 'Stores' }] : []),
      { path: '/deals', icon: Zap, label: 'Markets' },
      { path: '/chat', icon: MessageSquare, label: 'Comms' },
      ...(profile.email === 'comfort.designszw@gmail.com' || profile.isAdmin ? [{ path: '/admin', icon: ShieldAlert, label: 'Command' }] : []),
      { path: '/profile', icon: UserIcon, label: 'Hub' },
    ] : [
      { path: '/login', icon: LogIn, label: 'Hub Login' }
    ]),
  ];

  return (
    <div className="fixed inset-0 z-50 overflow-hidden lg:hidden">
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#05070a]/80 backdrop-blur-sm"
        onClick={onClose}
      />
      <motion.aside
        initial={{ x: '-100%' }}
        animate={{ x: 0 }}
        exit={{ x: '-100%' }}
        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
        className="absolute inset-y-0 left-0 w-72 bg-[#0d1117] border-r border-white/10 shadow-2xl flex flex-col"
      >
        <div className="p-6 border-b border-white/5 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <AppLogo size="md" />
            <h2 className="text-sm font-black text-white uppercase italic">Comfort Hub</h2>
          </div>
          <button onClick={onClose} className="text-gray-500 hover:text-white transition-colors">
            <X size={20} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto py-6 px-4 space-y-2">
          {navItems.map((item) => {
            const isActive = location.pathname === item.path || (item.path === '/' && location.pathname === '');
            return (
              <Link
                key={item.path}
                to={item.path}
                onClick={onClose}
                className={cn(
                  "flex items-center gap-4 px-4 py-3 rounded-xl transition-all group",
                  isActive 
                    ? "bg-primary/10 text-primary border border-primary/20" 
                    : "text-gray-400 hover:bg-white/5 hover:text-white border border-transparent"
                )}
              >
                <item.icon 
                  size={20} 
                  className={cn(
                    "transition-transform group-hover:scale-110",
                    isActive ? "drop-shadow-[0_0_8px_rgba(0,242,254,0.5)]" : ""
                  )} 
                />
                <span className="text-[10px] font-black uppercase tracking-widest leading-none">
                  {item.label}
                </span>
                {item.label === 'Comms' && unreadMessagesCount > 0 && (
                  <span className="ml-auto min-w-[16px] h-4 px-1 bg-red-600 rounded-lg flex items-center justify-center text-[8px] font-black text-white shadow-[0_0_8px_rgba(255,0,0,0.4)]">
                    {unreadMessagesCount}
                  </span>
                )}
                {isActive && item.label !== 'Comms' && (
                  <div className="ml-auto w-1 h-1 bg-primary rounded-full shadow-[0_0_5px_rgba(0,242,254,0.8)]" />
                )}
              </Link>
            );
          })}
        </div>

        <div className="p-6 border-t border-white/5 bg-white/5 space-y-4">
          <button
            onClick={() => {
              onClose();
              window.dispatchEvent(new CustomEvent('pwa-prompt-install'));
            }}
            className="w-full py-2.5 bg-primary/10 border border-primary/30 text-primary rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-primary hover:text-black transition-all flex items-center justify-center gap-2"
          >
            <Download size={14} />
            Install Native App
          </button>

          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary font-bold overflow-hidden border border-primary/20">
              {profile?.name?.charAt(0).toUpperCase() || <UserIcon size={18} />}
            </div>
            <div className="flex-1 min-w-0">
              <p className="text-[10px] font-black text-white uppercase truncate">{profile?.name || 'Anonymous User'}</p>
              <p className="text-[8px] text-gray-500 font-bold uppercase tracking-widest">
                {profile ? (profile.currentRole || 'Member') : 'Browsing Matrix'} {profile?.isGuest && '(Guest Session)'}
              </p>
            </div>
          </div>

          {profile?.isGuest && (
            <button 
              onClick={() => {
                if (onLogout) onLogout();
                onClose();
              }}
              className="w-full py-3 bg-red-500/10 border border-red-500/20 text-red-500 rounded-xl text-[9px] font-black uppercase tracking-widest hover:bg-red-500 hover:text-white transition-all flex items-center justify-center gap-2"
            >
              <LogIn size={14} className="rotate-180" />
              Terminate Guest Session
            </button>
          )}
        </div>
      </motion.aside>
    </div>
  );
}

function NotificationsModal({ profile, onClose }: { profile: UserProfile | null, onClose: () => void }) {
  const { notifications, markAsRead, markAllAsRead } = useNotifications();
  const navigate = useNavigate();
  const [showSettings, setShowSettings] = useState(false);
  const [activeNotification, setActiveNotification] = useState<AppNotification | null>(null);

  return (
    <div className="fixed inset-0 z-[100] flex items-start justify-center p-4 sm:p-6 md:p-8 pt-20 sm:pt-24 pointer-events-none">
      <motion.div 
        initial={{ opacity: 0 }} 
        animate={{ opacity: 1 }} 
        exit={{ opacity: 0 }} 
        className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md pointer-events-auto" 
        onClick={onClose} 
      />
      <motion.div 
        initial={{ scale: 0.95, opacity: 0, y: -20 }} 
        animate={{ scale: 1, opacity: 1, y: 0 }} 
        exit={{ scale: 0.95, opacity: 0, y: -20 }} 
        className="relative w-full max-w-sm bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[75vh] pointer-events-auto"
      >
        <div className="p-6 border-b border-white/5 flex justify-between items-center bg-white/5">
          <div>
            <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">
              {activeNotification ? 'Alert Reader' : 'Event Streams'}
            </h3>
            <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest leading-none">
              {activeNotification ? 'Full Stream Detail' : 'System Alerts & Interlocks'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            {activeNotification ? (
              <button 
                onClick={() => setActiveNotification(null)} 
                className="px-2.5 py-1 bg-white/5 hover:bg-white/10 rounded-lg text-gray-400 hover:text-white text-[9px] font-black uppercase tracking-wider transition-all border border-white/5"
              >
                Back
              </button>
            ) : (
              <button 
                onClick={() => setShowSettings(true)}
                className="p-1.5 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-primary transition-all border border-white/5"
                title="Push Notification Settings"
              >
                <Settings size={18} />
              </button>
            )}
            <button onClick={onClose} className="text-gray-500 hover:text-white p-1"><X size={20} /></button>
          </div>
        </div>

        {activeNotification ? (
          <div className="p-6 space-y-5 flex-1 overflow-y-auto custom-scrollbar">
            <div className="flex items-start gap-3">
              <div className="w-11 h-11 rounded-2xl bg-primary/20 text-primary border border-primary/30 flex items-center justify-center shrink-0">
                {getNotificationIcon(activeNotification.type)}
              </div>
              <div className="space-y-1 min-w-0 flex-1">
                <h4 className="text-sm font-black text-white uppercase tracking-tight leading-snug">{activeNotification.title}</h4>
                <div className="flex items-center gap-2 text-[8px] text-gray-500 font-black uppercase tracking-widest">
                  <span>{activeNotification.fromUserName || 'Comfort Business Hub'}</span>
                  <span>•</span>
                  <span>{activeNotification.createdAt?.toDate ? activeNotification.createdAt.toDate().toLocaleString() : 'Just now'}</span>
                </div>
              </div>
            </div>

            <div className="p-4 bg-white/5 border border-white/10 rounded-2xl space-y-2">
              <p className="text-xs text-gray-200 font-medium leading-relaxed whitespace-pre-wrap">
                {activeNotification.message}
              </p>
            </div>

            <div className="pt-2 space-y-2">
              {activeNotification.targetId && (
                <button
                  onClick={async () => {
                    await markAsRead(activeNotification.id);
                    if (activeNotification.type === 'like_product' || activeNotification.type === 'rate') navigate(`/product/${activeNotification.targetId}`);
                    if (activeNotification.type === 'follow' || activeNotification.type === 'like_store') navigate(`/store/${activeNotification.targetId}`);
                    if (activeNotification.type === 'engage' || activeNotification.type === 'buy') navigate('/chat');
                    onClose();
                  }}
                  className="w-full py-2.5 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/10 flex items-center justify-center gap-2"
                >
                  View Related Content <ArrowRight size={12} />
                </button>
              )}

              <button
                onClick={async () => {
                  await markAsRead(activeNotification.id);
                  setActiveNotification(null);
                  onClose();
                }}
                className="w-full py-3 bg-primary hover:bg-white text-[#05070a] rounded-xl text-[10px] font-black uppercase tracking-widest transition-all shadow-[0_0_20px_rgba(0,242,254,0.3)] flex items-center justify-center gap-2"
              >
                <Check size={14} /> OK / Close Message
              </button>
            </div>
          </div>
        ) : (
          <div className="flex-1 overflow-y-auto p-4 space-y-3 custom-scrollbar scroll-smooth">
            {notifications.length > 0 ? (
              (() => {
                const unread = notifications.filter(n => !n.read);
                const read = notifications.filter(n => n.read);
                
                return (
                  <>
                    {unread.map((n, idx) => (
                      <NotificationItem 
                        key={`unread-${n.id || idx}`} 
                        n={n} 
                        markAsRead={markAsRead} 
                        onSelect={(item) => setActiveNotification(item)}
                        onClose={onClose} 
                        navigate={navigate} 
                        profile={profile}
                      />
                    ))}
                    
                    {read.length > 0 && (
                      <div className="pt-4 pb-2 px-2">
                        <div className="flex items-center gap-4">
                          <div className="h-px flex-1 bg-white/5" />
                          <span className="text-[8px] font-black text-gray-600 uppercase tracking-[0.2em] whitespace-nowrap">Earlier Streams</span>
                          <div className="h-px flex-1 bg-white/5" />
                        </div>
                      </div>
                    )}
                    
                    {read.map((n, idx) => (
                      <NotificationItem 
                        key={`read-${n.id || idx}`} 
                        n={n} 
                        markAsRead={markAsRead} 
                        onSelect={(item) => setActiveNotification(item)}
                        onClose={onClose} 
                        navigate={navigate} 
                        profile={profile}
                      />
                    ))}
                  </>
                );
              })()
            ) : (
              <div className="py-20 text-center space-y-4">
                <Zap size={32} className="mx-auto text-gray-800" />
                <p className="text-[10px] font-black text-gray-600 uppercase tracking-widest italic">All systems clear - No events queued</p>
              </div>
            )}
          </div>
        )}

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

        <PushNotificationSettingsModal 
          isOpen={showSettings} 
          onClose={() => setShowSettings(false)} 
        />
      </motion.div>
    </div>
  );
}

function NotificationItem({ n, markAsRead, onSelect, onClose, navigate, profile }: { n: AppNotification, markAsRead: (id: string) => Promise<void>, onSelect?: (item: AppNotification) => void, onClose: () => void, navigate: any, profile: UserProfile | null, key?: string }) {
  const [isProcessing, setIsProcessing] = useState(false);

  const handleConnectionAction = async (e: React.MouseEvent, action: 'accept' | 'decline') => {
    e.stopPropagation();
    if (!profile || isProcessing) return;
    setIsProcessing(true);
    try {
      if (action === 'accept') {
        const connSnap = await getDoc(doc(db, 'connections', n.targetId!));
        if (connSnap.exists()) {
          await interactionService.acceptConnection(n.targetId!, connSnap.data(), profile);
        }
      } else {
        await interactionService.declineConnection(n.targetId!);
      }
      await markAsRead(n.id);
    } catch (err) {
      console.error("Connection action failed:", err);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div 
      onClick={() => {
        if (n.type === 'connect_request') return; // Must use accept/decline buttons
        if (onSelect) {
          onSelect(n);
        } else {
          markAsRead(n.id);
          if (n.type === 'engage' || n.type === 'buy') navigate('/chat');
          if (n.type === 'like_product' || n.type === 'rate') navigate(`/product/${n.targetId}`);
          if (n.type === 'follow' || n.type === 'like_store') navigate(`/store/${n.targetId}`);
          onClose();
        }
      }}
      className={cn(
        "p-4 rounded-2xl border transition-all group relative overflow-hidden cursor-pointer",
        n.read 
          ? "bg-transparent border-white/5 opacity-60" 
          : "bg-primary/[0.03] border-primary/30 shadow-[0_0_20px_rgba(0,242,254,0.15)]",
        n.type === 'connect_request' && !n.read && "cursor-default"
      )}
    >
      {!n.read && (
        <div className="absolute top-0 left-0 w-1 h-full bg-primary shadow-[0_0_10px_rgba(0,242,254,0.5)]" />
      )}
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
          
          {n.type === 'connect_request' && !n.read && (
            <div className="flex gap-2 mt-4">
              <button 
                onClick={(e) => handleConnectionAction(e, 'accept')}
                disabled={isProcessing}
                className="flex-1 py-2 bg-primary rounded-lg text-[9px] font-black text-[#05070a] uppercase tracking-widest flex items-center justify-center gap-1 hover:scale-105 transition-all"
              >
                {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <Check size={10} />} Accept
              </button>
              <button 
                onClick={(e) => handleConnectionAction(e, 'decline')}
                disabled={isProcessing}
                className="flex-1 py-2 bg-white/5 border border-white/10 rounded-lg text-[9px] font-black text-gray-400 uppercase tracking-widest flex items-center justify-center gap-1 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/30 transition-all"
              >
                {isProcessing ? <Loader2 size={10} className="animate-spin" /> : <X size={10} />} Deny
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function getNotificationIcon(type: AppNotification['type']) {
  switch (type) {
    case 'engage': return <Zap size={18} />;
    case 'buy': return <ShoppingBag size={18} />;
    case 'rate': return <Star size={18} />;
    case 'follow': return <UserPlus size={18} />;
    case 'like_store':
    case 'like_product': return <Heart size={18} />;
    case 'connect_request': return <Users size={18} />;
    case 'connect_accept': return <Check size={18} className="text-neon-green" />;
    case 'message': return <MessageSquare size={18} />;
    case 'reminder': return <Store size={18} className="text-neon-green" />;
    case 'report': return <ShieldAlert size={18} className="text-red-500" />;
    default: return <Bell size={18} />;
  }
}

function Navigation({ profile }: { profile: UserProfile | null }) {
  const { unreadMessagesCount } = useMessaging();
  const location = useLocation();
  
  const navItems = [
    { path: '/', icon: Search, label: 'Explore' },
    ...(profile ? [
      ...(profile.currentRole === 'supplier' ? [{ path: '/stores', icon: Store, label: 'Stores' }] : []),
      { path: '/deals', icon: Zap, label: 'Markets' },
      { path: '/chat', icon: MessageSquare, label: 'Comms' },
      ...(profile.email === 'comfort.designszw@gmail.com' || profile.isAdmin ? [{ path: '/admin', icon: ShieldAlert, label: 'Command' }] : []),
      { path: '/profile', icon: UserIcon, label: 'Hub' },
    ] : [
      { path: '/login', icon: LogIn, label: 'Hub login' }
    ]),
  ];

  return (
    <nav className="fixed bottom-6 left-1/2 -translate-x-1/2 w-full max-w-7xl px-4 z-30 flex justify-center pointer-events-none">
      <div className="bg-[#0d1117]/80 backdrop-blur-2xl border border-white/10 p-2 rounded-2xl shadow-2xl flex items-center justify-between w-full max-w-[400px] pointer-events-auto">
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
              {item.label === 'Comms' && unreadMessagesCount > 0 && (
                <span className="absolute top-1.5 right-1.5 min-w-[14px] h-[14px] px-1 bg-red-600 rounded-full border border-[#05070a] flex items-center justify-center text-[7px] font-black text-white z-20 shadow-[0_0_8px_rgba(255,0,0,0.5)] animate-pulse">
                  {unreadMessagesCount}
                </span>
              )}
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
