import { formatCurrency, openWhatsApp } from './utils';

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
    text: `🚀 Join me on Comfort Business Hub! Discover verified local stores, products & direct supplier deals:\n${url}`,
    url,
    imageUrl: `${origin}/icons/icon-512x512.png`,
    description: 'Explore verified stores, products, and direct trading on Comfort Business Hub.'
  };
}

/**
 * Constructs structured share payload for a Store / Shop
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
  const encodedStoreName = encodeURIComponent(store.name);
  // Store sharing link with the store name for brand awareness
  const url = `${origin}/store/${store.id}?store=${encodedStoreName}`;
  const image = store.logo || store.coverPhoto || `${origin}/icons/icon-512x512.png`;
  const categoryText = store.category ? ` | ${store.category}` : '';

  return {
    type: 'store',
    title: `${store.name}${categoryText} - Comfort Business Hub`,
    text: `🏬 Explore ${store.name} on Comfort Business Hub!\nCheck out verified products and get in touch directly:\n${url}`,
    url,
    imageUrl: image,
    storeName: store.name,
    description: store.description || `Visit ${store.name}'s official storefront on Comfort Business Hub.`
  };
}

/**
 * Constructs structured share payload for a Product
 */
export function getProductSharePayload(
  product: {
    id: string;
    name: string;
    price: number;
    currency?: string;
    images?: string[];
    description?: string;
  },
  storeName?: string
): SharePayload {
  const origin = window.location.origin;
  const encodedName = encodeURIComponent(product.name);
  const encodedStore = storeName ? `&store=${encodeURIComponent(storeName)}` : '';
  const url = `${origin}/product/${product.id}?name=${encodedName}${encodedStore}`;
  const image = product.images?.[0] || `${origin}/icons/icon-512x512.png`;
  const formattedPrice = formatCurrency(product.price, product.currency || 'USD');
  const storeBranding = storeName ? ` at ${storeName}` : '';

  return {
    type: 'product',
    title: `${product.name} (${formattedPrice}) ${storeBranding}`,
    text: `🛍️ ${product.name}\n💰 Price: ${formattedPrice}${storeName ? '\n🏪 Store: ' + storeName : ''}\n\nView product details & order on Comfort Business Hub:\n${url}`,
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
