import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { X, LogIn, UserPlus, Zap, ShieldCheck, ShoppingBag } from 'lucide-react';
import { useNavigate } from 'react-router-dom';

interface GuestLoginPromptProps {
  isOpen: boolean;
  onClose: () => void;
  title?: string;
  message?: string;
  actionLabel?: string;
  allowGuest?: boolean;
  onGuestContinue?: () => void;
}

export default function GuestLoginPrompt({ 
  isOpen, 
  onClose, 
  title = "Authentication Required", 
  message = "Please sign in to access secure features and perform real-time interactions.",
  actionLabel = "Sign In",
  allowGuest = false,
  onGuestContinue
}: GuestLoginPromptProps) {
  const navigate = useNavigate();

  return (
    <AnimatePresence>
      {isOpen && (
        <div key="guest-login-wrapper" className="fixed inset-0 z-[5000] flex items-center justify-center p-4 sm:p-6">
          <motion.div
            key="guest-login-backdrop"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md"
          />
          <motion.div
            key="guest-login-dialog"
            initial={{ scale: 0.9, opacity: 0, y: 20 }}
            animate={{ scale: 1, opacity: 1, y: 0 }}
            exit={{ scale: 0.9, opacity: 0, y: 20 }}
            className="relative w-full max-w-md bg-[#0d1117] border border-white/10 rounded-[2.5rem] p-8 shadow-2xl overflow-hidden group"
          >
            {/* Background effects */}
            <div className="absolute top-0 right-0 w-32 h-32 bg-primary/20 rounded-full blur-[80px] -mr-16 -mt-16 group-hover:bg-primary/30 transition-all duration-1000" />
            <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/20 rounded-full blur-[80px] -ml-16 -mb-16 group-hover:bg-accent/30 transition-all duration-1000" />

            <div className="relative z-10 space-y-6 text-center">
              <div className="w-20 h-20 bg-primary/10 rounded-3xl flex items-center justify-center mx-auto border border-primary/20 shadow-[0_0_20px_rgba(0,242,254,0.1)]">
                <Zap className="text-primary animate-pulse" size={40} />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">
                  {title}
                </h3>
                <p className="text-xs text-gray-400 font-medium leading-relaxed max-w-[280px] mx-auto">
                  {message}
                </p>
              </div>

              <div className="grid grid-cols-1 gap-2.5 pt-2">
                <button
                  onClick={() => {
                    onClose();
                    navigate('/login');
                  }}
                  className="w-full py-3.5 bg-primary text-[#05070a] rounded-2xl font-black uppercase text-[10px] tracking-[0.2em] hover:shadow-[0_0_20px_rgba(0,242,254,0.4)] hover:scale-[1.01] active:scale-98 transition-all flex items-center justify-center gap-2"
                >
                  <LogIn size={15} />
                  {actionLabel} (Returning User)
                </button>

                <button
                  onClick={() => {
                    onClose();
                    navigate('/signup');
                  }}
                  className="w-full py-3.5 bg-white/10 text-white rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] border border-white/15 hover:bg-white/20 transition-all flex items-center justify-center gap-2"
                >
                  <UserPlus size={15} className="text-primary" />
                  Create New Account (Seller or Buyer)
                </button>

                {allowGuest && (
                  <button
                    onClick={() => {
                      if (onGuestContinue) onGuestContinue();
                    }}
                    className="w-full py-3 bg-accent/20 text-accent rounded-2xl font-black uppercase text-[10px] tracking-[0.15em] border border-accent/20 hover:bg-accent/30 hover:shadow-[0_0_20px_rgba(255,0,212,0.2)] transition-all flex items-center justify-center gap-2 group/guest"
                  >
                    <ShoppingBag size={15} className="group-hover/guest:animate-bounce" />
                    Transact as a Guest
                  </button>
                )}

                <button
                  onClick={onClose}
                  className="w-full py-2.5 bg-transparent text-gray-500 hover:text-white text-[10px] font-black uppercase tracking-[0.2em] transition-all"
                >
                  Continue Browsing
                </button>
              </div>

              <div className="flex items-center justify-center gap-6 pt-4 border-t border-white/5">
                 <div className="flex flex-col items-center gap-1">
                    <ShieldCheck size={16} className="text-primary/50" />
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Secure Flow</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                    <ShoppingBag size={16} className="text-primary/50" />
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Order Sync</span>
                 </div>
                 <div className="flex flex-col items-center gap-1">
                    <UserPlus size={16} className="text-primary/50" />
                    <span className="text-[8px] font-black text-gray-600 uppercase tracking-widest">Profile Hub</span>
                 </div>
              </div>
            </div>

            <button
              onClick={onClose}
              className="absolute top-6 right-6 text-gray-500 hover:text-white transition-colors"
            >
              <X size={20} />
            </button>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  );
}
