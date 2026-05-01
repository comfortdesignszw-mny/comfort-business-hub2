import React, { useState, useRef } from 'react';
import { motion } from 'motion/react';
import { Store, Camera, Plus, Mail, Phone, MapPin, Loader2, Sparkles, X } from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Store as StoreType } from '../types';
import { useNavigate } from 'react-router-dom';
import { useEffect } from 'react';
import { uploadAndCompressImage } from '../lib/upload-utils';
import { validateImage } from '../lib/image-utils';
import { cn } from '../lib/utils';
import { BUSINESS_CATEGORIES } from '../constants';

export default function SupplierSetup({ profile, onComplete, existingStore }: { profile: UserProfile, onComplete?: () => void, existingStore?: StoreType }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(existingStore?.name || '');
  const [description, setDescription] = useState(existingStore?.description || '');
  const [email, setEmail] = useState(existingStore?.email || '');
  const [contacts, setContacts] = useState(existingStore?.contactNumbers || ['']);
  const [category, setCategory] = useState(existingStore?.category || BUSINESS_CATEGORIES[0]);
  const [specificBusinessType, setSpecificBusinessType] = useState(existingStore?.specificBusinessType || '');
  const [logo, setLogo] = useState(existingStore?.logo || '');
  const [uploading, setUploading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const navigate = useNavigate();

  useEffect(() => {
    if (existingStore) {
      setName(existingStore.name);
      setDescription(existingStore.description);
      setEmail(existingStore.email);
      setContacts(existingStore.contactNumbers || ['']);
      setCategory(existingStore.category);
      setSpecificBusinessType(existingStore.specificBusinessType || '');
      setLogo(existingStore.logo || '');
    }
  }, [existingStore]);

  const handleLogoUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    // Fast validation
    const validationError = validateImage(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Fast local preview
    const previewUrl = URL.createObjectURL(file);
    setLogo(previewUrl);
    setUploading(true);

    try {
      const url = await uploadAndCompressImage(file, `stores/${profile.uid}/logo`, {
        maxWidth: 300,
        maxHeight: 300,
        quality: 0.5
      });
      setLogo(url);
    } catch (error) {
      console.error("Logo upload error:", error);
      alert("Failed to upload logo. Please check the image format.");
      setLogo(''); // Revert
    } finally {
      setUploading(false);
      URL.revokeObjectURL(previewUrl);
    }
  };

  const handleAddContact = () => setContacts([...contacts, '']);
  const handleContactChange = (index: number, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = value;
    setContacts(newContacts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    setLoading(true);

    try {
        const storeData = {
          ownerId: profile.uid,
          name,
          description,
          email,
          contactNumbers: contacts.filter(c => c.trim() !== ''),
          category,
          specificBusinessType,
          logo: logo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
          updatedAt: new Date().toISOString()
      };

      if (existingStore) {
        await updateDoc(doc(db, 'stores', existingStore.id), storeData);
      } else {
        const newStoreData = {
          ...storeData,
          rating: 5,
          reviewCount: 0,
          geohash: profile.geohash || 'demo-hash',
          lat: profile.lat || -17.8252,
          lng: profile.lng || 31.0335,
          createdAt: new Date().toISOString()
        };
        await addDoc(collection(db, 'stores'), newStoreData);
      }

      if (onComplete) {
        onComplete();
      } else {
        window.location.reload();
      }
    } catch (error) {
      handleFirestoreError(error, existingStore ? OperationType.UPDATE : OperationType.CREATE, existingStore ? `stores/${existingStore.id}` : 'stores');
    } finally {
      setLoading(false);
    }
  };

  return (
    <motion.div 
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-6 space-y-8 pb-32"
    >
      <header className="space-y-2">
        <div className="flex items-center gap-2">
          <div className="w-10 h-10 bg-primary/20 rounded-xl flex items-center justify-center text-primary">
            <Store size={24} />
          </div>
          <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter">
            {existingStore ? 'Modify Storefront' : 'Initialize Storefront'}
          </h1>
        </div>
        <p className="text-xs text-gray-500 font-bold uppercase tracking-widest">
          {existingStore ? 'Update your operational parameters' : 'Connect your node to the regional trade network'}
        </p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-6">
        <div className="neon-card p-6 space-y-6">
          <div className="flex flex-col items-center gap-4 py-4">
            <input 
              type="file"
              ref={fileInputRef}
              onChange={handleLogoUpload}
              className="hidden"
              accept="image/*"
            />
            <div 
              onClick={() => !uploading && fileInputRef.current?.click()}
              className={cn(
                "w-24 h-24 bg-white/5 rounded-[2rem] border-2 border-dashed flex flex-col items-center justify-center text-gray-600 gap-2 cursor-pointer hover:border-primary/50 hover:text-primary transition-all relative overflow-hidden",
                logo ? "border-solid border-primary/20" : "border-white/10"
              )}
            >
              {uploading ? (
                <Loader2 className="animate-spin text-primary" size={24} />
              ) : logo ? (
                <img src={logo} alt="Logo" className="w-full h-full object-cover" />
              ) : (
                <>
                  <Camera size={24} />
                  <span className="text-[8px] font-black uppercase tracking-widest text-center px-2">Upload Identity Logo</span>
                </>
              )}
            </div>
            {logo && (
              <button 
                type="button"
                onClick={() => setLogo('')}
                className="text-[8px] font-black uppercase text-red-500 tracking-widest hover:opacity-80 flex items-center gap-1"
              >
                <X size={10} /> Remove Logo
              </button>
            )}
          </div>

          <div className="space-y-4">
            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Business Identifier</label>
              <input 
                type="text"
                placeholder="e.g. Harare High-Tech Logistics"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all font-bold italic"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Operational Description</label>
              <textarea 
                placeholder="What services do you provide to the network?"
                rows={3}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all font-medium"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Uplink Email</label>
                <div className="relative">
                  <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input 
                    type="email"
                    placeholder="hq@business.zw"
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all text-xs font-mono"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    required
                  />
                </div>
              </div>
              <div className="space-y-2">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Operational Sector</label>
                <select 
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 transition-all text-xs font-bold appearance-none"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {BUSINESS_CATEGORIES.map(cat => (
                    <option key={cat} value={cat}>{cat}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Specific Business Type</label>
              <input 
                type="text"
                placeholder="e.g. Specialized Solar Installation / High-End Fashion Boutique"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all text-xs font-bold"
                value={specificBusinessType}
                onChange={(e) => setSpecificBusinessType(e.target.value)}
                required
              />
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Contact Arrays</label>
              {contacts.map((c, i) => (
                <div key={i} className="relative group">
                  <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-600" />
                  <input 
                    type="tel"
                    placeholder="+263 7..."
                    className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all text-sm font-mono"
                    value={c}
                    onChange={(e) => handleContactChange(i, e.target.value)}
                    required
                  />
                </div>
              ))}
              <button 
                type="button"
                onClick={handleAddContact}
                className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity ml-1"
              >
                <Plus size={14} /> Add Additional Link
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
              {existingStore ? <Plus size={20} className="rotate-45" /> : <Sparkles size={20} />}
              {existingStore ? 'Commit Node Updates' : 'Transmit Storefront Data'}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
