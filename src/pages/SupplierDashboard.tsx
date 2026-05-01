import React, { useState, useEffect, useRef } from 'react';
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
  Image as ImageIcon, 
  X, 
  Check,
  ChevronRight,
  TrendingUp,
  Users,
  DollarSign
} from 'lucide-react';
import { db, auth, handleFirestoreError, OperationType } from '../lib/firebase';
import { 
  collection, 
  query, 
  where, 
  getDocs, 
  addDoc, 
  updateDoc, 
  deleteDoc, 
  doc,
  serverTimestamp 
} from 'firebase/firestore';
import { UserProfile, Store, Product, BuyButtonType } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import { uploadAndCompressImage } from '../lib/upload-utils';
import { validateImage } from '../lib/image-utils';
import { PRODUCT_CATEGORIES } from '../constants';
import { Loader2 } from 'lucide-react';
import SupplierSetup from './SupplierSetup';

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
  const [stores, setStores] = useState<Store[]>([]);
  const [activeStore, setActiveStore] = useState<Store | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [showProductForm, setShowProductForm] = useState(false);
  const [showStoreSetup, setShowStoreSetup] = useState(false);
  const [isEditingStore, setIsEditingStore] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<ProductForm>(initialForm);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [uploadingImage, setUploadingImage] = useState(false);
  const [productToDelete, setProductToDelete] = useState<Product | null>(null);
  const [customCategory, setCustomCategory] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    fetchData();
  }, [profile.uid]);

  const fetchData = async () => {
    setLoading(true);
    try {
      // Get Stores
      const storesRes = await getDocs(query(collection(db, 'stores'), where('ownerId', '==', profile.uid)));
      const fetchedStores = storesRes.docs.map(d => ({ id: d.id, ...d.data() } as Store));
      setStores(fetchedStores);
      
      if (fetchedStores.length > 0) {
        // Default to first store or keep existing selection if it still exists
        const storeToSet = activeStore ? fetchedStores.find(s => s.id === activeStore.id) || fetchedStores[0] : fetchedStores[0];
        setActiveStore(storeToSet);
        
        // Get Products for the active store
        const productsRes = await getDocs(query(collection(db, 'products'), where('storeId', '==', storeToSet.id)));
        setProducts(productsRes.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      }
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'supplier-data');
    } finally {
      setLoading(false);
    }
  };

  const switchStore = async (store: Store) => {
    setActiveStore(store);
    setLoading(true);
    try {
      const productsRes = await getDocs(query(collection(db, 'products'), where('storeId', '==', store.id)));
      setProducts(productsRes.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
    } catch (e) {
      handleFirestoreError(e, OperationType.LIST, 'products');
    } finally {
      setLoading(false);
    }
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

  const handleProductImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !activeStore) return;

    // Fast validation before anything else
    const validationError = validateImage(file);
    if (validationError) {
      alert(validationError);
      return;
    }

    // Instant Preview - UI feels instantaneous
    const previewUrl = URL.createObjectURL(file);
    setFormData(prev => ({ ...prev, images: [previewUrl] }));
    setUploadingImage(true);

    try {
      // Start upload in background. We don't block the whole form here
      const url = await uploadAndCompressImage(file, `products/${activeStore.id}/${Date.now()}`, {
        maxWidth: 600,
        maxHeight: 600,
        quality: 0.5
      });
      
      // Once uploaded, replace preview with permanent URL
      setFormData(prev => {
        // If image hasn't changed since we started (edge case), update it
        if (prev.images[0] === previewUrl) {
          return { ...prev, images: [url] };
        }
        return prev;
      });
    } catch (error) {
      console.error("Product image upload error:", error);
      alert("Failed to upload image. Please try again.");
      // Revert to nothing or original if it failed
      setFormData(prev => ({ ...prev, images: [] }));
    } finally {
      setUploadingImage(false);
      URL.revokeObjectURL(previewUrl);
    }
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
        await updateDoc(doc(db, 'products', editingProduct.id), data);
      } else {
        await addDoc(collection(db, 'products'), {
          ...data,
          createdAt: new Date().toISOString()
        });
      }
      
      setShowProductForm(false);
      fetchData();
    } catch (e) {
      handleFirestoreError(e, editingProduct ? OperationType.UPDATE : OperationType.CREATE, 'products');
    } finally {
      setIsSubmitting(false);
    }
  };

  const handleDeleteProduct = async (id: string) => {
    try {
      await deleteDoc(doc(db, 'products', id));
      setProductToDelete(null);
      fetchData();
    } catch (e) {
      handleFirestoreError(e, OperationType.DELETE, `products/${id}`);
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
      <section className="neon-card p-6 relative overflow-hidden">
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/5 blur-3xl -mr-16 -mt-16"></div>
        <div className="flex items-center gap-6">
          <div className="w-20 h-20 bg-white/5 rounded-2xl border border-white/10 flex items-center justify-center text-3xl font-black text-primary italic overflow-hidden">
            {activeStore.logo ? <img src={activeStore.logo} className="w-full h-full object-cover" /> : activeStore.name.charAt(0)}
          </div>
          <div className="space-y-1 flex-1">
            <div className="flex items-center justify-between">
              <h1 className="text-2xl font-black text-white italic uppercase tracking-tighter leading-none">{activeStore.name}</h1>
              <button 
                onClick={() => {
                  setIsEditingStore(true);
                  setShowStoreSetup(true);
                }}
                className="p-2 bg-white/5 border border-white/10 rounded-xl text-gray-500 hover:text-primary hover:border-primary/50 transition-all"
                title="Edit Store Profile"
              >
                <Edit3 size={16} />
              </button>
            </div>
            <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">{activeStore.category} Operations Unit</p>
            <div className="flex items-center gap-3 pt-2">
               <div className="flex items-center gap-1.5">
                <div className="w-1.5 h-1.5 bg-neon-green rounded-full shadow-[0_0_5px_#39FF14]"></div>
                <span className="text-[8px] font-black uppercase text-white tracking-widest">Node Verified</span>
              </div>
              <p className="text-[8px] text-gray-600 font-bold uppercase tracking-[0.2em]">{activeStore.email}</p>
            </div>
          </div>
        </div>
      </section>

      {/* Analytics Brief */}
      <section className="grid grid-cols-2 gap-4">
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
            <Users size={16} className="text-primary" />
            <span className="text-[8px] font-black text-neon-green uppercase tracking-widest">+4 NEW</span>
          </div>
          <p className="text-[9px] font-black text-gray-500 uppercase tracking-widest">Client Requests</p>
          <p className="text-xl font-black text-white italic tracking-tighter">{products.length * 8}</p>
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
                <img src={product.images[0]} className="w-full h-full object-cover" alt={product.name} />
              </div>
              <div className="flex-1 space-y-1">
                <h4 className="font-black text-white italic uppercase tracking-wider text-xs">{product.name}</h4>
                <div className="flex items-center gap-2">
                  <span className="text-primary font-black text-sm tracking-tighter">{formatCurrency(product.price, product.currency)}</span>
                  <span className={cn(
                    "px-1.5 py-0.5 text-[7px] font-black rounded uppercase tracking-widest",
                    product.isActive ? "bg-neon-green/10 text-neon-green" : "bg-red-500/10 text-red-500"
                  )}>
                    {product.isActive ? 'Active' : 'Offline'}
                  </span>
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
                  fetchData();
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
                  fetchData();
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
                className="relative w-full max-w-lg neon-card !bg-[#0d1117] p-8 max-h-[90vh] overflow-y-auto scroll-smooth no-scrollbar"
              >
              <button 
                onClick={() => setShowProductForm(false)}
                className="absolute top-6 right-6 text-gray-500 hover:text-white"
              >
                <X size={24} />
              </button>

              <header className="mb-8 space-y-2">
                <h3 className="text-2xl font-black text-white italic uppercase tracking-tighter">
                  {editingProduct ? 'Edit Entity' : 'New Matrix Entry'}
                </h3>
                <p className="text-[10px] text-gray-500 font-bold uppercase tracking-widest">Define operational parameters for the item</p>
              </header>

              <form onSubmit={handleSubmit} className="space-y-6">
                <div className="space-y-4">
                  {/* Image Matrix Upload */}
                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest ml-1">Visual Matrix (Image)</label>
                    <div 
                      onClick={() => !uploadingImage && fileInputRef.current?.click()}
                      className="w-full aspect-video bg-white/5 border border-white/10 rounded-2xl flex flex-col items-center justify-center cursor-pointer hover:border-primary/50 group transition-all overflow-hidden relative"
                    >
                      {formData.images.length > 0 ? (
                        <>
                          <img src={formData.images[0]} className={cn("w-full h-full object-cover", uploadingImage && "brightness-50")} />
                          {uploadingImage ? (
                            <div className="absolute inset-0 flex flex-col items-center justify-center">
                              <Loader2 className="animate-spin text-primary mb-2" size={32} />
                              <span className="text-[8px] font-black uppercase text-primary tracking-widest animate-pulse">Syncing Matrix...</span>
                            </div>
                          ) : (
                            <div className="absolute inset-0 bg-black/60 opacity-0 group-hover:opacity-100 flex flex-col items-center justify-center transition-opacity">
                              <ImageIcon className="text-primary mb-2" size={24} />
                              <span className="text-[8px] font-black uppercase text-white tracking-widest">Update Entity Image</span>
                            </div>
                          )}
                        </>
                      ) : uploadingImage ? (
                         <div className="flex flex-col items-center justify-center">
                           <Loader2 className="animate-spin text-primary mb-2" size={32} />
                           <span className="text-[8px] font-black uppercase text-primary tracking-widest">Processing...</span>
                         </div>
                      ) : (
                        <>
                          <ImageIcon className="text-gray-700 group-hover:text-primary transition-colors mb-2" size={32} />
                          <span className="text-[8px] font-black text-gray-500 group-hover:text-primary uppercase tracking-widest">Initialize Visual Identity</span>
                        </>
                      )}
                      <input 
                        type="file" 
                        ref={fileInputRef} 
                        onChange={handleProductImageUpload} 
                        className="hidden" 
                        accept="image/*" 
                      />
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Item Name</label>
                    <input 
                      type="text"
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic"
                      placeholder="e.g. 5KVA Inverter System"
                      value={formData.name}
                      onChange={e => setFormData({ ...formData, name: e.target.value })}
                      required
                    />
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Data Description</label>
                    <textarea 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-sm"
                      placeholder="Full technical specifications..."
                      rows={3}
                      value={formData.description}
                      onChange={e => setFormData({ ...formData, description: e.target.value })}
                      required
                    />
                  </div>

                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Unit Price</label>
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
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Currency</label>
                      <select 
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-bold appearance-none"
                        value={formData.currency}
                        onChange={e => setFormData({ ...formData, currency: e.target.value })}
                      >
                        <option value="USD">USD (US Dollar)</option>
                        <option value="ZiG">ZiG (Zimbabwe Gold)</option>
                      </select>
                    </div>
                  </div>

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Category Alignment</label>
                    <select 
                      className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-bold appearance-none"
                      value={formData.category}
                      onChange={e => setFormData({ ...formData, category: e.target.value })}
                    >
                      {PRODUCT_CATEGORIES.map(cat => (
                        <option key={cat} value={cat}>{cat}</option>
                      ))}
                      <option value="Other">Custom Category...</option>
                    </select>
                  </div>

                  {formData.category === 'Other' && (
                    <div className="space-y-2">
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Define Custom Category</label>
                      <input 
                        type="text"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 font-bold italic text-xs"
                        placeholder="Enter specific category name"
                        value={customCategory}
                        onChange={e => setCustomCategory(e.target.value)}
                        required
                      />
                    </div>
                  )}

                  <div className="space-y-2">
                    <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">Buy Logic Gateway</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { id: 'checkout', icon: ShoppingBag, label: 'Direct' },
                        { id: 'chat', icon: MessageSquare, label: 'Inbox' },
                        { id: 'link', icon: LinkIcon, label: 'Gateway' }
                      ].map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => setFormData({ ...formData, buyButtonType: t.id as BuyButtonType })}
                          className={cn(
                            "flex flex-col items-center gap-2 p-3 rounded-2xl border transition-all",
                            formData.buyButtonType === t.id 
                              ? "bg-primary/20 border-primary text-primary" 
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
                      <label className="text-[10px] font-black text-gray-400 uppercase tracking-widest">External Matrix Link</label>
                      <input 
                        type="url"
                        className="w-full bg-white/5 border border-white/10 rounded-2xl px-4 py-4 text-white outline-none focus:border-primary/50 text-xs font-mono"
                        placeholder="https://payments.gateway.zw/..."
                        value={formData.buyButtonLink}
                        onChange={e => setFormData({ ...formData, buyButtonLink: e.target.value })}
                        required
                      />
                    </div>
                  )}

                  <div className="flex items-center gap-3 p-4 bg-white/5 rounded-2xl border border-white/5">
                    <input 
                      type="checkbox"
                      id="isActive"
                      className="w-5 h-5 accent-primary bg-transparent rounded border-white/10"
                      checked={formData.isActive}
                      onChange={e => setFormData({ ...formData, isActive: e.target.checked })}
                    />
                    <label htmlFor="isActive" className="text-[10px] font-black text-white uppercase tracking-widest">Online Availability</label>
                  </div>
                </div>

                <button 
                  type="submit"
                  disabled={isSubmitting}
                  className="w-full btn-neon py-5 text-sm uppercase tracking-[0.2em] italic flex items-center justify-center gap-3 transition-all transform active:scale-[0.98]"
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
              </form>
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
