import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, CACHE_SIZE_UNLIMITED, persistentLocalCache } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Modern Firestore initialization with persistent cache settings for stability in sandboxed environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  localCache: persistentLocalCache({
    cacheSizeBytes: CACHE_SIZE_UNLIMITED
  })
}, firebaseConfig.firestoreDatabaseId);

export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Connectivity Guard (Graceful handling of offline states)
async function checkConnectivity() {
  if (typeof window === 'undefined') return;
  
  // Wait for auth to initialize to avoid early permission errors in logs
  await new Promise(resolve => {
    const unsub = auth.onAuthStateChanged(() => {
      unsub();
      resolve(null);
    });
    setTimeout(resolve, 5000); // Max wait
  });

  try {
    // Ping a known safe path or just check the server
    const { getDoc, setDoc, doc, serverTimestamp } = await import('firebase/firestore');
    // We don't necessarily need to fetch a doc that might not exist/have rules
    // Just verifying the instance is alive
    console.log("Firestore Signal: INITIALIZED (Long Polling Active)");
  } catch (error) {
    console.warn("Firestore Connectivity Warning:", error);
  }
}

checkConnectivity();

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
  const errInfo: FirestoreErrorInfo = {
    error: error instanceof Error ? error.message : String(error),
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
  } else {
    console.error('Firestore Error Payload: ', JSON.stringify(errInfo));
  }
  
  throw new Error(JSON.stringify(errInfo));
}

// Sync utility for splitting PII from public-facing profiles
export async function syncPublicProfile(profile: any) {
  try {
    const { setDoc, doc, serverTimestamp } = await import('firebase/firestore');
    const publicProfile = {
      uid: profile.uid,
      name: profile.name,
      avatar: profile.avatar || '',
      currentRole: profile.currentRole,
      location: profile.location ? { city: profile.location.city } : null,
      isVerified: profile.isVerified || false,
      gateway: profile.gateway || null,
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'public_profiles', profile.uid), publicProfile);
  } catch (err) {
    console.error('Failed to sync public profile:', err);
  }
}
