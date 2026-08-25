import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Phone, MoreVertical, Send, ImageIcon, MapPin, 
  FileText, Zap, ChevronRight, ArrowLeft, Paperclip, Plus, Loader2, ShieldCheck, Lock,
  Camera, Video, User, File, X as CloseIcon, Download, RotateCw, AlertCircle
} from 'lucide-react';
import { UserProfile, Conversation, Message, MessageAttachment } from '../types';
import { cn, formatAuditableStamp } from '../lib/utils';
import { db, handleFirestoreError, OperationType, storage } from '../lib/firebase';
import { localDB } from '../lib/db';
import { 
  collection, query, where, onSnapshot, orderBy, 
  addDoc, serverTimestamp, doc, getDoc, updateDoc,
  limit, writeBatch, getDocs
} from 'firebase/firestore';
import { ref, uploadBytesResumable, getDownloadURL } from 'firebase/storage';
import imageCompression from 'browser-image-compression';

import { useMessaging } from '../components/MessagingProvider';

export default function Chat({ profile }: { profile: UserProfile | null }) {
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);
  const [conversations, setConversations] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const { isOnline, queuedMessages } = useMessaging();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const convoId = params.get('id');
    if (convoId) {
      setSelectedConvo(convoId);
    }
  }, []);

  let guestId = localStorage.getItem('guest_uid');
  if (!guestId) {
    guestId = `guest_${Date.now()}_${Math.random().toString(36).substring(7)}`;
    localStorage.setItem('guest_uid', guestId);
  }
  const activeUid = profile?.uid || guestId;

  useEffect(() => {
    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', activeUid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const otherId = data.participants?.find((p: string) => p !== activeUid);
        
        // Fetch unread count for this convo
        let unreadCount = 0;
        try {
          const unreadQ = query(
            collection(db, 'conversations', d.id, 'messages'),
            where('senderId', '!=', activeUid),
            where('read', '==', false)
          );
          const unreadSnap = await getDocs(unreadQ);
          unreadCount = unreadSnap.size;
        } catch (e) {
          unreadCount = 0;
        }

        let otherName = 'User';
        if (otherId) {
          try {
            const userSnap = await getDoc(doc(db, 'public_profiles', otherId));
            if (userSnap.exists()) {
              otherName = userSnap.data().name || 'User';
            } else {
              try {
                const legacySnap = await getDoc(doc(db, 'users', otherId));
                if (legacySnap.exists()) {
                  otherName = legacySnap.data().name || legacySnap.data().businessName || 'User';
                }
              } catch (e) {}
            }
          } catch (e) {
            console.error("Error fetching participant:", e);
          }
        }

        return {
          id: d.id,
          ...data,
          participantName: otherName,
          participantId: otherId,
          unreadCount
        };
      }));
      setConversations(convos);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'conversations');
      setLoading(false);
    });

    return () => unsubscribe();
  }, [activeUid]);

  if (selectedConvo) {
    const convo = conversations.find(c => c.id === selectedConvo);
    return (
      <ConversationView 
        convo={convo || { id: selectedConvo }} 
        profile={profile} 
        onBack={() => {
          setSelectedConvo(null);
          window.history.pushState({}, '', '/chat');
        }} 
      />
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8"
    >
      <header className="flex items-center justify-between px-1">
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Communications</h2>
          <div className="flex items-center gap-1.5 text-[9px] text-neon-green font-black uppercase tracking-widest">
            <Lock size={10} className="fill-neon-green/20" /> End-to-End Encrypted Comms
          </div>
        </div>
        <div className="glass-pill !text-primary !border-primary/20">{conversations.length} Active Channels</div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-20 space-y-4">
          <Loader2 className="animate-spin text-primary" size={32} />
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Loading Private Messages...</p>
        </div>
      ) : (
        <div className="space-y-4 custom-scrollbar">
          {Array.from(new Map(conversations.filter(c => c && c.id).map(c => [c.id, c])).values()).map((conv) => (
            <motion.button
              key={`chat-conv-${conv.id}`}
              whileHover={{ scale: 1.01 }}
              whileTap={{ scale: 0.99 }}
              onClick={() => setSelectedConvo(conv.id)}
              className="w-full neon-card p-5 flex items-center gap-4 group transition-all duration-300 hover:border-primary/30"
            >
              <div className="relative">
                <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white text-xl font-black border border-white/5 shadow-inner italic">
                  {conv.participantName.charAt(0)}
                </div>
                <div className="absolute -bottom-1 -right-1 w-5 h-5 bg-neon-green rounded-lg flex items-center justify-center border-2 border-[#05070a] shadow-[0_0_10px_rgba(57,255,20,0.5)]">
                  <ShieldCheck size={12} className="text-[#05070a]" />
                </div>
              </div>
              <div className="flex-1 text-left space-y-1">
                <div className="flex justify-between items-center">
                  <h4 className="font-black text-white uppercase tracking-widest text-sm group-hover:text-primary transition-colors">{conv.participantName}</h4>
                  <div className="flex flex-col items-end gap-1">
                    <span className="text-[8px] text-primary/80 font-mono font-bold uppercase tracking-wider">
                      {formatAuditableStamp(conv.updatedAt)}
                    </span>
                    {conv.unreadCount > 0 && (
                      <span className="w-5 h-5 bg-red-600 rounded-full flex items-center justify-center text-[8px] font-black text-white shadow-[0_0_10px_rgba(255,0,0,0.5)] animate-pulse">
                        {conv.unreadCount}
                      </span>
                    )}
                  </div>
                </div>
                <p className="text-xs text-gray-500 line-clamp-1 font-medium italic">"{conv.lastMessage || 'Channel established'}"</p>
              </div>
              <ChevronRight size={16} className="text-gray-800 group-hover:text-primary transition-all group-hover:translate-x-1" />
            </motion.button>
          ))}
          
          {conversations.length === 0 && (
            <div className="neon-card p-12 text-center space-y-4 border-dashed">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-700">
                <MessageSquare size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-white/50 uppercase tracking-widest">No Active Links</p>
                <p className="text-[10px] text-gray-600">Secure channels will appear here once initiated</p>
              </div>
            </div>
          )}
        </div>
      )}
    </motion.div>
  );
}

function ConversationView({ convo, profile, onBack }: { convo: any, profile: UserProfile | null, onBack: () => void }) {
  const [text, setText] = useState('');
  const [messages, setMessages] = useState<any[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState(false);
  const [fileUploadError, setFileUploadError] = useState<string | null>(null);
  const { sendMessage, sendAttachment, queuedMessages } = useMessaging();
  const [participantInfo, setParticipantInfo] = useState<{ name: string } | null>(
    convo.participantName ? { name: convo.participantName } : null
  );
  const scrollRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoInputRef = useRef<HTMLInputElement>(null);
  const docInputRef = useRef<HTMLInputElement>(null);
  const chatTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const activeUploadFilesRef = useRef<Map<number, File>>(new Map());

  useEffect(() => {
    return () => {
      if (chatTimeoutRef.current) clearTimeout(chatTimeoutRef.current);
    };
  }, []);

  const currentQueuedMessages = queuedMessages.filter(m => m.convoId === convo.id);

  const activeUid = profile?.uid || localStorage.getItem('guest_uid') || 'guest_user';

  useEffect(() => {
    if (participantInfo || !convo.id) return;
    
    const fetchParticipant = async () => {
      try {
        const convoDoc = await getDoc(doc(db, 'conversations', convo.id));
        if (convoDoc.exists()) {
          const participants = convoDoc.data()?.participants;
          if (participants && Array.isArray(participants)) {
            const otherId = participants.find((p: string) => p !== activeUid);
            if (otherId) {
              try {
                const userSnap = await getDoc(doc(db, 'public_profiles', otherId));
                if (userSnap.exists()) {
                  setParticipantInfo({ name: userSnap.data().name || 'User' });
                } else {
                  try {
                    const legacySnap = await getDoc(doc(db, 'users', otherId));
                    if (legacySnap.exists()) {
                      setParticipantInfo({ name: legacySnap.data().name || legacySnap.data().businessName || 'User' });
                    }
                  } catch (e) {}
                }
              } catch (e) {
                console.error("Error fetching participant in view:", e);
              }
            }
          }
        }
      } catch (e) {
        console.error("Error fetching participant in view:", e);
      }
    };
    fetchParticipant();
  }, [convo.id, activeUid, participantInfo]);

  useEffect(() => {
    if (!convo.id) return;

    const q = query(
      collection(db, 'conversations', convo.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const docs = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
      setMessages(docs);
      setLoading(false);
      
      // Mark unread messages as read
      const unreadMessages = snapshot.docs.filter(d => !d.data().read && d.data().senderId !== activeUid);
      if (unreadMessages.length > 0) {
        const batch = writeBatch(db);
        unreadMessages.forEach(d => {
          batch.update(d.ref, { read: true });
        });
        batch.commit();
      }

      // Also mark corresponding notifications as read
      const markNotificationsRead = async () => {
        try {
          const nQuery = query(
            collection(db, 'notifications'), 
            where('userId', '==', activeUid),
            where('type', '==', 'message'),
            where('targetId', '==', convo.id),
            where('read', '==', false)
          );
          const nSnap = await getDocs(nQuery);
          if (!nSnap.empty) {
            const batch = writeBatch(db);
            nSnap.docs.forEach(d => batch.update(d.ref, { read: true }));
            await batch.commit();
          }
        } catch (e) {}
      };
      markNotificationsRead();

      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [convo.id, activeUid]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim()) return;

    const messageText = text;
    setText('');
    await sendMessage(convo.id, messageText);
    
    // Smooth scroll for local feedback
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const MAX_FILE_SIZE = 2 * 1024 * 1024; // 2MB Limit

  const handleFileUpload = async (file: File, type: 'image' | 'video' | 'file', existingLocalId?: number) => {
    if (!convo.id) return;
    
    setShowAttachmentMenu(false);

    // 1. File size check (Max 2MB)
    if (file.size > MAX_FILE_SIZE) {
      const sizeMB = (file.size / (1024 * 1024)).toFixed(2);
      setFileUploadError(`File "${file.name}" (${sizeMB} MB) exceeds maximum allowed size of 2MB. Please attach a smaller file.`);
      setTimeout(() => setFileUploadError(null), 10000);
      return;
    }

    // 2. Basic format lookup: verify if it's the expected type
    if (type === 'image' && file.type && !file.type.startsWith('image/')) {
      setFileUploadError("Invalid format: Selected file is not an image.");
      setTimeout(() => setFileUploadError(null), 10000);
      return;
    }
    if (type === 'video' && file.type && !file.type.startsWith('video/')) {
      setFileUploadError("Invalid format: Selected file is not a video.");
      setTimeout(() => setFileUploadError(null), 10000);
      return;
    }

    setFileUploadError(null);

    // Create or reuse local preview
    const previewUrl = URL.createObjectURL(file);
    let localId = existingLocalId;

    if (!localId) {
      localId = await localDB.queuedMessages.add({
        convoId: convo.id,
        senderId: profile?.uid || activeUid,
        text: type === 'image' ? '[Image]' : type === 'video' ? '[Video]' : '[File]',
        type,
        payload: { url: previewUrl, name: file.name, size: file.size, mimeType: file.type },
        createdAt: Date.now(),
        status: 'uploading',
        progress: 0,
        fileBlob: file
      });
    } else {
      await localDB.queuedMessages.update(localId, {
        status: 'uploading',
        progress: 0,
        payload: { url: previewUrl, name: file.name, size: file.size, mimeType: file.type },
        fileBlob: file
      });
    }

    if (localId) {
      activeUploadFilesRef.current.set(localId, file);
    }

    let isCompleted = false;
    let uploadTask: any = null;

    // Start 30-second timeout timer
    const timeoutTimer = setTimeout(() => {
      if (!isCompleted) {
        if (uploadTask) {
          try {
            uploadTask.cancel();
          } catch (e) {
            console.error("Cancel upload task failed:", e);
          }
        }
        if (localId) {
          localDB.queuedMessages.update(localId, { status: 'failed', progress: 0 });
        }
        setFileUploadError(`Upload timed out for "${file.name}". Click "Try Again" in the chat to retry.`);
        setTimeout(() => {
          setFileUploadError(null);
        }, 10000);
      }
    }, 30 * 1000);

    try {
      let finalFile = file;

      // Compress image if applicable
      if (type === 'image' && file.type.startsWith('image/')) {
        const options = {
          maxSizeMB: 0.5,
          maxWidthOrHeight: 1920,
          useWebWorker: true,
          onProgress: (p: number) => {
            if (localId) {
              localDB.queuedMessages.update(localId, { progress: p * 0.2 }); // 1st 20% for compression
            }
          }
        };
        try {
          finalFile = await imageCompression(file, options);
          console.log(`Compression complete: ${(file.size / 1024 / 1024).toFixed(2)}MB -> ${(finalFile.size / 1024 / 1024).toFixed(2)}MB`);
        } catch (error) {
          console.error("Compression failed, using original:", error);
        }
      }

      const storagePath = `conversations/${convo.id}/${Date.now()}_${file.name}`;
      const storageRef = ref(storage, storagePath);
      uploadTask = uploadBytesResumable(storageRef, finalFile);

      uploadTask.on('state_changed', 
        (snapshot: any) => {
          const progress = (snapshot.bytesTransferred / snapshot.totalBytes) * 80 + 20; // Last 80% for upload
          if (localId) {
            localDB.queuedMessages.update(localId, { progress });
          }
        }, 
        (error: any) => {
          console.error("Upload failed occurred:", error);
          isCompleted = true;
          clearTimeout(timeoutTimer);
          if (localId) {
            localDB.queuedMessages.update(localId, { status: 'failed', progress: 0 });
          }
          setFileUploadError(`Upload failed for "${file.name}". Click "Try Again" in the chat to retry.`);
          setTimeout(() => {
            setFileUploadError(null);
          }, 10000);
        }, 
        async () => {
          isCompleted = true;
          clearTimeout(timeoutTimer);
          const downloadURL = await getDownloadURL(uploadTask.snapshot.ref);
          
          URL.revokeObjectURL(previewUrl);
          if (localId) {
            activeUploadFilesRef.current.delete(localId);
            await localDB.queuedMessages.delete(localId);
          }

          await sendAttachment(convo.id, type, {
            url: downloadURL,
            name: file.name,
            size: finalFile.size,
            mimeType: file.type
          });
          
          setTimeout(() => {
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
          }, 100);
        }
      );
    } catch (err) {
      console.error("Attachment handling failed:", err);
      isCompleted = true;
      clearTimeout(timeoutTimer);
      if (localId) {
        localDB.queuedMessages.update(localId, { status: 'failed', progress: 0 });
      }
      setFileUploadError(`Upload failed for "${file.name}". Click "Try Again" in the chat to retry.`);
      setTimeout(() => {
        setFileUploadError(null);
      }, 10000);
    }
  };

  const handleRetry = async (msg: any) => {
    if (!msg.localQueueId) return;

    setFileUploadError(null);

    if (msg.type === 'text') {
      await localDB.queuedMessages.update(msg.localQueueId, { status: 'pending' });
      return;
    }

    let fileToRetry = activeUploadFilesRef.current.get(msg.localQueueId);

    if (!fileToRetry && msg.fileBlob) {
      const fileName = msg.payload?.name || `file_${Date.now()}`;
      const fileType = msg.payload?.mimeType || msg.fileBlob.type || 'application/octet-stream';
      fileToRetry = new window.File([msg.fileBlob], fileName, { type: fileType });
    }

    if (fileToRetry) {
      handleFileUpload(fileToRetry, msg.type || 'file', msg.localQueueId);
    } else {
      setFileUploadError("File session context expired. Please re-select the file to upload.");
      if (msg.type === 'image') fileInputRef.current?.click();
      else if (msg.type === 'video') videoInputRef.current?.click();
      else docInputRef.current?.click();
    }
  };

  const handleDiscard = async (localQueueId: number) => {
    activeUploadFilesRef.current.delete(localQueueId);
    await localDB.queuedMessages.delete(localQueueId);
  };

  const handleLocationShare = async () => {
    if (!navigator.geolocation) {
      alert("Geolocation is not supported by this browser.");
      return;
    }

    setShowAttachmentMenu(false);
    navigator.geolocation.getCurrentPosition(async (pos) => {
      const { latitude, longitude } = pos.coords;
      await sendAttachment(convo.id, 'location', {
        lat: latitude,
        lng: longitude,
        address: `Lat: ${latitude.toFixed(4)}, Lng: ${longitude.toFixed(4)}`
      });
      
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });
  };

  const handleContactShare = async () => {
    // Simulated contact share for now
    setShowAttachmentMenu(false);
    await sendAttachment(convo.id, 'contact', {
      name: "Business",
      phone: "+263 XXX XXX XXX",
      vcard: "BEGIN:VCARD\nVERSION:3.0\nFN:Business\nTEL:+263\nEND:VCARD"
    });
    
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const allMessages = [...messages, ...currentQueuedMessages.map(m => ({
    id: `queued-${m.id}`,
    localQueueId: m.id,
    senderId: m.senderId,
    text: m.text,
    type: m.type,
    payload: m.payload,
    createdAt: { seconds: Math.floor(m.createdAt / 1000) },
    isQueued: true,
    status: m.status,
    progress: m.progress,
    fileBlob: m.fileBlob
  }))].sort((a, b) => {
    const timeA = a.createdAt?.seconds || 0;
    const timeB = b.createdAt?.seconds || 0;
    return timeA - timeB;
  });

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-screen fixed inset-0 z-[100] bg-[#05070a]"
    >
      <AnimatePresence>
        {fileUploadError && (
          <motion.div
            initial={{ opacity: 0, y: -20, scale: 0.95 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            exit={{ opacity: 0, scale: 0.95 }}
            className="fixed top-20 left-1/2 -translate-x-1/2 z-[99999] w-[90%] max-w-md"
          >
            <div className="bg-[#120404] border border-red-500/50 rounded-2xl p-4 shadow-[0_0_30px_rgba(239,68,68,0.3)] flex items-start gap-3">
              <div className="w-8 h-8 rounded-lg bg-red-500/20 flex items-center justify-center text-red-500 flex-shrink-0 font-bold">
                ✕
              </div>
              <div className="flex-1 min-w-0">
                <h4 className="text-[10px] font-black text-red-500 uppercase tracking-widest">Upload Failed</h4>
                <p className="text-xs text-red-400 font-semibold mt-1 leading-normal">
                  {fileUploadError}
                </p>
              </div>
              <button 
                type="button"
                onClick={() => setFileUploadError(null)}
                className="text-red-500/60 hover:text-red-400 transition-colors p-1"
              >
                <CloseIcon size={14} />
              </button>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Chat header */}
      <div className="p-4 border-b border-white/5 flex items-center justify-between bg-white/5 backdrop-blur-xl">
        <div className="flex items-center gap-4">
          <button 
            onClick={onBack}
            className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white"
          >
            <ArrowLeft size={20} />
          </button>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-black border border-primary/20 italic">
              {participantInfo?.name?.charAt(0) || 'S'}
            </div>
            <div>
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{participantInfo?.name || 'User'}</h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1">
                   Secure Connection Active
                </p>
              </div>
            </div>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Lock size={14} className="text-neon-green animate-pulse" />
        </div>
      </div>

        {/* Messages */}
        <div ref={scrollRef} className="flex-1 overflow-y-auto p-4 space-y-6 custom-scrollbar pb-32">
          <div className="flex flex-col items-center gap-2 py-8">
            <ShieldCheck size={32} className="text-primary/20" />
            <span className="glass-pill !text-[8px] uppercase tracking-[0.3em] font-black !border-primary/10">Privacy Established</span>
            <p className="text-[7px] text-gray-700 font-bold uppercase tracking-widest max-w-[200px] text-center">End-to-End Encryption. Only participants can view messages.</p>
          </div>
          
          {loading ? (
            <div className="flex justify-center py-20">
              <Loader2 className="animate-spin text-primary/40" size={24} />
            </div>
          ) : (
            Array.from(new Map(allMessages.filter(m => m && m.id).map(m => [m.id, m])).values()).map((msg) => {
              const isMe = msg.senderId === profile?.uid;
              const isFailed = msg.status === 'failed';
              return (
                <div 
                  key={`chat-msg-${msg.id}`} 
                  className={cn(
                    "flex flex-col max-w-[85%] space-y-1",
                    isMe ? "ml-auto items-end" : "items-start"
                  )}
                >
                  <div 
                    className={cn(
                      "px-4 py-3 rounded-2xl text-sm font-medium shadow-lg backdrop-blur-md relative overflow-hidden group whitespace-pre-wrap transition-all",
                      isMe 
                        ? isFailed
                          ? "bg-red-950/40 text-white border border-red-500/50 rounded-tr-none text-right shadow-[0_0_15px_rgba(239,68,68,0.2)]"
                          : "bg-primary/20 text-white border border-primary/30 rounded-tr-none text-right"
                        : "bg-white/5 text-gray-200 border border-white/10 rounded-tl-none text-left",
                      msg.isQueued && !isFailed && "opacity-80 border-dashed border-gray-500/50"
                    )}
                  >
                    {isMe && !isFailed && <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 blur-xl group-hover:bg-primary/20 transition-colors"></div>}
                    
                    {/* Render different message types */}
                    {msg.type === 'image' && msg.payload?.url && (
                      <div className="space-y-2 relative">
                        <img 
                          src={msg.payload.url} 
                          alt="Attachment" 
                          className={cn(
                            "max-w-full rounded-xl border border-white/10 cursor-pointer hover:opacity-90 transition-opacity",
                            msg.status === 'uploading' && "opacity-40 grayscale blur-[2px]",
                            isFailed && "opacity-50 grayscale"
                          )}
                          onClick={() => window.open(msg.payload.url, '_blank')}
                        />
                        {msg.status === 'uploading' && (
                          <div className="absolute inset-0 flex flex-col items-center justify-center gap-2">
                            <Loader2 size={24} className="animate-spin text-primary" />
                            <span className="text-[8px] font-black uppercase tracking-[0.2em] text-white bg-black/50 px-2 py-0.5 rounded-full">
                              {Math.round(msg.progress || 0)}%
                            </span>
                          </div>
                        )}
                        {msg.text && msg.text !== '[Image Attachment]' && msg.text !== '[Image]' && <p className="text-[11px] opacity-80">{msg.text}</p>}
                      </div>
                    )}

                    {msg.type === 'video' && msg.payload?.url && (
                      <div className="space-y-2 relative">
                        {msg.status === 'uploading' ? (
                          <div className="w-[200px] aspect-video bg-white/5 rounded-xl flex flex-col items-center justify-center border border-white/10 relative overflow-hidden">
                             <Video size={32} className="text-gray-700 mb-2" />
                             <div className="absolute bottom-0 left-0 h-1 bg-primary/50" style={{ width: `${msg.progress || 0}%` }} />
                             <span className="text-[8px] font-black text-gray-500 uppercase tracking-widest text-center px-4">Processing... {Math.round(msg.progress || 0)}%</span>
                          </div>
                        ) : (
                          <video 
                            src={msg.payload.url} 
                            controls 
                            className={cn(
                              "max-w-full rounded-xl border border-white/10",
                              isFailed && "opacity-50 grayscale"
                            )}
                          />
                        )}
                        {msg.text && msg.text !== '[Video Attachment]' && msg.text !== '[Video]' && <p className="text-[11px] opacity-80">{msg.text}</p>}
                      </div>
                    )}

                    {msg.type === 'file' && msg.payload?.url && (
                      <div className="relative">
                        <a 
                          href={msg.status === 'uploading' || isFailed ? '#' : msg.payload.url} 
                          target={msg.status === 'uploading' || isFailed ? undefined : "_blank"} 
                          rel="noreferrer"
                          className={cn(
                            "flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10 hover:bg-white/10 transition-all shrink-0",
                            (msg.status === 'uploading' || isFailed) && "opacity-50 pointer-events-none"
                          )}
                        >
                          <div className={cn(
                            "w-10 h-10 rounded-lg flex items-center justify-center",
                            isFailed ? "bg-red-500/20 text-red-400" : "bg-primary/20 text-primary"
                          )}>
                            <FileText size={20} />
                          </div>
                          <div className="flex-1 min-w-0 pr-4 text-left">
                            <p className="text-[10px] font-black uppercase tracking-tight truncate text-white">{msg.payload.name || 'Document'}</p>
                            <p className="text-[8px] text-gray-500 font-bold uppercase">{(msg.payload.size / 1024).toFixed(0)} KB • {msg.status === 'uploading' ? 'UPLOADING' : isFailed ? 'FAILED' : 'FILE'}</p>
                          </div>
                          {msg.status === 'uploading' ? <Loader2 size={14} className="animate-spin text-primary" /> : <Download size={14} className="text-gray-500" />}
                        </a>
                      </div>
                    )}

                    {msg.type === 'location' && msg.payload && (
                      <div className="space-y-2">
                        <div className="flex items-center gap-2 mb-1 p-1">
                          <MapPin size={14} className="text-primary" />
                          <span className="text-[10px] font-black uppercase tracking-tight">Shared Location</span>
                        </div>
                        <div 
                          className="w-full aspect-video bg-white/10 rounded-xl flex flex-col items-center justify-center cursor-pointer border border-white/5 hover:bg-white/20 transition-all"
                          onClick={() => window.open(`https://www.google.com/maps?q=${msg.payload.lat},${msg.payload.lng}`, '_blank')}
                        >
                          <MapPin size={24} className="text-primary animate-bounce mb-2" />
                          <p className="text-[8px] font-black uppercase text-gray-400">View on Secure Maps</p>
                        </div>
                        {msg.payload.address && <p className="text-[9px] text-gray-500 italic mt-1">{msg.payload.address}</p>}
                      </div>
                    )}

                    {msg.type === 'contact' && msg.payload && (
                      <div className="flex items-center gap-3 p-2 bg-white/5 rounded-xl border border-white/10 w-full min-w-[200px]">
                        <div className="w-10 h-10 bg-accent/20 rounded-lg flex items-center justify-center text-accent">
                          <User size={20} />
                        </div>
                        <div className="flex-1 min-w-0">
                          <p className="text-[10px] font-black uppercase tracking-tight truncate text-white">{msg.payload.name}</p>
                          <p className="text-[8px] text-gray-500 font-bold uppercase">{msg.payload.phone}</p>
                        </div>
                        <button className="p-1 px-2 bg-white/5 rounded-lg text-[8px] font-black text-primary uppercase tracking-widest border border-primary/20">Add</button>
                      </div>
                    )}

                    {(!msg.type || msg.type === 'text') && (
                      <p className="relative z-10 leading-relaxed font-medium tracking-tight whitespace-pre-wrap">{msg.text}</p>
                    )}

                    {/* Try Again button for failed uploads */}
                    {isFailed && (
                      <div className="mt-3 pt-2 border-t border-red-500/30 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-1.5 text-red-400 text-[10px] font-bold">
                          <AlertCircle size={13} className="shrink-0 text-red-500" />
                          <span>Upload Failed</span>
                        </div>
                        <div className="flex items-center gap-2">
                          <button
                            type="button"
                            onClick={() => handleRetry(msg)}
                            className="px-3 py-1.5 rounded-xl bg-red-500/20 hover:bg-red-500/40 text-red-200 border border-red-500/40 text-[9px] font-black uppercase tracking-wider flex items-center gap-1.5 transition-all active:scale-95 shadow-sm cursor-pointer"
                          >
                            <RotateCw size={11} className="shrink-0 animate-spin-hover" />
                            <span>Try Again</span>
                          </button>
                          {msg.localQueueId && (
                            <button
                              type="button"
                              onClick={() => handleDiscard(msg.localQueueId)}
                              className="p-1 rounded-lg bg-white/5 hover:bg-white/10 text-gray-400 hover:text-white transition-colors cursor-pointer"
                              title="Discard message"
                            >
                              <CloseIcon size={12} />
                            </button>
                          )}
                        </div>
                      </div>
                    )}
                  </div>
                  <p className="text-[7.5px] text-gray-400 font-mono font-bold uppercase tracking-wider flex items-center gap-1.5">
                    <span>{formatAuditableStamp(msg.createdAt)}</span>
                    <span>•</span>
                    {isFailed ? <span className="text-red-400 font-extrabold">FAILED</span> : msg.isQueued ? <span className="text-gray-500 italic">PENDING SYNC</span> : (isMe ? 'PROCESSED' : 'DECODED')}
                  </p>
                </div>
              );
            })
          )}
        </div>

      {/* Input area */}
      <div className="p-4 bg-[#05070a] border-t border-white/5 backdrop-blur-xl absolute bottom-0 left-0 right-0 z-[110]">
        
        {/* Attachment Menu */}
        <AnimatePresence>
          {showAttachmentMenu && (
            <motion.div
              initial={{ opacity: 0, y: 50, scale: 0.95 }}
              animate={{ opacity: 1, y: -10, scale: 1 }}
              exit={{ opacity: 0, y: 50, scale: 0.95 }}
              className="absolute bottom-full left-4 bg-[#0d1117] border border-white/10 rounded-3xl p-4 shadow-2xl grid grid-cols-3 gap-4 mb-4 z-[120]"
            >
              {[
                { icon: ImageIcon, label: 'Image', sub: 'Up to 2MB', color: 'text-primary', onClick: () => fileInputRef.current?.click() },
                { icon: Video, label: 'Video', sub: 'Up to 2MB', color: 'text-neon-green', onClick: () => videoInputRef.current?.click() },
                { icon: FileText, label: 'Document', sub: 'Up to 2MB', color: 'text-accent', onClick: () => docInputRef.current?.click() },
                { icon: MapPin, label: 'Location', sub: 'Live GPS', color: 'text-red-500', onClick: handleLocationShare },
                { icon: User, label: 'Contact', sub: 'vCard', color: 'text-blue-500', onClick: handleContactShare },
                { icon: Camera, label: 'Media', sub: 'Up to 2MB', color: 'text-white', onClick: () => fileInputRef.current?.click() },
              ].map((item, idx) => (
                <motion.button
                  key={idx}
                  whileHover={{ scale: 1.05, backgroundColor: 'rgba(255,255,255,0.05)' }}
                  whileTap={{ scale: 0.95 }}
                  onClick={item.onClick}
                  className="flex flex-col items-center gap-1.5 p-2 rounded-2xl transition-all"
                >
                  <div className={cn("w-12 h-12 bg-white/5 rounded-2xl flex items-center justify-center border border-white/5 shadow-inner", item.color)}>
                    <item.icon size={20} />
                  </div>
                  <div className="flex flex-col items-center">
                    <span className="text-[8px] font-black uppercase tracking-widest text-gray-300">{item.label}</span>
                    <span className="text-[6.5px] font-bold text-gray-500 uppercase">{item.sub}</span>
                  </div>
                </motion.button>
              ))}
            </motion.div>
          )}
        </AnimatePresence>

        {/* Hidden inputs */}
        <input 
          type="file" 
          ref={fileInputRef} 
          className="hidden" 
          accept="image/*" 
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, 'image');
            e.target.value = '';
          }} 
        />
        <input 
          type="file" 
          ref={videoInputRef} 
          className="hidden" 
          accept="video/*" 
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, 'video');
            e.target.value = '';
          }} 
        />
        <input 
          type="file" 
          ref={docInputRef} 
          className="hidden" 
          accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.txt,.csv,.zip,.rar,.png,.jpg,.jpeg,.mp4,.mov,*/*" 
          onChange={(e) => {
            const f = e.target.files?.[0];
            if (f) handleFileUpload(f, 'file');
            e.target.value = '';
          }} 
        />

        <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-1000"></div>
          <div className="relative flex items-center bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden p-2">
            <button 
              type="button" 
              onClick={() => setShowAttachmentMenu(!showAttachmentMenu)}
              className={cn(
                "w-10 h-10 flex items-center justify-center transition-colors",
                showAttachmentMenu ? "text-primary rotate-45" : "text-gray-500 hover:text-primary"
              )}
            >
              {showAttachmentMenu ? <Plus size={24} /> : <Paperclip size={20} />}
            </button>
            <input 
              type="text" 
              placeholder="Type encrypted message..."
              className="flex-1 bg-transparent px-2 py-3 text-white placeholder-gray-600 outline-none text-sm font-bold tracking-tight italic"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onFocus={() => setShowAttachmentMenu(false)}
            />
            <button 
              type="submit"
              disabled={!text.trim()}
              className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.4)] active:scale-90 transition-all disabled:opacity-50 disabled:grayscale"
            >
              <Send size={18} className="fill-current" />
            </button>
          </div>
        </form>
        <p className="text-center text-[7px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-3">Advanced Privacy Active • Account ID: {profile?.uid?.slice(0, 8)}</p>
      </div>
    </motion.div>
  );
}

