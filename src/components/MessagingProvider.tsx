import React, { createContext, useContext, useEffect, useState } from 'react';
import { messaging, db } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X } from 'lucide-react';

interface MessagingContextType {
  token: string | null;
  notification: any | null;
}

const MessagingContext = createContext<MessagingContextType>({ token: null, notification: null });

export const useMessaging = () => useContext(MessagingContext);

export const MessagingProvider: React.FC<{ children: React.ReactNode, profile: UserProfile | null }> = ({ children, profile }) => {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);

  useEffect(() => {
    if (!profile || !messaging) return;

    const requestPermission = async () => {
      try {
        if (!('Notification' in window)) {
          console.log('This browser does not support desktop notifications');
          return;
        }

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          // Get the FCM token
          // Note: In production you'd need a VAPID key: 
          // const currentToken = await getToken(messaging, { vapidKey: 'YOUR_VAPID_KEY' });
          // If this fails with permission error, it's usually a missing project config or VAPID key
          try {
            const currentToken = await getToken(messaging);
            
            if (currentToken) {
              setToken(currentToken);
              // Store token in Firestore if it changed
              if (profile.fcmToken !== currentToken) {
                await updateDoc(doc(db, 'users', profile.uid), {
                  fcmToken: currentToken
                });
              }
            }
          } catch (tokenErr) {
            // Silently fail token retrieval as we have Firestore fallbacks
            console.warn('FCM Token sync skipped. This is expected if FCM is not fully configured in Firebase Console.', tokenErr);
          }
        }
      } catch (err) {
        console.warn('Notification permission request failed or was denied.', err);
      }
    };

    requestPermission();

    // Handle foreground messages
    const unsubscribe = onMessage(messaging, (payload) => {
      console.log('Foreground message received: ', payload);
      setNotification(payload);
      
      // Simple custom notification toast
      if (payload.notification) {
        const title = payload.notification.title || 'New Notification';
        const body = payload.notification.body || '';
        
        // Use a simple custom alert or trigger a global toast
        // For now, we'll log it and let the UI react to the 'notification' state
        console.log(`Notification: ${title} - ${body}`);
      }
    });

    return () => unsubscribe();
  }, [profile]);

  return (
    <MessagingContext.Provider value={{ token, notification }}>
      {children}
      <AnimatePresence>
        {notification && (
          <motion.div
            initial={{ opacity: 0, y: -50 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 w-[90%] max-w-sm z-[100] neon-card p-4 flex items-center gap-4 cursor-pointer"
            onClick={() => setNotification(null)}
          >
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
              <Bell size={20} className="animate-bounce" />
            </div>
            <div className="flex-1">
              <h4 className="text-[10px] font-black text-white uppercase tracking-widest">{notification.notification?.title}</h4>
              <p className="text-[9px] text-gray-500 font-bold uppercase tracking-tight line-clamp-2">{notification.notification?.body}</p>
            </div>
            <button 
              onClick={(e) => { e.stopPropagation(); setNotification(null); }}
              className="p-1 hover:text-white transition-colors"
            >
              <X size={16} />
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </MessagingContext.Provider>
  );
};
