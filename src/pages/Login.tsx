import React, { useState, useEffect } from 'react';
import { 
  signInWithEmailAndPassword,
  signInWithPopup, 
  signInWithRedirect,
  getRedirectResult,
  sendPasswordResetEmail,
  GoogleAuthProvider, 
  browserPopupRedirectResolver 
} from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, syncPublicProfile, sanitizeFirestoreData } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Shield, Globe, Cpu, AlertTriangle, Phone, Mail, Chrome, Eye, EyeOff, Loader2, CheckCircle2, KeyRound } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { 
  COUNTRY_CODES, 
  normalizePhoneNumber, 
  phoneToSyntheticEmail, 
  getFriendlyAuthErrorMessage 
} from '../lib/authUtils';
import CountryCodeSelector from '../components/CountryCodeSelector';
import AppLogo from '../components/AppLogo';

export default function Login() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'google' | 'email' | 'phone'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [quarantineInfo, setQuarantineInfo] = useState<{ duration: string } | null>(null);

  // Form Fields
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+263');
  const [phoneInput, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  // Password reset state
  const [showForgotPassword, setShowForgotPassword] = useState(false);
  const [resetEmail, setResetEmail] = useState('');
  const [resetLoading, setResetLoading] = useState(false);

  useEffect(() => {
    const checkQuarantine = () => {
      const temp = localStorage.getItem('quarantine_temp');
      if (temp) {
        try {
          const parsed = JSON.parse(temp);
          setQuarantineInfo(parsed);
          localStorage.removeItem('quarantine_temp');
        } catch (err) {
          console.error(err);
        }
      }
    };

    checkQuarantine();
    const interval = setInterval(checkQuarantine, 300);
    return () => clearInterval(interval);
  }, []);

  // Handle redirect result on mount (Google SSO redirect flow)
  useEffect(() => {
    const checkRedirect = async () => {
      try {
        const result = await getRedirectResult(auth);
        if (result) {
          setLoading(true);
          await finishLogin(result.user, 'google');
        }
      } catch (err: any) {
        console.error('Redirect login error:', err);
        setError(getFriendlyAuthErrorMessage(err.code, err.message));
      } finally {
        setLoading(false);
      }
    };
    checkRedirect();
  }, []);

  const finishLogin = async (user: any, authMethod: 'google' | 'email' | 'phone') => {
    const userPath = `users/${user.uid}`;
    let docSnap;
    try {
      docSnap = await getDoc(doc(db, 'users', user.uid));
    } catch (e) {
      handleFirestoreError(e, OperationType.GET, userPath);
      return;
    }

    if (docSnap && docSnap.exists()) {
      const existingProfile = docSnap.data() as UserProfile;
      if (existingProfile.status === 'suspended') {
        const durationText = existingProfile.suspensionDuration || '14 days';
        await auth.signOut();
        setQuarantineInfo({ duration: durationText });
        setLoading(false);
        return;
      }
    }

    const profileData: Record<string, any> = {
      uid: user.uid,
      name: user.displayName || (docSnap?.exists() ? (docSnap.data() as UserProfile).name : 'Operator'),
      email: user.email || null,
      avatar: user.photoURL || null,
      isVerified: user.emailVerified || false,
      authMethod,
      updatedAt: serverTimestamp()
    };

    if (!docSnap || !docSnap.exists()) {
      const newProfile = {
        ...profileData,
        phone: user.phoneNumber || 'Unlinked',
        currentRole: 'customer',
      };
      
      try {
        const cleanProfile = sanitizeFirestoreData(newProfile);
        await setDoc(doc(db, 'users', user.uid), cleanProfile);
        await syncPublicProfile(cleanProfile);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, userPath);
        return;
      }
    } else {
      try {
        const cleanProfileData = sanitizeFirestoreData(profileData);
        await setDoc(doc(db, 'users', user.uid), cleanProfileData, { merge: true });
        const existingProfile = docSnap.data() as UserProfile;
        await syncPublicProfile({ ...existingProfile, ...cleanProfileData });
      } catch (e) {
        handleFirestoreError(e, OperationType.UPDATE, userPath);
        return;
      }
    }
    
    window.location.reload();
  };

  const handleEmailLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!email.trim()) {
      setError("Please enter your email address.");
      return;
    }
    if (!password) {
      setError("Please enter your password.");
      return;
    }

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
      await finishLogin(cred.user, 'email');
    } catch (err: any) {
      console.error("Email Login Error:", err);
      setError(getFriendlyAuthErrorMessage(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    const cleanDigits = phoneInput.replace(/\D/g, '');
    if (cleanDigits.length < 7) {
      setError("Please enter a valid phone number (at least 7 digits).");
      return;
    }

    if (!password) {
      setError("Please enter your password.");
      return;
    }

    const normalizedPhone = normalizePhoneNumber(countryCode, phoneInput);
    const syntheticEmail = phoneToSyntheticEmail(normalizedPhone);

    setLoading(true);
    try {
      const cred = await signInWithEmailAndPassword(auth, syntheticEmail, password);
      await finishLogin(cred.user, 'phone');
    } catch (err: any) {
      console.error("Phone Login Error:", err);
      if (err.code === 'auth/user-not-found' || err.code === 'auth/invalid-credential' || err.code === 'auth/wrong-password') {
        setError("No account found with this phone number or incorrect password. Please check or Sign Up.");
      } else {
        setError(getFriendlyAuthErrorMessage(err.code, err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleLogin = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();
    
    try {
      const { user } = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      await finishLogin(user, 'google');
    } catch (err: any) {
      if (err.code === 'auth/popup-closed-by-user') {
        console.info('Google login popup was closed by user or iframe restrictions.');
        setError("Sign in window was closed. If popups are restricted in preview, please open the app in a new tab.");
      } else if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        console.warn('Google login popup blocked:', err);
        try {
          await signInWithRedirect(auth, provider);
        } catch (redirectErr: any) {
          setError("Sign in failed due to popup policy. Please open this app in a new tab to sign in with Google.");
        }
      } else {
        console.error('Login Error:', err);
        setError(getFriendlyAuthErrorMessage(err.code, err.message));
      }
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!resetEmail.trim()) {
      setError("Please enter your registered email address.");
      return;
    }

    setResetLoading(true);
    setError(null);
    setSuccessMsg(null);

    try {
      await sendPasswordResetEmail(auth, resetEmail.trim());
      setSuccessMsg("Password reset email sent! Check your inbox.");
      setShowForgotPassword(false);
    } catch (err: any) {
      console.error("Password reset error:", err);
      setError(getFriendlyAuthErrorMessage(err.code, err.message));
    } finally {
      setResetLoading(false);
    }
  };

  const handleOfflineGuestLogin = () => {
    const guestProfile: UserProfile = {
      uid: 'guest_' + Date.now(),
      name: 'Offline Operator',
      displayName: 'Offline Operator',
      phone: phoneInput ? normalizePhoneNumber(countryCode, phoneInput) : 'Offline',
      email: email || undefined,
      currentRole: 'customer',
      isVerified: false,
      authMethod: 'phone',
      createdAt: new Date().toISOString()
    } as any;
    localStorage.setItem('guest_profile', JSON.stringify(guestProfile));
    window.location.href = '/';
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#05070a] p-4 sm:p-8">
      <div className="flex-1 flex flex-col justify-center space-y-8 max-w-md mx-auto w-full py-6">
        
        {/* Header */}
        <header className="flex flex-col items-center text-center space-y-4">
          <motion.div 
            initial={{ scale: 0, rotate: -45 }}
            animate={{ scale: 1, rotate: 0 }}
            transition={{ type: "spring", stiffness: 260, damping: 20 }}
          >
            <AppLogo size="2xl" className="shadow-[0_0_40px_rgba(0,242,254,0.25)]" />
          </motion.div>
          
          <div className="space-y-1.5">
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
              Returning User <span className="text-primary drop-shadow-[0_0_10px_rgba(0,242,254,0.5)]">Log In</span>
            </h1>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-[0.15em]">
              Account type (Seller / Buyer) is automatically detected on log in
            </p>
          </div>
        </header>

        {/* Card */}
        <motion.div 
          layout
          className="neon-card p-6 sm:p-8 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 left-0 w-32 h-32 bg-primary/5 blur-3xl -ml-16 -mt-16"></div>

          {/* Auth Method Selector */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => { setMethod('phone'); setError(null); setShowForgotPassword(false); }}
              className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                method === 'phone' 
                  ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Phone size={13} />
              <span>Phone</span>
            </button>

            <button
              type="button"
              onClick={() => { setMethod('email'); setError(null); setShowForgotPassword(false); }}
              className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                method === 'email' 
                  ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Mail size={13} />
              <span>Email</span>
            </button>

            <button
              type="button"
              onClick={() => { setMethod('google'); setError(null); setShowForgotPassword(false); }}
              className={`py-2.5 px-2 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-1.5 ${
                method === 'google' 
                  ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]' 
                  : 'text-gray-400 hover:text-white'
              }`}
            >
              <Chrome size={13} />
              <span>Google</span>
            </button>
          </div>

          {/* Quarantine Banner */}
          {quarantineInfo && (
            <div className="p-4 bg-amber-500/10 border border-amber-500/30 rounded-2xl text-amber-400 text-[10px] font-bold uppercase tracking-wider text-center flex flex-col items-center justify-center gap-2">
              <AlertTriangle size={24} className="shrink-0 text-amber-500" />
              <p className="leading-relaxed">
                Your account has been suspended by System Admin for <span className="underline font-black">{quarantineInfo.duration}</span>.
              </p>
            </div>
          )}

          {/* Error & Success Banner */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-[11px] font-bold uppercase tracking-wider flex flex-col gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              >
                <div className="flex items-center gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 text-red-400" />
                  <span className="leading-snug">{error}</span>
                </div>
                {(error.includes('Unable to reach') || error.includes('network') || error.includes('connection')) && (
                  <button
                    type="button"
                    onClick={handleOfflineGuestLogin}
                    className="w-full py-2.5 px-3 bg-white/10 hover:bg-white/20 text-white rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-white/20 flex items-center justify-center gap-2"
                  >
                    <span>Enter Offline Guest Mode</span>
                  </button>
                )}
                {(error.includes('new tab') || error.includes('popup')) && (
                  <a
                    href="/"
                    target="_blank"
                    rel="noopener noreferrer"
                    className="w-full py-2.5 px-3 bg-primary/20 hover:bg-primary hover:text-black text-primary rounded-xl text-[10px] font-black uppercase tracking-widest transition-all border border-primary/40 flex items-center justify-center gap-2"
                  >
                    <span>Open App in New Tab for Google Auth</span>
                  </a>
                )}
              </motion.div>
            )}
            {successMsg && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 bg-neon-green/10 border border-neon-green/30 rounded-2xl text-neon-green text-[11px] font-bold uppercase tracking-wider flex items-center gap-2.5 shadow-[0_0_15px_rgba(57,255,20,0.1)]"
              >
                <CheckCircle2 size={16} className="shrink-0 text-neon-green" />
                <span className="leading-snug">{successMsg}</span>
              </motion.div>
            )}
          </AnimatePresence>

          {/* PHONE LOGIN FORM */}
          {method === 'phone' && (
            <form onSubmit={handlePhoneLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Mobile Phone Number</label>
                <div className="flex gap-2">
                  <CountryCodeSelector 
                    value={countryCode}
                    onChange={setCountryCode}
                  />
                  <input 
                    type="tel"
                    inputMode="tel"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="77 123 4567"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter your password"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all pr-10 font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <LogIn size={18} />
                    Log In with Phone
                  </>
                )}
              </button>
            </form>
          )}

          {/* EMAIL LOGIN FORM */}
          {method === 'email' && !showForgotPassword && (
            <form onSubmit={handleEmailLogin} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Email Address</label>
                <input 
                  type="email"
                  inputMode="email"
                  required
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                />
              </div>

              <div className="space-y-1">
                <div className="flex items-center justify-between">
                  <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Password</label>
                  <button 
                    type="button"
                    onClick={() => { setShowForgotPassword(true); setResetEmail(email); setError(null); }}
                    className="text-[9px] font-black text-primary uppercase tracking-wider hover:underline"
                  >
                    Forgot Password?
                  </button>
                </div>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="Enter password"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all pr-10 font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button 
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2 mt-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <LogIn size={18} />
                    Log In with Email
                  </>
                )}
              </button>
            </form>
          )}

          {/* FORGOT PASSWORD FORM */}
          {method === 'email' && showForgotPassword && (
            <form onSubmit={handlePasswordReset} className="space-y-4">
              <div className="flex items-center justify-between">
                <span className="text-[10px] font-black uppercase text-primary tracking-widest flex items-center gap-1.5">
                  <KeyRound size={12} /> Reset Password
                </span>
                <button 
                  type="button" 
                  onClick={() => setShowForgotPassword(false)}
                  className="text-[9px] text-gray-400 hover:text-white font-bold uppercase tracking-wider"
                >
                  Back to Login
                </button>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Your Email Address</label>
                <input 
                  type="email"
                  inputMode="email"
                  required
                  value={resetEmail}
                  onChange={(e) => setResetEmail(e.target.value)}
                  placeholder="you@example.com"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                />
              </div>

              <button 
                type="submit"
                disabled={resetLoading}
                className="w-full btn-neon py-3.5 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
              >
                {resetLoading ? <Loader2 className="animate-spin" size={18} /> : "Send Reset Email"}
              </button>
            </form>
          )}

          {/* GOOGLE LOGIN FORM */}
          {method === 'google' && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center space-y-2">
                <Chrome size={32} className="text-primary mx-auto animate-pulse" />
                <h3 className="text-xs font-black uppercase text-white tracking-widest">Sign In with Google</h3>
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                  Connect quickly and securely using your existing Google account.
                </p>
              </div>

              <button 
                type="button"
                onClick={handleGoogleLogin}
                disabled={loading}
                className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <LogIn size={18} />
                    Continue with Google
                  </>
                )}
              </button>
            </div>
          )}

          {/* Redirect to Sign Up Link */}
          <div className="pt-4 border-t border-white/10 text-center space-y-2">
            <p className="text-xs text-gray-400 font-medium">
              New user? Select your account type to register:
            </p>
            <Link 
              to="/signup" 
              className="inline-flex items-center gap-1.5 px-4 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl text-xs font-black uppercase tracking-wider transition-all border border-primary/20 italic"
            >
              <span>Create Account (Seller or Buyer) →</span>
            </Link>
          </div>
        </motion.div>

        {/* Footer info */}
        <div className="flex justify-center gap-6">
          <Link to="/terms" className="text-[9px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors">Terms of Service</Link>
          <Link to="/privacy" className="text-[9px] font-black text-gray-600 uppercase tracking-widest hover:text-primary transition-colors">Privacy Policy</Link>
        </div>
      </div>
    </div>
  );
}
