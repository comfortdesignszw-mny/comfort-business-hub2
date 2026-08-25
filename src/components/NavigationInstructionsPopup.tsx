import React, { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  X, Compass, Search, Zap, MessageSquare, 
  Store, UserIcon, ShieldAlert, ShoppingBag, 
  Sparkles, CheckCircle2
} from 'lucide-react';
import { useLocation } from 'react-router-dom';

interface NavInstruction {
  title: string;
  tip: string;
  icon: React.ElementType;
}

export default function NavigationInstructionsPopup() {
  const location = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [currentInstruction, setCurrentInstruction] = useState<NavInstruction | null>(null);
  const [timeLeft, setTimeLeft] = useState<number>(30);
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const countdownRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  // Concise single-tip navigation guides
  const getInstruction = (path: string): NavInstruction => {
    if (path === '/' || path === '') {
      return {
        title: 'Explore Hub',
        tip: 'Filter categories, search items, or switch to the GPS map to find suppliers.',
        icon: Search
      };
    }
    if (path.startsWith('/deals')) {
      return {
        title: 'Deal Room',
        tip: 'Track orders, upload Proof of Payment (POP), and monitor escrow progress.',
        icon: Zap
      };
    }
    if (path.startsWith('/chat')) {
      return {
        title: 'Direct Chat',
        tip: 'Message suppliers in real time to negotiate prices and delivery details.',
        icon: MessageSquare
      };
    }
    if (path.startsWith('/stores')) {
      return {
        title: 'Supplier Hub',
        tip: 'Manage your stores, add inventory with photos/videos, and view sales stats.',
        icon: Store
      };
    }
    if (path.startsWith('/store/') || path.startsWith('/s/')) {
      return {
        title: 'Storefront',
        tip: 'Browse merchant catalog, read reviews, or tap Chat to contact supplier.',
        icon: Store
      };
    }
    if (path.startsWith('/product/') || path.startsWith('/p/')) {
      return {
        title: 'Product View',
        tip: 'Check specs, stock, and tap Start Instant Deal to initiate purchase.',
        icon: ShoppingBag
      };
    }
    if (path.startsWith('/admin')) {
      return {
        title: 'Admin Console',
        tip: 'Review pending merchant KYC approvals, reports, and system telemetry.',
        icon: ShieldAlert
      };
    }
    if (path.startsWith('/profile')) {
      return {
        title: 'Profile & Settings',
        tip: 'Manage security, toggle biometric login, or switch between Buyer/Seller.',
        icon: UserIcon
      };
    }
    if (path.startsWith('/login') || path.startsWith('/signup')) {
      return {
        title: 'Secure Access',
        tip: 'Sign in to access your registered stores, deal room, and direct messages.',
        icon: Sparkles
      };
    }
    return {
      title: 'Navigation Tip',
      tip: 'Use the bottom dock to quickly jump between hub sections anytime.',
      icon: Compass
    };
  };

  const clearActiveTimers = () => {
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (countdownRef.current) {
      clearInterval(countdownRef.current);
      countdownRef.current = null;
    }
  };

  // Trigger brief non-obstructive popup on route changes
  useEffect(() => {
    const isMuted = sessionStorage.getItem('comfort_nav_instructions_muted') === 'true';
    if (isMuted) {
      setIsOpen(false);
      return;
    }

    const instr = getInstruction(location.pathname);
    setCurrentInstruction(instr);
    setIsOpen(true);
    setTimeLeft(30);

    clearActiveTimers();

    // Auto-disappear after 30 seconds
    timerRef.current = setTimeout(() => {
      setIsOpen(false);
    }, 30000);

    // 1-second countdown for progress
    countdownRef.current = setInterval(() => {
      setTimeLeft((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);

    return () => {
      clearActiveTimers();
    };
  }, [location.pathname]);

  // Disappear when user clicks anywhere else in the app
  useEffect(() => {
    const handleDocumentClick = (e: MouseEvent) => {
      if (!isOpen) return;
      if (containerRef.current && containerRef.current.contains(e.target as Node)) {
        return;
      }
      setIsOpen(false);
      clearActiveTimers();
    };

    const timeout = setTimeout(() => {
      document.addEventListener('click', handleDocumentClick);
    }, 200);

    return () => {
      clearTimeout(timeout);
      document.removeEventListener('click', handleDocumentClick);
    };
  }, [isOpen]);

  const handleDismiss = () => {
    setIsOpen(false);
    clearActiveTimers();
  };

  if (!isOpen || !currentInstruction) {
    return null;
  }

  const IconComponent = currentInstruction.icon;
  const progressPercent = ((30 - timeLeft) / 30) * 100;

  return (
    <AnimatePresence>
      <div 
        ref={containerRef}
        id="compact-navigation-instruction-popup"
        className="fixed top-16 sm:top-20 right-3 sm:right-5 z-[39] max-w-[280px] sm:max-w-[310px] pointer-events-auto"
      >
        <motion.div
          initial={{ opacity: 0, y: -10, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -10, scale: 0.95 }}
          transition={{ type: "spring", stiffness: 400, damping: 28 }}
          className="relative bg-[#0d1117]/95 backdrop-blur-xl border border-primary/25 rounded-xl p-3 shadow-[0_8px_30px_rgba(0,0,0,0.6),0_0_15px_rgba(0,242,254,0.15)] text-left overflow-hidden group"
        >
          {/* Subtle 30s Countdown Progress Bar on Top */}
          <div className="absolute top-0 left-0 right-0 h-0.5 bg-white/10 overflow-hidden">
            <motion.div 
              className="h-full bg-gradient-to-r from-primary to-cyan-400 transition-all ease-linear"
              style={{ width: `${100 - progressPercent}%` }}
            />
          </div>

          {/* Close button */}
          <button
            id="close-compact-nav-instruction-btn"
            onClick={handleDismiss}
            aria-label="Close guide"
            className="absolute top-2 right-2 w-5 h-5 rounded-full bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X size={11} />
          </button>

          {/* Small Icon & Title */}
          <div className="flex items-center gap-2 pr-5">
            <div className="w-6 h-6 rounded-lg bg-primary/10 border border-primary/20 flex items-center justify-center text-primary shrink-0">
              <IconComponent size={13} />
            </div>
            <h5 className="text-[11px] font-black text-white uppercase tracking-tight truncate">
              {currentInstruction.title}
            </h5>
          </div>

          {/* Single Tip Line */}
          <p className="text-[10px] text-gray-300 font-medium leading-tight mt-1.5 line-clamp-2">
            {currentInstruction.tip}
          </p>

          {/* Micro Footer: Countdown & Got It button */}
          <div className="flex items-center justify-between mt-2 pt-1.5 border-t border-white/5 text-[8.5px]">
            <span className="text-gray-500 font-medium">
              Auto-closes in <span className="text-primary font-bold">{timeLeft}s</span>
            </span>
            <button
              id="compact-nav-got-it-btn"
              onClick={handleDismiss}
              className="px-2 py-0.5 bg-primary/15 hover:bg-primary text-primary hover:text-[#05070a] border border-primary/25 rounded-md font-black uppercase tracking-wider transition-all"
            >
              Got It
            </button>
          </div>
        </motion.div>
      </div>
    </AnimatePresence>
  );
}
