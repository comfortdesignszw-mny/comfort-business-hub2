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
  triggerSync();
}

let syncInProgress = false;

export async function triggerSync() {
  if (syncInProgress) return;
  syncInProgress = true;

  try {
    const items = await localDB.outbox.orderBy('createdAt').toArray();
    
    for (const item of items) {
      try {
        const docRef = doc(db, item.collection, item.docId);
        
        if (item.action === 'create' || item.action === 'update') {
          await setDoc(docRef, {
            ...item.payload,
            updatedAt: Timestamp.now()
          }, { merge: true });
        } else if (item.action === 'delete') {
          await deleteDoc(docRef);
        }

        // Successfully synced, remove from outbox
        if (item.id) await localDB.outbox.delete(item.id);
      } catch (error) {
        console.error('Failed to sync item:', item, error);
        // Break to retry later
        break;
      }
    }
  } finally {
    syncInProgress = false;
  }
}

// Polling for sync if internet returns
window.addEventListener('online', () => triggerSync());
setInterval(() => triggerSync(), 60000); // Every minute
