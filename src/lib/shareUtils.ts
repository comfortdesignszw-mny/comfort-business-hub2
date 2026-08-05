import { formatCurrency, openWhatsApp } from './utils';
import { db } from './firebase';
import { localDB } from './db';
import { doc, getDoc, collection, query, where, getDocs, limit } from 'firebase/firestore';
import { Store, Product } from '../types';

export interface SharePayload {
  type: 'app' | 'store' | 'product' | 'profile';
  title: string;
  text: string;
  url: string;
  imageUrl?: string;
  storeName?: string;
  price?: number;
  currency?: string;
  description?: string;
}

import { INITIAL_OFFLINE_STORES, INITIAL_OFFLINE_PRODUCTS } from './db';

/**
 * Deterministic 5-character base36 hash for any string identifier.
 */
export function hashString5(str: string): string {
  if (!str) return '00000';
  let hash = 5381;
  for (let i = 0; i < str.length; i++) {
    hash = (hash * 33) ^ str.charCodeAt(i);
  }
  const base36 = (hash >>> 0).toString(36).toLowerCase();
  return base36.padStart(5, '0').slice(-5);
}

/**
 * Generates a clean, unique short identifier from a document ID or object containing shortId/id.
 */
export function getShortId(itemOrId: string | { id: string; shortId?: string }): string {
  if (!itemOrId) return '00000';
  if (typeof itemOrId === 'object') {
    if (itemOrId.shortId && itemOrId.shortId.trim().length > 0) {
      return itemOrId.shortId.trim();
    }
    itemOrId = itemOrId.id;
  }
  const id = String(itemOrId);
  if (id.length <= 8) return id;

  // Generate deterministic 5-character hash from full ID to prevent prefix truncation collisions
  return hashString5(id);
}

/**
 * Checks if a store document strictly matches a target ID or short ID.
 */
export function isStoreMatch(s: any, targetId: string): boolean {
  if (!s || !targetId) return false;
  const tid = targetId.trim().toLowerCase();
  const sid = (s.id || '').toString().toLowerCase();
  const sShort = (s.shortId || '').toString().toLowerCase();

  if (sid === tid) return true;
  if (sShort.length > 0 && sShort === tid) return true;
  if (getShortId(s).toLowerCase() === tid) return true;
  if (getShortId(s.id).toLowerCase() === tid) return true;
  if (hashString5(s.id).toLowerCase() === tid) return true;

  if (tid.length >= 8 && sid.startsWith(tid)) return true;

  return false;
}

/**
 * Checks if a product document strictly matches a target ID or short ID.
 */
export function isProductMatch(p: any, targetId: string): boolean {
  if (!p || !targetId) return false;
  const tid = targetId.trim().toLowerCase();
  const pid = (p.id || '').toString().toLowerCase();
  const pShort = (p.shortId || '').toString().toLowerCase();

  if (pid === tid) return true;
  if (pShort.length > 0 && pShort === tid) return true;
  if (getShortId(p).toLowerCase() === tid) return true;
  if (getShortId(p.id).toLowerCase() === tid) return true;
  if (hashString5(p.id).toLowerCase() === tid) return true;

  if (tid.length >= 8 && pid.startsWith(tid)) return true;

  return false;
}

/**
 * Converts product name into a clean URL-friendly slug.
 */
export function slugifyProductName(name: string): string {
  if (!name) return 'product';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'product';
}

/**
 * Converts store name into a clean URL-friendly slug.
 */
export function slugifyStoreName(name: string): string {
  if (!name) return 'store';
  return name
    .toLowerCase()
    .trim()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'store';
}

/**
 * Resolves store document strictly from either full ID or short ID (less than 6 chars).
 * Guarantees that only the matching store is returned (no random fallback).
 */
export async function resolveStoreByIdOrShortId(idParam: string): Promise<Store | null> {
  if (!idParam) return null;
  const targetId = decodeURIComponent(idParam).trim();

  // 1. Direct Firestore lookup by exact ID
  try {
    const directSnap = await getDoc(doc(db, 'stores', targetId));
    if (directSnap.exists()) {
      return { id: directSnap.id, ...directSnap.data() } as Store;
    }
  } catch (e) {}

  // 2. Query Firestore by explicit shortId field
  try {
    const qShort = query(collection(db, 'stores'), where('shortId', '==', targetId), limit(1));
    const snapShort = await getDocs(qShort);
    if (!snapShort.empty) {
      const d = snapShort.docs[0];
      return { id: d.id, ...d.data() } as Store;
    }
  } catch (e) {}

  // 3. Check Dexie local database cache
  try {
    const cachedRecords = await localDB.stores.toArray();
    if (cachedRecords.length > 0) {
      const match = cachedRecords.find(r => isStoreMatch(r.data || r, targetId));
      if (match) {
        return (match.data || match) as Store;
      }
    }
  } catch (e) {}

  // 4. Check initial offline seed stores
  const seedMatch = INITIAL_OFFLINE_STORES.find(s => isStoreMatch(s, targetId));
  if (seedMatch) {
    return seedMatch as unknown as Store;
  }

  // 5. Query Firestore prefix range search
  try {
    const qRange = query(
      collection(db, 'stores'),
      where('__name__', '>=', targetId),
      where('__name__', '<=', targetId + '\uf8ff'),
      limit(10)
    );
    const snapRange = await getDocs(qRange);
    if (!snapRange.empty) {
      const match = snapRange.docs.find(d => isStoreMatch({ id: d.id, ...d.data() }, targetId));
      if (match) return { id: match.id, ...match.data() } as Store;
    }
  } catch (e) {}

  // 6. Fallback scan recent stores collection (up to 100)
  try {
    const qAll = query(collection(db, 'stores'), limit(100));
    const snapAll = await getDocs(qAll);
    const match = snapAll.docs.find(d => isStoreMatch({ id: d.id, ...d.data() }, targetId));
    if (match) return { id: match.id, ...match.data() } as Store;
  } catch (e) {}

  return null;
}

/**
 * Resolves product document strictly from either full ID or short ID (less than 6 chars).
 * Guarantees that only the matching product is returned (no random fallback).
 */
export async function resolveProductByIdOrShortId(idParam: string): Promise<Product | null> {
  if (!idParam) return null;
  const targetId = decodeURIComponent(idParam).trim();

  // 1. Direct Firestore lookup by exact ID
  try {
    const directSnap = await getDoc(doc(db, 'products', targetId));
    if (directSnap.exists()) {
      return { id: directSnap.id, ...directSnap.data() } as Product;
    }
  } catch (e) {}

  // 2. Query Firestore by explicit shortId field
  try {
    const qShort = query(collection(db, 'products'), where('shortId', '==', targetId), limit(1));
    const snapShort = await getDocs(qShort);
    if (!snapShort.empty) {
      const d = snapShort.docs[0];
      return { id: d.id, ...d.data() } as Product;
    }
  } catch (e) {}

  // 3. Check Dexie local database cache - Exact Match First
  try {
    const cachedRecords = await localDB.products.toArray();
    if (cachedRecords.length > 0) {
      const exactMatch = cachedRecords.find(r => {
        const item = (r.data || r) as Product;
        if (!item) return false;
        return item.id === targetId || (item.shortId && item.shortId === targetId);
      });
      if (exactMatch) {
        return (exactMatch.data || exactMatch) as Product;
      }

      const match = cachedRecords.find(r => isProductMatch(r.data || r, targetId));
      if (match) {
        return (match.data || match) as Product;
      }
    }
  } catch (e) {}

  // 4. Check initial offline seed products - Exact Match First
  const seedExact = INITIAL_OFFLINE_PRODUCTS.find(p => p.id === targetId || (p as any).shortId === targetId);
  if (seedExact) {
    return seedExact as unknown as Product;
  }
  const seedMatch = INITIAL_OFFLINE_PRODUCTS.find(p => isProductMatch(p, targetId));
  if (seedMatch) {
    return seedMatch as unknown as Product;
  }

  // 5. Query Firestore prefix range search
  try {
    const qRange = query(
      collection(db, 'products'),
      where('__name__', '>=', targetId),
      where('__name__', '<=', targetId + '\uf8ff'),
      limit(10)
    );
    const snapRange = await getDocs(qRange);
    if (!snapRange.empty) {
      const match = snapRange.docs.find(d => isProductMatch({ id: d.id, ...d.data() }, targetId));
      if (match) return { id: match.id, ...match.data() } as Product;
    }
  } catch (e) {}

  // 6. Fallback scan recent products collection (up to 100)
  try {
    const qAll = query(collection(db, 'products'), limit(100));
    const snapAll = await getDocs(qAll);
    const match = snapAll.docs.find(d => isProductMatch({ id: d.id, ...d.data() }, targetId));
    if (match) return { id: match.id, ...match.data() } as Product;
  } catch (e) {}

  return null;
}

/**
 * Updates document title and OpenGraph / Twitter meta tags dynamically
 * for URL previews when shared or visited.
 */
export function updateMetaTags(payload: {
  title: string;
  description?: string;
  image?: string;
  url?: string;
}) {
  if (typeof document === 'undefined') return;

  // 1. Title
  document.title = payload.title;

  // 2. Helper to set or create meta tag
  const setMeta = (attrName: string, attrVal: string, content: string) => {
    if (!content) return;
    let element = document.querySelector(`meta[${attrName}="${attrVal}"]`);
    if (!element) {
      element = document.createElement('meta');
      element.setAttribute(attrName, attrVal);
      document.head.appendChild(element);
    }
    element.setAttribute('content', content);
  };

  const defaultDescription = 'Comfort Business Hub - Explore verified stores, local products, and direct trading across Southern Africa.';
  const defaultImage = `${window.location.origin}/icons/icon-512x512.png`;
  const currentUrl = payload.url || window.location.href;

  const desc = payload.description || defaultDescription;
  const img = payload.image || defaultImage;

  // Standard Meta
  setMeta('name', 'description', desc);

  // OpenGraph (Facebook, WhatsApp, LinkedIn, etc.)
  setMeta('property', 'og:title', payload.title);
  setMeta('property', 'og:description', desc);
  setMeta('property', 'og:image', img);
  setMeta('property', 'og:url', currentUrl);
  setMeta('property', 'og:type', 'website');
  setMeta('property', 'og:site_name', 'Comfort Business Hub');

  // Twitter Cards
  setMeta('name', 'twitter:card', 'summary_large_image');
  setMeta('name', 'twitter:title', payload.title);
  setMeta('name', 'twitter:description', desc);
  setMeta('name', 'twitter:image', img);
}

/**
 * Constructs structured share payload for whole App
 */
export function getAppSharePayload(): SharePayload {
  const origin = window.location.origin;
  const url = `${origin}/?ref=share`;
  return {
    type: 'app',
    title: 'Comfort Business Hub',
    text: `🚀 Join me on Comfort Business Hub! Discover verified local stores, products & direct supplier deals:`,
    url,
    imageUrl: `${origin}/icons/icon-512x512.png`,
    description: 'Explore verified stores, products, and direct trading on Comfort Business Hub.'
  };
}

/**
 * Constructs structured share payload for a Store / Shop
 * Generates clean shortened store URL containing: App URL + short store ID
 */
export function getStoreSharePayload(store: {
  id: string;
  name: string;
  description?: string;
  logo?: string;
  coverPhoto?: string;
  category?: string;
  verified?: boolean;
}): SharePayload {
  const origin = window.location.origin;
  const shortId = getShortId(store.id);
  // Shortened Storefront URL
  const url = `${origin}/s/${shortId}`;
  const image = store.logo || store.coverPhoto || `${origin}/icons/icon-512x512.png`;
  const categoryText = store.category ? ` | ${store.category}` : '';

  return {
    type: 'store',
    title: `${store.name}${categoryText} - Comfort Business Hub`,
    text: `🏬 Explore ${store.name} on Comfort Business Hub!\nCheck out verified products and get in touch directly:`,
    url,
    imageUrl: image,
    storeName: store.name,
    description: store.description || `Visit ${store.name}'s official storefront on Comfort Business Hub.`
  };
}

/**
 * Constructs structured share payload for a Product
 * Generates clean shortened product URL containing: App URL + short product ID
 */
export function getProductSharePayload(
  product: {
    id: string;
    name: string;
    price: number;
    currency?: string;
    images?: string[];
    description?: string;
    shortId?: string;
  },
  storeName?: string
): SharePayload {
  const origin = window.location.origin;
  const shortId = getShortId(product);
  // Clean, short product link
  const url = `${origin}/p/${shortId}`;
  const image = product.images?.[0] || `${origin}/icons/icon-512x512.png`;
  const formattedPrice = formatCurrency(product.price, product.currency || 'USD');
  const storeBranding = storeName ? ` at ${storeName}` : '';

  return {
    type: 'product',
    title: `${product.name} (${formattedPrice}) ${storeBranding}`,
    text: `🛍️ ${product.name}\n💰 Price: ${formattedPrice}${storeName ? '\n🏪 Store: ' + storeName : ''}\n\nView product details & order on Comfort Business Hub:`,
    url,
    imageUrl: image,
    storeName,
    price: product.price,
    currency: product.currency || 'USD',
    description: product.description || `${product.name} available for ${formattedPrice}`
  };
}

/**
 * Shared execution helper: attempts Web Share API with image file if possible,
 * falling back gracefully.
 */
export function triggerShareModal(payload: SharePayload) {
  if (typeof window !== 'undefined') {
    window.dispatchEvent(new CustomEvent('open-share-modal', { detail: payload }));
  }
}

export async function executeShare(
  payload: SharePayload,
  fallbackToModal: (payload: SharePayload) => void = triggerShareModal
) {
  // Always update meta tags for active preview
  updateMetaTags({
    title: payload.title,
    description: payload.text,
    image: payload.imageUrl,
    url: payload.url
  });

  if (!navigator.share) {
    fallbackToModal(payload);
    return;
  }

  try {
    // Attempt file attachment for Web Share API if image exists and CORS allows
    let filesToShare: File[] = [];
    if (payload.imageUrl && typeof fetch !== 'undefined' && navigator.canShare) {
      try {
        const response = await fetch(payload.imageUrl, { mode: 'cors' });
        if (response.ok) {
          const blob = await response.blob();
          const ext = blob.type.split('/')[1] || 'png';
          const file = new File([blob], `share-preview.${ext}`, { type: blob.type });
          if (navigator.canShare({ files: [file] })) {
            filesToShare = [file];
          }
        }
      } catch (err) {
        // Fall back to text + url share if image fetch encounters CORS
      }
    }

    const shareData: ShareData = {
      title: payload.title,
      text: payload.text,
      url: payload.url,
      ...(filesToShare.length > 0 ? { files: filesToShare } : {})
    };

    await navigator.share(shareData);
  } catch (err: any) {
    if (err.name === 'AbortError') {
      // User canceled share sheet, no error needed
      return;
    }
    // Share API failed (e.g., unsupported parameters), open rich custom share modal
    fallbackToModal(payload);
  }
}

