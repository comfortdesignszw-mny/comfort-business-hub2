import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { AlertCircle, RefreshCw, X, WifiOff, CheckCircle } from 'lucide-react';
import { subscribeToSyncErrors, retrySyncFromError, cancelSyncItem, SyncErrorInfo } from '../lib/sync';
import { auth } from '../lib/firebase';
import { UserProfile } from '../types';

export default function SyncIndicator({ profile }: { profile?: UserProfile | null }) {
  const [syncError, setSyncErrorState] = useState<SyncErrorInfo | null>(null);
  const [isRetrying, setIsRetrying] = useState(false);
  const [cancelledMessage, setCancelledMessage] = useState<string | null>(null);

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
      await retrySyncFromError();
    } finally {
      setTimeout(() => setIsRetrying(false), 800);
    }
  };

  const handleCancel = async () => {
    if (!syncError) return;
    const itemName = syncError.itemName;
    await cancelSyncItem(syncError.id);
    setCancelledMessage(`Sync cancelled for "${itemName}". Retries terminated.`);
    setTimeout(() => setCancelledMessage(null), 3500);
  };

  // Scope check: If error is associated with a specific user account, ONLY show to that user
  const currentUid = profile?.uid || auth.currentUser?.uid;
  if (syncError && syncError.userId && currentUid && syncError.userId !== currentUid) {
    return null;
  }

  // If sync is normal, or in 2-minute delay period, keep UI silent and invisible
  if (!syncError && !cancelledMessage) return null;
  if (syncError && syncError.status === 'delayed_error') return null;

  return (
    <div className="fixed bottom-20 sm:bottom-6 right-4 z-50 max-w-sm pointer-events-auto">
      <AnimatePresence mode="wait">
        {cancelledMessage ? (
          <motion.div
            key="sync-cancelled-toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="flex items-center gap-2.5 p-3 bg-zinc-900/95 border border-zinc-700/80 backdrop-blur-md rounded-2xl shadow-xl text-white text-xs"
          >
            <CheckCircle size={16} className="text-emerald-400 shrink-0" />
            <p className="text-[10px] font-bold text-gray-200">{cancelledMessage}</p>
          </motion.div>
        ) : syncError && syncError.status === 'waiting_connection' ? (
          <motion.div
            key="sync-waiting-toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="flex items-center gap-3 p-3 bg-amber-950/90 border border-amber-500/50 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_rgba(245,158,11,0.25)] text-white"
          >
            <div className="p-2 rounded-xl bg-amber-500/20 text-amber-400 shrink-0">
              <WifiOff size={16} className="animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <p className="text-[9px] font-black uppercase tracking-widest text-amber-300">
                Sync Queued (Waiting for Connection)
              </p>
              <p className="text-xs font-bold text-white truncate">
                "{syncError.itemName}"
              </p>
              <p className="text-[9px] text-amber-200/80">
                Will auto-sync when active connection is restored.
              </p>
            </div>

            <div className="flex items-center gap-1 shrink-0">
              <button
                onClick={handleCancel}
                className="px-2 py-1 bg-white/10 hover:bg-white/20 text-gray-300 hover:text-white rounded-lg text-[9px] font-bold uppercase tracking-wider transition-colors cursor-pointer"
                title="Cancel sync and stop retries"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : syncError ? (
          <motion.div
            key="sync-error-toast"
            initial={{ opacity: 0, y: 20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, y: 20, scale: 0.95 }}
            className="flex items-center gap-3 p-3 bg-red-950/95 border border-red-500/60 backdrop-blur-md rounded-2xl shadow-[0_10px_30px_rgba(239,68,68,0.35)] text-white"
          >
            <div className="p-2 rounded-xl bg-red-500/20 text-red-400 shrink-0">
              <AlertCircle size={18} className="animate-pulse" />
            </div>

            <div className="flex-1 min-w-0 pr-1">
              <div className="flex items-center gap-1.5">
                <p className="text-[9px] font-black uppercase tracking-widest text-red-300">
                  Sync Error
                </p>
                {syncError.userRetries > 0 && (
                  <span className="text-[8px] bg-red-500/30 text-red-200 px-1 py-0.2 rounded font-mono font-bold">
                    Retry {syncError.userRetries}/3
                  </span>
                )}
              </div>
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
                className="px-2.5 py-1.5 bg-red-600 hover:bg-red-500 active:scale-95 text-white font-black text-[9px] uppercase tracking-wider rounded-lg flex items-center gap-1 transition-all shadow-sm disabled:opacity-50 cursor-pointer"
                title="Retry sync now"
              >
                <RefreshCw size={10} className={isRetrying ? "animate-spin" : ""} />
                {isRetrying ? 'Retrying' : 'Retry'}
              </button>
              <button
                onClick={handleCancel}
                className="px-2 py-1.5 bg-white/10 hover:bg-red-500/30 text-red-200 hover:text-white rounded-lg text-[9px] font-black uppercase tracking-wider transition-colors cursor-pointer"
                title="Cancel sync and stop retrying this item"
              >
                Cancel
              </button>
            </div>
          </motion.div>
        ) : null}
      </AnimatePresence>
    </div>
  );
}
