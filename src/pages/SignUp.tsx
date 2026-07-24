import React, { useState } from 'react';
import { 
  createUserWithEmailAndPassword,
  signInWithPopup, 
  signInWithRedirect,
  GoogleAuthProvider, 
  browserPopupRedirectResolver,
  updateProfile
} from 'firebase/auth';
import { auth, db, handleFirestoreError, OperationType, syncPublicProfile } from '../lib/firebase';
import { doc, setDoc, getDoc, serverTimestamp } from 'firebase/firestore';
import { motion, AnimatePresence } from 'motion/react';
import { LogIn, Shield, Globe, Cpu, AlertTriangle, UserPlus, Phone, Mail, Chrome, CheckCircle2, Eye, EyeOff, Loader2, ArrowLeft } from 'lucide-react';
import { Link, useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';
import { 
  COUNTRY_CODES, 
  normalizePhoneNumber, 
  phoneToSyntheticEmail, 
  checkPhoneExistsInFirestore, 
  getFriendlyAuthErrorMessage 
} from '../lib/authUtils';
import CountryCodeSelector from '../components/CountryCodeSelector';

export default function SignUp() {
  const navigate = useNavigate();
  const [method, setMethod] = useState<'google' | 'email' | 'phone'>('phone');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Form Fields
  const [displayName, setDisplayName] = useState('');
  const [email, setEmail] = useState('');
  const [countryCode, setCountryCode] = useState('+263');
  const [phoneInput, setPhoneInput] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);

  const handleFinishSignUp = async (user: any, authMethod: 'google' | 'email' | 'phone', extraDetails: { displayName?: string; phoneNumber?: string; email?: string }) => {
    const userPath = `users/${user.uid}`;
    
    // Check if doc exists
    let docSnap;
    try {
      docSnap = await getDoc(doc(db, 'users', user.uid));
    } catch (e) {
      console.warn("Check user existence warning:", e);
    }

    const finalName = extraDetails.displayName || user.displayName || displayName || 'New Operator';
    const finalPhone = extraDetails.phoneNumber || user.phoneNumber || (authMethod === 'phone' ? extraDetails.phoneNumber : 'Unlinked');
    const finalEmail = authMethod === 'email' ? (extraDetails.email || email) : (authMethod === 'google' ? user.email : null);

    const newProfile: UserProfile = {
      uid: user.uid,
      name: finalName,
      displayName: finalName,
      authMethod,
      email: finalEmail,
      phoneNumber: authMethod === 'phone' ? finalPhone : null,
      phone: finalPhone || 'Unlinked',
      phoneVerified: false,
      currentRole: 'customer',
      isVerified: user.emailVerified || false,
      createdAt: serverTimestamp(),
      updatedAt: serverTimestamp()
    };

    if (!docSnap || !docSnap.exists()) {
      try {
        await setDoc(doc(db, 'users', user.uid), newProfile);
        await syncPublicProfile(newProfile);
      } catch (e) {
        handleFirestoreError(e, OperationType.WRITE, userPath);
        return;
      }
    }

    // Try updating display name on Firebase Auth user object
    try {
      if (user && finalName) {
        await updateProfile(user, { displayName: finalName });
      }
    } catch (e) {
      console.warn("Could not update auth profile name:", e);
    }

    window.location.reload();
  };

  const handleEmailSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!displayName.trim()) {
      setError("Please enter your full name or display name.");
      return;
    }
    if (!email.trim() || !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      setError("Please enter a valid email address.");
      return;
    }
    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }
    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    setLoading(true);
    try {
      const cred = await createUserWithEmailAndPassword(auth, email.trim(), password);
      await handleFinishSignUp(cred.user, 'email', { displayName: displayName.trim(), email: email.trim() });
    } catch (err: any) {
      console.error("Email SignUp Error:", err);
      setError(getFriendlyAuthErrorMessage(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneSignUp = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setSuccessMsg(null);

    if (!displayName.trim()) {
      setError("Please enter your full name or display name.");
      return;
    }

    const cleanDigits = phoneInput.replace(/\D/g, '');
    if (cleanDigits.length < 7) {
      setError("Please enter a valid phone number (at least 7 digits).");
      return;
    }

    if (password.length < 6) {
      setError("Password must be at least 6 characters long.");
      return;
    }

    if (password !== confirmPassword) {
      setError("Passwords do not match. Please re-enter.");
      return;
    }

    const normalizedPhone = normalizePhoneNumber(countryCode, phoneInput);

    setLoading(true);
    try {
      // Check phone uniqueness in Firestore first
      const exists = await checkPhoneExistsInFirestore(normalizedPhone);
      if (exists) {
        setError("An account with this phone number already exists. Try logging in instead.");
        setLoading(false);
        return;
      }

      const syntheticEmail = phoneToSyntheticEmail(normalizedPhone);
      const cred = await createUserWithEmailAndPassword(auth, syntheticEmail, password);
      await handleFinishSignUp(cred.user, 'phone', { displayName: displayName.trim(), phoneNumber: normalizedPhone });
    } catch (err: any) {
      console.error("Phone SignUp Error:", err);
      setError(getFriendlyAuthErrorMessage(err.code, err.message));
    } finally {
      setLoading(false);
    }
  };

  const handleGoogleSignUp = async () => {
    setLoading(true);
    setError(null);
    const provider = new GoogleAuthProvider();

    try {
      const { user } = await signInWithPopup(auth, provider, browserPopupRedirectResolver);
      await handleFinishSignUp(user, 'google', { displayName: user.displayName || 'Operator' });
    } catch (err: any) {
      console.error("Google SignUp Error:", err);
      if (err.code === 'auth/popup-blocked' || err.code === 'auth/cancelled-popup-request') {
        try {
          await signInWithRedirect(auth, provider);
        } catch (rErr: any) {
          setError("Sign in failed. Please open this app in a new tab using the top-right button.");
        }
      } else {
        setError(getFriendlyAuthErrorMessage(err.code, err.message));
      }
    } finally {
      setLoading(false);
    }
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
            className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center shadow-[0_0_40px_rgba(0,242,254,0.15)] relative group overflow-hidden border border-white/10"
          >
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/5 opacity-50"></div>
            <img src="/icon.png" alt="Comfort Hub" className="w-12 h-12 object-contain relative z-10 drop-shadow-[0_0_12px_rgba(0,242,254,0.5)]" />
          </motion.div>
          
          <div className="space-y-1">
            <h1 className="text-3xl font-black text-white italic tracking-tighter uppercase leading-none">
              Create <span className="text-primary drop-shadow-[0_0_10px_rgba(0,242,254,0.5)]">Account</span>
            </h1>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-[0.25em]">Comfort Business Hub Zimbabwe</p>
          </div>
        </header>

        {/* Card */}
        <motion.div 
          layout
          className="neon-card p-6 sm:p-8 space-y-6 relative overflow-hidden"
        >
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16"></div>

          {/* Auth Method Selector */}
          <div className="grid grid-cols-3 gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => { setMethod('phone'); setError(null); }}
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
              onClick={() => { setMethod('email'); setError(null); }}
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
              onClick={() => { setMethod('google'); setError(null); }}
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

          {/* Error Banner */}
          <AnimatePresence>
            {error && (
              <motion.div 
                initial={{ opacity: 0, y: -10 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, y: -10 }}
                className="p-3.5 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-[11px] font-bold uppercase tracking-wider flex items-center gap-2.5 shadow-[0_0_15px_rgba(239,68,68,0.1)]"
              >
                <AlertTriangle size={16} className="shrink-0 text-red-400" />
                <span className="leading-snug">{error}</span>
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

          {/* PHONE FORM */}
          {method === 'phone' && (
            <form onSubmit={handlePhoneSignUp} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Full Name / Business Name</label>
                <input 
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Tendai Moyo"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                />
              </div>

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
                <p className="text-[9px] text-gray-500 font-medium ml-1">No email required! Enter mobile digits without spaces.</p>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Create Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all pr-10 font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all pr-10 font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
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
                    <UserPlus size={18} />
                    Create Account with Phone
                  </>
                )}
              </button>
            </form>
          )}

          {/* EMAIL FORM */}
          {method === 'email' && (
            <form onSubmit={handleEmailSignUp} className="space-y-4">
              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Full Name / Business Name</label>
                <input 
                  type="text"
                  required
                  value={displayName}
                  onChange={(e) => setDisplayName(e.target.value)}
                  placeholder="e.g. Chipo Mutasa"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                />
              </div>

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
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Create Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="At least 6 characters"
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

              <div className="space-y-1">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Confirm Password</label>
                <div className="relative">
                  <input 
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={6}
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter password"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all pr-10 font-medium"
                  />
                  <button 
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    aria-label={showPassword ? "Hide password" : "Show password"}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors p-1"
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
                    <UserPlus size={18} />
                    Create Account with Email
                  </>
                )}
              </button>
            </form>
          )}

          {/* GOOGLE FORM */}
          {method === 'google' && (
            <div className="space-y-4 py-2">
              <div className="p-4 bg-white/5 rounded-2xl border border-white/10 text-center space-y-2">
                <Chrome size={32} className="text-primary mx-auto animate-pulse" />
                <h3 className="text-xs font-black uppercase text-white tracking-widest">Instant Sign Up with Google</h3>
                <p className="text-[10px] text-gray-400 leading-relaxed font-medium">
                  Use your Google Account for fast, secure authentication without setting passwords.
                </p>
              </div>

              <button 
                type="button"
                onClick={handleGoogleSignUp}
                disabled={loading}
                className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <LogIn size={18} />
                    Sign Up using Google
                  </>
                )}
              </button>
            </div>
          )}

          {/* Redirect to Login Link */}
          <div className="pt-4 border-t border-white/10 text-center">
            <p className="text-xs text-gray-400 font-medium">
              Already have an account?{' '}
              <Link 
                to="/login" 
                className="text-primary font-black uppercase tracking-wider hover:underline italic ml-1"
              >
                Log In Here
              </Link>
            </p>
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
