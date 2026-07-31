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
  Sparkles,
  Zap,
  RefreshCw,
  Wrench,
  HelpCircle
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
import { executeShare, getStoreSharePayload } from '../lib/shareUtils';
import { useNotifications } from '../components/NotificationProvider';
import { PRODUCT_CATEGORIES, BUSINESS_CATEGORIES } from '../constants';
import SupplierSetup from './SupplierSetup';
import { offlineResilientWrite } from '../lib/sync';
import { localDB } from '../lib/db';
import ImageInput from '../components/ImageInput';
import LocationPicker from '../components/LocationPicker';
import { geohashForLocation } from 'geofire-common';
import { MapContainer, TileLayer, Marker } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import { useLocation } from 'react-router-dom';
import MarketTrendsChart from '../components/MarketTrendsChart';

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
  quantityUnit?: string;
  category: string;
  images: string[];
  buyButtonType: BuyButtonType;
  buyButtonLink: string;
  isActive: boolean;
  itemType: 'product' | 'service';
  pricingOption: 'fixed' | 'negotiable' | 'installments' | 'contact_seller_for_price';
}

const PRESET_QUANTITY_UNITS = [
  'per item',
  'per kg',
  'per tonne',
  'per night',
  'per day',
  'per session',
  'per box',
  'per litre'
];

const initialForm: ProductForm = {
  name: '',
  description: '',
  price: 0,
  currency: 'USD',
  quantityUnit: 'per item',
  category: 'Electronics',
  images: [],
  buyButtonType: 'chat',
  buyButtonLink: '',
  isActive: true,
  itemType: 'product',
  pricingOption: 'fixed'
};

export default function SupplierDashboard({ profile }: { profile: UserProfile }) {
  const location = useLocation();
  const { triggerFeedback } = useNotifications();
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
  const [isWaitingForSync, setIsWaitingForSync] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const [customQuantityUnit, setCustomQuantityUnit] = useState('');
  const [isEditingLocation, setIsEditingLocation] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [waUrl, setWaUrl] = useState('');
  const [isWaParsing, setIsWaParsing] = useState(false);
  const [waImportedProducts, setWaImportedProducts] = useState<any[]>([]);
  const [waError, setWaError] = useState<string | null>(null);

  const [engagementStats, setEngagementStats] = useState({ engaged: 0, interested: 0, volume: 0 });

  const [waitingForId, setWaitingForId] = useState<string | null>(null);

  // Autosave product form draft to localStorage
  useEffect(() => {
    if (showProductForm && !editingProduct) {
      if (formData.name !== '' || formData.description !== '' || formData.images.length > 0) {
        localStorage.setItem('supplier_product_form_draft', JSON.stringify({
          formData,
          customCategory
        }));
      }
    }
  }, [formData, showProductForm, editingProduct, customCategory]);

  useEffect(() => {
    setLoading(true);
    // Real-time Stores Listener
    const storesQuery = query(collection(db, 'stores'), where('ownerId', '==', profile.uid));
    const storesUnsub = onSnapshot(storesQuery, (snap) => {
      const fetchedStores = snap.docs.map(d => ({ id: d.id, ...d.data() } as Store));
      setStores(fetchedStores);
      
      if (fetchedStores.length > 0) {
        setIsWaitingForSync(false);
        // Set active store
        setActiveStore(prev => {
          // 1. If we were waiting for a specific ID, select it
          if (waitingForId) {
            const target = fetchedStores.find(s => s.id === waitingForId);
            if (target) {
              setWaitingForId(null);
              return target;
            }
          }

          // 2. If we had an active store, stay on it if still exists
          if (prev) {
            return fetchedStores.find(s => s.id === prev.id) || fetchedStores[0];
          }

          // 3. Fallback to selection logic from state or first store
          const state = location.state as any;
          if (state?.activeStore) {
            return fetchedStores.find(s => s.id === state.activeStore.id) || fetchedStores[0];
          }
          return fetchedStores[0];
        });
      }
      setLoading(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, 'supplier-stores');
      setLoading(false);
    });

    return () => storesUnsub();
  }, [profile.uid, location.key, waitingForId]);

  // Real-time Products Listener for Active Store
  useEffect(() => {
    if (!activeStore?.id) return;
    
    // Engagement stats listener
    const q = query(collection(db, 'engagements'), where('supplierId', '==', profile.uid));
    const unsubEng = onSnapshot(q, (snap) => {
      const stats = { engaged: 0, interested: 0, volume: 0 };
      
      // Get the last reset timestamp for this store (if any)
      const resetAt = activeStore.statsResetAt ? new Date(activeStore.statsResetAt) : new Date(0);

      snap.docs.forEach(d => {
        const data = d.data();
        const createdAt = data.createdAt?.toDate ? data.createdAt.toDate() : new Date(data.createdAt || 0);
        
        if (createdAt >= resetAt) {
          if (data.type === 'engaged') stats.engaged++;
          if (data.type === 'interested') stats.interested++;
          if (data.type === 'order_now') {
            stats.volume += data.price || 0;
            // Also count order_now as interested for the "Interested to Buy" stat if needed, 
            // but the user said "Interested to Buy" should be "interested" type clicks?
            // Actually they said "Active Leads should be number of clicks on the 'engage' button".
          }
        }
      });
      setEngagementStats(stats);
    });
    
    const productsQuery = query(collection(db, 'products'), where('storeId', '==', activeStore.id));
    
    // 1. Instantly pull and render from saved app files for super fast, zero-delay preview!
    localDB.cache
      .where('collection')
      .equals('products')
      .toArray()
      .then((cachedDocs) => {
        const storeCachedProducts = cachedDocs
          .map((item) => item.data as Product)
          .filter((p) => p.storeId === activeStore.id);
        
        if (storeCachedProducts.length > 0) {
          storeCachedProducts.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());
          setProducts(storeCachedProducts);
        }
      })
      .catch((e) => console.error('[Cache] Failed loading cached products:', e));

    const productsUnsub = onSnapshot(productsQuery, async (snap) => {
      const dbProducts = snap.docs.map(d => ({ id: d.id, ...d.data() } as Product));
      
      // 2. Refresh localDB cache values in background with clean database references
      for (const p of dbProducts) {
        await localDB.cache.put({
          id: `products:${p.id}`,
          collection: 'products',
          docId: p.id,
          data: p,
          updatedAt: Date.now()
        });
      }

      // 3. Keep any cached/outbox items that are optimistic or offline drafts
      const cachedDocs = await localDB.cache.where('collection').equals('products').toArray();
      const storeCachedProducts = cachedDocs
        .map((item) => item.data as Product)
        .filter((p) => p.storeId === activeStore.id);

      const mergedMap = new Map<string, Product>();
      storeCachedProducts.forEach(p => mergedMap.set(p.id, p));
      dbProducts.forEach(p => mergedMap.set(p.id, p));

      const mergedProducts = Array.from(mergedMap.values());
      mergedProducts.sort((a, b) => new Date(b.createdAt || b.updatedAt).getTime() - new Date(a.createdAt || a.updatedAt).getTime());

      setProducts(mergedProducts);
      setIsWaitingForSync(false);
    }, (err) => {
      handleFirestoreError(err, OperationType.GET, `supplier-products-${activeStore.id}`);
    });

    return () => {
      productsUnsub();
      unsubEng();
    };
  }, [activeStore?.id, activeStore?.statsResetAt]);

  const handleResetStats = async () => {
    if (!activeStore) return;
    try {
      await updateDoc(doc(db, 'stores', activeStore.id), {
        statsResetAt: new Date().toISOString()
      });
    } catch (err) {
      handleFirestoreError(err, OperationType.UPDATE, `stores/${activeStore.id}`);
    }
  };

  const handleSaveStore = async () => {
    if (!activeStore || Object.keys(storeEditData).length === 0) {
      setIsEditingStore(false);
      return;
    }
    
    if (document.querySelectorAll('[data-uploading="true"]').length > 0) {
      alert("Please wait for store images to finish saving before saving.");
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
      const prodUnit = product.quantityUnit || 'per item';
      const isPresetUnit = PRESET_QUANTITY_UNITS.includes(prodUnit);
      setFormData({
        name: product.name,
        description: product.description,
        price: product.price || 0,
        currency: product.currency || 'USD',
        quantityUnit: isPresetUnit ? prodUnit : 'custom',
        category: PRODUCT_CATEGORIES.includes(product.category) ? product.category : 'Other',
        images: product.images,
        buyButtonType: product.buyButtonType,
        buyButtonLink: product.buyButtonLink || '',
        isActive: product.isActive,
        itemType: product.itemType || 'product',
        pricingOption: product.pricingOption || 'fixed'
      });
      if (!isPresetUnit) {
        setCustomQuantityUnit(prodUnit);
      } else {
        setCustomQuantityUnit('');
      }
      if (!PRODUCT_CATEGORIES.includes(product.category)) {
        setCustomCategory(product.category);
      } else {
        setCustomCategory('');
      }
    } else {
      setEditingProduct(null);
      // Auto-load product creation draft from saved app files if available
      const cachedDraft = localStorage.getItem('supplier_product_form_draft');
      if (cachedDraft) {
        try {
          const parsed = JSON.parse(cachedDraft);
          if (parsed.formData) {
            setFormData(parsed.formData);
            setCustomCategory(parsed.customCategory || '');
            setCustomQuantityUnit(parsed.customQuantityUnit || '');
            triggerFeedback('Draft Restored', 'Unsaved product parameters resumed from saved app files.', 'message');
          } else {
            setFormData(initialForm);
            setCustomCategory('');
            setCustomQuantityUnit('');
          }
        } catch (e) {
          setFormData(initialForm);
          setCustomCategory('');
          setCustomQuantityUnit('');
        }
      } else {
        setFormData(initialForm);
        setCustomCategory('');
        setCustomQuantityUnit('');
      }
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
    if (!activeStore || !profile) return;
    
    if (document.querySelectorAll('[data-uploading="true"]').length > 0) {
      alert("Please wait for your images to finish saving before saving. It should take a few seconds.");
      return;
    }
    
    setIsSubmitting(true);

    try {
      const finalCategory = formData.category === 'Other' ? customCategory : formData.category;
      const finalQuantityUnit = formData.quantityUnit === 'custom' || (!PRESET_QUANTITY_UNITS.includes(formData.quantityUnit || ''))
        ? (customQuantityUnit.trim() || 'per item')
        : (formData.quantityUnit || 'per item');
      
      const data = {
        ...formData,
        category: finalCategory,
        quantityUnit: finalQuantityUnit,
        storeId: activeStore.id,
        ownerId: profile.uid,
        images: formData.images.length > 0 ? formData.images : [`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(formData.name)}`],
        updatedAt: new Date().toISOString()
      };

      if (editingProduct) {
        const updatedProduct: Product = {
          ...editingProduct,
          ...data,
        } as Product;
        await offlineResilientWrite('products', editingProduct.id, 'update', data);
        setProducts(prev => prev.map(p => p.id === editingProduct.id ? updatedProduct : p));
      } else {
        const newId = `prod_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const newProduct: Product = {
          ...data,
          id: newId,
          createdAt: new Date().toISOString()
        } as Product;
        await offlineResilientWrite('products', newId, 'create', newProduct);
        setProducts(prev => [newProduct, ...prev]);
      }
      
      localStorage.removeItem('supplier_product_form_draft');
      setIsWaitingForSync(false);
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

  const handleShareStore = async () => {
    if (!activeStore) return;
    const payload = getStoreSharePayload({
      id: activeStore.id,
      name: activeStore.name,
      description: activeStore.description,
      logo: activeStore.logo,
      coverPhoto: activeStore.coverPhoto,
      category: activeStore.category,
      verified: activeStore.isVerified
    });
    await executeShare(payload);
  };

  const handleWhatsAppImport = async () => {
    if (!waUrl) return;
    setIsWaParsing(true);
    setWaError(null);
    try {
      const resp = await fetch('/api/import/whatsapp', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ url: waUrl })
      });
      const data: any = await resp.json();
      if (data.error) throw new Error(data.error);
      setWaImportedProducts(data.products || []);
    } catch (err: any) {
      setWaError(err.message || 'Failed to parse catalogue');
    } finally {
      setIsWaParsing(false);
    }
  };

  const commitWaImport = async (selectedIndices: number[]) => {
    if (!activeStore || !profile) return;
    setIsSubmitting(true);
    try {
      const selected = waImportedProducts.filter((_, i) => selectedIndices.includes(i));
      for (const p of selected) {
        const newId = `prod_wa_${Date.now()}_${Math.random().toString(36).substring(7)}`;
        const data = {
          name: p.name,
          description: p.description || '',
          price: p.price,
          currency: p.currency || 'USD',
          category: 'General',
          images: p.image ? [p.image] : [`https://api.dicebear.com/7.x/shapes/svg?seed=${encodeURIComponent(p.name)}`],
          buyButtonType: 'chat' as BuyButtonType,
          buyButtonLink: '',
          isActive: false, // Import as draft (offline)
          storeId: activeStore.id,
          ownerId: profile.uid,
          createdAt: new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          id: newId
        };
        await offlineResilientWrite('products', newId, 'create', data);
      }
      setShowWhatsAppModal(false);
      setWaUrl('');
      setWaImportedProducts([]);
    } catch (err) {
      handleFirestoreError(err, OperationType.CREATE, 'products-bulk-import');
    } finally {
      setIsSubmitting(false);
    }
  };

  if (loading || isWaitingForSync) {
    return (
      <div className="flex flex-col items-center justify-center h-64 space-y-4">
        <div className="w-12 h-12 border-4 border-primary/20 border-t-primary rounded-full animate-spin"></div>
        <p className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
          {isWaitingForSync ? 'Loading...' : 'Loading Dashboard...'}
        </p>
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
          <SupplierSetup 
            profile={profile} 
            onComplete={(newId) => {
              if (newId) setWaitingForId(newId);
              setIsWaitingForSync(true);
              setShowStoreSetup(false);
              triggerFeedback('Store Updated', 'Your store details have been saved.', 'connect_accept');
            }} 
          />
        </div>
      );
    }
    return (
      <div className="p-12 text-center space-y-6">
        <div className="w-20 h-20 bg-white/5 rounded-3xl flex items-center justify-center mx-auto text-gray-700">
          <StoreIcon size={40} />
        </div>
        <div className="space-y-2">
          <p className="text-sm font-black text-white uppercase tracking-widest">No Stores Found</p>
          <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Create your first store to start selling</p>
        </div>
        <button 
          onClick={() => setShowStoreSetup(true)}
          className="btn-neon px-8 py-4 text-xs"
        >
          Create Store
        </button>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-8 pb-32">
      {/* Identity Verification Notice */}
      {!profile.isVerified && (
        <section className="bg-emerald-500/10 border border-emerald-500/20 rounded-[2rem] p-6 flex flex-col md:flex-row items-center gap-6 relative overflow-hidden group">
          <div className="absolute top-0 right-0 w-32 h-32 bg-emerald-500/5 blur-3xl -mr-16 -mt-16 pointer-events-none group-hover:bg-emerald-500/10 transition-colors"></div>
          <div className="w-14 h-14 bg-emerald-500/20 rounded-2xl flex items-center justify-center text-emerald-400 flex-shrink-0 animate-pulse shadow-[0_0_20px_rgba(16,185,129,0.2)]">
            <Shield size={28} />
          </div>
          <div className="flex-1 text-center md:text-left space-y-1">
            <h3 className="text-xs font-black text-white uppercase tracking-widest italic">Store & Inventory Live</h3>
            <p className="text-[10px] text-gray-300 font-bold uppercase tracking-widest leading-relaxed">
              Your store, profile, and products are <span className="text-emerald-400 font-black">Live and functional</span> on the Discovery Network immediately. An Admin will review your profile to issue your <span className="text-emerald-400 font-black">Green Neon Verified Badge</span>.
            </p>
          </div>
          <div className="px-5 py-2.5 bg-emerald-500/20 border border-emerald-400/40 text-emerald-400 text-[9px] font-black uppercase tracking-[0.2em] rounded-xl flex items-center gap-2 shadow-lg shadow-emerald-500/10 shrink-0">
            <Sparkles size={14} /> Pending Verification Badge
          </div>
        </section>
      )}

      {/* Store Selection & Multiple Stores Support */}
      <section className="flex flex-col gap-4">
        <div className="flex items-center justify-between">
          <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Your Stores ({stores.length})</h2>
          <div className="flex items-center gap-3">
            <button 
              onClick={() => {
                if (profile?.uid) {
                  localStorage.removeItem(`supplier_tutorial_dismissed_${profile.uid}`);
                }
                window.dispatchEvent(new CustomEvent('open_supplier_tutorial'));
              }}
              className="flex items-center gap-1.5 text-amber-400 border border-amber-500/30 bg-amber-500/10 px-3 py-1.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-amber-500/20 transition-all shadow-sm"
              title="Open Supplier Tutorial Guide"
            >
              <HelpCircle size={14} /> Supplier Guide
            </button>
            <button 
              onClick={() => setShowStoreSetup(true)}
              className="flex items-center gap-2 text-primary text-[10px] font-black uppercase tracking-widest hover:opacity-80 transition-opacity"
            >
              <Plus size={14} /> New Store
            </button>
          </div>
        </div>
        <div className="flex gap-3 overflow-x-auto no-scrollbar pb-2">
          {Array.from(new Map(stores.filter(s => s && s.id).map(s => [s.id, s])).values()).map((s, idx) => (
            <button
              key={`sup-store-${s.id || idx}-${idx}`}
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
                  label="Store Logo"
                />
              </div>
              <div className="flex-1 w-full">
                <ImageInput 
                  value={storeEditData.coverPhoto ?? activeStore.coverPhoto ?? ''} 
                  onChange={(val) => setStoreEditData(prev => ({ ...prev, coverPhoto: val }))}
                  aspectRatio="video"
                  label="Store Cover Image"
                  className="w-full border-primary/20"
                />
              </div>
            </div>
            <div className="flex-1 space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="space-y-1">
                    <label className="text-[9px] font-black text-gray-500 uppercase tracking-widest ml-1">Store Name</label>
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
                       {isEditingLocation ? 'Save Location' : 'Update Location'}
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
                onClick={() => handleSaveStore()}
                disabled={isSavingStore}
                className="px-8 py-3 rounded-xl text-[10px] font-black uppercase tracking-widest flex items-center gap-2 transition-all btn-neon shadow-lg shadow-primary/20"
              >
                {isSavingStore ? <Loader2 className="animate-spin" size={14} /> : <Check size={14} />} Save Changes
              </button>
            </div>
          </div>
        ) : (
          <div className="p-5 sm:p-10 relative z-10 flex flex-col justify-center items-center sm:items-start flex-1 text-center sm:text-left">
            <div className="flex flex-col sm:flex-row items-center sm:items-start gap-4 sm:gap-8 w-full">
              {/* Logo on top for profile */}
              <div className="w-16 h-16 sm:w-24 sm:h-24 bg-[#05070a]/80 backdrop-blur-xl rounded-2xl sm:rounded-3xl border border-primary/30 flex items-center justify-center text-xl sm:text-3xl font-black text-primary italic overflow-hidden shadow-2xl flex-shrink-0">
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

              <div className="flex-1 space-y-3 w-full">
                <div className="flex flex-col sm:flex-row items-center sm:items-start justify-between gap-4">
                  <div className="space-y-1">
                    <h1 className="text-xl sm:text-3xl font-black text-white italic uppercase tracking-tighter leading-none shadow-black drop-shadow-lg">{activeStore.name}</h1>
                    <p className="text-[8px] sm:text-[9px] text-primary font-black uppercase tracking-[0.2em] mt-1.5 bg-primary/10 w-fit px-2 py-0.5 rounded border border-primary/20 mx-auto sm:mx-0">{activeStore.category} Sector Hub</p>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    <button 
                      onClick={handleShareStore}
                      className="p-2 sm:p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white hover:text-primary hover:border-primary/50 transition-all hover:scale-110 active:scale-95 shadow-xl"
                      title="Share Store Link"
                    >
                      <Share2 size={16} />
                    </button>
                    <button 
                      onClick={() => {
                        setIsEditingStore(true);
                        setStoreEditData({});
                      }}
                      className="p-2 sm:p-3 bg-black/40 backdrop-blur-md border border-white/10 rounded-xl text-white hover:text-primary hover:border-primary/50 transition-all hover:scale-110 active:scale-95 shadow-xl"
                      title="Edit Store Profile"
                    >
                      <Edit3 size={16} />
                    </button>
                  </div>
                </div>
                
                <div className="flex flex-wrap items-center justify-center sm:justify-start gap-2 sm:gap-4 pt-1">
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-black/40 rounded-lg border border-white/5">
                    <div className="w-1 h-1 bg-neon-green rounded-full shadow-[0_0_8px_#39FF14] animate-pulse"></div>
                    <span className="text-[8px] font-black uppercase text-white tracking-widest leading-none">Active</span>
                  </div>
                  <div className="flex items-center gap-1.5 px-2 py-1 bg-primary/10 border border-primary/20 rounded-lg text-[8px] font-black text-primary uppercase tracking-widest animate-pulse leading-none">
                    <Sparkles size={8} /> Live Explorer
                  </div>
                  <div className="flex items-center gap-1.5 text-[8px] text-gray-300 font-bold uppercase tracking-widest bg-black/40 px-2.5 py-1 rounded-lg border border-white/5 leading-none">
                    <MapPin size={10} className="text-primary" /> {activeStore.address || 'No location set'}
                  </div>
                </div>
              </div>
            </div>
            
            <div className="mt-6 sm:mt-8 pt-4 sm:pt-6 border-t border-white/10 w-full">
               <p className="text-[10px] sm:text-xs text-gray-300 font-medium max-w-2xl leading-relaxed drop-shadow-lg mx-auto sm:mx-0">
                 {activeStore.description}
               </p>
            </div>
          </div>
        )}
      </section>

      {/* Analytics Brief */}
      <section className="space-y-4">
        <div className="flex items-center justify-between px-1">
          <h2 className="text-[10px] font-black text-gray-500 uppercase tracking-[0.2em]">Live Operational Metrics</h2>
          <button 
            onClick={handleResetStats}
            className="text-[10px] font-black text-primary uppercase tracking-widest flex items-center gap-1.5 hover:opacity-80 transition-opacity"
          >
            <RefreshCw size={12} /> Reset Counters
          </button>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <div className="neon-card p-4 space-y-2 group">
            <div className="flex items-center justify-between">
              <DollarSign size={16} className="text-primary" />
              <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_8px_rgba(57,255,20,0.5)]"></div>
            </div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Store Volume</p>
            <p className="text-xl font-black text-white italic tracking-tighter">{formatCurrency(engagementStats.volume, 'USD')}</p>
          </div>
          <div className="neon-card p-4 space-y-2">
            <div className="flex items-center justify-between">
              <Package size={16} className="text-primary" />
              <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">LIVE</span>
            </div>
            <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Active Inventory</p>
            <p className="text-xl font-black text-white italic tracking-tighter">{products.length}</p>
          </div>
          <div className="neon-card p-4 space-y-2 border-primary/20 bg-primary/5">
            <div className="flex items-center justify-between">
              <Zap size={16} className="text-primary" />
              <div className="w-1.5 h-1.5 bg-primary rounded-full animate-pulse shadow-[0_0_8px_rgba(0,242,254,0.5)]"></div>
            </div>
            <p className="text-[9px] font-black text-primary uppercase tracking-widest">Active Leads (Engage)</p>
            <p className="text-xl font-black text-white italic tracking-tighter">{engagementStats.engaged}</p>
          </div>
          <div className="neon-card p-4 space-y-2 border-accent/20 bg-accent/5">
            <div className="flex items-center justify-between">
              <ShoppingBag size={16} className="text-accent" />
              <div className="w-1.5 h-1.5 bg-accent rounded-full animate-pulse shadow-[0_0_8px_rgba(240,147,251,0.5)]"></div>
            </div>
            <p className="text-[9px] font-black text-accent uppercase tracking-widest">Orders Initiated</p>
            <p className="text-xl font-black text-white italic tracking-tighter">{engagementStats.interested}</p>
          </div>
        </div>
      </section>

      {/* Market Trends Analytics Section */}
      <section>
        <MarketTrendsChart userCategory={activeStore?.category} />
      </section>

      {/* Product List */}
      <section className="space-y-6">
        <div className="flex items-center justify-between px-1">
          <div className="flex items-center gap-2">
            <h2 className="font-black text-white uppercase tracking-tighter text-lg">Inventory</h2>
            <span className="px-2 py-0.5 bg-primary/10 text-primary text-[8px] font-black rounded border border-primary/20 uppercase tracking-widest">{products.length} Items</span>
          </div>
          <div className="flex items-center gap-2">
            <button 
              onClick={() => setShowWhatsAppModal(true)}
              className="flex items-center gap-2 bg-neon-green/10 border border-neon-green/20 text-neon-green px-4 py-2.5 rounded-xl text-[10px] font-black uppercase tracking-widest hover:bg-neon-green/20 transition-all shadow-lg shadow-neon-green/5"
            >
              <Phone size={14} /> Import from WA
            </button>
            <button 
              onClick={() => handleOpenForm()}
              className="w-10 h-10 rounded-xl border flex items-center justify-center transition-all bg-primary/20 border-primary/20 text-primary hover:bg-primary hover:text-[#05070a]"
            >
              <Plus size={20} />
            </button>
          </div>
        </div>

        <div className="space-y-4">
          {Array.from(new Map<string, Product>(products.filter(p => p && p.id).map(p => [p.id, p])).values()).map((product, index) => (
            <motion.div 
              key={`sup-prod-${product.id || index}-${index}`}
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
                <p className="text-[10px] text-gray-600">Start populating your inventory</p>
              </div>
            </div>
          )}
        </div>
      </section>

      {/* Modal for Store Setup Overlay */}
      <AnimatePresence>
        {showStoreSetup && (
          <div key="store-setup-overlay-container" className="fixed inset-0 z-[100] bg-[#05070a] overflow-y-auto">
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
          <div key="product-form-modal-container" className="fixed inset-0 z-50 flex items-center justify-center p-4">
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
                      {editingProduct ? 'Edit Entity' : 'New Product'}
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
                      {/* Image Upload */}
                      <div className="space-y-4">
                        <div className="flex items-center justify-between ml-1">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest">
                            Product Images ({formData.images.length}/5 max total • Max 2 local uploads)
                          </label>
                        </div>
                        
                        <div className="grid grid-cols-2 gap-4">
                          {formData.images.map((img, idx) => {
                            const localUploads = formData.images.filter((i, iIdx) => iIdx !== idx && (i.startsWith('data:') || i.startsWith('blob:') || i.includes('firebasestorage'))).length;
                            return (
                              <div key={idx} className="relative">
                                <ImageInput 
                                  value={img} 
                                  allowLocalUpload={localUploads < 2}
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
                            );
                          })}
                          
                          {formData.images.length < 5 && (() => {
                            const currentLocalCount = formData.images.filter(i => i.startsWith('data:') || i.startsWith('blob:') || i.includes('firebasestorage')).length;
                            return (
                              <div className="relative">
                                <ImageInput 
                                  value="" 
                                  allowLocalUpload={currentLocalCount < 2}
                                  onChange={(val) => {
                                    if (val) {
                                      setFormData({ ...formData, images: [...formData.images, val] });
                                    }
                                  }} 
                                  aspectRatio="square"
                                  label="Add Asset"
                                />
                              </div>
                            );
                          })()}
                        </div>
                      </div>

                      <div className="space-y-4">
                        {/* Listing Type Choice: Product or Service */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Listing Type</label>
                          <div className="grid grid-cols-2 gap-3">
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, itemType: 'product' })}
                              className={cn(
                                "py-3 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                                formData.itemType === 'product'
                                  ? "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(0,242,254,0.15)]"
                                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                              )}
                            >
                              <Package size={16} /> Physical Product
                            </button>
                            <button
                              type="button"
                              onClick={() => setFormData({ ...formData, itemType: 'service' })}
                              className={cn(
                                "py-3 px-4 rounded-2xl border text-xs font-black uppercase tracking-wider flex items-center justify-center gap-2 transition-all",
                                formData.itemType === 'service'
                                  ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.15)]"
                                  : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                              )}
                            >
                              <Wrench size={16} /> Professional Service
                            </button>
                          </div>
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                            {formData.itemType === 'service' ? 'Service Title' : 'Item Name'}
                          </label>
                          <input 
                            type="text"
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic transition-all"
                            placeholder={formData.itemType === 'service' ? "e.g. Solar Inverter Installation & Wiring" : "e.g. 5KVA Inverter System"}
                            value={formData.name}
                            onChange={e => setFormData({ ...formData, name: e.target.value })}
                            required
                          />
                        </div>

                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Data Description</label>
                          <textarea 
                            className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-sm min-h-[100px] transition-all"
                            placeholder="Full specifications or service deliverables..."
                            rows={3}
                            value={formData.description}
                            onChange={e => setFormData({ ...formData, description: e.target.value })}
                            required
                          />
                        </div>

                        {/* Pricing Terms / Options */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">Pricing Terms & Structure</label>
                          <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
                            {[
                              { id: 'fixed', label: 'Fixed Price' },
                              { id: 'negotiable', label: 'Negotiable' },
                              { id: 'installments', label: 'Installments' },
                              { id: 'contact_seller_for_price', label: 'Contact for Price' }
                            ].map((opt) => (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => {
                                  const isContact = opt.id === 'contact_seller_for_price';
                                  setFormData({ 
                                    ...formData, 
                                    pricingOption: opt.id as any,
                                    buyButtonType: isContact ? 'chat' : formData.buyButtonType
                                  });
                                }}
                                className={cn(
                                  "py-2.5 px-3 rounded-xl border text-[9px] font-black uppercase tracking-wider transition-all flex items-center justify-center text-center",
                                  formData.pricingOption === opt.id
                                    ? opt.id === 'contact_seller_for_price'
                                      ? "bg-emerald-500/20 border-emerald-400 text-emerald-400 shadow-[0_0_15px_rgba(16,185,129,0.2)]"
                                      : "bg-primary/20 border-primary text-primary shadow-[0_0_15px_rgba(0,242,254,0.15)]"
                                    : "bg-white/5 border-white/10 text-gray-400 hover:text-white"
                                )}
                              >
                                {opt.label}
                              </button>
                            ))}
                          </div>
                        </div>

                        <div className="grid grid-cols-2 gap-4">
                          <div className="space-y-2">
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                              Unit Price {formData.pricingOption === 'contact_seller_for_price' ? '(Optional)' : ''}
                            </label>
                            <div className="relative">
                              <DollarSign size={16} className="absolute left-4 top-1/2 -translate-y-1/2 text-primary" />
                              <input 
                                type="number"
                                className="w-full bg-white/5 border border-white/10 rounded-2xl pl-12 pr-4 py-4 text-white outline-none focus:border-primary/50 font-mono"
                                placeholder={formData.pricingOption === 'contact_seller_for_price' ? 'Contact Seller' : '0.00'}
                                value={formData.price || ''}
                                onChange={e => setFormData({ ...formData, price: parseFloat(e.target.value) || 0 })}
                                required={formData.pricingOption !== 'contact_seller_for_price'}
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

                        {/* Quantity Unit / Pricing Condition (Immediately after price) */}
                        <div className="space-y-2">
                          <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">
                            Quantity Unit / Pricing Condition
                          </label>
                          <div className="space-y-2">
                            <select 
                              className="w-full bg-[#0d1117] border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-bold appearance-none cursor-pointer shadow-xl"
                              value={
                                PRESET_QUANTITY_UNITS.includes(formData.quantityUnit || 'per item')
                                  ? (formData.quantityUnit || 'per item')
                                  : 'custom'
                              }
                              onChange={e => {
                                const val = e.target.value;
                                setFormData(prev => ({ ...prev, quantityUnit: val }));
                              }}
                            >
                              <option value="per item" className="bg-[#0d1117] text-white py-2">per item / unit (Standard)</option>
                              <option value="per kg" className="bg-[#0d1117] text-white py-2">per kg (Kilogram)</option>
                              <option value="per tonne" className="bg-[#0d1117] text-white py-2">per tonne (Tonne)</option>
                              <option value="per night" className="bg-[#0d1117] text-white py-2">per night (Hotel / Lodge Bookings)</option>
                              <option value="per day" className="bg-[#0d1117] text-white py-2">per day (Car Rental / Daily Rate)</option>
                              <option value="per session" className="bg-[#0d1117] text-white py-2">per session (Service / Booking)</option>
                              <option value="per box" className="bg-[#0d1117] text-white py-2">per box / package</option>
                              <option value="per litre" className="bg-[#0d1117] text-white py-2">per litre (Liquid / Fuel)</option>
                              <option value="custom" className="bg-[#0d1117] text-white py-2">✨ Custom Quantity or Condition...</option>
                            </select>

                            {(formData.quantityUnit === 'custom' || (!PRESET_QUANTITY_UNITS.includes(formData.quantityUnit || 'per item') && formData.quantityUnit !== undefined)) && (
                              <div className="space-y-1 pt-1">
                                <label className="text-[9px] font-black text-neon-green uppercase tracking-widest ml-1">Specify Custom Quantity or Condition</label>
                                <input 
                                  type="text"
                                  className="w-full bg-white/5 border border-primary/40 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary font-bold text-xs transition-all shadow-[0_0_15px_rgba(0,242,254,0.1)]"
                                  placeholder="e.g. per crate, per hour, per 50kg bag, per trip"
                                  value={customQuantityUnit}
                                  onChange={e => {
                                    setCustomQuantityUnit(e.target.value);
                                  }}
                                  required
                                />
                              </div>
                            )}
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
                            <label className="text-[10px] font-black text-gray-500 uppercase tracking-widest ml-1">External Link</label>
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
                        {editingProduct ? 'Update Listing' : 'Create Product'}
                      </>
                    )}
                  </button>
                </div>
              </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* WhatsApp Import Modal */}
      <AnimatePresence>
        {showWhatsAppModal && (
          <div key="whatsapp-modal-container" className="fixed inset-0 z-[120] flex items-center justify-center p-4">
            <motion.div 
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className="absolute inset-0 bg-[#05070a]/90 backdrop-blur-md"
              onClick={() => setShowWhatsAppModal(false)}
            />
            <motion.div 
              initial={{ opacity: 0, scale: 0.9, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.9, y: 20 }}
              className="relative w-full max-w-lg neon-card !bg-[#0d1117] p-8 space-y-6 shadow-2xl border border-white/10"
            >
              <div className="flex justify-between items-start">
                <header className="space-y-1">
                  <div className="flex items-center gap-2">
                    <div className="w-8 h-8 bg-neon-green/20 rounded-lg flex items-center justify-center text-neon-green">
                      <Phone size={18} />
                    </div>
                    <h3 className="text-xl font-black text-white italic uppercase tracking-tighter">WhatsApp Linker</h3>
                  </div>
                  <p className="text-[9px] text-gray-500 font-bold uppercase tracking-widest">Import products from external catalog</p>
                </header>
                <button onClick={() => setShowWhatsAppModal(false)} className="text-gray-500 hover:text-white"><X size={20} /></button>
              </div>

              {waImportedProducts.length === 0 ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Catalog URL</label>
                    <input 
                      type="url"
                      placeholder="https://wa.me/c/..."
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white placeholder-gray-700 outline-none focus:border-neon-green/50 font-mono text-xs"
                      value={waUrl}
                      onChange={e => setWaUrl(e.target.value)}
                    />
                  </div>
                  {waError && <p className="text-[10px] text-red-500 font-bold uppercase tracking-widest italic">{waError}</p>}
                  <button 
                    onClick={handleWhatsAppImport}
                    disabled={isWaParsing || !waUrl}
                    className="w-full py-4 bg-neon-green/10 border border-neon-green/20 text-neon-green rounded-xl text-[10px] font-black uppercase tracking-[0.2em] hover:bg-neon-green/20 transition-all flex items-center justify-center gap-2 disabled:opacity-50"
                  >
                    {isWaParsing ? <Loader2 className="animate-spin" size={16} /> : <Zap size={16} />}
                    Scan Catalogue Context
                  </button>
                </div>
              ) : (
                <div className="space-y-6">
                  <div className="max-h-[300px] overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                    {waImportedProducts.map((p, idx) => (
                      <div key={`wa-import-${p.name || idx}-${idx}`} className="p-3 bg-white/5 border border-white/5 rounded-xl flex items-center gap-3">
                        <div className="w-12 h-12 bg-white/10 rounded-lg overflow-hidden flex-shrink-0">
                          {p.image && <img src={p.image} className="w-full h-full object-cover" alt="" referrerPolicy="no-referrer" />}
                        </div>
                        <div className="flex-1 overflow-hidden">
                          <h4 className="text-[10px] font-black text-white italic truncate">{p.name}</h4>
                          <p className="text-[9px] text-primary font-bold">{formatCurrency(p.price, p.currency)}</p>
                        </div>
                        <Check className="text-neon-green" size={16} />
                      </div>
                    ))}
                  </div>
                  <button 
                    onClick={() => commitWaImport(waImportedProducts.map((_, i) => i))}
                    className="w-full btn-neon py-4 text-xs font-black uppercase tracking-[0.2em] italic flex items-center justify-center gap-2"
                  >
                    <Plus size={16} /> Decrypt {waImportedProducts.length} Items into Inventory
                  </button>
                  <button 
                    onClick={() => setWaImportedProducts([])}
                    className="w-full text-[9px] font-black text-gray-500 uppercase tracking-widest hover:text-white"
                  >
                    Discard Scan
                  </button>
                </div>
              )}
            </motion.div>
          </div>
        )}
      </AnimatePresence>

      {/* Delete Confirmation Modal */}
      <AnimatePresence>
        {productToDelete && (
          <div key="delete-product-modal-container" className="fixed inset-0 z-[60] flex items-center justify-center p-4">
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
                  Warning: This action is irreversible. The listing <span className="text-white italic">"{productToDelete.name}"</span> will be completely permanently deleted.
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
