import React, { useState } from 'react';
import { motion } from 'motion/react';
import { 
  Bell, X, MessageSquare, ShoppingBag, Heart, Store as StoreIcon, 
  Check, ShieldCheck, Sparkles, Send, Volume2, AlertCircle
} from 'lucide-react';
import { useNotifications } from './NotificationProvider';
import { cn } from '../lib/utils';

export default function PushNotificationSettingsModal({
  isOpen,
  onClose
}: {
  isOpen: boolean;
  onClose: () => void;
}) {
  const { 
    pushSettings, 
    updatePushSettings, 
    requestPushPermission, 
    triggerTestPushNotification, 
    sendWeeklySupplierReminder 
  } = useNotifications();

  const [testSuccessMsg, setTestSuccessMsg] = useState<string | null>(null);

  if (!isOpen) return null;

  const permissionStatus = typeof window !== 'undefined' && 'Notification' in window 
    ? Notification.permission 
    : 'unsupported';

  const handleTest = (type: 'message' | 'buy' | 'like_product' | 'reminder') => {
    triggerTestPushNotification(type);
    setTestSuccessMsg(`Dispatched test push alert for ${type === 'reminder' ? 'Weekly Supplier Reminder' : type}!`);
    setTimeout(() => setTestSuccessMsg(null), 4000);
  };

  const handleWeeklyTrigger = () => {
    sendWeeklySupplierReminder();
    setTestSuccessMsg('Weekly Supplier Discovery Alert triggered successfully!');
    setTimeout(() => setTestSuccessMsg(null), 4000);
  };

  return (
    <div className="fixed inset-0 z-[150] flex items-center justify-center p-4 sm:p-6 overflow-y-auto">
      <motion.div 
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-xl"
        onClick={onClose}
      />

      <motion.div 
        initial={{ scale: 0.9, opacity: 0, y: 20 }}
        animate={{ scale: 1, opacity: 1, y: 0 }}
        exit={{ scale: 0.9, opacity: 0, y: 20 }}
        className="relative w-full max-w-lg bg-[#0d1117] border border-white/10 rounded-3xl shadow-2xl overflow-hidden flex flex-col max-h-[85vh]"
      >
        {/* Header */}
        <div className="p-5 sm:p-6 border-b border-white/10 bg-white/5 flex justify-between items-center">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-2xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary shadow-lg">
              <Bell size={20} className="animate-pulse" />
            </div>
            <div>
              <h3 className="text-base sm:text-lg font-black text-white italic uppercase tracking-tighter">
                Push Alert Protocol
              </h3>
              <p className="text-[9px] text-gray-400 font-bold uppercase tracking-widest leading-none">
                Configure Real-Time Device Notifications
              </p>
            </div>
          </div>
          <button 
            onClick={onClose} 
            className="w-9 h-9 rounded-xl bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white flex items-center justify-center transition-all"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6 space-y-6 overflow-y-auto custom-scrollbar flex-1">
          {/* Permission Status Box */}
          <div className="p-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-between gap-4">
            <div className="space-y-1">
              <span className="text-[9px] font-black uppercase tracking-widest text-gray-400">Device Browser Status</span>
              <div className="flex items-center gap-2">
                <span className={cn(
                  "w-2.5 h-2.5 rounded-full animate-ping",
                  permissionStatus === 'granted' ? "bg-neon-green" : permissionStatus === 'denied' ? "bg-red-500" : "bg-amber-400"
                )} />
                <span className="text-sm font-black text-white italic uppercase">
                  {permissionStatus === 'granted' ? 'Push Granted' : permissionStatus === 'denied' ? 'Permission Denied' : 'Prompt Pending'}
                </span>
              </div>
            </div>

            {permissionStatus !== 'granted' && permissionStatus !== 'unsupported' && (
              <button 
                onClick={requestPushPermission}
                className="btn-neon px-4 py-2 text-[10px] font-black uppercase tracking-widest flex items-center gap-1.5"
              >
                <ShieldCheck size={14} /> Enable Permission
              </button>
            )}
          </div>

          {testSuccessMsg && (
            <motion.div 
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="p-3 bg-neon-green/20 border border-neon-green/40 rounded-xl text-neon-green text-xs font-bold flex items-center gap-2"
            >
              <Sparkles size={16} />
              {testSuccessMsg}
            </motion.div>
          )}

          {/* Toggle Channels */}
          <div className="space-y-3">
            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Notification Channels</h4>

            {/* 1. Messages */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-blue-500/20 text-blue-400 flex items-center justify-center shrink-0">
                  <MessageSquare size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-white italic uppercase">Comms & Direct Messages</h5>
                  <p className="text-[10px] text-gray-400">Alerts when suppliers or clients send direct chat messages.</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={pushSettings.messagesEnabled}
                onChange={(e) => updatePushSettings({ messagesEnabled: e.target.checked })}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-primary focus:ring-primary"
              />
            </div>

            {/* 2. Deals & Orders */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-primary/20 text-primary flex items-center justify-center shrink-0">
                  <ShoppingBag size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-white italic uppercase">New Deals & Purchases</h5>
                  <p className="text-[10px] text-gray-400">Alerts when a purchase protocol or Pay On Delivery order is initialized.</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={pushSettings.dealsEnabled}
                onChange={(e) => updatePushSettings({ dealsEnabled: e.target.checked })}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-primary focus:ring-primary"
              />
            </div>

            {/* 3. Social Engagements */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between gap-4">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-pink-500/20 text-pink-400 flex items-center justify-center shrink-0">
                  <Heart size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-white italic uppercase">Social Engagements</h5>
                  <p className="text-[10px] text-gray-400">Alerts when users like your store/products, follow you, or request connection.</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={pushSettings.engagementsEnabled}
                onChange={(e) => updatePushSettings({ engagementsEnabled: e.target.checked })}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-primary focus:ring-primary"
              />
            </div>

            {/* 4. Weekly Supplier Product Update Reminders */}
            <div className="p-4 bg-white/5 border border-white/5 rounded-2xl flex items-center justify-between gap-4 border-l-4 border-l-neon-green">
              <div className="flex items-center gap-3">
                <div className="w-9 h-9 rounded-xl bg-neon-green/20 text-neon-green flex items-center justify-center shrink-0">
                  <StoreIcon size={18} />
                </div>
                <div>
                  <h5 className="text-xs font-black text-white italic uppercase flex items-center gap-1.5">
                    Weekly Supplier Update Reminders
                    <span className="px-1.5 py-0.5 rounded bg-neon-green/20 text-neon-green text-[8px] font-bold">RECOMMENDED</span>
                  </h5>
                  <p className="text-[10px] text-gray-400">Weekly push alert reminding suppliers to update products & services for top ranking & discoverability.</p>
                </div>
              </div>
              <input 
                type="checkbox" 
                checked={pushSettings.weeklyRemindersEnabled}
                onChange={(e) => updatePushSettings({ weeklyRemindersEnabled: e.target.checked })}
                className="w-5 h-5 rounded bg-white/10 border-white/20 text-neon-green focus:ring-neon-green"
              />
            </div>
          </div>

          {/* Instant Test Push Section */}
          <div className="space-y-3 pt-2 border-t border-white/10">
            <h4 className="text-[10px] font-black text-primary uppercase tracking-[0.2em]">Test Push Notifications</h4>
            <div className="grid grid-cols-2 gap-2">
              <button 
                onClick={() => handleTest('message')}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
              >
                <MessageSquare size={12} /> Test Comms
              </button>
              <button 
                onClick={() => handleTest('buy')}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
              >
                <ShoppingBag size={12} /> Test Purchase
              </button>
              <button 
                onClick={() => handleTest('like_product')}
                className="py-2.5 px-3 bg-white/5 hover:bg-white/10 border border-white/10 rounded-xl text-[10px] font-black uppercase text-gray-300 hover:text-white flex items-center justify-center gap-1.5 transition-all"
              >
                <Heart size={12} /> Test Engagement
              </button>
              <button 
                onClick={handleWeeklyTrigger}
                className="py-2.5 px-3 bg-neon-green/20 hover:bg-neon-green/30 border border-neon-green/30 rounded-xl text-[10px] font-black uppercase text-neon-green flex items-center justify-center gap-1.5 transition-all"
              >
                <StoreIcon size={12} /> Trigger Weekly Alert
              </button>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="p-4 bg-white/5 border-t border-white/10 flex justify-end">
          <button 
            onClick={onClose}
            className="btn-neon px-6 py-2.5 text-[10px] font-black uppercase tracking-widest"
          >
            Save Preferences
          </button>
        </div>
      </motion.div>
    </div>
  );
}
