import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, RefreshCw, X } from 'lucide-react';
import { subscribeToSyncErrors, clearSyncError, triggerSync, SyncErrorInfo } from '../lib/sync';

export default function SyncIndicator() {
  const [syncError, setSyncErrorState] = useState<SyncErrorInfo | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);

  useEffect(() => {
    const unsubscribe = subscribeToSyncErrors((err) => {
      setSyncErrorState(err);
      if (!err) {
        setIsRetrying(false);
      }
    });

    return () => {
      unsubscribe();
    };
  }, []);

  const handleRetry = async () => {
    setIsRetrying(true);
    try {
      await triggerSync();
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  const handleDismiss = () => {
    clearSyncError();
  };

  // Completely invisible on normal sync / background operations.
  // Only shows red alert when a sync error occurs with item name and retry option.
  if (!syncError) return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 max-w-sm pointer-events-auto">
      <AnimatePresence>
        <motion.div
          initial={{ opacity: 0, y: 20, scale: 0.95 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 20, scale: 0.95 }}
          className="flex items-center gap-3 p-3 bg-red-950/90 border border-red-500/50 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.3)] text-white"
        >
          <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
            <AlertCircle size={18} className="animate-pulse" />
          </div>

          <div className="flex-1 min-w-0 pr-1">
            <p className="text-[9px] font-black uppercase tracking-widest text-red-300 flex items-center gap-1.5">
              Sync Error
            </p>
            <p className="text-xs font-bold text-white truncate">
              "{syncError.itemName}"
            </p>
            <p className="text-[9px] text-red-200/80 truncate">
              Failed to sync to cloud. Local changes saved.
            </p>
          </div>

          <div className="flex items-center gap-1.5 shrink-0">
            <button
              onClick={handleRetry}
              disabled={isRetrying}
              className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-[9px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all shadow-sm disabled:opacity-50"
              title="Retry sync now"
            >
              <RefreshCw size={10} className={isRetrying ? "animate-spin" : ""} />
              {isRetrying ? 'Retrying' : 'Retry'}
            </button>
            <button
              onClick={handleDismiss}
              className="p-1.5 hover:bg-white/10 text-red-300 hover:text-white rounded-lg transition-colors"
              title="Dismiss error"
            >
              <X size={14} />
            </button>
          </div>
        </motion.div>
      </AnimatePresence>
    </div>
  );
}
