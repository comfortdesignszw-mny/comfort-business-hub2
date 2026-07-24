import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, doc, getDocFromServer } from 'firebase/firestore';
import { getStorage } from 'firebase/storage';
import { getMessaging, getToken, onMessage } from 'firebase/messaging';
import firebaseConfig from '../../firebase-applet-config.json';

const app = initializeApp(firebaseConfig);

// Standard Firestore initialization for maximum compatibility
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

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
      updatedAt: serverTimestamp()
    };
    
    await setDoc(doc(db, 'public_profiles', profile.uid), publicProfile, { merge: true });
  } catch (err) {
    console.error('Failed to sync public profile:', err);
  }
}
