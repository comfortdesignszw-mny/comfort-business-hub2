import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { initializeFirestore, doc, getDocFromServer, enableIndexedDbPersistence, CACHE_SIZE_UNLIMITED } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);
// Using initializeFirestore instead of getFirestore for better network resilience in some environments
export const db = initializeFirestore(app, {
  experimentalForceLongPolling: true,
  cacheSizeBytes: CACHE_SIZE_UNLIMITED
}, firebaseConfig.firestoreDatabaseId);

// Enable persistence for offline capabilities
if (typeof window !== 'undefined') {
  enableIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence failed: Browser not supported');
    }
  });
}
export const auth = getAuth(app);
export const storage = getStorage(app);
export const messaging = typeof window !== 'undefined' ? getMessaging(app) : null;

// Connectivity Test (Delayed for reliability)
async function testConnection() {
  // Give the browser a moment to settle network connections
  await new Promise(resolve => setTimeout(resolve, 2000));
  try {
    // Explicitly check connectivity to the server
    await getDocFromServer(doc(db, 'test', 'connection'));
    console.log("Firestore Signal: CONNECTED");
  } catch (error) {
    console.error("Firestore Signal Error:", error);
    if (error instanceof Error && (error.message.includes('the client is offline') || error.message.includes('Insufficient permissions'))) {
      console.error("CRITICAL: Firestore is unreachable or permissions are missing. Check network or Firebase Console rules/allowlist.");
    }
  }
}

testConnection();

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
    const { setDoc, doc } = await import('firebase/firestore');
    const publicProfile = {
      uid: profile.uid,
      name: profile.name,
      avatar: profile.avatar || '',
      currentRole: profile.currentRole,
      location: profile.location ? { city: profile.location.city } : null,
      isVerified: profile.isVerified || false,
      gateway: profile.gateway || null,
      updatedAt: new Date().toISOString()
    };
    
    await setDoc(doc(db, 'public_profiles', profile.uid), publicProfile);
  } catch (err) {
    console.error('Failed to sync public profile:', err);
  }
}
