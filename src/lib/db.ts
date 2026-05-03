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
  createdAt: number;
  status: 'pending' | 'failed';
}

export class ComfortOfflineDB extends Dexie {
  users!: Table<LocalUser>;
  outbox!: Table<OutboxItem>;
  cache!: Table<CachedDoc>;
  queuedMessages!: Table<QueuedMessage>;

  constructor() {
    super('ComfortBusinessHubDB');
    this.version(2).stores({
      users: 'id',
      outbox: '++id, collection, action, createdAt',
      cache: 'id, collection, docId, updatedAt',
      queuedMessages: '++id, convoId, senderId, createdAt'
    });
  }
}

export const localDB = new ComfortOfflineDB();
