import React, { createContext, useContext, useEffect, useState } from 'react';
import { messaging, db } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, addDoc, collection, serverTimestamp, setDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, WifiOff, Wifi } from 'lucide-react';
import { localDB, QueuedMessage } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface MessagingContextType {
  token: string | null;
  notification: any | null;
  isOnline: boolean;
  queuedMessages: QueuedMessage[];
  sendMessage: (convoId: string, text: string) => Promise<void>;
  startConversation: (targetUid: string, initialMessage?: string) => Promise<string>;
}

const MessagingContext = createContext<MessagingContextType>({ 
  token: null, 
  notification: null, 
  isOnline: true, 
  queuedMessages: [],
  sendMessage: async () => {},
  startConversation: async () => ''
});

export const useMessaging = () => useContext(MessagingContext);

export const MessagingProvider: React.FC<{ children: React.ReactNode, profile: UserProfile | null }> = ({ children, profile }) => {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  
  const queuedMessages = useLiveQuery(
    () => localDB.queuedMessages.toArray(),
    []
  ) || [];

  useEffect(() => {
    const handleOnline = () => setIsOnline(true);
    const handleOffline = () => setIsOnline(false);

    window.addEventListener('online', handleOnline);
    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('online', handleOnline);
      window.removeEventListener('offline', handleOffline);
    };
  }, []);

  // Sync logic
  useEffect(() => {
    if (isOnline && queuedMessages.length > 0 && profile) {
      const syncMessages = async () => {
        for (const msg of queuedMessages) {
          try {
            // Check if conversation exists, if not, we might have a problem if it was a startConversation offline
            // But for simplicity, we assume the conversation was created or will be created
            await addDoc(collection(db, 'conversations', msg.convoId, 'messages'), {
              conversationId: msg.convoId,
              senderId: msg.senderId,
              text: msg.text,
              type: 'text',
              createdAt: serverTimestamp()
            });

            await updateDoc(doc(db, 'conversations', msg.convoId), {
              lastMessage: msg.text,
              updatedAt: serverTimestamp()
            });

            await localDB.queuedMessages.delete(msg.id!);
          } catch (err) {
            console.error("Failed to sync message:", err);
            await localDB.queuedMessages.update(msg.id!, { status: 'failed' });
          }
        }
      };
      syncMessages();
    }
  }, [isOnline, queuedMessages.length, profile?.uid]);

  const sendMessage = async (convoId: string, text: string) => {
    if (!profile) return;

    if (!isOnline) {
      await localDB.queuedMessages.add({
        convoId,
        senderId: profile.uid,
        text,
        createdAt: Date.now(),
        status: 'pending'
      });
      return;
    }

    try {
      await addDoc(collection(db, 'conversations', convoId, 'messages'), {
        conversationId: convoId,
        senderId: profile.uid,
        text,
        type: 'text',
        createdAt: serverTimestamp()
      });

      await updateDoc(doc(db, 'conversations', convoId), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });
    } catch (err) {
      await localDB.queuedMessages.add({
        convoId,
        senderId: profile.uid,
        text,
        createdAt: Date.now(),
        status: 'pending'
      });
    }
  };

  const startConversation = async (targetUid: string, initialMessage?: string) => {
    if (!profile) throw new Error("Auth required");
    
    const convoId = [profile.uid, targetUid].sort().join('_');
    
    // In industry apps, we'd queue the conversation creation too if offline
    // For now, if offline, we still redirect to chat, and sendMessage will queue the message
    if (!isOnline) {
      if (initialMessage) {
        await sendMessage(convoId, initialMessage);
      }
      return convoId;
    }

    try {
      await setDoc(doc(db, 'conversations', convoId), {
        id: convoId,
        participants: [profile.uid, targetUid],
        updatedAt: serverTimestamp(),
        lastMessage: initialMessage || 'Link initiated',
        initiatorId: profile.uid
      }, { merge: true });

      if (initialMessage) {
        await sendMessage(convoId, initialMessage);
      }
      return convoId;
    } catch (err) {
      if (initialMessage) {
        await sendMessage(convoId, initialMessage);
      }
      return convoId;
    }
  };

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
    <MessagingContext.Provider value={{ token, notification, isOnline, queuedMessages, sendMessage, startConversation }}>
      {children}
      <AnimatePresence>
        {/* Connection Status Toast */}
        {!isOnline && (
          <motion.div
            initial={{ opacity: 0, y: -20 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9 }}
            className="fixed top-24 left-1/2 -translate-x-1/2 z-[100] bg-red-500/10 border border-red-500/20 backdrop-blur-md px-4 py-2 rounded-full flex items-center gap-2"
          >
            <WifiOff size={12} className="text-red-500 animate-pulse" />
            <span className="text-[9px] font-black text-red-500 uppercase tracking-widest">Connection Severed • Local Cache Active</span>
          </motion.div>
        )}
        
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
