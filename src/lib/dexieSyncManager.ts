import { localDB, calculateTTL } from './db';
import { db } from './firebase';
import { doc, setDoc, updateDoc, deleteDoc, serverTimestamp } from 'firebase/firestore';

/**
 * Dexie Offline Cache & Sync Manager
 * Manages IndexedDB local persistence, background synchronization, and offline outbox queues.
 */

export async function cacheDocument(collectionName: string, docId: string, data: any) {
  try {
    const now = Date.now();
    const { lastSynced, expiresAt } = calculateTTL();
    await localDB.cache.put({
      id: `${collectionName}:${docId}`,
      collection: collectionName,
      docId,
      data,
      updatedAt: now,
      lastSynced,
      expiresAt
    });

    if (collectionName === 'stores' && data) {
      await localDB.stores.put({ id: docId, data, updatedAt: now, lastSynced, expiresAt });
    } else if (collectionName === 'products' && data) {
      await localDB.products.put({ id: docId, storeId: data.storeId || '', data, updatedAt: now, lastSynced, expiresAt });
    } else if (collectionName === 'deals' && data) {
      await localDB.deals.put({
        id: docId,
        supplierId: data.supplierId || '',
        customerId: data.customerId || '',
        data,
        updatedAt: now,
        lastSynced,
        expiresAt
      });
    }
  } catch (err) {
    console.warn('[Dexie Cache] Failed to cache document:', collectionName, docId, err);
  }
}

export async function cacheCollection(collectionName: string, items: any[]) {
  try {
    const now = Date.now();
    const { lastSynced, expiresAt } = calculateTTL();
    const records = items.map(item => ({
      id: `${collectionName}:${item.id || item.uid}`,
      collection: collectionName,
      docId: item.id || item.uid,
      data: item,
      updatedAt: now,
      lastSynced,
      expiresAt
    }));
    await localDB.cache.bulkPut(records);

    if (collectionName === 'stores') {
      const storeRecords = items.map(s => ({ id: s.id, data: s, updatedAt: now, lastSynced, expiresAt }));
      await localDB.stores.bulkPut(storeRecords);
    } else if (collectionName === 'products') {
      const productRecords = items.map(p => ({ id: p.id, storeId: p.storeId || '', data: p, updatedAt: now, lastSynced, expiresAt }));
      await localDB.products.bulkPut(productRecords);
    } else if (collectionName === 'deals') {
      const dealRecords = items.map(d => ({
        id: d.id,
        supplierId: d.supplierId || '',
        customerId: d.customerId || '',
        data: d,
        updatedAt: now,
        lastSynced,
        expiresAt
      }));
      await localDB.deals.bulkPut(dealRecords);
    }
  } catch (err) {
    console.warn('[Dexie Cache] Failed to cache collection:', collectionName, err);
  }
}

export async function getCachedDocument<T = any>(collectionName: string, docId: string): Promise<T | null> {
  try {
    const cached = await localDB.cache.get(`${collectionName}:${docId}`);
    return cached ? (cached.data as T) : null;
  } catch (err) {
    console.warn('[Dexie Cache] Read error:', err);
    return null;
  }
}

export async function getCachedCollection<T = any>(collectionName: string): Promise<T[]> {
  try {
    if (collectionName === 'stores') {
      const stores = await localDB.stores.toArray();
      if (stores.length > 0) return stores.map(s => s.data as T);
    } else if (collectionName === 'products') {
      const products = await localDB.products.toArray();
      if (products.length > 0) return products.map(p => p.data as T);
    } else if (collectionName === 'deals') {
      const deals = await localDB.deals.toArray();
      if (deals.length > 0) return deals.map(d => d.data as T);
    }

    const items = await localDB.cache.where('collection').equals(collectionName).toArray();
    return items.map(item => item.data as T);
  } catch (err) {
    console.warn('[Dexie Cache] List read error:', err);
    return [];
  }
}

export async function queueOfflineAction(
  collectionName: string,
  docId: string,
  action: 'create' | 'update' | 'delete',
  payload: any
) {
  try {
    await localDB.outbox.add({
      collection: collectionName,
      docId,
      action,
      payload,
      createdAt: Date.now()
    });

    if (action === 'delete') {
      await localDB.cache.delete(`${collectionName}:${docId}`);
    } else {
      await cacheDocument(collectionName, docId, payload);
    }
  } catch (err) {
    console.warn('[Dexie Outbox] Failed to queue action:', err);
  }
}

export async function processOutboxSync(): Promise<{ synced: number; failed: number }> {
  if (!navigator.onLine) return { synced: 0, failed: 0 };

  let synced = 0;
  let failed = 0;

  try {
    const items = await localDB.outbox.orderBy('createdAt').toArray();
    if (items.length === 0) return { synced: 0, failed: 0 };

    for (const item of items) {
      if (!item.id) continue;
      try {
        const docRef = doc(db, item.collection, item.docId);
        const payload = {
          ...item.payload,
          _syncedAt: new Date().toISOString(),
          updatedAt: new Date().toISOString()
        };

        if (item.action === 'create' || item.action === 'update') {
          await setDoc(docRef, payload, { merge: true });
        } else if (item.action === 'delete') {
          await deleteDoc(docRef);
        }

        await localDB.outbox.delete(item.id);
        synced++;
      } catch (err) {
        console.warn(`[Outbox Sync] Item ${item.id} failed:`, err);
        failed++;
      }
    }
  } catch (err) {
    console.error('[Outbox Sync] Batch failed:', err);
  }

  return { synced, failed };
}

export async function clearAppLocalState() {
  try {
    await localDB.cache.clear();
    await localDB.stores.clear();
    await localDB.products.clear();
    await localDB.deals.clear();
    await localDB.outbox.clear();
    await localDB.queuedMessages.clear();
    console.log('[Dexie] Local cache cleared successfully.');
  } catch (err) {
    console.error('[Dexie] Failed to clear local state:', err);
  }
}

// Auto-sync listener when browser goes back online
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Dexie Sync Manager] Internet restored. Triggering outbox processing...');
    processOutboxSync();
  });
}
