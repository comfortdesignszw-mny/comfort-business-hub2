import Dexie, { Table } from 'dexie';

export interface LocalUser {
  id: string;
  data: any;
  lastSynced?: number;
  expiresAt?: number;
}

export interface OutboxItem {
  id?: number;
  collection: string;
  docId: string;
  action: 'create' | 'update' | 'delete';
  payload: any;
  createdAt: number;
}

export interface CachedDoc {
  id: string; // collection:id
  collection: string;
  docId: string;
  data: any;
  updatedAt: number;
  lastSynced?: number;
  expiresAt?: number;
}

export interface QueuedMessage {
  id?: number;
  convoId: string;
  senderId: string;
  text: string;
  type?: string;
  payload?: any;
  createdAt: number;
  status: 'pending' | 'failed' | 'uploading';
  progress?: number;
  fileBlob?: Blob;
}

export interface LocalStore {
  id: string;
  data: any;
  updatedAt: number;
  lastSynced?: number;
  expiresAt?: number;
}

export interface LocalProduct {
  id: string;
  storeId?: string;
  data: any;
  updatedAt: number;
  lastSynced?: number;
  expiresAt?: number;
}

export interface LocalDeal {
  id: string;
  supplierId?: string;
  customerId?: string;
  data: any;
  updatedAt: number;
  lastSynced?: number;
  expiresAt?: number;
}

export const DEFAULT_TTL_MS = 30 * 60 * 1000; // 30 minutes TTL

export function calculateTTL(ttlMs: number = DEFAULT_TTL_MS): { lastSynced: number; expiresAt: number } {
  const now = Date.now();
  return {
    lastSynced: now,
    expiresAt: now + ttlMs,
  };
}

export class ComfortOfflineDB extends Dexie {
  users!: Table<LocalUser>;
  outbox!: Table<OutboxItem>;
  cache!: Table<CachedDoc>;
  queuedMessages!: Table<QueuedMessage>;
  stores!: Table<LocalStore>;
  products!: Table<LocalProduct>;
  deals!: Table<LocalDeal>;

  constructor() {
    super('ComfortBusinessHubDB');
    this.version(3).stores({
      users: 'id',
      outbox: '++id, collection, action, createdAt',
      cache: 'id, collection, docId, updatedAt',
      queuedMessages: '++id, convoId, senderId, createdAt',
      stores: 'id, updatedAt',
      products: 'id, storeId, updatedAt',
      deals: 'id, supplierId, customerId, updatedAt'
    });

    this.version(4).stores({
      users: 'id, lastSynced, expiresAt',
      outbox: '++id, collection, action, createdAt',
      cache: 'id, collection, docId, updatedAt, lastSynced, expiresAt',
      queuedMessages: '++id, convoId, senderId, createdAt',
      stores: 'id, updatedAt, lastSynced, expiresAt',
      products: 'id, storeId, updatedAt, lastSynced, expiresAt',
      deals: 'id, supplierId, customerId, updatedAt, lastSynced, expiresAt'
    });
  }
}

export const localDB = new ComfortOfflineDB();

// Initial Offline Seed Data for first-time offline launch
export const INITIAL_OFFLINE_STORES = [
  {
    id: 'store_harare_central',
    name: 'Harare Wholesale Hub',
    category: 'FMCG & Groceries',
    location: 'Harare CBD',
    city: 'Harare',
    rating: 4.8,
    isVerified: true,
    description: 'Premier supplier of bulk groceries, grain, and general wholesale goods in Harare.',
    image: 'https://images.unsplash.com/photo-1578916171728-46686eac8d58?q=80&w=600&auto=format&fit=crop',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'store_bulawayo_hardware',
    name: 'Bulawayo Industrial Hardware',
    category: 'Construction & Hardware',
    location: 'Belmont Industrial',
    city: 'Bulawayo',
    rating: 4.7,
    isVerified: true,
    description: 'Quality building materials, steel, cement, and industrial tools.',
    image: 'https://images.unsplash.com/photo-1504307651254-35680f356dfd?q=80&w=600&auto=format&fit=crop',
    updatedAt: new Date().toISOString()
  }
];

export const INITIAL_OFFLINE_PRODUCTS = [
  {
    id: 'prod_maize_50kg',
    storeId: 'store_harare_central',
    name: 'Grade A White Maize Meal (50kg)',
    category: 'Agriculture',
    price: 18.50,
    unit: 'bag',
    minOrder: 10,
    inStock: true,
    isVerified: true,
    image: 'https://images.unsplash.com/photo-1551754655-cd27e38d2076?q=80&w=600&auto=format&fit=crop',
    description: 'Top grade refined white maize grain bags suitable for milling or retail.',
    updatedAt: new Date().toISOString()
  },
  {
    id: 'prod_cement_bag',
    storeId: 'store_bulawayo_hardware',
    name: 'Portland Cement PC 42.5N (50kg)',
    category: 'Construction',
    price: 10.20,
    unit: 'bag',
    minOrder: 20,
    inStock: true,
    isVerified: true,
    image: 'https://images.unsplash.com/photo-1589939705384-5185137a7f0f?q=80&w=600&auto=format&fit=crop',
    description: 'High strength construction cement for structural building work.',
    updatedAt: new Date().toISOString()
  }
];

