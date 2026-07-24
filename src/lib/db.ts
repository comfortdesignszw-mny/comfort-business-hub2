import Dexie, { Table } from 'dexie';

export interface LocalUser {
  id: string;
  data: any;
  lastSynced: number;
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
}

export interface LocalStore {
  id: string;
  data: any;
  updatedAt: number;
}

export interface LocalProduct {
  id: string;
  storeId?: string;
  data: any;
  updatedAt: number;
}

export interface LocalDeal {
  id: string;
  supplierId?: string;
  customerId?: string;
  data: any;
  updatedAt: number;
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
  }
}

export const localDB = new ComfortOfflineDB();
