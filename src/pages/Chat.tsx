import { useState } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { MessageSquare, Phone, MoreVertical, Send, ImageIcon, MapPin, FileText, Zap, ChevronRight, ArrowLeft, Paperclip, Plus } from 'lucide-react';
import { UserProfile, Conversation, Message } from '../types';
import { cn } from '../lib/utils';

export default function Chat({ profile }: { profile: UserProfile | null }) {
  const [selectedConvo, setSelectedConvo] = useState<string | null>(null);

  const mockConversations: any[] = [
    {
      id: 'c1',
      participantName: 'Green Logistics',
      lastMessage: "Is the solar panel still available?",
      unreadCount: 2,
      updatedAt: new Date().toISOString()
    },
    {
      id: 'c2',
      participantName: 'Hardware Zone',
      lastMessage: "Quote prepared for 500 units.",
      unreadCount: 0,
      updatedAt: new Date().toISOString()
    }
  ];

  if (selectedConvo) {
    const convo = mockConversations.find(c => c.id === selectedConvo);
    return <ConversationView convo={convo} onBack={() => setSelectedConvo(null)} />;
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className="p-4 space-y-8"
    >
      <header className="flex items-center justify-between px-1">
        <h2 className="text-2xl font-black text-white italic uppercase tracking-tighter">Communications</h2>
        <div className="glass-pill !text-primary !border-primary/20">02 Active Channels</div>
      </header>

      <div className="space-y-4">
        {mockConversations.map((conv) => (
          <motion.button
            key={conv.id}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            onClick={() => setSelectedConvo(conv.id)}
            className="w-full neon-card p-5 flex items-center gap-4 group transition-all duration-300 hover:border-primary/30"
          >
            <div className="relative">
              <div className="w-14 h-14 bg-white/5 rounded-2xl flex items-center justify-center text-white text-xl font-bold border border-white/5 shadow-inner">
                {conv.participantName.charAt(0)}
              </div>
              {conv.unreadCount > 0 && (
                <span className="absolute -top-1 -right-1 w-5 h-5 bg-primary text-[#05070a] text-[10px] font-black rounded-lg flex items-center justify-center border-2 border-[#05070a] shadow-[0_0_10px_rgba(0,242,254,0.5)]">
                  {conv.unreadCount}
                </span>
              )}
            </div>
            <div className="flex-1 text-left space-y-1">
              <div className="flex justify-between items-center">
                <h4 className="font-black text-white uppercase tracking-widest text-sm group-hover:text-primary transition-colors">{conv.participantName}</h4>
                <span className="text-[9px] text-gray-600 font-bold uppercase">12:42</span>
              </div>
              <p className="text-xs text-gray-500 line-clamp-1 font-medium italic">"{conv.lastMessage}"</p>
            </div>
            <ChevronRight size={16} className="text-gray-800 group-hover:text-primary transition-all group-hover:translate-x-1" />
          </motion.button>
        ))}
      </div>
    </motion.div>
  );
}

function ConversationView({ convo, onBack }: { convo: any, onBack: () => void }) {
  const [text, setText] = useState('');

  const messages: Message[] = [
    {
      id: 'm1',
      conversationId: convo.id,
      senderId: 's1',
      text: "Hello! Thank you for reaching out to Green Logistics.",
      type: 'text',
      createdAt: new Date(Date.now() - 1000 * 60 * 5).toISOString()
    },
    {
      id: 'm2',
      conversationId: convo.id,
      senderId: 'u1',
      text: "Hi, I'm interested in the 200W solar panel for my farm in Goromonzi.",
      type: 'text',
      createdAt: new Date(Date.now() - 1000 * 60 * 4).toISOString()
    },
    {
      id: 'm3',
      conversationId: convo.id,
      senderId: 's1',
      text: "Certainly! We have stock available. Here is a formal quote for 10 units.",
      type: 'text',
      createdAt: new Date(Date.now() - 1000 * 60 * 3).toISOString()
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: -20 }}
      className="flex flex-col h-full bg-[#05070a]"
    >
      {/* Chat header */}
      <div className="p-4 border-b border-white/5 flex items-center gap-4 bg-white/5 backdrop-blur-xl">
        <button 
          onClick={onBack}
          className="w-10 h-10 bg-white/5 rounded-xl flex items-center justify-center text-gray-400 hover:text-white"
        >
          <ArrowLeft size={20} />
        </button>
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary font-bold border border-primary/20">
            {convo.participantName.charAt(0)}
          </div>
          <div>
            <h4 className="text-sm font-black text-white uppercase tracking-widest">{convo.participantName}</h4>
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
              <p className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Secure Uplink</p>
            </div>
          </div>
        </div>
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-6 no-scrollbar">
        <div className="flex justify-center mb-6">
          <span className="glass-pill !text-[8px]">Encrypted Channel Established</span>
        </div>
        {messages.map((msg) => {
          const isMe = msg.senderId === 'u1';
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
                  "px-4 py-3 rounded-2xl text-sm font-medium shadow-lg backdrop-blur-md relative overflow-hidden group",
                  isMe 
                    ? "bg-primary/20 text-white border border-primary/30 rounded-tr-none" 
                    : "bg-white/5 text-gray-200 border border-white/10 rounded-tl-none"
                )}
              >
                {isMe && <div className="absolute top-0 right-0 w-12 h-12 bg-primary/10 blur-xl group-hover:bg-primary/20 transition-colors"></div>}
                <p className="relative z-10 leading-relaxed">{msg.text}</p>
              </div>
              <p className="text-[8px] text-gray-600 font-bold uppercase tracking-widest">
                {new Date(msg.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })} • SEEN
              </p>
            </div>
          );
        })}
      </div>

      {/* Input area */}
      <div className="p-4 bg-white/5 border-t border-white/5 backdrop-blur-xl pb-28">
        <div className="relative group">
          <div className="absolute -inset-0.5 bg-gradient-to-r from-primary to-accent rounded-2xl blur opacity-10 group-focus-within:opacity-30 transition duration-1000"></div>
          <div className="relative flex items-center bg-[#0d1117] border border-white/10 rounded-2xl overflow-hidden p-2">
            <button className="w-10 h-10 flex items-center justify-center text-gray-500 hover:text-primary transition-colors">
              <Paperclip size={20} />
            </button>
            <input 
              type="text" 
              placeholder="Type encrypted message..."
              className="flex-1 bg-transparent px-2 py-3 text-white placeholder-gray-600 outline-none text-sm font-medium"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <button className="w-10 h-10 bg-primary rounded-xl flex items-center justify-center text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.4)] active:scale-90 transition-all">
              <Send size={18} className="fill-current" />
            </button>
          </div>
        </div>
      </div>
    </motion.div>
  );
}
