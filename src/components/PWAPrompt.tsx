import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Download, X, Box } from 'lucide-react';

export default function PWAPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState<any>(null);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    const handler = (e: any) => {
      // Prevent Chrome 67 and earlier from automatically showing the prompt
      e.preventDefault();
      // Stash the event so it can be triggered later.
      setDeferredPrompt(e);
      // Show the prompt after a short delay
      setTimeout(() => setIsVisible(true), 3000);
    };

    window.addEventListener('beforeinstallprompt', handler);

    // Check if already installed
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setIsVisible(false);
    }

    return () => window.removeEventListener('beforeinstallprompt', handler);
  }, []);

  const handleInstall = async () => {
    if (!deferredPrompt) return;
    
    setIsVisible(false);
    deferredPrompt.prompt();
    
    const { outcome } = await deferredPrompt.userChoice;
    console.log(`User responded to the install prompt with: ${outcome}`);
    
    setDeferredPrompt(null);
  };

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div 
          initial={{ y: 100, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          exit={{ y: 100, opacity: 0 }}
          className="fixed bottom-24 left-4 right-4 z-[100] md:left-auto md:right-8 md:bottom-8 md:w-80"
        >
          <div className="bg-[#0d1117] border border-primary/20 rounded-2xl p-4 shadow-2xl shadow-primary/10 overflow-hidden relative group">
            {/* Background Glow */}
            <div className="absolute inset-0 bg-gradient-to-br from-primary/5 via-transparent to-accent/5 opacity-50" />
            
            <div className="relative flex items-center gap-4">
              <div className="w-12 h-12 bg-primary/10 rounded-xl flex items-center justify-center text-primary shrink-0 border border-primary/20">
                <Box size={24} className="animate-pulse" />
              </div>
              
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-white uppercase tracking-wider italic">Install ComfortHub</h4>
                <p className="text-[10px] text-gray-400 font-bold leading-tight">Add to your home screen for quick matrix access.</p>
              </div>

              <div className="flex flex-col gap-2">
                <button 
                  onClick={() => setIsVisible(false)}
                  className="p-1 text-gray-500 hover:text-white transition-colors"
                >
                  <X size={16} />
                </button>
              </div>
            </div>

            <div className="mt-4 flex gap-2">
              <button 
                onClick={handleInstall}
                className="flex-1 bg-primary text-[#05070a] py-2 rounded-lg text-[10px] font-black uppercase tracking-widest flex items-center justify-center gap-2 hover:bg-white transition-colors"
              >
                <Download size={14} /> Install Now
              </button>
              <button 
                onClick={() => setIsVisible(false)}
                className="px-4 py-2 bg-white/5 border border-white/10 rounded-lg text-[10px] font-bold text-gray-400 hover:text-white transition-colors"
              >
                Later
              </button>
            </div>

            {/* Scanning Line Effect */}
            <div className="absolute top-0 left-0 w-full h-[1px] bg-gradient-to-r from-transparent via-primary/50 to-transparent animate-scan" />
          </div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
