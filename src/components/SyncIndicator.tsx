import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { Cloud, CloudOff, RefreshCw, CheckCircle2 } from 'lucide-react';
import { localDB } from '../lib/db';
import { cn } from '../lib/utils';

export default function SyncIndicator() {
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [pendingCount, setPendingCount] = useState(0);
  const [isSyncing, setIsSyncing] = useState(false);

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    // Poll for outbox count
    const interval = setInterval(async () => {
      const count = await localDB.outbox.count();
      setPendingCount(count);
      // We assume if count is decreasing, syncing is happening
      // But we can also check the triggerSync state if we had a global signal
    }, 2000);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
      clearInterval(interval);
    };
  }, []);

  return (
    <div className="flex items-center gap-2 px-3 py-1.5 bg-white/5 rounded-full border border-white/5 transition-all">
      <AnimatePresence mode="wait">
        {!isOnline ? (
          <motion.div 
            key="offline"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-red-400"
          >
            <CloudOff size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest">Offline</span>
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
            <span className="text-[8px] font-black uppercase tracking-widest">Syncing ({pendingCount})</span>
          </motion.div>
        ) : (
          <motion.div 
            key="online"
            initial={{ opacity: 0, scale: 0.8 }}
            animate={{ opacity: 1, scale: 1 }}
            exit={{ opacity: 0, scale: 0.8 }}
            className="flex items-center gap-1.5 text-neon-green"
          >
            <CheckCircle2 size={12} />
            <span className="text-[8px] font-black uppercase tracking-widest">Synced</span>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}
