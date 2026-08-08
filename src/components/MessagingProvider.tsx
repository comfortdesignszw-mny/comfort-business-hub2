import React, { createContext, useContext, useEffect, useState } from 'react';
import { messaging, db, auth } from '../lib/firebase';
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

const globalOngoingSyncs = new Set<number>();

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
    if (!profile || profile.isGuest || !auth.currentUser) {
      setUnreadMessagesCount(0);
      return;
    }

    const q = query(
      collection(db, 'notifications'),
      where('userId', '==', profile.uid),
      where('type', '==', 'message'),
      where('read', '==', false)
    );

    const unsubscribe = onSnapshot(q, (snap) => {
      setUnreadMessagesCount(snap.size);
    }, (err) => {
      console.warn('Unread notifications listener suppressed for guest/auth state:', err);
    });

    return () => unsubscribe();
  }, [profile?.uid, profile?.isGuest, auth.currentUser?.uid]);

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

  const getGuestProfile = (): UserProfile => {
    let guestId = localStorage.getItem('guest_uid');
    if (!guestId) {
      guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
      localStorage.setItem('guest_uid', guestId);
    }
    let savedContact: any = {};
    try {
      savedContact = JSON.parse(localStorage.getItem('guest_contact_info') || '{}');
    } catch (e) {
      savedContact = {};
    }
    return {
      uid: guestId,
      name: savedContact.name || 'Guest Buyer',
      email: savedContact.email || '',
      phone: savedContact.phone || '',
      currentRole: 'customer',
      isVerified: false,
      isGuest: true,
      createdAt: new Date().toISOString(),
      updatedAt: new Date().toISOString()
    };
  };

  const activeProfile = profile || getGuestProfile();

  // Sync logic
  useEffect(() => {
    if (isOnline && queuedMessages.length > 0) {
      const syncMessages = async () => {
        const readyToSync = queuedMessages.filter(m => m.status === 'pending');
        
        for (const msg of readyToSync) {
          if (globalOngoingSyncs.has(msg.id!)) continue;
          globalOngoingSyncs.add(msg.id!);

          try {
            // Mark as uploading in DB as well
            const updatedCount = await localDB.queuedMessages
              .where('id').equals(msg.id!)
              .filter(m => m.status === 'pending')
              .modify({ status: 'uploading' });
            if (updatedCount === 0) continue; // Already processed by another tab or instance


            // Determine text for history/notification
            let displayText = msg.text;
            if (msg.type !== 'text') {
              displayText = 
                msg.type === 'image' ? '[Image Attachment]' : 
                msg.type === 'video' ? '[Video Attachment]' : 
                msg.type === 'location' ? '[Location Share]' : 
                msg.type === 'contact' ? '[Contact Shared]' : '[File Attachment]';
            }

            const messageData = {
              conversationId: msg.convoId,
              senderId: msg.senderId || activeProfile.uid,
              text: displayText,
              type: msg.type || 'text',
              payload: msg.payload || null,
              read: false,
              createdAt: serverTimestamp()
            };

            await addDoc(collection(db, 'conversations', msg.convoId, 'messages'), messageData);

            await updateDoc(doc(db, 'conversations', msg.convoId), {
              lastMessage: displayText,
              updatedAt: serverTimestamp()
            });

            // Notification
            const convoDoc = await getDoc(doc(db, 'conversations', msg.convoId));
            if (convoDoc.exists()) {
              const otherId = convoDoc.data().participants?.find((p: string) => p !== activeProfile.uid);
              if (otherId) {
                await addDoc(collection(db, 'notifications'), {
                  userId: otherId,
                  type: 'message',
                  fromUserId: activeProfile.uid,
                  fromUserName: activeProfile.name || 'Guest Buyer',
                  targetId: msg.convoId,
                  title: `New Message from ${activeProfile.name || 'Guest Buyer'}`,
                  message: displayText.length > 50 ? displayText.substring(0, 47) + '...' : displayText,
                  read: false,
                  createdAt: serverTimestamp()
                });
              }
            }

            await localDB.queuedMessages.delete(msg.id!);
          } catch (err) {
            console.error("Failed to sync message:", err);
            if (err instanceof Error && err.message.includes('permission')) {
               await localDB.queuedMessages.update(msg.id!, { status: 'failed' });
            } else {
               await localDB.queuedMessages.update(msg.id!, { status: 'pending' });
            }
          } finally {
            globalOngoingSyncs.delete(msg.id!);
          }
        }
      };
      syncMessages();
    }
  }, [isOnline, queuedMessages.length, activeProfile.uid]);

  const sendMessage = async (convoId: string, text: string) => {
    await localDB.queuedMessages.add({
      convoId,
      senderId: activeProfile.uid,
      text,
      type: 'text',
      createdAt: Date.now(),
      status: 'pending'
    });
  };

  const sendAttachment = async (convoId: string, type: any, payload: any, localId?: number) => {
    let finalLocalId = localId;
    if (!finalLocalId) {
      finalLocalId = await localDB.queuedMessages.add({
        convoId,
        senderId: activeProfile.uid,
        text: type === 'image' ? '[Image]' : type === 'video' ? '[Video]' : '[File]',
        type,
        payload,
        createdAt: Date.now(),
        status: 'pending'
      });
    } else {
      await localDB.queuedMessages.update(finalLocalId, { 
        status: 'pending',
        payload
      });
    }
  };

  const startConversation = async (targetUid: string, initialMessage?: string) => {
    const userUid = activeProfile.uid;
    const convoId = [userUid, targetUid].sort().join('_');
    
    // Background task to ensure conversation exists
    const ensureConversation = async () => {
      try {
        await setDoc(doc(db, 'conversations', convoId), {
          id: convoId,
          participants: [userUid, targetUid],
          updatedAt: serverTimestamp(),
          lastMessage: initialMessage || 'Link initiated',
          initiatorId: userUid
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
        {notification && (
          <motion.div
            key="messaging-fcm-notification-toast"
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
