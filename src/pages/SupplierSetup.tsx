import React, { useState, useEffect } from 'react';
import { motion } from 'motion/react';
import { Store, Plus, Mail, Phone, Loader2, Sparkles, Store as StoreIcon, Building2, MapPin, Image, Info, Check, Globe } from 'lucide-react';
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
  const handleRemoveContact = (index: number) => {
    if (contacts.length <= 1) return;
    setContacts(contacts.filter((_, i) => i !== index));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!profile) return;
    
    if (document.querySelectorAll('[data-uploading="true"]').length > 0) {
      alert("Please wait for your images to finish uploading before saving.");
      return;
    }
    
    setLoading(true);

    try {
        const hash = geohashForLocation([location.lat, location.lng]);
        const finalCategory = category === 'Other' || (!BUSINESS_CATEGORIES.includes(category) && category !== '') ? customCategory : category;
        
        const storeData = {
          ownerId: profile.uid,
          name: name.trim(),
          description: description.trim(),
          email: email.trim(),
          contactNumbers: contacts.filter(c => c.trim() !== ''),
          category: finalCategory,
          specificBusinessType: specificBusinessType.trim(),
          logo: logo || `https://api.dicebear.com/7.x/initials/svg?seed=${encodeURIComponent(name || 'Store')}`,
          coverPhoto: coverPhoto || `https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80`,
          lat: location.lat,
          lng: location.lng,
          geohash: hash,
          address: location.address,
          isVerified: existingStore ? Boolean(existingStore.isVerified || (existingStore as any)?.verified || profile?.isVerified) : Boolean(profile?.isVerified),
          updatedAt: new Date().toISOString()
      };

      if (existingStore) {
        await offlineResilientWrite('stores', existingStore.id, 'update', storeData, profile.uid);
        onComplete?.(existingStore.id);
      } else {
        const newStoreId = `store_${Date.now()}_${Math.random().toString(36).substring(7)}`;
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
        await offlineResilientWrite('stores', newStoreId, 'create', newStoreData, profile.uid);
        
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
      initial={{ opacity: 0, y: 15 }}
      animate={{ opacity: 1, y: 0 }}
      className="p-4 sm:p-8 space-y-8 pb-32 max-w-4xl mx-auto"
    >
      {/* Header */}
      <header className="space-y-3">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-primary/20 rounded-2xl flex items-center justify-center text-primary border border-primary/30 shadow-[0_0_15px_rgba(0,242,254,0.15)]">
            <StoreIcon size={24} />
          </div>
          <div>
            <h1 className="text-2xl sm:text-3xl font-black text-white italic uppercase tracking-tighter">
              {existingStore ? 'Edit Storefront Profile' : 'Create New Storefront'}
            </h1>
            <p className="text-xs text-gray-400 font-bold uppercase tracking-widest mt-0.5">
              {existingStore ? 'Update official parameters & business credentials' : 'Deploy a verified enterprise storefront to the Comfort Hub network'}
            </p>
          </div>
        </div>
      </header>

      {/* Progress Stages Bar */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
        {[
          { num: '01', title: 'Media & Identity', icon: Image },
          { num: '02', title: 'Business Profile', icon: Building2 },
          { num: '03', title: 'Contact Channels', icon: Phone },
          { num: '04', title: 'GPS Deployment', icon: MapPin }
        ].map((step, idx) => (
          <div key={idx} className="p-3 bg-white/5 rounded-2xl border border-white/10 flex items-center gap-2.5">
            <div className="w-6 h-6 rounded-lg bg-primary/20 text-primary flex items-center justify-center text-[10px] font-black">
              {step.num}
            </div>
            <div className="min-w-0">
              <p className="text-[10px] font-black text-white uppercase tracking-wider truncate">{step.title}</p>
            </div>
          </div>
        ))}
      </div>

      <form onSubmit={handleSubmit} className="space-y-8">
        {/* Stage 1: Brand & Media Assets */}
        <section className="neon-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">1</div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider italic">Brand & Visual Identity</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Logo square icon and panoramic storefront cover banner</p>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-12 gap-6 items-start">
            <div className="md:col-span-4 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                Brand Logo (1:1 Square)
              </label>
              <ImageInput 
                value={logo} 
                onChange={setLogo} 
                label="Upload Logo"
                aspectRatio="square"
              />
              <p className="text-[9px] text-gray-500 italic">Recommended: 400×400px transparent PNG or SVG.</p>
            </div>

            <div className="md:col-span-8 space-y-2">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest block">
                Storefront Cover Banner (16:9 Wide)
              </label>
              <ImageInput 
                value={coverPhoto} 
                onChange={setCoverPhoto} 
                label="Upload Cover Banner"
                aspectRatio="video"
              />
              <p className="text-[9px] text-gray-500 italic">Showcase your shop floor, brand aesthetic, or key commercial inventory.</p>
            </div>
          </div>
        </section>

        {/* Stage 2: Enterprise Details & Profile */}
        <section className="neon-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">2</div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider italic">Store Details & Sector Classification</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Official name, core capabilities, and operational category</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                Official Business Name <span className="text-primary">*</span>
              </label>
              <input 
                type="text"
                placeholder="Enter official business name (e.g. Harare High-Tech Logistics & Solar Systems)"
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all font-bold italic text-sm"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <p className="text-[9px] text-gray-500 ml-1">The prominent public title displayed on directory cards and discovery searches.</p>
            </div>

            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest flex items-center gap-1.5">
                Operational Overview & Description <span className="text-primary">*</span>
              </label>
              <textarea 
                placeholder="Describe your primary products, delivery capabilities, warranty terms, and client guarantees..."
                rows={4}
                className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all text-xs font-medium leading-relaxed"
                value={description}
                onChange={(e) => setDescription(e.target.value)}
                required
              />
              <p className="text-[9px] text-gray-500 ml-1">Comprehensive summary to build trust with buyers and partners.</p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Primary Sector <span className="text-primary">*</span>
                </label>
                <select 
                  className="w-full bg-[#0d1117] border border-white/10 rounded-2xl px-5 py-4 text-white outline-none focus:border-primary/50 transition-all text-xs font-bold appearance-none cursor-pointer"
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
                  <option value="Other" className="bg-[#0d1117] text-white py-2">✨ Other / Custom Sector</option>
                </select>
                <p className="text-[9px] text-gray-500 ml-1">Enables shoppers to filter and discover your store in the directory.</p>
              </div>

              <div className="space-y-1.5">
                <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                  Specific Business Specialization <span className="text-primary">*</span>
                </label>
                <input 
                  type="text"
                  placeholder="e.g. Tier-1 Solar Inverters, Lithium Battery Banks & Complete Off-Grid Setup"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all text-xs font-bold"
                  value={specificBusinessType}
                  onChange={(e) => setSpecificBusinessType(e.target.value)}
                  required
                />
                <p className="text-[9px] text-gray-500 ml-1">Specific niche or primary merchandise line.</p>
              </div>
            </div>

            {(category === 'Other' || (!BUSINESS_CATEGORIES.includes(category) && category !== '')) && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                className="space-y-1.5 pt-2"
              >
                <label className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1">
                  Define Custom Sector <span className="text-primary">*</span>
                </label>
                <input 
                  type="text"
                  placeholder="Enter your custom business sector (e.g. Precision CNC Machining & Fabrication)"
                  className="w-full bg-white/5 border border-primary/30 rounded-2xl px-5 py-4 text-white placeholder-gray-600 outline-none focus:border-primary transition-all text-xs font-bold"
                  value={customCategory}
                  onChange={(e) => setCustomCategory(e.target.value)}
                  required={category === 'Other'}
                />
              </motion.div>
            )}
          </div>
        </section>

        {/* Stage 3: Communication & Contact Channels */}
        <section className="neon-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">3</div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider italic">Direct Contact & Communication Channels</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Official correspondence email and phone/WhatsApp links</p>
            </div>
          </div>

          <div className="space-y-5">
            <div className="space-y-1.5">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Official Business Email <span className="text-primary">*</span>
              </label>
              <div className="relative">
                <Mail size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                <input 
                  type="email"
                  placeholder="sales@businessname.zw or support@company.com"
                  className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all text-xs font-mono"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  required
                />
              </div>
              <p className="text-[9px] text-gray-500 ml-1">Used for order receipts, customer inquiries, and verification notices.</p>
            </div>

            <div className="space-y-3">
              <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">
                Contact & WhatsApp Phone Numbers <span className="text-primary">*</span>
              </label>
              
              {contacts.map((c, i) => (
                <div key={i} className="flex gap-2 items-center">
                  <div className="relative flex-1">
                    <Phone size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-gray-500" />
                    <input 
                      type="tel"
                      placeholder="+263 77 123 4567 (Direct mobile or WhatsApp line)"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white placeholder-gray-600 outline-none focus:border-primary/50 transition-all text-xs font-mono"
                      value={c}
                      onChange={(e) => handleContactChange(i, e.target.value)}
                      required
                    />
                  </div>
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => handleRemoveContact(i)}
                      className="p-3 text-red-400 hover:text-red-300 hover:bg-red-500/10 rounded-xl transition-colors"
                      title="Remove contact"
                    >
                      ×
                    </button>
                  )}
                </div>
              ))}

              <button 
                type="button"
                onClick={handleAddContact}
                className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity ml-1 py-1"
              >
                <Plus size={14} /> Add Additional Contact Number
              </button>
            </div>
          </div>
        </section>

        {/* Stage 4: Regional Deployment Coordinates */}
        <section className="neon-card p-6 md:p-8 space-y-6">
          <div className="flex items-center gap-2 border-b border-white/5 pb-4">
            <div className="w-7 h-7 rounded-lg bg-primary/10 text-primary flex items-center justify-center text-xs font-black">4</div>
            <div>
              <h2 className="text-sm font-black text-white uppercase tracking-wider italic">Regional Deployment & Map Pin</h2>
              <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Pinpoint your showroom, warehouse, or pickup location</p>
            </div>
          </div>

          <div className="space-y-4">
            <LocationPicker 
              initialLat={location.lat}
              initialLng={location.lng}
              onLocationSelect={(lat, lng, address) => setLocation({ lat, lng, address })}
            />
            <p className="text-[9px] text-gray-500 italic">
              Selected Location: <span className="text-white font-mono">{location.address || `${location.lat.toFixed(4)}, ${location.lng.toFixed(4)}`}</span>
            </p>
          </div>
        </section>

        {/* Submit Button */}
        <button 
          type="submit"
          disabled={loading}
          className="w-full py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3 transition-all btn-neon shadow-2xl"
        >
          {loading ? (
            <Loader2 className="animate-spin" size={20} />
          ) : (
            <>
              {existingStore ? <Check size={20} /> : <Sparkles size={20} />}
              {existingStore ? 'Save Store Changes' : 'Launch & Initialize Storefront'}
            </>
          )}
        </button>
      </form>
    </motion.div>
  );
}

