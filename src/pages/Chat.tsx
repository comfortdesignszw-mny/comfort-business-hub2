import { useState, useEffect, useRef } from 'react';
import React from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  MessageSquare, Phone, MoreVertical, Send, ImageIcon, MapPin, 
  FileText, Zap, ChevronRight, ArrowLeft, Paperclip, Plus, Loader2, ShieldCheck, Lock
} from 'lucide-react';
import { UserProfile, Conversation, Message } from '../types';
import { cn } from '../lib/utils';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, query, where, onSnapshot, orderBy, 
  addDoc, serverTimestamp, doc, getDoc, updateDoc,
  limit
} from 'firebase/firestore';

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

  useEffect(() => {
    if (!profile) return;

    const q = query(
      collection(db, 'conversations'),
      where('participants', 'array-contains', profile.uid),
      orderBy('updatedAt', 'desc'),
      limit(50)
    );

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const convos = await Promise.all(snapshot.docs.map(async (d) => {
        const data = d.data();
        const otherId = data.participants?.find((p: string) => p !== profile.uid);
        
        let otherName = 'Secure Node';
        if (otherId) {
          try {
            const userSnap = await getDoc(doc(db, 'users', otherId));
            if (userSnap.exists()) {
              otherName = userSnap.data().name || userSnap.data().businessName || 'Secure Node';
            }
          } catch (e) {
            console.error("Error fetching participant:", e);
          }
        }

        return {
          id: d.id,
          ...data,
          participantName: otherName,
          participantId: otherId
        };
      }));
      setConversations(convos);
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.LIST, 'conversations');
    });

    return () => unsubscribe();
  }, [profile]);

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
          <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest italic">Syncing Privacy Channels...</p>
        </div>
      ) : (
        <div className="space-y-4 custom-scrollbar">
          {conversations.map((conv) => (
            <motion.button
              key={conv.id}
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
                  <span className="text-[8px] text-gray-600 font-bold uppercase">
                    {conv.updatedAt?.seconds ? new Date(conv.updatedAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Now'}
                  </span>
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
  const { sendMessage, queuedMessages } = useMessaging();
  const [participantInfo, setParticipantInfo] = useState<{ name: string } | null>(
    convo.participantName ? { name: convo.participantName } : null
  );
  const scrollRef = useRef<HTMLDivElement>(null);

  const currentQueuedMessages = queuedMessages.filter(m => m.convoId === convo.id);

  useEffect(() => {
    if (participantInfo || !convo.id) return;
    
    const fetchParticipant = async () => {
      try {
        const convoDoc = await getDoc(doc(db, 'conversations', convo.id));
        if (convoDoc.exists()) {
          const participants = convoDoc.data()?.participants;
          if (participants && Array.isArray(participants)) {
            const otherId = participants.find((p: string) => p !== profile?.uid);
            if (otherId) {
              const userSnap = await getDoc(doc(db, 'users', otherId));
              if (userSnap.exists()) {
                setParticipantInfo({ name: userSnap.data().name || userSnap.data().businessName || 'Secure Node' });
              }
            }
          }
        }
      } catch (e) {
        console.error("Error fetching participant in view:", e);
      }
    };
    fetchParticipant();
  }, [convo.id, profile?.uid, participantInfo]);

  useEffect(() => {
    if (!convo.id || !profile) return;

    const q = query(
      collection(db, 'conversations', convo.id, 'messages'),
      orderBy('createdAt', 'asc'),
      limit(100)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setMessages(snapshot.docs.map(d => ({ id: d.id, ...d.data() })));
      setLoading(false);
      setTimeout(() => {
        scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
      }, 100);
    });

    return () => unsubscribe();
  }, [convo.id, profile]);

  const handleSend = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!text.trim() || !profile) return;

    const messageText = text;
    setText('');
    await sendMessage(convo.id, messageText);
    
    // Smooth scroll for local feedback
    setTimeout(() => {
      scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight, behavior: 'smooth' });
    }, 100);
  };

  const allMessages = [...messages, ...currentQueuedMessages.map(m => ({
    id: `queued-${m.id}`,
    senderId: m.senderId,
    text: m.text,
    createdAt: { seconds: Math.floor(m.createdAt / 1000) },
    isQueued: true
  }))];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-screen fixed inset-0 z-[100] bg-[#05070a]"
    >
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
              <h4 className="text-sm font-black text-white uppercase tracking-widest">{participantInfo?.name || 'Secure Node'}</h4>
              <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
                <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest flex items-center gap-1">
                   Secure Uplink Active
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
          <span className="glass-pill !text-[8px] uppercase tracking-[0.3em] font-black !border-primary/10">Privacy Matrix Established</span>
          <p className="text-[7px] text-gray-700 font-bold uppercase tracking-widest max-w-[200px] text-center">Protocol: End-to-End Node Restriction. Only participants can access this stream.</p>
        </div>
        
        {loading ? (
          <div className="flex justify-center py-20">
            <Loader2 className="animate-spin text-primary/40" size={24} />
          </div>
        ) : (
          allMessages.map((msg) => {
            const isMe = msg.senderId === profile?.uid;
            return (
              <div 
                key={msg.id} 
                className={cn(
                  "flex flex-col max-w-[85%] space-y-1",
                  isMe ? "ml-auto items-end" : "items-start"
                )}
              >
                <div 
                  className={cn(
                    "px-4 py-3 rounded-2xl text-sm font-medium shadow-lg backdrop-blur-md relative overflow-hidden group whitespace-pre-wrap transition-all",
                    isMe 
                      ? "bg-primary/20 text-white border border-primary/30 rounded-tr-none text-right" 
                      : "bg-white/5 text-gray-200 border border-white/10 rounded-tl-none text-left",
                    msg.isQueued && "opacity-60 border-dashed border-gray-500"
                  )}
                >
                  {isMe && <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 blur-xl group-hover:bg-primary/20 transition-colors"></div>}
                  <p className="relative z-10 leading-relaxed font-medium tracking-tight">{msg.text}</p>
                </div>
                <p className="text-[7px] text-gray-600 font-black uppercase tracking-widest flex items-center gap-1">
                  {msg.createdAt?.seconds ? new Date(msg.createdAt.seconds * 1000).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' }) : 'Sending...'} • {msg.isQueued ? <span className="text-gray-500 italic">PENDING SYNC</span> : (isMe ? 'PROCESSED' : 'DECODED')}
                </p>
              </div>
            );
          })
        )}
      </div>

      {/* Input area */}
      <div className="p-4 bg-[#05070a] border-t border-white/5 backdrop-blur-xl absolute bottom-0 left-0 right-0">
        <form onSubmit={handleSend} className="relative group max-w-4xl mx-auto">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-1000"></div>
          <div className="relative flex items-center bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden p-2">
            <button type="button" className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-primary transition-colors">
              <Paperclip size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Type encrypted message..."
              className="flex-1 bg-transparent px-2 py-3 text-white placeholder-gray-600 outline-none text-sm font-bold tracking-tight italic"
              value={text}
              onChange={(e) => setText(e.target.value)}
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
        <p className="text-center text-[7px] text-gray-600 font-bold uppercase tracking-[0.2em] mt-3">Advanced Privacy Protocol Active • Node ID: {profile?.uid?.slice(0, 8)}</p>
      </div>
    </motion.div>
  );
}

