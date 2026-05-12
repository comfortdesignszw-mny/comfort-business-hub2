import React, { useState } from 'react';
import { motion } from 'motion/react';
import { User, Phone, Mail, Package, Plus, X, Sparkles, Loader2 } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType, syncPublicProfile } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { UserProfile } from '../types';

export default function CustomerSetup({ profile }: { profile: UserProfile }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(profile.name || '');
  const [phone, setPhone] = useState(profile.phone || '');
  const [needs, setNeeds] = useState<string[]>(['']);

  const handleAddNeed = () => setNeeds([...needs, '']);
  const handleNeedChange = (index: number, value: string) => {
    const newNeeds = [...needs];
    newNeeds[index] = value;
    setNeeds(newNeeds);
  };
  const handleRemoveNeed = (index: number) => {
    setNeeds(needs.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    const path = `users/${profile.uid}`;

    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        name,
        phone,
        requiredProducts: needs.filter(n => n.trim() !== ''),
        isVerified: true,
        updatedAt: new Date().toISOString()
      });
      
      await syncPublicProfile({
        ...profile,
        name,
        isVerified: true
      });
      window.location.reload();
    } catch (error) {
      handleFirestoreError(error, OperationType.UPDATE, path);
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className="p-6 space-y-8 pb-32"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
            <User size={24} />
          </div>
          <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">Profile Initialization</h1>
        </div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">Register your node to begin matching with regional suppliers</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="neon-card p-6 space-y-6">
          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Identity Name</label>
              <div className="relative">
                <User size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="text"
                  placeholder="Full Name"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all font-bold italic"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Communication Link (Phone)</label>
              <div className="relative">
                <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                <input 
                  type="tel"
                  placeholder="+263 7..."
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all font-mono"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  required
                />
              </div>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Required Commodities / Services</label>
              <p className="text-[8px] text-gray-600 font-bold uppercase tracking-wider mb-2">Our AI will match these with available supplier nodes</p>
              {needs.map((need, i) => (
                <div key={i} className="flex gap-2">
                  <div className="relative flex-1">
                    <Package size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                    <input 
                      type="text"
                      placeholder="e.g. Solar Inverters, Web Design..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all text-xs font-bold"
                      value={need}
                      onChange={(e) => handleNeedChange(i, e.target.value)}
                      required
                    />
                  </div>
                  {needs.length > 1 && (
                    <button 
                      type="button"
                      onClick={() => handleRemoveNeed(i)}
                      className="w-12 h-12 bg-red-500/10 border border-red-500/20 rounded-2xl flex items-center justify-center text-red-500"
                    >
                      <X size={18} />
                    </button>
                  )}
                </div>
              ))}
              <button 
                type="button"
                onClick={handleAddNeed}
                className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity ml-1"
              >
                <Plus size={14} /> Add Requirement
              </button>
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              <Sparkles size={20} />
              Finalize Profiling
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
