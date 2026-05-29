import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Store, Plus, Mail, Phone, Loader2, Sparkles, Store as StoreIcon } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore';
import { UserProfile, Store as StoreType } from '../types';
import { BUSINESS_CATEGORIES } from '../constants';
import { cn } from '../lib/utils';
import ImageInput from '../components/ImageInput';
import LocationPicker from '../components/LocationPicker';
import { offlineResilientWrite } from '../lib/sync';
import { geohashForLocation } from 'geofire-common';

export default function SupplierSetup({ profile, onComplete, existingStore }: { profile: UserProfile, onComplete?: (id?: string) => void, existingStore?: StoreType }) {
  const [loading, setLoading] = useState(false);
  const [name, setName] = useState(existingStore?.name || '');
  const [description, setDescription] = useState(existingStore?.description || '');
  const [email, setEmail] = useState(existingStore?.email || '');
  const [contacts, setContacts] = useState(existingStore?.contactNumbers || ['']);
  const [category, setCategory] = useState(existingStore?.category || BUSINESS_CATEGORIES[0]);
  const [customCategory, setCustomCategory] = useState(
    existingStore?.category && !BUSINESS_CATEGORIES.includes(existingStore.category) ? existingStore.category : ''
  );
  const [specificBusinessType, setSpecificBusinessType] = useState(existingStore?.specificBusinessType || '');
  const [logo, setLogo] = useState(existingStore?.logo || '');
  const [coverPhoto, setCoverPhoto] = useState(existingStore?.coverPhoto || '');
  const [location, setLocation] = useState({
    lat: existingStore?.lat || profile.lat || -17.8252,
    lng: existingStore?.lng || profile.lng || 31.0335,
    address: profile.location?.address || ''
  });

  useEffect(() => {
    if (existingStore) {
      setName(existingStore.name);
      setDescription(existingStore.description);
      setEmail(existingStore.email);
      setContacts(existingStore.contactNumbers || ['']);
      setCategory(existingStore.category);
      setCustomCategory(BUSINESS_CATEGORIES.includes(existingStore.category) ? '' : existingStore.category);
      setSpecificBusinessType(existingStore.specificBusinessType || '');
      setLogo(existingStore.logo || '');
      setCoverPhoto(existingStore.coverPhoto || '');
    }
  }, [existingStore]);

  const handleAddContact = () => setContacts([...contacts, '']);
  const handleContactChange = (index: number, value: string) => {
    const newContacts = [...contacts];
    newContacts[index] = value;
    setContacts(newContacts);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (!profile.isVerified) {
      alert("CRITICAL: Identity verification required to register new supply chain nodes. Please check your email and verify your identity.");
      return;
    }
    
    if (
      (logoUrl && (logoUrl.startsWith('blob:') || logoUrl.startsWith('data:'))) ||
      (coverImage && (coverImage.startsWith('blob:') || coverImage.startsWith('data:')))
    ) {
      alert("Please wait for your images to finish securely syncing to the cloud before saving.");
      return;
    }
    
    setLoading(true);

    try {
        const hash = geohashForLocation([location.lat, location.lng]);
        const finalCategory = category === 'Other' || (!BUSINESS_CATEGORIES.includes(category) && category !== '') ? customCategory : category;
        
        const storeData = {
          ownerId: profile.uid,
          name,
          description,
          email,
          contactNumbers: contacts.filter(c => c.trim() !== ''),
          category: finalCategory,
          specificBusinessType,
          logo: logo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name)}`,
          coverPhoto: coverPhoto || `https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80`,
          lat: location.lat,
          lng: location.lng,
          geohash: hash,
          address: location.address,
          updatedAt: new Date().toISOString()
      };

      if (existingStore) {
        await offlineResilientWrite('stores', existingStore.id, 'update', storeData);
        onComplete?.(existingStore.id);
      } else {
        const newStoreId = `store_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const hash = geohashForLocation([location.lat, location.lng]);
        const newStoreData = {
          ...storeData,
          id: newStoreId,
          rating: 5,
          reviewCount: 0,
          lat: location.lat,
          lng: location.lng,
          geohash: hash,
          createdAt: new Date().toISOString()
        };
        await offlineResilientWrite('stores', newStoreId, 'create', newStoreData);
        
        if (onComplete) {
          onComplete(newStoreId);
        } else {
          alert("Storefront initialized successfully!");
        }
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
          <div className="flex flex-col md:flex-row gap-6">
            <div className="flex-1 max-w-[200px] mx-auto md:mx-0 w-full">
              <ImageInput 
                value={logo} 
                onChange={setLogo} 
                label="Business Logo Identity"
                aspectRatio="square"
              />
            </div>
            <div className="flex-[2] w-full">
              <ImageInput 
                value={coverPhoto} 
                onChange={setCoverPhoto} 
                label="Storefront Cover Image"
                aspectRatio="video"
              />
            </div>
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
                <div className="space-y-3">
                  <select 
                    className="w-full bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 transition-all text-xs font-bold appearance-none cursor-pointer"
                    value={BUSINESS_CATEGORIES.includes(category) ? category : 'Other'}
                    onChange={(e) => {
                      const val = e.target.value;
                      if (val === 'Other') {
                        setCategory('Other');
                      } else {
                        setCategory(val);
                        setCustomCategory('');
                      }
                    }}
                  >
                    {BUSINESS_CATEGORIES.map(cat => (
                      <option key={cat} value={cat} className="bg-[#0d1117] text-white py-2">{cat}</option>
                    ))}
                    <option value="Other" className="bg-[#0d1117] text-white py-2">Other / Custom</option>
                  </select>

                  {(category === 'Other' || (!BUSINESS_CATEGORIES.includes(category) && category !== '')) && (
                    <motion.div
                      initial={{ opacity: 0, height: 0 }}
                      animate={{ opacity: 1, height: 'auto' }}
                      className="space-y-2"
                    >
                      <label className="text-[9px] font-black text-primary uppercase tracking-widest ml-1 italic">Define Sector</label>
                      <input 
                        type="text"
                        placeholder="Enter your custom business sector"
                        className="w-full bg-white/5 border border-primary/20 rounded-2xl px-4 py-4 text-white placeholder-gray-700 outline-none focus:border-primary/50 transition-all text-xs font-bold font-mono"
                        value={customCategory}
                        onChange={(e) => setCustomCategory(e.target.value)}
                        required={category === 'Other'}
                      />
                    </motion.div>
                  )}
                </div>
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

            <div className="pt-4 border-t border-white/5 space-y-4">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1 flex items-center gap-2">
                <StoreIcon size={12} className="text-primary" /> Regional Deployment Coordinates
              </label>
              <LocationPicker 
                initialLat={location.lat}
                initialLng={location.lng}
                onLocationSelect={(lat, lng, address) => setLocation({ lat, lng, address })}
              />
            </div>
          </div>
        </div>

        <button 
          type="submit"
          disabled={loading}
          className={cn(
            "w-full py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3 transition-all",
            profile.isVerified 
              ? "btn-neon" 
              : "bg-red-500/10 border border-red-500/20 text-red-500 opacity-50 cursor-not-allowed"
          )}
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              {existingStore ? <Plus size={20} className="rotate-45" /> : <Sparkles size={20} />}
              {existingStore ? 'Commit Node Updates' : 'Transmit Storefront Data'}
              {!profile.isVerified && <span className="text-[8px] font-black block ml-2">(Verification Required)</span>}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}
