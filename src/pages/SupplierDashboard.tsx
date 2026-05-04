import React, { useState, useEffect } from 'react';
import { motion, AnimatePresence } from 'motion/react';
import { 
  Store as StoreIcon, 
  Plus, 
  Package, 
  Edit3, 
  Trash2, 
  ShoppingBag, 
  MessageSquare, 
  Link as LinkIcon, 
  X, 
  Check,
  Users,
  DollarSign,
  Loader2,
  Phone,
  Share2,
  Shield,
  MapPin,
  Building2,
  Sparkles
} from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  updateDoc, 
  doc,
  onSnapshot
} from 'firebase/firestore';
import { UserProfile, Store, Product, BuyButtonType } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { PRODUCT_CATEGORIES, BUSINESS_CATEGORIES } from '../constants';
import SupplierSetup from './SupplierSetup';
import { offlineResilientWrite } from '../lib/sync';
import ImageInput from '../components/ImageInput';
import LocationPicker from '../components/LocationPicker';
import { geohashForLocation } from 'geofire-common';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useLocation } from 'react-router-dom';

// Fix for default marker icon in Leaflet
const DefaultIcon = L.icon({
    iconUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-icon.png',
    shadowUrl: 'https://unpkg.com/leaflet@1.9.4/dist/images/marker-shadow.png',
    iconSize: [25, 41],
    iconAnchor: [12, 41]
});
L.Marker.prototype.options.icon = DefaultIcon;

interface ProductForm {
  name: string;
  description: string;
  price: number;
  currency: string;
  category: string;
  images: string[];
  buyButtonType: BuyButtonType;
  buyButtonLink: string;
  isActive: boolean;
}

const initialForm: ProductForm = {
  name: '',
  description: '',
  price: 0,
  currency: 'USD',
  category: 'Electronics',
  images: [],
  buyButtonType: 'chat',
  buyButtonLink: '',
  isActive: true
};

export default function SupplierDashboard({ profile }: { profile: UserProfile }) {
  const location = useLocation();
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showStoreSetup, setShowStoreSetup] = useState(false);
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [storeEditData, setStoreEditData] = useState<Partial<Store>>({});
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isSavingStore, setIsSavingStore] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [isEditingLocation, setIsEditingLocation] = useState(false);

  const [engagementStats, setEngagementStats] = useState({ engaged: 0, interested: 0 });

  useEffect(() => {
    setLoading(true);
    // Real-time Stores Listener
    const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', profile.uid));
    const storesUnsub = onSnapshot(storesQuery, (snap) => {
      const fetchedStores = snap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
      setStores(fetchedStores);
      
      if (fetchedStores.length > 0) {
        // Set active store if not set or if current active store was updated
        setActiveStore(prev => {
          if (!prev) {
            // Check location state for preferred store
            const state = location.state as any;
            if (state?.activeStore) {
              return fetchedStores.find(s => s.id === state.activeStore.id) || fetchedStores[0];
            }
            return fetchedStores[0];
          }
          return fetchedStores.find(s => s.id === prev.id) || fetchedStores[0];
        });
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'supplier-stores');
      setLoading(false);
    });

    fetchEngagementStats();
    
    // Handle navigation triggers from location state
    const state = location.state as any;
    if (state) {
      if (state.editProduct) {
        handleOpenForm(state.editProduct);
      } else if (state.showProductForm) {
        handleOpenForm();
      }
    }

    return () => storesUnsub();
  }, [profile.uid, location.key]);

  // Real-time Products Listener for Active Store
  useEffect(() => {
    if (!activeStore?.id) return;
    
    const productsQuery = query(collection(db, 'products'), where('storeId', '==', activeStore.id));
    const productsUnsub = onSnapshot(productsQuery, (snap) => {
      setProducts(snap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `supplier-products-${activeStore.id}`);
    });

    return () => productsUnsub();
  }, [activeStore?.id]);

  const fetchEngagementStats = async () => {
    try {
      const q = query(collection(db, 'engagements'), where('supplierId', '==', profile.uid));
      const snap = await getDocs(q);
      const stats = { engaged: 0, interested: 0 };
      snap.docs.forEach(d => {
        const data = d.data();
        if (data.type === 'engaged') stats.engaged++;
        if (data.type === 'interested') stats.interested++;
      });
      setEngagementStats(stats);
    } catch (e) {
      console.error("Error fetching engagement stats:", e);
    }
  };

  const handleSaveStore = async () => {
    if (!activeStore || Object.keys(storeEditData).length === 0) {
      setIsEditingStore(false);
      return;
    }
    
    setIsSavingStore(true);
    try {
      let data = {
        ...storeEditData,
        updatedAt: new Date().toISOString()
      };

      if (storeEditData.lat && storeEditData.lng) {
        (data as any).geohash = geohashForLocation([storeEditData.lat, storeEditData.lng]);
      }

      await offlineResilientWrite('stores', activeStore.id, 'update', data);
      setIsEditingStore(false);
      setStoreEditData({});
    } catch (e) {
      handleFirestoreError(e, OperationType.UPDATE, `stores/${activeStore.id}`);
    } finally {
      setIsSavingStore(false);
    }
  };

  const switchStore = (store: Store) => {
    setActiveStore(store);
  };

  const handleOpenForm = (product?: Product) => {
    if (product) {
      setEditingProduct(product);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price,
        currency: product.currency,
        category: PRODUCT_CATEGORIES.includes(product.category) ? product.category : 'Other',
        images: product.images,
        buyButtonType: product.buyButtonType,
        buyButtonLink: product.buyButtonLink || '',
        isActive: product.isActive
      });
      if (!PRODUCT_CATEGORIES.includes(product.category)) {
        setCustomCategory(product.category);
      } else {
        setCustomCategory('');
      }
    } else {
      setEditingProduct(null);
      setFormData(initialForm);
      setCustomCategory('');
    }
    setShowProductForm(true);
  };

  const removeProductImage = (index: number) => {
    setFormData(prev => ({
      ...prev,
      images: prev.images.filter((_, i) => i !== index)
    }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!activeStore) return;
    setIsSubmitting(true);

    try {
      const finalCategory = formData.category === 'Other' ? customCategory : formData.category;
      
      const data = {
        ...formData,
        category: finalCategory,
        storeId: activeStore.id,
        ownerId: profile.uid,
        images: formData.images.length > 0 ? formData.images : [`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(formData.name)}`],
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        await offlineResilientWrite('products', editingProduct.id, 'update', data);
      } else {
        const newId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        await offlineResilientWrite('products', newId, 'create', {
          ...data,
          id: newId,
          createdAt: new Date().toISOString()
        });
      }
      
      setShowProductForm(false);
    } catch (e) {
      handleFirestoreError(e, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await offlineResilientWrite('products', id, 'delete');
      setProductToDelete(null);
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
    }
  };

  const handleShareStore = () => {
    if (!activeStore) return;
    const shareUrl = `${window.location.origin}/store/${activeStore.id}`;
    if (navigator.share) {
      navigator.share({
        title: activeStore.name,
        text: `Visit our store ${activeStore.name} on Comfort Business Hub!`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Store Link Copied to Clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Decrypting Dashboard...</p>
      </div>
    );
  }

  if (!activeStore) {
    if (showStoreSetup) {
      return (
        <div className="relative">
          <button 
            onClick={() => setShowStoreSetup(false)}
            className="absolute top-4 right-4 z-10 p-2 text-gray-500 hover:text-white"
          >
            <X size={24} />
          </button>
          <SupplierSetup profile={profile} />
        </div>
      );
    }
    return (
      <div className="p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-gray-700">
          <StoreIcon size={40} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-black text-white uppercase tracking-widest">No Node Profiles Detected</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Initialize your first supply chain node to start trading</p>
        </div>
        <button 
          onClick={() => setShowStoreSetup(true)}
          className="btn-neon px-8 py-4 text-xs"
        >
          Initialize Matrix Node
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 pb-32">
      {/* Identity Verification Warning */}
      {!profile.isVerified && (
        <section className="bg-red-500/10 border border-red-500/20 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-red-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-red-500/10 transition-colors"></div>
          <div className="w-14 h-14 bg-red-500/20 rounded-2xl flex items-center justify-center text-red-500 flex-shrink-0 animate-pulse shadow-[0_0_20px_rgba(239,68,68,0.2)]">
            <Shield size={28} />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Identity Verification Required</h3>
            <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest leading-relaxed">
              Your supply chain node is in <span className="text-red-500">Read-Only mode</span>. Verify your email in the Matrix console to unlock production-grade inventory writes and trading protocols.
            </p>
          </div>
          <button 
            onClick={() => window.open('https://mail.google.com', '_blank')}
            className="px-6 py-3 bg-red-500 hover:bg-red-400 text-white text-[9px] font-black uppercase tracking-[0.2em] rounded-xl transition-all active:scale-95 shadow-lg shadow-red-500/20"
          >
            Check Signals
          </button>
        </section>
      )}

      {/* Store Selection & Multiple Stores Support */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Operational Nodes ({stores.length})</h2>
          <button 
            onClick={() => setShowStoreSetup(true)}
            className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
          >
            <Plus size={14} /> New Node
          </button>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {stores.map((s) => (
            <button
              key={s.id}
              onClick={() => switchStore(s)}
              className={cn(
                "px-5 py-3 rounded-2xl border transition-all flex flex-col items-start gap-1 min-w-[140px]",
                activeStore.id === s.id 
                  ? "bg-primary/10 border-primary text-primary" 
                  : "bg-white/5 border-white/5 text-gray-500 hover:border-white/10"
              )}
            >
              <span className="text-[10px] font-black uppercase tracking-widest line-clamp-1">{s.name}</span>
              <span className="text-[8px] font-bold opacity-60 italic">{s.category}</span>
            </button>
          ))}
        </div>
      </section>

      {/* Store Header */}
      <section className="neon-card p-0 relative overflow-hidden group min-h-[300px] flex flex-col">
        {/* Background Cover */}
        <div className="absolute inset-0 z-0">
          <img 
            src={(isEditingStore && storeEditData.coverPhoto) ? storeEditData.coverPhoto : (activeStore.coverPhoto || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80")} 
            className="w-full h-full object-cover opacity-30 group-hover:opacity-40 transition-opacity duration-700 brightness-75 saturate-[1.2]" 
            alt="Cover" 
            referrerPolicy="no-referrer"
            onError={(e) => {
              const target = e.target as HTMLImageElement;
              target.src = "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80";
            }}
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#0d1117] via-[#0d1117]/60 to-transparent"></div>
        </div>

        {isEditingStore ? (
          <div className="relative z-10 p-6 sm:p-8 space-y-6 bg-black/40 backdrop-blur-md flex-1">
            <div className="flex flex-col md:flex-row gap-6">
              <div className="w-24 h-24 flex-shrink-0">
                <ImageInput 
                  value={storeEditData.logo ?? activeStore.logo ?? ''} 
                  onChange={(val) => setStoreEditData(prev => ({ ...prev, logo: val }))}
                  aspectRatio="square"
                  className="w-full h-full border-primary/20"
                  label="Node Logo"
                />
              </div>
              <div className="flex-1 w-full">
                <ImageInput 
                  value={storeEditData.coverPhoto ?? activeStore.coverPhoto ?? ''} 
                  onChange={(val) => setStoreEditData(prev => ({ ...prev, coverPhoto: val }))}
                  aspectRatio="video"
                  label="Matrix Cover Area"
                  className="w-full border-primary/20"
                />
              </div>
            </div>
            <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Node Identifier</label>
                    <input 
                      type="text"
                      value={storeEditData.name ?? activeStore.name}
                      onChange={e => setStoreEditData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 font-bold italic"
                    />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Operational Sector</label>
                    <select 
                      className="w-full bg-[#0d1117] border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-bold appearance-none cursor-pointer"
                      value={storeEditData.category ?? activeStore.category}
                      onChange={e => setStoreEditData(prev => ({ ...prev, category: e.target.value }))}
                    >
                      {BUSINESS_CATEGORIES.map(cat => (
                        <option key={cat} value={cat} className="bg-[#0d1117] text-white py-2">{cat}</option>
                      ))}
                    </select>
                  </div>
                </div>
                <div className="space-y-1">
                  <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Operational Description</label>
                  <textarea 
                    value={storeEditData.description ?? activeStore.description}
                    onChange={e => setStoreEditData(prev => ({ ...prev, description: e.target.value }))}
                    rows={2}
                    className="w-full bg-white/5 border border-white/10 rounded-xl px-4 py-3 text-white outline-none focus:border-primary/50 text-xs font-medium"
                  />
                </div>

                <div className="space-y-4 pt-4 border-t border-white/5">
                   <div className="flex items-center justify-between">
                     <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Geographic Coordinates</label>
                     <button 
                      type="button"
                      onClick={() => setIsEditingLocation(!isEditingLocation)}
                      className="text-[9px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5"
                     >
                       {isEditingLocation ? 'Lock Node' : 'Update Node Position'}
                     </button>
                   </div>
                   
                   {isEditingLocation ? (
                     <LocationPicker 
                       initialLat={storeEditData.lat ?? activeStore.lat}
                       initialLng={storeEditData.lng ?? activeStore.lng}
                       onLocationSelect={(lat, lng, address) => {
                         setStoreEditData(prev => ({ ...prev, lat, lng, address }));
                       }}
                     />
                   ) : (
                     <div className="flex items-center gap-3 p-4 bg-white/5 border border-white/5 rounded-2xl">
                       <MapPin size={18} className="text-primary" />
                       <div>
                         <p className="text-[10px] text-white font-bold italic">{(storeEditData as any).address || activeStore.address || 'Standard Hub Position'}</p>
                         <p className="text-[8px] text-gray-500 font-mono mt-0.5">LAT: {storeEditData.lat ?? activeStore.lat} | LNG: {storeEditData.lng ?? activeStore.lng}</p>
                       </div>
                     </div>
                   )}
                </div>
              </div>
            <div className="flex gap-3 justify-end pt-2">
              <button 
                onClick={() => { setIsEditingStore(false); setStoreEditData({}); }}
                className="px-6 py-3 text-[10px] font-black text-gray-400 uppercase tracking-widest bg-white/5 rounded-xl border border-white/5 hover:bg-white/10 transition-all"
              >
                Cancel
              </button>
              <button 
                onClick={handleSaveStore}
                disabled={isSavingStore}
                className="px-8 py-3 btn-neon text-[10px] font-black uppercase tracking-widest flex items-center gap-2 shadow-lg shadow-primary/20"
              >
                {isSavingStore ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Commit Node Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="p-6 sm:p-8 relative z-10 flex flex-col justify-end flex-1">
            <div className="flex items-center gap-6">
              <div className="w-20 h-20 sm:w-28 sm:h-28 bg-[#05070a]/80 backdrop-blur-xl rounded-3xl border border-primary/30 flex items-center justify-center text-3xl font-black text-primary italic overflow-hidden shadow-2xl">
                {activeStore.logo ? (
                  <img 
                    src={activeStore.logo} 
                    className="w-full h-full object-cover" 
                    referrerPolicy="no-referrer" 
                    onError={(e) => {
                      const target = e.target as HTMLImageElement;
                      target.src = "https://api.dicebear.com/7.x/initials/svg?seed=" + activeStore.name;
                    }}
                  />
                ) : activeStore.name.charAt(0)}
              </div>
              <div className="space-y-1.5 flex-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h1 className="text-2xl sm:text-4xl font-black text-white italic uppercase tracking-tighter leading-none shadow-black drop-shadow-lg">{activeStore.name}</h1>
                    <p className="text-[10px] text-primary font-black uppercase tracking-widest mt-2 bg-primary/10 w-fit px-2 py-0.5 rounded border border-primary/20">{activeStore.category} Sector Hub</p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleShareStore}
                      className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white hover:text-primary hover:border-primary/50 transition-all hover:scale-110 active:scale-95 shadow-xl"
                      title="Share Store Link"
                    >
                      <Share2 size={18} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingStore(true);
                        setStoreEditData({});
                      }}
                      className="p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white hover:text-primary hover:border-primary/50 transition-all hover:scale-110 active:scale-95 shadow-xl"
                      title="Edit Store Profile"
                    >
                      <Edit3 size={18} />
                    </button>
                  </div>
                </div>
                
                <div className="flex items-center gap-4 pt-3 flex-wrap">
                  <div className="flex items-center gap-2">
                    <div className="w-2 h-2 bg-neon-green rounded-full shadow-[0_0_10px_#39FF14] animate-pulse"></div>
                    <span className="text-[9px] font-black uppercase text-white tracking-widest">Active Status</span>
                  </div>
                  <div className="flex items-center gap-2 px-2 py-0.5 bg-primary/10 border border-primary/20 rounded text-[8px] font-black text-primary uppercase tracking-widest animate-pulse">
                    <Sparkles size={10} /> Live on Discovery Explorer
                  </div>
                  <div className="flex items-center gap-2 text-[9px] text-gray-300 font-bold uppercase tracking-widest bg-black/20 px-2.5 py-1 rounded-lg border border-white/5">
                    <MapPin size={10} className="text-primary" /> {activeStore.address || 'Matrix Location'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-8 border-t border-white/10 pt-6">
               <p className="text-xs text-gray-300 font-medium max-w-2xl leading-relaxed drop-shadow-lg">
                 {activeStore.description}
               </p>
            </div>
          </div>
        )}
      </section>

      {/* Analytics Brief */}
      <section className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="neon-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <DollarSign size={16} className="text-primary" />
            <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">+12%</span>
          </div>
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Volume (MTD)</p>
          <p className="text-xl font-black text-white italic tracking-tighter">$12.4K</p>
        </div>
        <div className="neon-card p-4 space-y-2">
          <div className="flex items-center justify-between">
            <Package size={16} className="text-primary" />
            <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">LIVE</span>
          </div>
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Items Active</p>
          <p className="text-xl font-black text-white italic tracking-tighter">{products.length}</p>
        </div>
        <div className="neon-card p-4 space-y-2 border-primary/20 bg-primary/5">
          <div className="flex items-center justify-between">
            <MessageSquare size={16} className="text-primary" />
            <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(0,242,254,0.5)]"></div>
          </div>
          <p className="text-[9px] font-black text-primary uppercase tracking-widest">Product Engaged</p>
          <p className="text-xl font-black text-white italic tracking-tighter">{engagementStats.engaged}</p>
        </div>
        <div className="neon-card p-4 space-y-2 border-accent/20 bg-accent/5">
          <div className="flex items-center justify-between">
            <ShoppingBag size={16} className="text-accent" />
            <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(240,147,251,0.5)]"></div>
          </div>
          <p className="text-[9px] font-black text-accent uppercase tracking-widest">Interested to Buy</p>
          <p className="text-xl font-black text-white italic tracking-tighter">{engagementStats.interested}</p>
        </div>
      </section>

      {/* Product List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-white uppercase tracking-tighter text-lg">Inventory Matrix</h2>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded border border-primary/20 uppercase tracking-widest">{products.length} Items</span>
          </div>
          <button 
            onClick={() => handleOpenForm()}
            className="w-10 h-10 bg-primary/20 rounded-xl border border-primary/20 flex items-center justify-center text-primary hover:bg-primary hover:text-[#05070a] transition-all"
          >
            <Plus size={20} />
          </button>
        </div>

        <div className="space-y-4">
          {products.map((product, index) => (
            <motion.div 
              key={product.id}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.05 }}
              layout
              className="neon-card p-4 flex gap-4 items-center group"
            >
              <div className="w-16 h-16 bg-white/5 rounded-xl overflow-hidden border border-white/5">
                <img 
                  src={product.images[0]} 
                  className="w-full h-full object-cover" 
                  alt={product.name} 
                  referrerPolicy="no-referrer" 
                  onError={(e) => {
                    const target = e.target as HTMLImageElement;
                    target.src = "https://images.unsplash.com/photo-1541701494587-cb58502866ab?q=80&w=400&auto=format&fit=crop";
                  }}
                />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-black text-white italic uppercase tracking-wider text-xs">{product.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-black text-sm tracking-tighter">{formatCurrency(product.price, product.currency)}</span>
                  <div className="flex items-center gap-2">
                    <span className={cn(
                      "px-1.5 py-0.5 text-[7px] font-black rounded uppercase tracking-widest",
                      product.isActive ? "bg-neon-green/10 text-neon-green" : "bg-red-500/10 text-red-500"
                    )}>
                      {product.isActive ? 'Active' : 'Offline'}
                    </span>
                    {product.isActive && (
                      <span className="px-1.5 py-0.5 text-[7px] font-black rounded bg-primary/10 text-primary uppercase tracking-widest flex items-center gap-1">
                        <Sparkles size={8} /> Live on Discovery
                      </span>
                    )}
                  </div>
                </div>
              </div>
              <div className="flex items-center gap-2 opacity-50 group-hover:opacity-100 transition-opacity">
                <button 
                  onClick={() => handleOpenForm(product)}
                  className="p-2 hover:text-primary transition-colors"
                >
                  <Edit3 size={16} />
                </button>
                <button 
                  onClick={() => setProductToDelete(product)}
                  className="p-2 hover:text-red-500 transition-colors"
                >
                  <Trash2 size={16} />
                </button>
              </div>
            </motion.div>
          ))}

          {products.length === 0 && (
            <div className="neon-card p-12 text-center space-y-4 border-dashed border-2 border-white/5">
              <div className="w-16 h-16 bg-white/5 rounded-full flex items-center justify-center mx-auto text-gray-700">
                <Package size={32} />
              </div>
              <div className="space-y-1">
                <p className="text-xs font-black text-white/50 uppercase tracking-widest">No Items Identified</p>
                <p className="text-[10px] text-gray-600">Start populating your supply matrix</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal for Store Setup Overlay */}
      <AnimatePresence>
        {showStoreSetup && (
          <div className="fixed inset-0 z-[100] bg-[#05070a] overflow-y-auto">
            <div className="max-w-2xl mx-auto py-12 px-4 shadow-2xl">
               <button 
                onClick={() => {
                  setShowStoreSetup(false);
                  setIsEditingStore(false);
                }}
                className="absolute top-6 right-6 z-[110] p-2 text-gray-500 hover:text-white bg-white/5 rounded-full border border-white/10 hover:border-primary/50 transition-all"
              >
                <X size={24} />
              </button>
              <SupplierSetup 
                profile={profile} 
                existingStore={isEditingStore ? activeStore : undefined}
                onComplete={() => {
                  setShowStoreSetup(false);
                  setIsEditingStore(false);
                }} 
              />
            </div>
          </div>
        )}
      </AnimatePresence>

      {/* Product Form Modal */}
      <AnimatePresence>
        {showProductForm && (
          <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md"
              onClick={() => setShowProductForm(false)}
            />
              <motion.div 
                initial={{ opacity: 0, scale: 0.9, y: 20 }}
                animate={{ opacity: 1, scale: 1, y: 0 }}
                exit={{ opacity: 0, scale: 0.9, y: 20 }}
                className="relative w-full max-w-lg neon-card !bg-[#0d1117] p-0 max-h-[90vh] flex flex-col overflow-hidden shadow-2xl border border-white/10"
              >
                {/* Sticky Header */}
                <div className="p-6 border-b border-white/5 relative z-10 bg-[#0d1117]/80 backdrop-blur-md flex justify-between items-start">
                  <header className="space-y-1">
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">
                      {editingProduct ? 'Edit Entity' : 'New Matrix Entry'}
                    </h3>
                    <p className="text-[9px] text-primary/60 font-bold uppercase tracking-widest">Operational Parameters Identification</p>
                  </header>
                  <button 
                    onClick={() => setShowProductForm(false)}
                    className="text-gray-400 hover:text-white bg-white/5 p-2 rounded-xl border border-white/10 transition-all hover:scale-110 active:scale-95"
                  >
                    <X size={20} />
                  </button>
                </div>

                {/* Scrollable Form Content */}
                <div className="flex-1 overflow-y-auto p-6 md:p-8 custom-scrollbar scroll-smooth overscroll-behavior-contain">
                  <form id="product-form" onSubmit={handleSubmit} className="space-y-6">
                    <div className="space-y-6">
                      {/* Image Matrix Upload */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">Visual Matrix ({formData.images.length}/5)</label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {formData.images.map((img, idx) => (
                            <div key={idx} className="relative">
                              <ImageInput 
                                value={img} 
                                onChange={(val) => {
                                  const newImages = [...formData.images];
                                  if (val) {
                                    newImages[idx] = val;
                                  } else {
                                    newImages.splice(idx, 1);
                                  }
                                  setFormData({ ...formData, images: newImages });
                                }} 
                                aspectRatio="square"
                              />
                            </div>
                          ))}
                          
                          {formData.images.length < 5 && (
                            <div className="relative">
                              <ImageInput 
                                value="" 
                                onChange={(val) => {
                                  if (val) {
                                    setFormData({ ...formData, images: [...formData.images, val] });
                                  }
                                }} 
                                aspectRatio="square"
                                label="Add Asset"
                              />
                            </div>
                          )}
                        </div>
                      </div>

                      <div className="space-y-4">
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Item Name</label>
                          <input 
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic transition-all"
                            placeholder="e.g. 5KVA Inverter System"
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Data Description</label>
                          <textarea 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-sm min-h-[100px] transition-all"
                            placeholder="Full technical specifications..."
                            rows={3}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            required
                          />
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Unit Price</label>
                            <div className="relative">
                              <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                              <input 
                                type="number"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:border-primary/50 font-mono"
                                placeholder="0.00"
                                value={formData.price || ''}
                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) })}
                                required
                              />
                            </div>
                          </div>
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Currency</label>
                            <select 
                              className="w-full bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-bold appearance-none cursor-pointer shadow-xl"
                              value={formData.currency}
                              onChange={e => setFormData({ ...formData, currency: e.target.value })}
                            >
                              <option value="USD" className="bg-[#0d1117] text-white py-2">USD (US Dollar)</option>
                              <option value="ZiG" className="bg-[#0d1117] text-white py-2">ZiG (Zimbabwe Gold)</option>
                            </select>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Category Alignment</label>
                          <select 
                            className="w-full bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-bold appearance-none cursor-pointer shadow-xl"
                            value={formData.category}
                            onChange={e => setFormData({ ...formData, category: e.target.value })}
                          >
                            {PRODUCT_CATEGORIES.map(cat => (
                              <option key={cat} value={cat} className="bg-[#0d1117] text-white py-2">{cat}</option>
                            ))}
                            <option value="Other" className="bg-[#0d1117] text-white py-2">Custom Category...</option>
                          </select>
                        </div>

                        {formData.category === 'Other' && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Define Custom Category</label>
                            <input 
                              type="text"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic text-xs transition-all"
                              placeholder="Enter specific category name"
                              value={customCategory}
                              onChange={e => setCustomCategory(e.target.value)}
                              required
                            />
                          </div>
                        )}

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Buy Logic Gateway</label>
                          <div className="grid grid-cols-3 md:grid-cols-5 gap-2">
                            {[
                              { id: 'checkout', icon: ShoppingBag, label: 'Direct' },
                              { id: 'chat', icon: MessageSquare, label: 'Inbox' },
                              { id: 'link', icon: LinkIcon, label: 'Gateway' },
                              { id: 'ecocash', icon: Phone, label: 'EcoCash' },
                              { id: 'pod', icon: Package, label: 'POD' }
                            ].map((t) => (
                              <button
                                key={t.id}
                                type="button"
                                onClick={() => setFormData({ ...formData, buyButtonType: t.id as BuyButtonType })}
                                className={cn(
                                  "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all hover:scale-105 active:scale-95",
                                  formData.buyButtonType === t.id 
                                    ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(0,242,254,0.1)]" 
                                    : "bg-white/5 border-white/5 text-gray-500"
                                )}
                              >
                                <t.icon size={18} />
                                <span className="text-[8px] font-black uppercase tracking-widest">{t.label}</span>
                              </button>
                            ))}
                          </div>
                        </div>

                        {formData.buyButtonType === 'link' && (
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">External Matrix Link</label>
                            <input 
                              type="url"
                              className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-mono transition-all"
                              placeholder="https://payments.gateway.zw/..."
                              value={formData.buyButtonLink}
                              onChange={e => setFormData({ ...formData, buyButtonLink: e.target.value })}
                              required
                            />
                          </div>
                        )}

                        <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5 hover:border-white/10 transition-colors cursor-pointer group" onClick={() => setFormData({ ...formData, isActive: !formData.isActive })}>
                          <input 
                            type="checkbox"
                            id="isActive"
                            className="w-5 h-5 accent-primary bg-transparent rounded border-white/10 cursor-pointer"
                            checked={formData.isActive}
                            onChange={e => {
                               e.stopPropagation();
                               setFormData({ ...formData, isActive: e.target.checked });
                            }}
                          />
                          <label htmlFor="isActive" className="text-[10px] font-black text-white uppercase tracking-widest cursor-pointer group-hover:text-primary transition-colors">Online Availability</label>
                        </div>
                      </div>
                    </div>
                  </form>
                </div>

                {/* Sticky Footer */}
                <div className="p-6 border-t border-white/5 bg-[#0d1117]/80 backdrop-blur-md">
                  <button 
                    type="submit"
                    form="product-form"
                    disabled={isSubmitting}
                    className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3 transition-all transform active:scale-95 shadow-xl disabled:opacity-50"
                  >
                    {isSubmitting ? (
                      <Loader2 className="animate-spin" size={20} />
                    ) : (
                      <>
                        {editingProduct ? <Check size={20} /> : <Plus size={20} />}
                        {editingProduct ? 'Update Listing' : 'Initialize Matrix Entry'}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div className="fixed inset-0 z-[60] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05070a]/95 backdrop-blur-xl"
              onClick={() => setProductToDelete(null)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-sm neon-card !bg-red-950/10 !border-red-500/20 p-8 text-center space-y-6"
            >
              <div className="w-16 h-16 bg-red-500/10 rounded-full flex items-center justify-center mx-auto text-red-500">
                <Trash2 size={32} className="animate-pulse" />
              </div>
              
              <div className="space-y-2">
                <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">Decommission Entity?</h3>
                <p className="text-[10px] text-red-400 font-bold uppercase tracking-widest leading-relaxed">
                  Warning: This action is irreversible. The listing <span className="text-white italic">"{productToDelete.name}"</span> will be completely purged from the operational matrix.
                </p>
              </div>

              <div className="flex flex-col gap-3">
                <button 
                  onClick={() => handleDeleteProduct(productToDelete.id)}
                  className="w-full bg-red-500 hover:bg-red-600 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all transform active:scale-95 shadow-[0_0_20px_rgba(239,68,68,0.3)]"
                >
                  Confirm Permanent Delete
                </button>
                <button 
                  onClick={() => setProductToDelete(null)}
                  className="w-full bg-white/5 hover:bg-white/10 text-white font-black py-4 rounded-2xl uppercase tracking-widest text-[10px] transition-all border border-white/5"
                >
                  Abort Protocol
                </button>
              </div>
            </motion.div>
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}

function Loader2Component({ className, size = 20 }: { className?: string, size?: number }) {
  return <Loader2 className={cn("animate-spin", className)} size={size} />;
}
