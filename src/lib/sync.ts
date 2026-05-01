import { 
  collection, 
  doc, 
  setDoc, 
  updateDoc, 
  deleteDoc,
  Timestamp,
  getDoc
} from 'firebase/firestore';
import { db } from './firebase';
import { localDB, OutboxItem } from './db';

export async function addToOutbox(item: Omit<OutboxItem, 'createdAt'>) {
  const fullItem: OutboxItem = {
    ...item,
    createdAt: Date.now()
  };
  await localDB.outbox.add(fullItem);
  
  // Notify user or UI (could use a global state or simple console log)
  console.log(`[Sync] Operation queued for ${item.collection}/${item.docId} while offline.`);
  
  if (navigator.onLine) {
    triggerSync();
  }
}

let syncInProgress = false;

export async function triggerSync() {
  if (syncInProgress || !navigator.onLine) return;
  syncInProgress = true;

  try {
    const items = await localDB.outbox.orderBy('createdAt').toArray();
    if (items.length === 0) return;

    console.log(`[Sync] Attempting to synchronize ${items.length} queued operations...`);
    
    for (const item of items) {
      if (!navigator.onLine) break;

      try {
        const docRef = doc(db, item.collection, item.docId);
        
        if (item.action === 'create' || item.action === 'update') {
          // Use Timestamp.now() for server sync time
          await setDoc(docRef, {
            ...item.payload,
            updatedAt: Timestamp.now(),
            _syncedAt: Timestamp.now() // Flag for tracking
          }, { merge: true });
        } else if (item.action === 'delete') {
          await deleteDoc(docRef);
        }

        // Successfully synced, remove from outbox
        if (item.id) await localDB.outbox.delete(item.id);
        console.log(`[Sync] Synchronized ${item.collection}/${item.docId}`);
      } catch (error) {
        console.error('[Sync] Failed to sync item:', item, error);
        // If it's a permission error, we might want to discard it or notify user
        // But for network errors, we break and retry later
        if (error instanceof Error && !error.message.includes('permission')) {
          break; 
        }
        // If permission error, maybe mark as failed/abandoned
      }
    }
  } finally {
    syncInProgress = false;
  }
}

/**
 * Universal wrapper for writes that handles offline state gracefully.
 */
export async function offlineResilientWrite(
  collectionName: string, 
  docId: string, 
  action: 'create' | 'update' | 'delete', 
  payload: any = null
) {
  // 1. Update local cache first for instant UI response (Optimistic)
  if (action !== 'delete' && payload) {
    await localDB.cache.put({
      id: `${collectionName}:${docId}`,
      collection: collectionName,
      docId,
      data: payload,
      updatedAt: Date.now()
    });
  } else if (action === 'delete') {
    await localDB.cache.delete(`${collectionName}:${docId}`);
  }

  // 2. Try remote write
  if (navigator.onLine) {
    try {
      const docRef = doc(db, collectionName, docId);
      if (action === 'create' || action === 'update') {
        await setDoc(docRef, { ...payload, updatedAt: Timestamp.now() }, { merge: true });
      } else {
        await deleteDoc(docRef);
      }
      return; // Success
    } catch (error) {
      console.warn('[Sync] Online write failed, fallback to outbox', error);
    }
  }

  // 3. Fallback to outbox if offline or remote write failed
  await addToOutbox({
    collection: collectionName,
    docId,
    action,
    payload
  });
}

// Global Listeners
if (typeof window !== 'undefined') {
  window.addEventListener('online', () => {
    console.log('[Network] System Online. Initializing Sync...');
    triggerSync();
  });
  
  window.addEventListener('offline', () => {
    console.warn('[Network] System Offline. Queuing mode active.');
  });

  // Background interval for safety
  setInterval(() => triggerSync(), 60000);
}
