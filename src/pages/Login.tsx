import React, { useState } from 'react';
import { signInWithPopup, GoogleAuthProvider, browserPopupRedirectResolver } from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, syncPublicProfile } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { Zap, LogIn, Shield, Globe, Cpu, AlertTriangle } from 'lucide-react';
import { Link } from 'react-router-dom';
import { UserProfile } from '../types';

export default function Login() {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    try {
      const provider = new GoogleAuthProvider();
      // Using browserPopupRedirectResolver to improve communication in iframe environments
      const { user } = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      
      const userPath = `users/${user.uid}`;
      // Check if profile exists
      let docSnap;
      try {
        docSnap = await getDoc(doc(db, 'users', user.uid));
      } catch (e) {
        handleFirestoreError(e, OperationType.GET, userPath);
        return;
      }

      const profileData: Partial<UserProfile> = {
        uid: user.uid,
        name: user.displayName || 'Operator',
        email: user.email || undefined,
        avatar: user.photoURL || undefined,
        isVerified: user.emailVerified,
        updatedAt: serverTimestamp()
      };

      if (!docSnap.exists()) {
        const newProfile: UserProfile = {
          ...profileData,
          phone: user.phoneNumber || 'Unlinked',
          currentRole: 'customer',
        } as UserProfile;
        
        try {
          await setDoc(doc(db, 'users', user.uid), newProfile);
          await syncPublicProfile(newProfile);
        } catch (e) {
          handleFirestoreError(e, OperationType.WRITE, userPath);
          return;
        }
      } else {
        // Sync existing profile with latest Google data
        try {
          await setDoc(doc(db, 'users', user.uid), profileData, { merge: true });
          const existingProfile = docSnap.data() as UserProfile;
          await syncPublicProfile({ ...existingProfile, ...profileData });
        } catch (e) {
          handleFirestoreError(e, OperationType.UPDATE, userPath);
          return;
        }
      }
      
      window.location.reload();
    } catch (err: any) {
      console.error('Login Error:', err);
      let message = err.message || "Failed to establish uplink.";
      
      if (err.code === 'auth/internal-error' || err.code === 'auth/network-request-failed') {
        message = "Network connectivity issues or unauthorized terminal. Ensure your domain is allowlisted in Firebase, and try again";
      } else if (err.code === 'auth/popup-blocked') {
        message = "Login interface blocked by browser. Please enable popups for this site and try again.";
      } else if (err.code === 'auth/popup-closed-by-user') {
        message = "Authentication sequence aborted by operator.";
      }
      
      setError(message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#05070a] p-8">
      <div className="flex-1 flex flex-col justify-center space-y-12 max-w-sm mx-auto w-full">
        <header className="flex flex-col items-center text-center space-y-6">
          <motion.div 
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
            className="w-28 h-28 bg-white/5 rounded-[2.5rem] flex items-center justify-center shadow-[0_0_50px_rgba(0,242,254,0.15)] relative group overflow-hidden border border-white/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/5 opacity-50"></div>
            <img src="/icon.png" alt="Comfort Hub" className="w-16 h-16 object-contain relative z-10 drop-shadow-[0_0_15px_rgba(0,242,254,0.5)]" />
          </motion.div>
          <div className="space-y-2 relative">
            <h1 className="text-4xl font-black text-white italic tracking-tighter uppercase leading-none">
              Comfort<br/><span className="text-primary drop-shadow-[0_0_10px_rgba(0,242,254,0.5)]">Business Hub</span>
            </h1>
            <p className="text-xs text-gray-500 font-bold uppercase tracking-[0.3em] opacity-60">The Future of Zimbabwe Commerce</p>
          </div>
        </header>

        <motion.div 
          layout
          className="neon-card p-8 space-y-8 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 blur-3xl -ml-16 -mt-16"></div>
          
          <AnimatePresence mode="wait">
            <motion.div 
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              className="space-y-8"
            >
              <div className="space-y-4">
                <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/10 italic">
                  <Shield size={20} className="text-primary shrink-0" />
                  <p className="text-[10px] text-gray-400 font-bold uppercase tracking-wider">Authentication Protocol Required</p>
                </div>
                
                {error && (
                  <div className="space-y-4">
                    <div className="p-3 bg-red-500/10 border border-red-500/20 rounded-xl text-red-500 text-[10px] font-bold uppercase tracking-wider text-center flex items-center gap-2">
                      <AlertTriangle size={14} className="shrink-0" />
                      {error}
                    </div>
                  </div>
                )}

                <button 
                  onClick={handleGoogleLogin}
                  disabled={loading}
                  className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
                >
                  {loading ? (
                    <Cpu className="animate-spin" size={20} />
                  ) : (
                    <>
                      <LogIn size={20} />
                      Uplink via Google
                    </>
                  )}
                </button>
              </div>

                <div className="p-6 bg-white/[0.02] rounded-2xl border border-white/5 space-y-4">
                  <div className="flex items-center gap-2">
                    <Globe size={14} className="text-primary" />
                    <span className="text-[9px] font-black uppercase text-white tracking-widest">Global Node Access</span>
                  </div>
                  <p className="text-[10px] text-gray-500 leading-relaxed font-medium">By connecting, you authorize the Comfort Business Hub to synchronize your trade data across regional nodes.</p>
                  
                  <div className="flex justify-center gap-6 pt-2 border-t border-white/5">
                    <Link to="/terms" className="text-[9px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors">Terms of Service</Link>
                    <Link to="/privacy" className="text-[9px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors">Privacy Policy</Link>
                  </div>
                </div>
            </motion.div>
          </AnimatePresence>
        </motion.div>

        <section className="space-y-4">
          <div className="flex items-center gap-4">
            <div className="h-[1px] bg-white/5 flex-1"></div>
            <span className="text-[10px] font-black text-gray-700 uppercase tracking-widest">Network Status</span>
            <div className="h-[1px] bg-white/5 flex-1"></div>
          </div>
          <div className="flex justify-center gap-6">
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
              <span className="text-[8px] font-black uppercase text-white tracking-widest">Secure Payments</span>
            </div>
            <div className="flex items-center gap-2 opacity-40">
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
              <span className="text-[8px] font-black uppercase text-white tracking-widest">Node Verified</span>
            </div>
          </div>
        </section>
      </div>
    </div>
  );
}
