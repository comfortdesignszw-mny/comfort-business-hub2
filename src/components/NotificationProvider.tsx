import React, { createContext, useContext, useEffect, useState, useRef } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc, addDoc, serverTimestamp } from 'firebase/firestore';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, AppNotification, PushNotificationSettings } from '../types';
import { formatAuditableStamp } from '../lib/utils';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, Info, Star, ShoppingBag, Zap, Heart, UserPlus, MessageSquare, Store as StoreIcon, ShieldAlert } from 'lucide-react';

interface NotificationContextType {
  notifications: AppNotification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
  triggerFeedback: (title: string, message: string, type: AppNotification['type']) => void;
  pushSettings: PushNotificationSettings;
  updatePushSettings: (newSettings: Partial<PushNotificationSettings>) => void;
  requestPushPermission: () => Promise<void>;
  triggerTestPushNotification: (type: 'message' | 'buy' | 'like_product' | 'reminder') => void;
  sendWeeklySupplierReminder: () => Promise<void>;
}

const DEFAULT_SETTINGS: PushNotificationSettings = {
  messagesEnabled: true,
  dealsEnabled: true,
  engagementsEnabled: true,
  weeklyRemindersEnabled: true,
  lastWeeklyReminder: 0
};

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children, profile }: { children: React.ReactNode, profile: UserProfile | null }) {
  const [notifications, setNotifications] = useState<AppNotification[]>([]);
  const [showToast, setShowToast] = useState<{title: string, message: string, type: AppNotification['type']} | null>(null);
  
  const [pushSettings, setPushSettings] = useState<PushNotificationSettings>(() => {
    try {
      const saved = localStorage.getItem('cbh_push_settings');
      return saved ? { ...DEFAULT_SETTINGS, ...JSON.parse(saved) } : DEFAULT_SETTINGS;
    } catch {
      return DEFAULT_SETTINGS;
    }
  });

  const updatePushSettings = (newSettings: Partial<PushNotificationSettings>) => {
    setPushSettings(prev => {
      const updated = { ...prev, ...newSettings };
      localStorage.setItem('cbh_push_settings', JSON.stringify(updated));
      return updated;
    });
  };

  const requestPushPermission = async () => {
    if (typeof window !== 'undefined' && 'Notification' in window) {
      try {
        await Notification.requestPermission();
      } catch (e) {
        console.warn('Push notification permission request failed:', e);
      }
    }
  };

  const triggerFeedback = (title: string, message: string, type: AppNotification['type']) => {
    setShowToast({ title, message, type });
    playNotificationSound(type);
    setTimeout(() => setShowToast(null), 5000);
  };

  const sendWeeklySupplierReminder = async () => {
    const title = '📢 Weekly Supplier Discovery Alert';
    const message = 'Keep your products, services, and storefront updated! Fresh listings rank higher and get 3x more customer inquiries.';
    
    // 1. In-app toast & sound
    triggerFeedback(title, message, 'reminder');

    // 2. Browser Native Push Notification
    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/icons/icon-192x192.png'
        });
      } catch (err) {
        console.warn('Native notification failed:', err);
      }
    }

    // 3. Save notification record in DB if profile exists
    if (profile?.uid) {
      try {
        await addDoc(collection(db, 'notifications'), {
          userId: profile.uid,
          type: 'reminder',
          fromUserId: 'system',
          fromUserName: 'Comfort Business Hub Engine',
          title,
          message,
          read: false,
          createdAt: serverTimestamp()
        });
      } catch (err) {
        console.error('Failed to log reminder:', err);
      }
    }

    updatePushSettings({ lastWeeklyReminder: Date.now() });
  };

  const triggerTestPushNotification = (type: 'message' | 'buy' | 'like_product' | 'reminder') => {
    let title = 'Test Alert';
    let message = 'This is a test device push notification from Comfort Business Hub.';

    if (type === 'message') {
      title = '💬 New Comms Signal';
      message = 'Supplier Node: "Hie, your requested price quotation is ready."';
    } else if (type === 'buy') {
      title = '🛍️ Purchase Protocol Initialized';
      message = 'Customer initialized a Pay On Delivery order for your product!';
    } else if (type === 'like_product') {
      title = '❤️ New Social Engagement';
      message = 'Citizen liked your inventory item and saved it to favorites.';
    } else if (type === 'reminder') {
      title = '📢 Weekly Supplier Discovery Alert';
      message = 'Suppliers: Update your inventory and services today to maintain top marketplace ranking!';
    }

    triggerFeedback(title, message, type);

    if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
      try {
        new Notification(title, {
          body: message,
          icon: '/icons/icon-192x192.png'
        });
      } catch (err) {
        console.warn('Test push failed:', err);
      }
    }
  };

  // Check weekly reminder schedule for suppliers or store managers
  useEffect(() => {
    if (!profile) return;

    if (pushSettings.weeklyRemindersEnabled) {
      const SEVEN_DAYS_MS = 7 * 24 * 60 * 60 * 1000;
      const lastRun = pushSettings.lastWeeklyReminder || 0;
      if (Date.now() - lastRun > SEVEN_DAYS_MS) {
        // Trigger weekly reminder after a gentle 3-second delay on boot
        const timer = setTimeout(() => {
          sendWeeklySupplierReminder();
        }, 3000);
        return () => clearTimeout(timer);
      }
    }
  }, [profile?.uid, profile?.currentRole, pushSettings.weeklyRemindersEnabled]);

  const prevCountRef = useRef(0);
  const pushSettingsRef = useRef(pushSettings);
  pushSettingsRef.current = pushSettings;

  useEffect(() => {
    if (!profile || profile.isGuest || !auth.currentUser) {
      setNotifications([]);
      prevCountRef.current = 0;
      return;
    }

    // Request browser notification permission automatically
    requestPushPermission();

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const raw = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as AppNotification[];

      // Dedupe by id
      const newNotifications = Array.from(new Map(raw.map(n => [n.id, n])).values());

      if (newNotifications.length > prevCountRef.current) {
        const latest = newNotifications[0];
        const currentSettings = pushSettingsRef.current;
        if (latest && !latest.read) {
          // Check permission toggles
          let shouldShow = true;
          if (latest.type === 'message' && !currentSettings.messagesEnabled) shouldShow = false;
          if (latest.type === 'buy' && !currentSettings.dealsEnabled) shouldShow = false;
          if ((latest.type === 'like_product' || latest.type === 'like_store' || latest.type === 'follow' || latest.type === 'connect_request') && !currentSettings.engagementsEnabled) shouldShow = false;
          if (latest.type === 'reminder' && !currentSettings.weeklyRemindersEnabled) shouldShow = false;

          if (shouldShow) {
            // 1. UI Toast
            triggerFeedback(latest.title, latest.message, latest.type);

            // 2. Browser Native Notification
            if (typeof window !== 'undefined' && 'Notification' in window && Notification.permission === 'granted') {
              try {
                new Notification(latest.title, {
                  body: latest.message,
                  icon: '/icons/icon-192x192.png'
                });
              } catch (err) {
                console.warn('Native Notification construction failed', err);
              }
            }
          }
        }
      }

      prevCountRef.current = newNotifications.length;
      setNotifications(newNotifications);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [profile?.uid, profile?.isGuest, auth.currentUser?.uid]);

  const playNotificationSound = (type: AppNotification['type']) => {
    try {
      const context = new (window.AudioContext || (window as any).webkitAudioContext)();
      const masterGain = context.createGain();
      masterGain.connect(context.destination);
      masterGain.gain.setValueAtTime(0.1, context.currentTime);

      const now = context.currentTime;

      if (type === 'like_product' || type === 'like_store' || type === 'follow' || type === 'share') {
        const osc1 = context.createOscillator();
        const osc2 = context.createOscillator();
        const g1 = context.createGain();
        const g2 = context.createGain();

        osc1.type = 'sine';
        osc2.type = 'square';
        
        osc1.frequency.setValueAtTime(880, now);
        osc1.frequency.exponentialRampToValueAtTime(1760, now + 0.1);
        
        osc2.frequency.setValueAtTime(440, now + 0.05);
        osc2.frequency.exponentialRampToValueAtTime(880, now + 0.15);

        g1.gain.setValueAtTime(0, now);
        g1.gain.linearRampToValueAtTime(0.2, now + 0.01);
        g1.gain.exponentialRampToValueAtTime(0.0001, now + 0.2);

        g2.gain.setValueAtTime(0, now + 0.05);
        g2.gain.linearRampToValueAtTime(0.1, now + 0.06);
        g2.gain.exponentialRampToValueAtTime(0.0001, now + 0.3);

        osc1.connect(g1);
        g1.connect(masterGain);
        osc2.connect(g2);
        g2.connect(masterGain);

        osc1.start(now);
        osc1.stop(now + 0.2);
        osc2.start(now + 0.05);
        osc2.stop(now + 0.3);
      } else if (type === 'message') {
        const osc = context.createOscillator();
        const g = context.createGain();
        osc.type = 'sine';
        osc.frequency.setValueAtTime(1100, now);
        
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.15, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.4);
        
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.4);
      } else if (type === 'reminder') {
        // Special chime for reminders
        const osc = context.createOscillator();
        const g = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(523.25, now); // C5
        osc.frequency.setValueAtTime(659.25, now + 0.15); // E5
        osc.frequency.setValueAtTime(783.99, now + 0.3); // G5

        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.6);

        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.6);
      } else {
        const osc = context.createOscillator();
        const g = context.createGain();
        osc.type = 'triangle';
        osc.frequency.setValueAtTime(660, now);
        osc.frequency.exponentialRampToValueAtTime(330, now + 0.3);
        
        g.gain.setValueAtTime(0, now);
        g.gain.linearRampToValueAtTime(0.2, now + 0.01);
        g.gain.exponentialRampToValueAtTime(0.0001, now + 0.5);
        
        osc.connect(g);
        g.connect(masterGain);
        osc.start(now);
        osc.stop(now + 0.5);
      }
    } catch (e) {
      console.warn('Audio feedback blocked by browser settings');
    }
  };

  const markAsRead = async (id: string) => {
    try {
      await updateDoc(doc(db, 'notifications', id), { read: true });
    } catch (err) {
      console.error('Failed to mark notification as read:', err);
    }
  };

  const markAllAsRead = async () => {
    try {
      const unread = notifications.filter(n => !n.read);
      const promises = unread.map(n => updateDoc(doc(db, 'notifications', n.id), { read: true }));
      await Promise.all(promises);
    } catch (err) {
      console.error('Failed to mark all as read:', err);
    }
  };

  const unreadCount = notifications.filter(n => !n.read).length;

  return (
    <NotificationContext.Provider value={{ 
      notifications, 
      unreadCount, 
      markAsRead, 
      markAllAsRead, 
      triggerFeedback,
      pushSettings,
      updatePushSettings,
      requestPushPermission,
      triggerTestPushNotification,
      sendWeeklySupplierReminder
    }}>
      {children}
      
      {/* Real-time Toast Component */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            key={(showToast as any).id || showToast.title || 'notification-toast'}
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-4 right-4 z-[9999] sm:left-auto sm:right-8 sm:w-96"
          >
            <div className="bg-[#0d1117]/95 backdrop-blur-xl border border-primary/40 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.6)] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 border border-primary/30 flex items-center justify-center text-primary flex-shrink-0 shadow-lg">
                {getIcon(showToast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <div className="flex justify-between items-start gap-1">
                  <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">{showToast.title}</h4>
                  <span className="text-[7.5px] font-mono font-bold text-primary shrink-0 uppercase tracking-wider">{formatAuditableStamp(Date.now())}</span>
                </div>
                <p className="text-[10px] text-gray-300 mt-0.5 line-clamp-2 leading-relaxed">{showToast.message}</p>
              </div>
              <button 
                onClick={() => setShowToast(null)}
                className="text-gray-500 hover:text-white transition-colors"
              >
                <X size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </NotificationContext.Provider>
  );
}

function getIcon(type: AppNotification['type']) {
  switch (type) {
    case 'engage': return <Zap size={20} />;
    case 'buy': return <ShoppingBag size={20} />;
    case 'rate': return <Star size={20} />;
    case 'follow': return <UserPlus size={20} />;
    case 'like_store': 
    case 'like_product': return <Heart size={20} />;
    case 'message': return <MessageSquare size={20} />;
    case 'reminder': return <StoreIcon size={20} className="text-neon-green" />;
    case 'report': return <ShieldAlert size={20} className="text-red-500" />;
    default: return <Bell size={20} />;
  }
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
