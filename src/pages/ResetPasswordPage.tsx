import React, { useState } from 'react';
import { useSearchParams, useNavigate, Link } from 'react-router-dom';
import { motion } from 'motion/react';
import { Lock, Eye, EyeOff, Loader2, CheckCircle2, AlertTriangle, ShieldCheck, ArrowLeft } from 'lucide-react';
import AppLogo from '../components/AppLogo';

export default function ResetPasswordPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();

  const token = searchParams.get('token') || '';
  const uid = searchParams.get('uid') || '';

  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirm, setShowConfirm] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [isSuccess, setIsSuccess] = useState(false);

  const calculatePasswordStrength = (pass: string) => {
    if (!pass) return { score: 0, label: 'None', color: 'bg-gray-700' };
    let score = 0;
    if (pass.length >= 8) score += 1;
    if (pass.length >= 12) score += 1;
    if (/[A-Z]/.test(pass)) score += 1;
    if (/[0-9]/.test(pass)) score += 1;
    if (/[!@#$%^&*(),.?":{}|<>]/.test(pass)) score += 1;

    if (score <= 2) return { score: 33, label: 'Weak', color: 'bg-red-500' };
    if (score <= 4) return { score: 66, label: 'Moderate', color: 'bg-amber-500' };
    return { score: 100, label: 'Strong', color: 'bg-emerald-500' };
  };

  const strength = calculatePasswordStrength(newPassword);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!token || !uid) {
      setError("Invalid password reset link. Missing token or user ID.");
      return;
    }

    if (newPassword.length < 8) {
      setError("Password must be at least 8 characters long.");
      return;
    }

    if (newPassword !== confirmPassword) {
      setError("Passwords do not match.");
      return;
    }

    setLoading(true);
    setError(null);

    try {
      const res = await fetch('/api/auth/reset-password', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          token,
          uid,
          newPassword,
        }),
      });

      const data = await res.json();

      if (data.success) {
        setIsSuccess(true);
      } else {
        setError(data.message || "Failed to reset password. Link may be expired or used.");
      }
    } catch (err: any) {
      console.error("Reset password error:", err);
      setError("An unexpected network error occurred. Please try again.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col min-h-screen bg-[#05070a] p-4 sm:p-8">
      <div className="flex-1 flex flex-col justify-center max-w-md mx-auto w-full py-6 space-y-8">
        
        {/* App Logo & Header */}
        <header className="flex flex-col items-center text-center space-y-4">
          <AppLogo size="xl" />
          <div className="space-y-1">
            <span className="inline-flex items-center gap-1.5 px-3 py-1 rounded-full bg-primary/10 border border-primary/30 text-primary text-[10px] font-black uppercase tracking-widest">
              <ShieldCheck size={12} /> Comfort Business Hub Security
            </span>
            <h1 className="text-2xl font-black text-white italic uppercase tracking-tight">Create New Password</h1>
          </div>
        </header>

        {/* Card */}
        <motion.div
          initial={{ opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="neon-card p-6 sm:p-8 space-y-6 relative overflow-hidden"
        >
          {isSuccess ? (
            <div className="text-center space-y-6 py-4">
              <div className="w-16 h-16 bg-emerald-500/20 border border-emerald-500/40 rounded-full flex items-center justify-center mx-auto text-emerald-400">
                <CheckCircle2 size={36} />
              </div>
              <div className="space-y-2">
                <h2 className="text-xl font-black text-white uppercase italic">Password Reset Complete!</h2>
                <p className="text-xs text-gray-400 leading-relaxed font-medium">
                  Your password has been securely updated and all previous active sessions have been revoked.
                </p>
              </div>

              <button
                type="button"
                onClick={() => navigate('/login')}
                className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic"
              >
                Proceed to Login
              </button>
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-5">
              {error && (
                <div className="p-4 bg-red-500/10 border border-red-500/30 rounded-2xl text-red-400 text-xs font-bold flex items-start gap-2.5">
                  <AlertTriangle size={16} className="shrink-0 mt-0.5" />
                  <p className="leading-snug">{error}</p>
                </div>
              )}

              {/* New Password Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">New Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type={showPassword ? "text" : "password"}
                    required
                    minLength={8}
                    value={newPassword}
                    onChange={(e) => setNewPassword(e.target.value)}
                    placeholder="At least 8 characters"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showPassword ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>

                {/* Strength Meter */}
                {newPassword && (
                  <div className="space-y-1 pt-1">
                    <div className="h-1.5 w-full bg-white/10 rounded-full overflow-hidden">
                      <div
                        className={`h-full transition-all duration-300 ${strength.color}`}
                        style={{ width: `${strength.score}%` }}
                      ></div>
                    </div>
                    <div className="flex justify-between items-center text-[9px] font-bold">
                      <span className="text-gray-400">Strength: <span className="text-white">{strength.label}</span></span>
                      <span className="text-gray-500">Min 8 chars, uppercase & numbers recommended</span>
                    </div>
                  </div>
                )}
              </div>

              {/* Confirm Password Field */}
              <div className="space-y-1.5">
                <label className="text-[10px] font-black uppercase text-gray-400 tracking-wider">Confirm Password</label>
                <div className="relative">
                  <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 text-gray-500" size={16} />
                  <input
                    type={showConfirm ? "text" : "password"}
                    required
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="Re-enter new password"
                    className="w-full bg-black/40 border border-white/10 rounded-2xl pl-10 pr-10 py-3 text-xs text-white placeholder-gray-600 focus:outline-none focus:border-primary transition-all font-medium"
                  />
                  <button
                    type="button"
                    onClick={() => setShowConfirm(!showConfirm)}
                    className="absolute right-3.5 top-1/2 -translate-y-1/2 text-gray-500 hover:text-white transition-colors"
                  >
                    {showConfirm ? <EyeOff size={16} /> : <Eye size={16} />}
                  </button>
                </div>
              </div>

              <button
                type="submit"
                disabled={loading}
                className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2 mt-4"
              >
                {loading ? <Loader2 className="animate-spin" size={18} /> : "Update Password"}
              </button>
            </form>
          )}

          <div className="pt-4 border-t border-white/10 text-center">
            <Link
              to="/login"
              className="inline-flex items-center gap-2 text-xs text-gray-400 hover:text-primary font-bold uppercase tracking-wider transition-colors"
            >
              <ArrowLeft size={14} /> Back to Login
            </Link>
          </div>
        </motion.div>
      </div>
    </div>
  );
}
