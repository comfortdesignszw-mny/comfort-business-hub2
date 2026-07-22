import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { localDB } from '../lib/db';
import { cn } from '../lib/utils';

export default function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    const interval = setInterval(async () => {
      const count = await localDB.outbox.count();
      setPendingCount(count);
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  if (isOnline && pendingCount === 0) return null; // Very subtle, only show when needed

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 transition-all">
      <AnimatePresence mode="wait">
        {!isOnline ? (
          <motion.div 
            key="offline"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-yellow-400"
          >
            <CloudOff size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest">
              {pendingCount > 0 ? "Saved offline — will sync when connected" : "No internet connection"}
            </span>
          </motion.div>
        ) : pendingCount > 0 ? (
          <motion.div 
            key="syncing"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-primary"
          >
            <RefreshCw size={12} className="animate-spin" />
            <span className="text-[8px] font-black uppercase tracking-widest">Saving changes ({pendingCount})</span>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
