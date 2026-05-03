import React, { createContext, useContext, useEffect, useState } from 'react';
import { collection, query, where, orderBy, onSnapshot, doc, updateDoc } from 'firebase/firestore';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { UserProfile, Notification } from '../types';
import { AnimatePresence, motion } from 'motion/react';
import { Bell, X, Info, Star, ShoppingBag, Zap, Heart, UserPlus } from 'lucide-react';

interface NotificationContextType {
  notifications: Notification[];
  unreadCount: number;
  markAsRead: (id: string) => Promise<void>;
  markAllAsRead: () => Promise<void>;
}

const NotificationContext = createContext<NotificationContextType | undefined>(undefined);

export function NotificationProvider({ children, profile }: { children: React.ReactNode, profile: UserProfile | null }) {
  const [notifications, setNotifications] = useState<Notification[]>([]);
  const [showToast, setShowToast] = useState<Notification | null>(null);

  useEffect(() => {
    if (!profile) {
      setNotifications([]);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      orderBy('createdAt', 'desc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const newNotifications = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      })) as Notification[];

      // Detect new notification for toast
      if (newNotifications.length > notifications.length) {
        const latest = newNotifications[0];
        if (latest && !latest.read) {
          setShowToast(latest);
          setTimeout(() => setShowToast(null), 5000);
        }
      }

      setNotifications(newNotifications);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'notifications');
    });

    return () => unsubscribe();
  }, [profile?.uid]);

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
    <NotificationContext.Provider value={{ notifications, unreadCount, markAsRead, markAllAsRead }}>
      {children}
      
      {/* Real-time Toast Component */}
      <AnimatePresence>
        {showToast && (
          <motion.div
            initial={{ opacity: 0, y: 50, scale: 0.9 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed bottom-24 left-4 right-4 z-[9999] sm:left-auto sm:right-8 sm:w-96"
          >
            <div className="bg-[#0d1117]/90 backdrop-blur-xl border border-primary/30 rounded-2xl p-4 shadow-[0_20px_50px_rgba(0,0,0,0.5)] flex items-start gap-4">
              <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center text-primary flex-shrink-0">
                {getIcon(showToast.type)}
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-xs font-black text-white uppercase tracking-tight truncate">{showToast.title}</h4>
                <p className="text-[10px] text-gray-400 mt-0.5 line-clamp-2">{showToast.message}</p>
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

function getIcon(type: Notification['type']) {
  switch (type) {
    case 'engage': return <Zap size={20} />;
    case 'buy': return <ShoppingBag size={20} />;
    case 'rate': return <Star size={20} />;
    case 'follow': return <UserPlus size={20} />;
    case 'like_store': 
    case 'like_product': return <Heart size={20} />;
    default: return <Bell size={20} />;
  }
}

export function useNotifications() {
  const context = useContext(NotificationContext);
  if (!context) throw new Error('useNotifications must be used within NotificationProvider');
  return context;
}
