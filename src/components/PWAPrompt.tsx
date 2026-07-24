import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Box, Info, Share, PlusSquare, Monitor, ChevronRight } from 'lucide-react';

type Platform = 'ios' | 'android' | 'desktop' | 'unknown';

export default function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [platform, setPlatform] = useState<Platform>('unknown');

  useEffect(() => {
    // Platform detection
    const ua = window.navigator.userAgent.toLowerCase();
    const isIos = /iphone|ipad|ipod/.test(ua);
    const isAndroid = /android/.test(ua);
    const isDesktop = !isIos && !isAndroid;

    if (isIos) setPlatform('ios');
    else if (isAndroid) setPlatform('android');
    else setPlatform('desktop');

    const handler = (e: any) => {
      e.preventDefault();
      setDeferredPrompt(e);
      // Show prompt for Android/Desktop after a delay
      setTimeout(() => setIsVisible(true), 5000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    const triggerHandler = () => {
      setIsVisible(true);
    };
    window.addEventListener('pwa-prompt-install', triggerHandler);

    // For iOS, we check if it's already in standalone mode
    const isStandalone = window.matchMedia('(display-mode: standalone)').matches || (window.navigator as any).standalone;
    
    if (isIos && !isStandalone) {
      // Show iOS specific prompt after a delay
      setTimeout(() => setIsVisible(true), 8000);
    }

    if (isStandalone) {
      setIsVisible(false);
    }

    return () => {
      window.removeEventListener('beforeinstallprompt', handler);
      window.removeEventListener('pwa-prompt-install', triggerHandler);
    };
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    setIsVisible(false);
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User responded to the install prompt with: ${outcome}`);
    
    setDeferredPrompt(null);
  };

  const renderPlatformInstructions = () => {
    if (platform === 'ios') {
      return (
        <div className="space-y-3">
          <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <Share size={16} className="text-primary" />
            </div>
            <div className="text-[10px] text-gray-300 font-medium">
              1. Tap the <span className="text-white font-black">Share icon</span> in the browser footer.
            </div>
          </div>
          <div className="flex items-start gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
            <div className="w-8 h-8 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
              <PlusSquare size={16} className="text-primary" />
            </div>
            <div className="text-[10px] text-gray-300 font-medium">
              2. Scroll down and tap <span className="text-white font-black">"Add to Home Screen"</span>.
            </div>
          </div>
        </div>
      );
    }

    return (
      <div className="space-y-3">
        <div className="flex items-center gap-3 bg-white/5 p-3 rounded-xl border border-white/5">
          <div className="w-10 h-10 rounded-lg bg-primary/20 flex items-center justify-center shrink-0">
            {platform === 'desktop' ? <Monitor size={20} className="text-primary" /> : <Box size={20} className="text-primary" />}
          </div>
          <div className="flex-1">
            <p className="text-[10px] text-gray-300">Fast, secure installation for {platform === 'desktop' ? 'Full Desktop Matrix' : 'Mobile Node'}.</p>
          </div>
        </div>
        <button 
          onClick={handleInstall}
          className="w-full bg-primary text-[#05070a] py-3 rounded-xl text-[11px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-all shadow-lg active:scale-95"
        >
          <Download size={14} /> Install Application
        </button>
      </div>
    );
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ y: 200, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 200, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:bottom-8 md:w-96"
        >
          <div className="bg-[#0b0e14] border border-primary/30 rounded-3xl p-6 shadow-[0_0_50px_rgba(0,242,254,0.15)] overflow-hidden relative group">
            {/* Background Effects */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 via-transparent to-accent/5" />
            <div className="absolute -top-24 -right-24 w-48 h-48 bg-primary/10 rounded-full blur-[80px]" />
            
            <div className="relative">
              <div className="flex justify-between items-start mb-5">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 bg-primary/10 rounded-xl flex items-center justify-center overflow-hidden border border-primary/20">
                    <img src="/icon.png" alt="Comfort Hub" className="w-full h-full object-cover" />
                  </div>
                  <div>
                    <h4 className="text-sm font-black text-white uppercase tracking-wider italic">Comfort Business Hub</h4>
                    <p className="text-[9px] text-primary font-black uppercase tracking-[0.2em] leading-none">Neural App Matrix</p>
                  </div>
                </div>
                <button 
                  onClick={() => setIsVisible(false)}
                  className="p-1.5 bg-white/5 rounded-lg text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>

              <div className="mb-6 space-y-2">
                <p className="text-xs text-white font-black italic uppercase tracking-tight">Experience Global Supply Matrix</p>
                <p className="text-[10px] text-gray-400 font-medium leading-relaxed">
                  Transform this marketplace into a full-app experience with instant access, offline sync, and neural node notifications.
                </p>
              </div>

              {renderPlatformInstructions()}

              <div className="mt-5 flex items-center justify-between text-[8px] font-black uppercase tracking-widest text-gray-600">
                <div className="flex items-center gap-1.5">
                  <div className="w-1 h-1 bg-neon-green rounded-full animate-pulse" />
                  Ready for Deployment
                </div>
                {platform !== 'ios' && (
                  <button 
                    onClick={() => setIsVisible(false)}
                    className="hover:text-white transition-colors"
                  >
                    Sync Later
                  </button>
                )}
              </div>
            </div>

            {/* Scanning Line */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary to-transparent animate-scan" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}

