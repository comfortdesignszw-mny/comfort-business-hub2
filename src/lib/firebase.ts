import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { 
  initializeFirestore, 
  doc, 
  getDocFromCache, 
  getDocsFromCache, 
  getDoc, 
  getDocs, 
  DocumentReference, 
  Query, 
  DocumentSnapshot, 
  QuerySnapshot,
  CACHE_SIZE_UNLIMITED, 
  persistentLocalCache 
} from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Modern Firestore initialization with persistent local cache for zero-connectivity startup
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED,
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Non-blocking Zero-Connectivity Startup Signal
async function initZeroConnectivityStartup() {
  console.info("⚡ Zero-Connectivity Startup: Prioritizing local cache and browser sandbox.");
}

initZeroConnectivityStartup();

/**
 * Cache-First Document Fetcher
 * Tries browser persistent cache / sandbox first for instant startup.
 * Queries database only if required data is missing locally.
 */
export async function getDocCacheFirst(docRef: DocumentReference): Promise<DocumentSnapshot> {
  try {
    const cachedSnap = await getDocFromCache(docRef);
    if (cachedSnap.exists()) {
      return cachedSnap;
    }
  } catch (err) {
    // Cache miss or local cache unavailable
  }

  // Fallback to remote database query if missing locally
  return await getDoc(docRef);
}

/**
 * Cache-First Collection / Query Fetcher
 * Tries local browser cache first, queries server only if not found in local cache.
 */
export async function getDocsCacheFirst(queryRef: Query): Promise<QuerySnapshot> {
  try {
    const cachedSnap = await getDocsFromCache(queryRef);
    if (!cachedSnap.empty) {
      return cachedSnap;
    }
  } catch (err) {
    // Cache miss or query not cached
  }

  // Fallback to remote database query
  return await getDocs(queryRef);
}

// Standardized Error Handler
export enum OperationType {
  CREATE = 'create',
  UPDATE = 'update',
  DELETE = 'delete',
  LIST = 'list',
  GET = 'get',
  WRITE = 'write',
}

export interface FirestoreErrorInfo {
  error: string;
  operationType: OperationType;
  path: string | null;
  authInfo: {
    userId?: string | null;
    email?: string | null;
    emailVerified?: boolean | null;
    isAnonymous?: boolean | null;
  }
}

export function handleFirestoreError(error: unknown, operationType: OperationType, path: string | null) {
  const errMessage = error instanceof Error ? error.message : String(error);
  
  const errInfo: FirestoreErrorInfo = {
    error: errMessage,
    authInfo: {
      userId: auth.currentUser?.uid,
      email: auth.currentUser?.email,
      emailVerified: auth.currentUser?.emailVerified,
      isAnonymous: auth.currentUser?.isAnonymous,
    },
    operationType,
    path
  };
  
  // High-priority security logging for permission violations
  if (errInfo.error.includes('Insufficient permissions')) {
    console.error(' [SECURITY INCIDENT] Unauthorized Access Attempt:', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  } else if (
    errMessage.includes('offline') || 
    errMessage.includes('unavailable') || 
    errMessage.includes('network') ||
    errMessage.includes('failed-precondition')
  ) {
    // Graceful offline degradation for zero-connectivity startup
    console.warn(`[Zero-Connectivity Fallback] Firestore ${operationType} on ${path || 'resource'} operating from local cache/sandbox:`, errMessage);
    return;
  } else {
    console.error('Firestore Error Payload: ', JSON.stringify(errInfo));
    throw new Error(JSON.stringify(errInfo));
  }
}

/**
 * Recursively cleans an object by removing keys with `undefined` values,
 * which cause Firestore setDoc / updateDoc to throw errors.
 */
export function sanitizeFirestoreData<T extends Record<string, any>>(data: T): Record<string, any> {
  if (!data || typeof data !== 'object') return data;
  const clean: Record<string, any> = {};
  for (const key of Object.keys(data)) {
    const value = data[key];
    if (value !== undefined) {
      if (
        value !== null &&
        typeof value === 'object' &&
        !Array.isArray(value) &&
        !(value instanceof Date) &&
        typeof (value as any).toDate !== 'function'
      ) {
        if (value.constructor && (value.constructor.name === 'FieldValue' || value.constructor.name === 'ServerTimestampTransform')) {
          clean[key] = value;
        } else {
          clean[key] = sanitizeFirestoreData(value);
        }
      } else {
        clean[key] = value;
      }
    }
  }
  return clean;
}

// Sync utility for splitting PII from public-facing profiles
export async function syncPublicProfile(profile: any) {
  if (!profile || !profile.uid) return;
  // Verify that an active auth user exists and matches profile UID before writing to Firestore
  if (!auth.currentUser || auth.currentUser.uid !== profile.uid) {
    console.warn('syncPublicProfile skipped: auth currentUser does not match profile uid');
    return;
  }
  try {
    const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
    const publicProfile: Record<string, any> = {
      uid: profile.uid,
      name: profile.name || 'User',
      avatar: profile.avatar || '',
      currentRole: profile.currentRole || 'customer',
      location: profile.location ? { city: profile.location.city || '' } : null,
      isVerified: Boolean(profile.isVerified),
      gateway: profile.gateway || null,
      paymentMethods: profile.paymentMethods || null,
      whatsappNumber: profile.whatsappNumber || profile.phone || profile.phoneNumber || '',
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'public_profiles', profile.uid), sanitizeFirestoreData(publicProfile), { merge: true });
  } catch (err) {
    console.error('Failed to sync public profile:', err);
  }
}
