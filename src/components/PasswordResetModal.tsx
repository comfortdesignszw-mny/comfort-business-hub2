import React, { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { KeyRound, Mail, Phone, Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, X, ShieldCheck } from 'lucide-react';

interface PasswordResetModalProps {
  isOpen: boolean;
  onClose: () => void;
  defaultEmail?: string;
}

export default function PasswordResetModal({ isOpen, onClose, defaultEmail = '' }: PasswordResetModalProps) {
  const [mode, setMode] = useState<'email' | 'phone'>('email');
  const [emailInput, setEmailInput] = useState(defaultEmail);
  const [phoneInput, setPhoneInput] = useState('');
  
  // States
  const [loading, setLoading] = useState(false);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Phone OTP Flow States
  const [phoneStep, setPhoneStep] = useState<'input' | 'otp'>('input');
  const [otpCode, setOtpCode] = useState('');
  const [newPhonePassword, setNewPhonePassword] = useState('');
  const [showPass, setShowPass] = useState(false);

  if (!isOpen) return null;

  const handleEmailResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!emailInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/request-password-reset', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: emailInput.trim() }),
      });
      const data = await res.json();
      setSuccessMsg(data.message || "If that email/phone number is registered, we've sent you a reset link/code.");
    } catch (err: any) {
      console.error('Password reset request error:', err);
      // Anti-enumeration fallback
      setSuccessMsg("If that email/phone number is registered, we've sent you a reset link/code.");
    } finally {
      setLoading(false);
    }
  };

  const handlePhoneResetRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!phoneInput.trim()) return;

    setLoading(true);
    setErrorMsg(null);
    setSuccessMsg(null);

    try {
      const res = await fetch('/api/auth/request-password-reset-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ phone: phoneInput.trim() }),
      });
      const data = await res.json();
      setPhoneStep('otp');
      setSuccessMsg(data.message || "SMS OTP code sent if registered. Please enter verification code below.");
    } catch (err: any) {
      setPhoneStep('otp');
      setSuccessMsg("SMS OTP code sent if registered. Please enter verification code below.");
    } finally {
      setLoading(false);
    }
  };

  const handleVerifyPhoneOTPAndReset = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!otpCode.trim() || newPhonePassword.length < 8) {
      setErrorMsg("Please enter 6-digit OTP code and a password with at least 8 characters.");
      return;
    }

    setLoading(true);
    setErrorMsg(null);

    try {
      const res = await fetch('/api/auth/reset-password-phone', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          idToken: `phone_token_${otpCode}_${Date.now()}`,
          newPassword: newPhonePassword,
        }),
      });
      const data = await res.json();
      if (data.success) {
        setSuccessMsg("Password reset successfully! Please log in with your new credentials.");
      } else {
        setErrorMsg(data.message || "Verification failed. Please double check OTP.");
      }
    } catch (err: any) {
      setErrorMsg("Failed to update password with phone OTP.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <AnimatePresence>
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/80 backdrop-blur-md">
        <motion.div
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.95 }}
          className="neon-card p-6 sm:p-8 max-w-lg w-full relative overflow-hidden space-y-6"
        >
          {/* Close button */}
          <button
            onClick={onClose}
            className="absolute top-4 right-4 p-2 text-gray-400 hover:text-white rounded-full bg-white/5 hover:bg-white/10 transition-colors"
          >
            <X size={18} />
          </button>

          {/* Header */}
          <div className="space-y-2 text-center">
            <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={12} /> Comfort Business Hub Recovery
            </div>
            <h2 className="text-2xl font-black text-white italic uppercase tracking-tight">Custom Password Reset</h2>
            <p className="text-xs text-gray-400 font-medium">
              Works for Email, Phone & Google SSO fallback password creation
            </p>
          </div>

          {/* Method Tabs */}
          <div className="grid grid-cols-2 gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/10">
            <button
              type="button"
              onClick={() => { setMode('email'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                mode === 'email' ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Mail size={14} /> Email Link
            </button>
            <button
              type="button"
              onClick={() => { setMode('phone'); setPhoneStep('input'); setSuccessMsg(null); setErrorMsg(null); }}
              className={`py-2 px-3 rounded-xl text-[10px] font-black uppercase tracking-wider transition-all flex items-center justify-center gap-2 ${
                mode === 'phone' ? 'bg-primary text-black shadow-[0_0_15px_rgba(0,242,254,0.4)]' : 'text-gray-400 hover:text-white'
              }`}
            >
              <Phone size={14} /> Phone OTP
            </button>
          </div>

          {/* Messages */}
          {successMsg && (
            <div className="p-4 bg-emerald-500/10 border border-emerald-500/30 rounded-2xl text-emerald-400 text-xs font-semibold flex items-start gap-3">
              <CheckCircle2 size={18} className="shrink-0 text-emerald-400 mt-0.5" />
              <p className="leading-relaxed">{successMsg}</p>
            </div>
          )}

          {errorMsg && (
            <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-semibold flex items-start gap-3">
              <AlertTriangle size={18} className="shrink-0 text-red-400 mt-0.5" />
              <p className="leading-relaxed">{errorMsg}</p>
            </div>
          )}

          {/* Email Reset Form */}
          {mode === 'email' && (
            <form onSubmit={handleEmailResetRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Registered Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="email"
                    required
                    value={emailInput}
                    onChange={(e) => setEmailInput(e.target.value)}
                    placeholder="user@example.com"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-3.5 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <KeyRound size={16} /> Send Security Reset Link
                  </>
                )}
              </button>
            </form>
          )}

          {/* Phone Reset Form */}
          {mode === 'phone' && phoneStep === 'input' && (
            <form onSubmit={handlePhoneResetRequest} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Mobile Phone Number</label>
                <div className="relative">
                  <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type="tel"
                    required
                    value={phoneInput}
                    onChange={(e) => setPhoneInput(e.target.value)}
                    placeholder="+263 77 123 4567"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-4 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                  />
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-3.5 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : (
                  <>
                    <Phone size={16} /> Dispatch SMS Verification Code
                  </>
                )}
              </button>
            </form>
          )}

          {/* Phone OTP Verification & Password Entry */}
          {mode === 'phone' && phoneStep === 'otp' && (
            <form onSubmit={handleVerifyPhoneOTPAndReset} className="space-y-4">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">6-Digit SMS Verification Code</label>
                <input
                  type="text"
                  required
                  maxLength={6}
                  value={otpCode}
                  onChange={(e) => setOtpCode(e.target.value)}
                  placeholder="123456"
                  className="w-full bg-black/40 border border-white/10 rounded-2xl px-4 py-3 text-sm text-center tracking-[0.4em] font-black text-primary placeholder-gray-600 focus:outline-none focus:border-primary transition-all"
                />
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">New Password (8+ characters)</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type={showPass ? 'text' : 'password'}
                    required
                    minLength={8}
                    value={newPhonePassword}
                    onChange={(e) => setNewPhonePassword(e.target.value)}
                    placeholder="Enter new password"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPass(!showPass)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPass ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-3.5 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : 'Verify Code & Set Password'}
              </button>
            </form>
          )}
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
