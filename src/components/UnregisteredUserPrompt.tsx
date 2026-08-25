import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, LogIn, Sparkles, ArrowRight, UserPlus, Zap
} from 'lucide-react';
import { useNavigate } from 'react-router-dom';
import { UserProfile } from '../types';

interface UnregisteredUserPromptProps {
  user: any;
  profile: UserProfile | null;
}

const DISMISS_COUNT_KEY = 'comfort_unregistered_prompt_dismiss_count';
const TERMINATE_KEY = 'comfort_unregistered_prompt_session_terminated';
const FIVE_MINUTES_MS = 5 * 60 * 1000; // 5 minutes

export default function UnregisteredUserPrompt({ user, profile }: UnregisteredUserPromptProps) {
  const navigate = useNavigate();
  const [isOpen, setIsOpen] = useState(false);
  const [dismissCount, setDismissCount] = useState<number>(0);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);

  // Check if current user is an unregistered / guest / anonymous user
  const isUnregistered = !user || profile?.isGuest === true;

  // Initialize session state on mount
  useEffect(() => {
    // If user is properly authenticated, terminate any prompt
    if (!isUnregistered) {
      setIsOpen(false);
      if (intervalRef.current) clearInterval(intervalRef.current);
      return;
    }

    // Check if session is already terminated due to 2 dismissals
    const isTerminated = sessionStorage.getItem(TERMINATE_KEY) === 'true';
    const storedDismissCount = parseInt(sessionStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
    setDismissCount(storedDismissCount);

    if (isTerminated || storedDismissCount >= 2) {
      setIsOpen(false);
      return;
    }

    // Initial popup display after 8 seconds of browsing on first arrival
    const initialTimer = setTimeout(() => {
      const currentTerminated = sessionStorage.getItem(TERMINATE_KEY) === 'true';
      const currentDismiss = parseInt(sessionStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
      if (!currentTerminated && currentDismiss < 2 && (!user || profile?.isGuest)) {
        setIsOpen(true);
      }
    }, 8000);

    // Recurring interval: once every 5 minutes
    intervalRef.current = setInterval(() => {
      const currentTerminated = sessionStorage.getItem(TERMINATE_KEY) === 'true';
      const currentDismiss = parseInt(sessionStorage.getItem(DISMISS_COUNT_KEY) || '0', 10);
      
      if (currentTerminated || currentDismiss >= 2) {
        if (intervalRef.current) clearInterval(intervalRef.current);
        return;
      }

      // If user is still unregistered, pop up notification
      if (!user || profile?.isGuest) {
        setIsOpen(true);
      }
    }, FIVE_MINUTES_MS);

    return () => {
      clearTimeout(initialTimer);
      if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [user, profile, isUnregistered]);

  // Handle user dismissal / cancellation
  const handleDismiss = () => {
    const newCount = dismissCount + 1;
    setDismissCount(newCount);
    sessionStorage.setItem(DISMISS_COUNT_KEY, newCount.toString());

    if (newCount >= 2) {
      // User cancelled twice -> terminate for this session
      sessionStorage.setItem(TERMINATE_KEY, 'true');
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    }

    setIsOpen(false);
  };

  const handleGoToAuth = (path: '/login' | '/signup') => {
    setIsOpen(false);
    navigate(path);
  };

  if (!isUnregistered || !isOpen) {
    return null;
  }

  return (
    <AnimatePresence>
      {/* Compact Non-Blocking Floating Notification Card (No full-screen backdrop) */}
      <div 
        id="unregistered-user-prompt-container"
        className="fixed bottom-20 sm:bottom-24 left-3 right-3 sm:left-auto sm:right-6 z-[48] sm:max-w-sm pointer-events-auto"
      >
        <motion.div
          key="compact-prompt-card"
          initial={{ opacity: 0, y: 30, scale: 0.94 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.94 }}
          transition={{ type: "spring", stiffness: 350, damping: 28 }}
          className="relative bg-[#0d1117]/95 backdrop-blur-xl border border-cyan-500/40 rounded-2xl p-4 sm:p-4.5 shadow-[0_12px_40px_rgba(0,0,0,0.8),0_0_25px_rgba(0,242,254,0.2)] text-left overflow-hidden group"
        >
          {/* Subtle Ambient Glow Edge */}
          <div className="absolute top-0 right-0 w-32 h-32 bg-primary/15 rounded-full blur-[60px] -mr-12 -mt-12 pointer-events-none" />

          {/* Close / Dismiss Button */}
          <button
            id="close-unregistered-prompt-btn"
            onClick={handleDismiss}
            aria-label="Dismiss account prompt"
            className="absolute top-3 right-3 w-6 h-6 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all border border-white/10"
          >
            <X size={13} />
          </button>

          {/* Compact Header & Icon */}
          <div className="flex items-start gap-2.5 pr-6">
            <div className="w-8 h-8 rounded-xl bg-primary/10 border border-primary/30 flex items-center justify-center text-primary shrink-0 shadow-[0_0_12px_rgba(0,242,254,0.25)]">
              <Sparkles size={16} className="animate-pulse" />
            </div>
            <div>
              <span className="px-2 py-0.5 rounded-full bg-primary/10 border border-primary/20 text-primary text-[7.5px] font-black uppercase tracking-wider inline-flex items-center gap-1">
                <Zap size={9} /> Marketplace Access
              </span>
              <h4 className="text-xs sm:text-sm font-black text-white italic uppercase tracking-tight mt-0.5">
                Join Marketplace Hub
              </h4>
            </div>
          </div>

          {/* Concise Non-Intrusive Message */}
          <p className="text-[11px] text-gray-300 font-medium leading-snug mt-2">
            Create an account or login to enjoy seamless <span className="text-primary font-bold">Comfort Hub</span> benefits with full access to sell, buy, and negotiate verified products.
          </p>

          {/* Action Buttons */}
          <div className="mt-3 space-y-1.5">
            <button
              id="login-or-create-account-btn"
              onClick={() => handleGoToAuth('/login')}
              className="w-full py-2.5 px-3 bg-gradient-to-r from-primary via-cyan-400 to-primary bg-[length:200%_auto] hover:bg-[position:right_center] text-[#05070a] rounded-xl font-black uppercase text-[10px] tracking-wider shadow-[0_0_15px_rgba(0,242,254,0.35)] hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-1.5"
            >
              <LogIn size={13} />
              <span>Login or Create Account</span>
              <ArrowRight size={13} />
            </button>

            <div className="flex items-center justify-between pt-1 px-1">
              <button
                id="signup-direct-link"
                onClick={() => handleGoToAuth('/signup')}
                className="text-[9px] font-black text-primary hover:text-cyan-300 uppercase tracking-wider flex items-center gap-1 transition-colors"
              >
                <UserPlus size={11} />
                <span>Register</span>
              </button>

              <button
                id="dismiss-unregistered-link"
                onClick={handleDismiss}
                className="text-[9px] text-gray-400 hover:text-gray-200 uppercase tracking-wider transition-colors"
              >
                {dismissCount === 0 ? 'Dismiss (1/2)' : 'Don\'t show again'}
              </button>
            </div>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
