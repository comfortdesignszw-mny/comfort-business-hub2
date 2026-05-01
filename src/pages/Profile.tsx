import React, { useState, useTransition } from 'react';
import { useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { 
  User, Store, Phone, MapPin, Shield, LogOut, ChevronRight, Wallet, 
  Bell, Zap, Image as ImageIcon, X, Check, CreditCard, 
  Navigation, Crosshair, Save, Loader2 
} from 'lucide-react';
import { UserProfile, Role } from '../types';
import { auth, db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, updateDoc } from 'firebase/firestore';
import { cn } from '../lib/utils';
import ImageInput from '../components/ImageInput';

export default function Profile({ profile, setProfile }: { profile: UserProfile | null, setProfile: (p: UserProfile) => void }) {
  const [loading, setLoading] = useState(false);
  const [activeModal, setActiveModal] = useState<'profile' | 'gateway' | 'location' | null>(null);
  const [isPending, startTransition] = useTransition();
  const navigate = useNavigate();

  const toggleRole = async () => {
    if (!profile || loading) return;
    
    const newRole: Role = profile.currentRole === 'customer' ? 'supplier' : 'customer';
    
    // Optimistic Update
    const prevRole = profile.currentRole;
    setProfile({ ...profile, currentRole: newRole });
    
    setLoading(true);
    const path = `users/${profile.uid}`;
    try {
      await updateDoc(doc(db, 'users', profile.uid), {
        currentRole: newRole
      });
    } catch (e) {
      // Revert on failure
      setProfile({ ...profile, currentRole: prevRole });
      handleFirestoreError(e, OperationType.UPDATE, path);
    } finally {
      setLoading(false);
    }
  };

  const handleLogout = () => {
    auth.signOut();
    navigate('/login');
  };

  const handleUpdateProfile = async (updates: Partial<UserProfile>) => {
    if (!profile) return;
    
    // Optimistic UI for immediate feedback
    const prevProfile = { ...profile };
    setProfile({ ...profile, ...updates });
    
    setLoading(true);
    try {
      const data = {
        ...updates,
        updatedAt: new Date().toISOString()
      };
      await updateDoc(doc(db, 'users', profile.uid), data);
    } catch (e) {
      setProfile(prevProfile);
      handleFirestoreError(e, OperationType.UPDATE, `users/${profile.uid}`);
    } finally {
      setLoading(false);
    }
  };

  const handleNavigate = (path: string) => {
    startTransition(() => {
      navigate(path);
    });
  };

  if (!profile) return null;

  return (
    <motion.div 
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      transition={{ duration: 0.2, ease: "easeOut" }}
      className="p-4 space-y-8 no-scrollbar"
      style={{ willChange: 'transform, opacity' }}
    >
      {/* Profile Header */}
      <section className="flex flex-col items-center text-center space-y-6 pt-6">
        <div className="relative group">
          <div className="absolute -inset-1 bg-gradient-to-r from-primary to-accent rounded-full blur opacity-25 group-hover:opacity-50 transition duration-1000"></div>
          <div className="relative w-32 h-32 bg-[#0d1117] border-4 border-[#05070a] rounded-full flex items-center justify-center text-white text-4xl font-black shadow-2xl relative overflow-hidden">
            <div className="absolute inset-0 bg-gradient-to-br from-primary/10 to-accent/10"></div>
            {profile.avatar ? (
              <img src={profile.avatar} alt={profile.name} className="w-full h-full object-cover" />
            ) : profile.name.charAt(0)}
          </div>
          <button 
            onClick={() => setActiveModal('profile')}
            className="absolute bottom-1 right-1 w-10 h-10 bg-primary text-[#05070a] rounded-xl flex items-center justify-center border-4 border-[#05070a] shadow-lg group-hover:scale-110 transition-transform active:scale-95"
          >
            <ImageIcon size={18} />
          </button>
        </div>
        <div className="space-y-1">
          <h2 className="text-2xl font-black text-white italic tracking-tighter uppercase">{profile.name}</h2>
          <div className="flex items-center justify-center gap-3">
            <p className="text-xs text-gray-500 font-black uppercase tracking-widest">{profile.phone}</p>
            <div className="w-1.5 h-1.5 bg-gray-700 rounded-full"></div>
            <p className="text-[10px] text-primary font-black uppercase tracking-widest">Node ID: {profile.uid.slice(0, 8)}</p>
          </div>
        </div>
        <div className="flex gap-3">
          {profile.isVerified && (
            <div className="glass-pill !text-neon-green !border-neon-green/20 flex items-center gap-1.5 shadow-[0_0_10px_rgba(57,255,20,0.1)]">
              <Shield size={12} className="fill-neon-green/20" /> Verified Operator
            </div>
          )}
          <div className="glass-pill">Beta Access</div>
        </div>
      </section>

      {/* Role Toggle Dashboard */}
      <section className="neon-card p-8 relative overflow-hidden group">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16 group-hover:bg-primary/20 transition-all pointer-events-none"></div>
        
        <div className="flex items-center justify-between mb-8">
          <div className="space-y-1 text-left">
            <h3 className="text-sm font-black text-white uppercase tracking-widest">Active Link</h3>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Switch between Hub Personas</p>
          </div>
          <div className="flex items-center gap-2 p-1.5 bg-white/5 rounded-2xl border border-white/5 relative z-10">
            <button 
              onClick={toggleRole}
              disabled={loading}
              title="Customer Mode"
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90",
                profile.currentRole === 'customer' 
                  ? "bg-primary text-[#05070a] shadow-[0_0_15px_rgba(0,242,254,0.4)]" 
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <User size={22} />
            </button>
            <button 
              onClick={toggleRole}
              disabled={loading}
              title="Supplier Mode"
              className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-200 active:scale-90",
                profile.currentRole === 'supplier' 
                  ? "bg-accent text-white shadow-[0_0_15px_rgba(240,147,251,0.4)]" 
                  : "text-gray-500 hover:text-gray-300"
              )}
            >
              <Store size={22} />
            </button>
          </div>
        </div>
        
        <motion.div 
          initial={false}
          animate={{ 
            height: profile.currentRole === 'supplier' ? 'auto' : 0, 
            opacity: profile.currentRole === 'supplier' ? 1 : 0,
            marginBottom: profile.currentRole === 'supplier' ? 0 : -24
          }}
          transition={{ 
            duration: 0.25, 
            ease: [0.23, 1, 0.32, 1] // Fast out, slow in for snappier feel
          }}
          className="overflow-hidden"
          style={{ willChange: 'height, opacity' }}
        >
          <div className="pt-6 border-t border-white/5 space-y-4">
            <div className="grid grid-cols-2 gap-4">
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Store Volume</p>
                <div className="flex items-end gap-2">
                  <p className="text-xl font-black text-white">$12.4K</p>
                  <p className="text-[8px] text-neon-green font-bold mb-1">+12%</p>
                </div>
              </div>
              <div className="bg-white/5 p-4 rounded-2xl border border-white/5 space-y-2">
                <p className="text-[8px] text-gray-400 font-black uppercase tracking-widest">Active Leads</p>
                <p className="text-xl font-black text-primary">08 Nodes</p>
              </div>
            </div>
            
            <motion.button
              whileTap={{ scale: 0.97 }}
              onClick={() => handleNavigate('/store')}
              className={cn(
                "w-full btn-neon py-4 flex items-center justify-center gap-3 text-[11px] font-black uppercase tracking-widest transition-all",
                isPending && "brightness-50 grayscale cursor-wait"
              )}
            >
              {isPending ? <Loader2 className="animate-spin" size={16} /> : <Store size={18} className="text-inherit" />} 
              Sync & Manage Business
            </motion.button>
          </div>
        </motion.div>
      </section>

      {/* Menu Links */}
      <section className="space-y-4">
        <MenuButton 
          icon={Wallet} 
          label="Financial Gateway" 
          detail={profile.gateway?.provider ? `${profile.gateway.provider.toUpperCase()} Configured` : "Link EcoCash & Bank"} 
          onClick={() => setActiveModal('gateway')}
        />
        <MenuButton 
          icon={MapPin} 
          label="Geographic Nodes" 
          detail={profile.location?.city ? `${profile.location.city} Operational` : "Manage Operational Areas"} 
          onClick={() => setActiveModal('location')}
        />
        <MenuButton icon={User} label="Identity Uplink" detail="Modify Profile Details" onClick={() => setActiveModal('profile')} />
      </section>

      <div className="pt-6 pb-20">
        <button 
          onClick={handleLogout}
          className="w-full flex items-center justify-center gap-3 py-5 text-gray-500 font-black uppercase tracking-widest text-[10px] bg-white/5 rounded-2xl border border-white/5 hover:bg-red-500/10 hover:text-red-500 hover:border-red-500/20 transition-all active:scale-95 group"
        >
          <LogOut size={16} className="group-hover:translate-x-1 transition-transform" /> Sign Out from Node
        </button>
        <div className="flex flex-col items-center mt-8 space-y-2">
          <Zap size={24} className="text-primary/20" />
          <p className="text-[9px] text-gray-700 font-black uppercase tracking-[0.3em]">Comfort Business Hub • v1.0.42</p>
        </div>
      </div>

      {/* Modals */}
      <AnimatePresence>
        {activeModal && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05070a]/95 backdrop-blur-xl"
              onClick={() => setActiveModal(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg neon-card !bg-[#0d1117] p-8 max-h-[90vh] overflow-y-auto no-scrollbar"
            >
              <button 
                onClick={() => setActiveModal(null)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white"
              >
                <X size={24} />
              </button>

              {activeModal === 'profile' && (
                <ProfileEditor profile={profile} onSave={(p) => { handleUpdateProfile(p); setActiveModal(null); }} />
              )}
              {activeModal === 'gateway' && (
                <GatewayConfig profile={profile} onSave={(g) => { handleUpdateProfile({ gateway: g }); setActiveModal(null); }} />
              )}
              {activeModal === 'location' && (
                <LocationConfig profile={profile} onSave={(l) => { handleUpdateProfile({ location: l }); setActiveModal(null); }} />
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

function ProfileEditor({ profile, onSave }: { profile: UserProfile, onSave: (p: Partial<UserProfile>) => void }) {
  const [name, setName] = useState(profile.name);
  const [phone, setPhone] = useState(profile.phone);
  const [avatar, setAvatar] = useState(profile.avatar || '');

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Identity Editor</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Modify your node communications data</p>
      </header>

      <div className="space-y-6">
         <div className="max-w-[160px] mx-auto w-full">
            <ImageInput 
              value={avatar} 
              onChange={setAvatar} 
              label="Avatar Identity"
              aspectRatio="square"
            />
         </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Entity Name</label>
            <input 
              type="text"
              value={name}
              onChange={e => setName(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic"
            />
          </div>
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Comms Link (Phone)</label>
            <input 
              type="tel"
              value={phone}
              onChange={e => setPhone(e.target.value)}
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-mono"
            />
          </div>
        </div>

        <button 
          onClick={() => onSave({ name, phone, avatar })}
          className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
        >
          <Save size={18} /> Update Core Data
        </button>
      </div>
    </div>
  );
}

function GatewayConfig({ profile, onSave }: { profile: UserProfile, onSave: (g: any) => void }) {
  const [provider, setProvider] = useState(profile.gateway?.provider || 'paypal');
  const [details, setDetails] = useState(profile.gateway?.details || '');

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Finance Hub</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Matrix currency routing parameters</p>
      </header>

      <div className="space-y-6">
        <div className="grid grid-cols-2 gap-3">
          {['paypal', 'stripe', 'paynow', 'custom'].map((id) => (
            <button
              key={id}
              onClick={() => setProvider(id as any)}
              className={cn(
                "p-4 rounded-2xl border flex flex-col items-center gap-2 transition-all",
                provider === id ? "bg-primary/20 border-primary text-primary" : "bg-white/5 border-white/5 text-gray-500"
              )}
            >
              <CreditCard size={20} />
              <span className="text-[10px] font-black uppercase tracking-widest">{id}</span>
            </button>
          ))}
        </div>

        <div className="space-y-2">
          <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Gateway Identity/Address</label>
          <input 
            type="text"
            value={details}
            onChange={e => setDetails(e.target.value)}
            placeholder={provider === 'paypal' ? 'Paypal Email Address' : 'Account Details / Secret Link'}
            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-mono text-xs"
          />
        </div>

        <button 
          onClick={() => onSave({ provider, details, isActive: true })}
          className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
        >
          <Check size={18} /> Synchronize Gateway
        </button>
      </div>
    </div>
  );
}

function LocationConfig({ profile, onSave }: { profile: UserProfile, onSave: (l: any) => void }) {
  const [city, setCity] = useState(profile.location?.city || '');
  const [address, setAddress] = useState(profile.location?.address || '');
  const [lat, setLat] = useState(profile.location?.coordinates?.lat || -17.8252);
  const [lng, setLng] = useState(profile.location?.coordinates?.lng || 31.0335);

  const getGPS = () => {
    if (navigator.geolocation) {
      navigator.geolocation.getCurrentPosition((pos) => {
        setLat(pos.coords.latitude);
        setLng(pos.coords.longitude);
      });
    }
  };

  return (
    <div className="space-y-8">
      <header className="space-y-2">
        <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">Geo-Matrix Node</h3>
        <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pinpoint your operational coordinate</p>
      </header>

      <div className="space-y-6">
        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Base City</label>
            <input 
              type="text"
              value={city}
              onChange={e => setCity(e.target.value)}
              placeholder="e.g. Harare, Mutare, Bulawayo..."
              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic"
            />
          </div>
          
          <div className="grid grid-cols-2 gap-4">
             <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Latitude</label>
                <input 
                  type="number"
                  step="0.000001"
                  value={lat}
                  onChange={e => setLat(parseFloat(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-mono text-xs"
                />
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Longitude</label>
                <input 
                  type="number"
                  step="0.000001"
                  value={lng}
                  onChange={e => setLng(parseFloat(e.target.value))}
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-mono text-xs"
                />
              </div>
          </div>
        </div>

        <button 
          onClick={getGPS}
          className="w-full py-4 bg-white/5 border border-white/10 rounded-2xl flex items-center justify-center gap-2 text-[10px] font-black uppercase text-primary tracking-widest hover:bg-primary/5 transition-colors"
        >
          <Crosshair size={14} /> Scan Internal GPS Node
        </button>

        <button 
          onClick={() => onSave({ city, address, coordinates: { lat, lng } })}
          className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3"
        >
          <Navigation size={18} /> Transmit Coordinates
        </button>
      </div>
    </div>
  );
}

function MenuButton({ icon: Icon, label, detail, onClick }: { icon: any, label: string, detail?: string, onClick?: () => void }) {
  return (
    <motion.button 
      whileTap={{ scale: 0.98 }}
      onClick={onClick} 
      className="w-full neon-card p-5 flex items-center justify-between group hover:border-primary/40 transition-all duration-200 active:bg-white/5"
      style={{ transform: 'translateZ(0)' }}
    >
      <div className="flex items-center gap-4">
        <div className="w-12 h-12 bg-white/5 rounded-xl flex items-center justify-center text-gray-500 group-hover:text-primary group-hover:bg-primary/10 transition-all duration-300">
          <Icon size={22} className="group-hover:scale-110 transition-transform" />
        </div>
        <div className="text-left space-y-0.5">
          <p className="text-sm font-black text-white uppercase tracking-widest group-hover:text-primary transition-colors">{label}</p>
          {detail && <p className="text-[10px] text-gray-500 font-bold uppercase tracking-tight italic opacity-60 leading-tight">{detail}</p>}
        </div>
      </div>
      <ChevronRight size={18} className="text-gray-700 group-hover:text-primary transition-all group-hover:translate-x-2" />
    </motion.button>
  );
}

