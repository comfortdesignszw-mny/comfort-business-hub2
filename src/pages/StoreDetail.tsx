import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { motion, AnimatePresence } from 'motion/react';
import { Store as StoreIcon, MapPin, Star, MessageSquare, ArrowLeft, Share2, Info, Loader2, Building2, Zap, ShoppingBag } from 'lucide-react';
import { db, handleFirestoreError, OperationType } from '../lib/firebase';
import { doc, getDoc, collection, query, where, getDocs, onSnapshot, limit } from 'firebase/firestore';
import { UserProfile, Product, Store as StoreType } from '../types';
import { cn, formatCurrency } from '../lib/utils';
import ProductCard from '../components/ProductCard';

export default function StoreDetail({ profile }: { profile: UserProfile | null }) {
  const { id } = useParams<{ id: string }>();
  const navigate = useNavigate();
  const [store, setStore] = useState<StoreType | null>(null);
  const [products, setProducts] = useState<Product[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!id) return;

    const fetchStoreAndProducts = async () => {
      setLoading(true);
      try {
        const storeSnap = await getDoc(doc(db, 'stores', id));
        if (!storeSnap.exists()) {
          setError("Node not found in local subspace");
          setLoading(false);
          return;
        }
        setStore({ id: storeSnap.id, ...storeSnap.data() } as StoreType);

        const pq = query(
          collection(db, 'products'),
          where('storeId', '==', id),
          where('isActive', '==', true),
          limit(50)
        );
        
        const productsSnap = await getDocs(pq);
        setProducts(productsSnap.docs.map(d => ({ id: d.id, ...d.data() } as Product)));
      } catch (err) {
        handleFirestoreError(err, OperationType.GET, `store-detail-${id}`);
        setError("Error synchronizing with store node");
      } finally {
        setLoading(false);
      }
    };

    fetchStoreAndProducts();
  }, [id]);

  const handleShare = () => {
    const shareUrl = `${window.location.origin}/store/${id}`;
    if (navigator.share) {
      navigator.share({
        title: store?.name || 'Comfort Node',
        text: `Check out ${store?.name} on Comfort Business Hub!`,
        url: shareUrl,
      }).catch(console.error);
    } else {
      navigator.clipboard.writeText(shareUrl);
      alert('Node Link Copied to Clipboard!');
    }
  };

  if (loading) {
    return (
      <div className="flex flex-col items-center justify-center py-20 gap-4">
        <Loader2 className="animate-spin text-primary" size={32} />
        <p className="text-[10px] text-gray-500 font-black uppercase tracking-widest animate-pulse">Syncing Store Node...</p>
      </div>
    );
  }

  if (error || !store) {
    return (
      <div className="p-8 text-center space-y-4">
        <Building2 className="mx-auto text-gray-700" size={48} />
        <h3 className="text-lg font-black text-white italic uppercase">{error || "Node Offline"}</h3>
        <button onClick={() => navigate('/')} className="btn-neon px-8 py-3 text-[10px] font-black uppercase">Return to Hub</button>
      </div>
    );
  }

  return (
    <motion.div 
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      className="p-4 space-y-8"
    >
      <header className="relative py-12 rounded-[2.5rem] overflow-hidden neon-card">
         <div className="absolute inset-0 z-0">
          <img 
            src={store.banner || "https://images.unsplash.com/photo-1441986300917-64674bd600d8?w=800&q=80"} 
            className="w-full h-full object-cover opacity-30" 
            alt="Banner" 
            referrerPolicy="no-referrer" 
          />
          <div className="absolute inset-0 bg-gradient-to-t from-[#05070a] via-[#05070a]/60 to-transparent"></div>
        </div>

        <div className="relative z-10 flex flex-col items-center text-center space-y-4 px-6">
          <div className="w-24 h-24 rounded-3xl bg-[#0d1117] border-4 border-[#05070a] shadow-2xl overflow-hidden flex items-center justify-center text-primary font-black text-4xl">
            {store.logo ? (
              <img src={store.logo} className="w-full h-full object-cover" referrerPolicy="no-referrer" />
            ) : store.name.charAt(0)}
          </div>
          
          <div className="space-y-1">
            <h2 className="text-3xl font-black text-white italic uppercase tracking-tighter">{store.name}</h2>
            <div className="flex items-center justify-center gap-2">
              <MapPin size={12} className="text-primary" />
              <p className="text-[10px] text-gray-400 font-bold uppercase tracking-widest">{store.category} • {store.location || 'Local Hub'}</p>
            </div>
          </div>

          <div className="flex gap-2">
            <div className="glass-pill !text-neon-green flex items-center gap-1.5">
              <Star size={12} className="fill-neon-green" /> {store.rating.toFixed(1)} ({store.reviewCount})
            </div>
            <button 
              onClick={handleShare}
              className="glass-pill hover:bg-white/10 flex items-center gap-1.5"
            >
              <Share2 size={12} /> Share Node
            </button>
          </div>

          <p className="text-xs text-gray-400 max-w-md mx-auto leading-relaxed">
            {store.description}
          </p>
        </div>
      </header>

      {!profile && (
        <section className="p-6 neon-card bg-gradient-to-br from-primary/10 to-accent/10 border-primary/30 text-center space-y-4">
          <Zap className="mx-auto text-primary animate-pulse" size={28} />
          <h3 className="text-lg font-black text-white italic uppercase tracking-tighter">Join the Enterprise Matrix</h3>
          <p className="text-[11px] text-gray-300 leading-relaxed max-w-xs mx-auto">
            You're browsing this store's inventory as a quest. <span className="text-primary font-black">Comfort Business Hub</span> members get direct supplier channels, lower rates, and unified checkouts.
          </p>
          <div className="flex flex-col gap-3">
             <button 
                onClick={() => navigate('/login')}
                className="btn-neon w-full py-3 text-[10px] uppercase font-black tracking-widest"
              >
                Create Hub Identity
              </button>
              <p className="text-[8px] text-gray-500 font-black uppercase tracking-widest">Connect with verified local suppliers instantly</p>
          </div>
        </section>
      )}

      <section className="space-y-6">
        <div className="flex items-center justify-between px-2">
          <h3 className="font-black text-white uppercase tracking-tighter text-xl italic flex items-center gap-2">
            <ShoppingBag size={20} className="text-primary" />
            Inventory Node
          </h3>
          <span className="text-[9px] font-black text-neon-green uppercase tracking-widest">{products.length} Items Live</span>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-6">
          {products.length > 0 ? (
            products.map((p) => (
              <ProductCard key={p.id} product={p} profile={profile} />
            ))
          ) : (
            <div className="col-span-full py-20 text-center space-y-4 bg-white/5 rounded-3xl border border-white/5">
              <Info size={32} className="mx-auto text-gray-700" />
              <p className="text-xs font-black text-gray-500 uppercase tracking-widest">No active items found in this node</p>
            </div>
          )}
        </div>
      </section>
    </motion.div>
  );
}
