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
let retryCount = 0;
let backoffTimer: NodeJS.Timeout | null = null;

export async function triggerSync() {
  if (syncInProgress || !navigator.onLine) return;
  syncInProgress = true;

  try {
    const items = await localDB.outbox.orderBy('createdAt').toArray();
    if (items.length === 0) {
      retryCount = 0;
      return;
    }

    console.log(`[Sync] Attempting to synchronize ${items.length} queued operations...`);
    
    let allSucceeded = true;

    for (const item of items) {
      if (!navigator.onLine) {
        allSucceeded = false;
        break;
      }

      try {
        const docRef = doc(db, item.collection, item.docId);
        
        if (item.action === 'create' || item.action === 'update') {
          // Use Timestamp.now() for server sync time
          const setDocPromise = setDoc(docRef, {
            ...item.payload,
            updatedAt: Timestamp.now(),
            _syncedAt: Timestamp.now() // Flag for tracking
          }, { merge: true });
          
          await Promise.race([
            setDocPromise,
            new Promise((_, reject) => setTimeout(() => reject(new Error("sync_timeout")), 30000))
          ]);
        } else if (item.action === 'delete') {
          await Promise.race([
            deleteDoc(docRef),
            new Promise((_, reject) => setTimeout(() => reject(new Error("sync_timeout")), 30000))
          ]);
        }

        // Successfully synced, remove from outbox
        if (item.id) await localDB.outbox.delete(item.id);
        console.log(`[Sync] Synchronized ${item.collection}/${item.docId}`);
      } catch (error) {
        console.error('[Sync] Failed to sync item:', item, error);
        allSucceeded = false;
        
        // Unrecoverable permission error => drop it
        if (error instanceof Error && error.message.toLowerCase().includes('permission')) {
          if (item.id) await localDB.outbox.delete(item.id);
        } else {
          break; // Stop and retry later for network errors
        }
      }
    }

    if (!allSucceeded && navigator.onLine) {
      // Exponential backoff
      retryCount++;
      const delay = Math.min(1000 * Math.pow(2, retryCount), 60000); // Max 1 minute
      console.warn(`[Sync] Sync incomplete. Retrying in ${delay}ms... (Attempt ${retryCount})`);
      if (backoffTimer) clearTimeout(backoffTimer);
      backoffTimer = setTimeout(() => {
        triggerSync();
      }, delay);
    } else if (allSucceeded) {
      retryCount = 0;
    }

  } finally {
    syncInProgress = false;
  }
}

export const processOutbox = triggerSync;

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
        await Promise.race([
          setDoc(docRef, { ...payload, updatedAt: Timestamp.now() }, { merge: true }),
          new Promise((_, reject) => setTimeout(() => reject(new Error("sync_timeout")), 30000))
        ]);
      } else {
        await Promise.race([
          deleteDoc(docRef),
          new Promise((_, reject) => setTimeout(() => reject(new Error("sync_timeout")), 30000))
        ]);
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
