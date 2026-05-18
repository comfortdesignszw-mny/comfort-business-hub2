import React, { createContext, useContext, useEffect, useState } from 'react';
import { messaging, db } from '../lib/firebase';
import { getToken, onMessage } from 'firebase/messaging';
import { doc, updateDoc, addDoc, collection, serverTimestamp, setDoc, query, where, onSnapshot, getDoc } from 'firebase/firestore';
import { UserProfile } from '../types';
import { motion, AnimatePresence } from 'motion/react';
import { Bell, X, WifiOff, Wifi } from 'lucide-react';
import { localDB, QueuedMessage } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';

interface MessagingContextType {
  token: string | null;
  notification: any | null;
  isOnline: boolean;
  unreadMessagesCount: number;
  queuedMessages: QueuedMessage[];
  sendMessage: (convoId: string, text: string) => Promise<void>;
  sendAttachment: (convoId: string, type: 'image' | 'video' | 'file' | 'location' | 'contact', payload: any) => Promise<void>;
  startConversation: (targetUid: string, initialMessage?: string) => Promise<string>;
}

const MessagingContext = createContext<MessagingContextType>({ 
  token: null, 
  notification: null, 
  isOnline: true, 
  unreadMessagesCount: 0,
  queuedMessages: [],
  sendMessage: async () => {},
  sendAttachment: async () => {},
  startConversation: async () => ''
});

export const useMessaging = () => useContext(MessagingContext);

export const MessagingProvider: React.FC<{ children: React.ReactNode, profile: UserProfile | null }> = ({ children, profile }) => {
  const [token, setToken] = useState<string | null>(null);
  const [notification, setNotification] = useState<any>(null);
  const [isOnline, setIsOnline] = useState(navigator.onLine);
  const [unreadMessagesCount, setUnreadMessagesCount] = useState(0);
  
  const queuedMessages = useLiveQuery(
    () => localDB.queuedMessages.orderBy('createdAt').toArray(),
    []
  ) || [];

  const updateQueuedMessage = async (id: number, updates: Partial<QueuedMessage>) => {
    await localDB.queuedMessages.update(id, updates);
  };

  useEffect(() => {
    if (!profile) {
      setUnreadMessagesCount(0);
      return;
    }

    // Listener for unread messages across all user's conversations
    // Since Firestore doesn't support complex cross-collection queries for messages easily, 
    // we listen to conversations where user is a participant and has unread messages.
    // However, it's easier to listen to messages directly if we know the conversations.
    // For now, let's listen to all "notifications" of type 'message' which we will create below.
    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      where('type', '==', 'message'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadMessagesCount(snap.size);
    });

    return () => unsubscribe();
  }, [profile?.uid]);

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
        // Only sync messages that are 'pending' (ready to sync)
        const readyToSync = queuedMessages.filter(m => m.status === 'pending');
        
        for (const msg of readyToSync) {
          try {
            const messageData = {
              conversationId: msg.convoId,
              senderId: msg.senderId,
              text: msg.text,
              type: msg.type || 'text',
              payload: msg.payload || null,
              read: false,
              createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'conversations', msg.convoId, 'messages'), messageData);

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

    const localId = await localDB.queuedMessages.add({
      convoId,
      senderId: profile.uid,
      text,
      type: 'text',
      createdAt: Date.now(),
      status: isOnline ? 'pending' : 'pending' // Always start as pending for now
    });

    if (!isOnline) return;

    try {
      const messageData = {
        conversationId: convoId,
        senderId: profile.uid,
        text,
        type: 'text',
        read: false,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'conversations', convoId, 'messages'), messageData);

      await updateDoc(doc(db, 'conversations', convoId), {
        lastMessage: text,
        updatedAt: serverTimestamp()
      });

      // Notification logic...
      const convoDoc = await getDoc(doc(db, 'conversations', convoId));
      if (convoDoc.exists()) {
        const otherId = convoDoc.data().participants?.find((p: string) => p !== profile.uid);
        if (otherId) {
          await addDoc(collection(db, 'notifications'), {
            userId: otherId,
            type: 'message',
            fromUserId: profile.uid,
            fromUserName: profile.name || 'User',
            targetId: convoId,
            title: `New Message from ${profile.name || 'User'}`,
            message: text.length > 50 ? text.substring(0, 47) + '...' : text,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      await localDB.queuedMessages.delete(localId);
    } catch (err) {
      console.error("Send failed:", err);
      // Keep in localDB if failed
    }
  };

  const sendAttachment = async (convoId: string, type: any, payload: any, localId?: number) => {
    if (!profile) return;

    // If no localId, this might be a new request or coming from Chat.tsx
    // For Chat.tsx, it might have already added a placeholder
    let finalLocalId = localId;
    if (!finalLocalId) {
      finalLocalId = await localDB.queuedMessages.add({
        convoId,
        senderId: profile.uid,
        text: type === 'image' ? '[Image]' : type === 'video' ? '[Video]' : '[File]',
        type,
        payload,
        createdAt: Date.now(),
        status: 'pending'
      });
    }

    if (!isOnline) {
      await localDB.queuedMessages.update(finalLocalId, { status: 'pending' });
      return;
    }

    try {
      const messageData = {
        conversationId: convoId,
        senderId: profile.uid,
        text: type === 'image' ? '[Image Attachment]' : 
              type === 'video' ? '[Video Attachment]' : 
              type === 'location' ? '[Location Share]' : 
              type === 'contact' ? '[Contact Shared]' : '[File Attachment]',
        type,
        payload,
        read: false,
        createdAt: serverTimestamp()
      };

      await addDoc(collection(db, 'conversations', convoId, 'messages'), messageData);

      await updateDoc(doc(db, 'conversations', convoId), {
        lastMessage: messageData.text,
        updatedAt: serverTimestamp()
      });

      // Notify
      const convoDoc = await getDoc(doc(db, 'conversations', convoId));
      if (convoDoc.exists()) {
        const otherId = convoDoc.data().participants?.find((p: string) => p !== profile.uid);
        if (otherId) {
          await addDoc(collection(db, 'notifications'), {
            userId: otherId,
            type: 'message',
            fromUserId: profile.uid,
            fromUserName: profile.name || 'User',
            targetId: convoId,
            title: `New Attachment from ${profile.name || 'User'}`,
            message: messageData.text,
            read: false,
            createdAt: serverTimestamp()
          });
        }
      }

      await localDB.queuedMessages.delete(finalLocalId);
    } catch (err) {
      console.error("Attachment send failed:", err);
      await localDB.queuedMessages.update(finalLocalId, { status: 'pending' });
    }
  };

  const startConversation = async (targetUid: string, initialMessage?: string) => {
    if (!profile) throw new Error("Auth required");
    
    const convoId = [profile.uid, targetUid].sort().join('_');
    
    // Background task to ensure conversation exists
    const ensureConversation = async () => {
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
      } catch (err) {
        console.error("Conversation initialization failed:", err);
        if (initialMessage) {
          await sendMessage(convoId, initialMessage);
        }
      }
    };

    ensureConversation();
    return convoId;
  };

  useEffect(() => {
    if (!profile || !messaging) return;

    const requestPermission = async () => {
      try {
        if (!('Notification' in window)) return;

        const permission = await Notification.requestPermission();
        if (permission === 'granted') {
          try {
            const currentToken = await getToken(messaging);
            if (currentToken) {
              setToken(currentToken);
              if (profile.fcmToken !== currentToken) {
                await updateDoc(doc(db, 'users', profile.uid), {
                  fcmToken: currentToken
                });
              }
            }
          } catch (tokenErr) {
            console.warn('FCM Token sync skipped.', tokenErr);
          }
        }
      } catch (err) {
        console.warn('Notification permission request failed.', err);
      }
    };

    requestPermission();

    const unsubscribe = onMessage(messaging, (payload) => {
      setNotification(payload);
    });

    return () => unsubscribe();
  }, [profile]);

  return (
    <MessagingContext.Provider value={{ 
      token, 
      notification, 
      isOnline, 
      unreadMessagesCount, 
      queuedMessages, 
      sendMessage, 
      sendAttachment,
      startConversation 
    }}>
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
