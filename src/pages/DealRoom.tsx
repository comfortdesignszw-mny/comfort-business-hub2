import React, { useState } from 'react';
import { motion } from 'motion/react';
import { Zap, Clock, CheckCircle2, ChevronRight, DollarSign, MessageCircle, AlertCircle } from 'lucide-react';
import { UserProfile, Deal, DealStatus } from '../types';
import { cn, formatCurrency } from '../lib/utils';

export default function DealRoom({ profile }: { profile: UserProfile | null }) {
  const [activeTab, setActiveTab] = useState<'buying' | 'selling'>('buying');

  const mockDeals: Deal[] = [
    {
      id: 'd1',
      customerId: 'u1',
      supplierId: 's1',
      productId: 'p1',
      status: 'pending',
      agreedPrice: 175,
      customerNotes: 'Looking for a discount on bulk order.',
      updatedAt: new Date().toISOString()
    },
    {
      id: 'd2',
      customerId: 'u1',
      supplierId: 's2',
      productId: 'p3',
      status: 'accepted',
      agreedPrice: 45,
      supplierNotes: 'Ready for pickup at warehouse.',
      updatedAt: new Date().toISOString()
    }
  ];

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.98 }}
      animate={{ opacity: 1, scale: 1 }}
      exit={{ opacity: 0, scale: 0.98 }}
      className="p-4 space-y-8"
    >
      <header className="space-y-1">
        <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">Market Control</h2>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Active Negotiation Channels</p>
      </header>

      {/* Role Switcher in Tabs */}
      <div className="flex bg-white/5 p-1.5 rounded-2xl border border-white/5 shadow-inner">
        <button 
          onClick={() => setActiveTab('buying')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
            activeTab === 'buying' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          Incoming Assets
        </button>
        <button 
          onClick={() => setActiveTab('selling')}
          className={cn(
            "flex-1 py-3 text-[10px] font-black uppercase tracking-widest rounded-xl transition-all duration-300",
            activeTab === 'selling' ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.3)]" : "text-gray-500 hover:text-gray-300"
          )}
        >
          Outbound Supply
        </button>
      </div>

      <div className="space-y-6">
        {mockDeals.map((deal) => (
          <DealCard key={deal.id} deal={deal} />
        ))}
        
        {mockDeals.length === 0 && (
          <div className="py-20 flex flex-col items-center text-center space-y-4">
            <div className="w-16 h-16 bg-white/5 rounded-2xl flex items-center justify-center text-gray-700 animate-pulse">
              <Clock size={32} />
            </div>
            <p className="text-gray-500 font-black uppercase tracking-widest text-[10px]">No active transmissions</p>
            <button className="btn-neon text-xs">Initialize Discovery</button>
          </div>
        )}
      </div>

      {/* EcoCash Integration Mock Tip */}
      <motion.div 
        whileHover={{ scale: 1.02 }}
        className="bg-accent/5 border border-accent/20 p-5 rounded-2xl flex items-start gap-4 relative overflow-hidden group cursor-pointer shadow-lg shadow-accent/5"
      >
        <div className="absolute top-0 right-0 w-24 h-24 bg-accent/10 blur-3xl -mr-12 -mt-12 group-hover:bg-accent/20 transition-colors"></div>
        <div className="w-10 h-10 bg-accent rounded-xl flex items-center justify-center text-white shadow-[0_0_15px_rgba(240,147,251,0.4)] shrink-0">
          <DollarSign size={20} />
        </div>
        <div className="relative z-10">
          <h4 className="text-xs font-black text-accent uppercase tracking-widest">Instant Settlement Enabled</h4>
          <p className="text-[10px] text-gray-400 font-medium leading-relaxed mt-1">
            Settlement via <span className="text-white font-bold italic">EcoCash & InnBucks</span> is now live. Complete deals up to $5,000 instantly.
          </p>
        </div>
      </motion.div>
    </motion.div>
  );
}

function DealCard({ deal }: { deal: Deal, key?: React.Key }) {
  const statusConfig: Record<DealStatus, { color: string, glow: string, icon: any, label: string }> = {
    pending: { color: 'text-amber-400', glow: 'shadow-[0_0_10px_rgba(251,191,36,0.3)]', icon: Clock, label: 'Negotiating' },
    quoted: { color: 'text-blue-400', glow: 'shadow-[0_0_10px_rgba(96,165,250,0.3)]', icon: DollarSign, label: 'Price Lock' },
    accepted: { color: 'text-neon-green', glow: 'shadow-[0_0_10px_rgba(57,255,20,0.3)]', icon: CheckCircle2, label: 'Ready' },
    delivered: { color: 'text-primary', glow: 'shadow-[0_0_10px_rgba(0,242,254,0.3)]', icon: Zap, label: 'Terminal' },
    cancelled: { color: 'text-red-400', glow: 'shadow-[0_0_10px_rgba(248,113,113,0.3)]', icon: AlertCircle, label: 'Aborted' }
  };

  const config = statusConfig[deal.status];

  return (
    <motion.div 
      whileHover={{ y: -4, border: '1px solid rgba(0, 242, 254, 0.2)' }}
      className="neon-card p-5 space-y-6 cursor-pointer relative group"
    >
      <div className="flex justify-between items-start">
        <div className="flex gap-4">
          <div className="w-14 h-14 bg-white/5 rounded-xl border border-white/10 overflow-hidden shrink-0 shadow-inner">
            <img src="https://images.unsplash.com/photo-1509391366360-fe5bb58583bb?w=120&h=120&fit=crop" alt="Thumbnail" className="w-full h-full object-cover group-hover:scale-110 transition-transform duration-500" />
          </div>
          <div className="space-y-1">
            <h4 className="font-black text-white italic text-base group-hover:text-primary transition-colors">Solar Panel 200W</h4>
            <div className="flex items-center gap-2">
              <span className="text-[9px] text-gray-500 font-black uppercase tracking-widest">Ref ID:</span>
              <span className="text-[9px] text-primary font-mono font-bold tracking-widest">{deal.id.toUpperCase()}</span>
            </div>
          </div>
        </div>
        <div className={cn("px-2.5 py-1 rounded-lg text-[9px] font-black flex items-center gap-1.5 uppercase tracking-widest border border-white/5", config.color, config.glow)}>
          <config.icon size={10} />
          {config.label}
        </div>
      </div>

      <div className="grid grid-cols-2 gap-6 p-4 bg-white/[0.02] rounded-xl border border-white/5">
        <div className="space-y-1">
          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Market Value</p>
          <p className="text-xl font-black text-white tracking-tighter italic">{formatCurrency(deal.agreedPrice)}</p>
        </div>
        <div className="space-y-1 text-right">
          <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Sync Hash</p>
          <div className="flex items-center justify-end gap-1.5">
            <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
            <p className="text-[10px] font-bold text-gray-400 italic">2m ago</p>
          </div>
        </div>
      </div>

      <div className="flex gap-3">
        <button className="flex-[2] btn-neon text-[10px] uppercase tracking-widest gap-2">
          <MessageCircle size={14} className="fill-current" /> Open Comms
        </button>
        <button className="flex-1 btn-neon-accent text-[10px] uppercase tracking-widest">
          Settle
        </button>
      </div>
    </motion.div>
  );
}
