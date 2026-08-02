import { initializeApp, getApps, App } from 'firebase-admin/app';
import { getFirestore, Firestore } from 'firebase-admin/firestore';
import { getAuth, Auth } from 'firebase-admin/auth';

let adminApp: App | undefined;

export function getAdminServices(): { db: Firestore; auth: Auth } {
  if (!getApps().length) {
    adminApp = initializeApp({
      projectId: process.env.VITE_FIREBASE_PROJECT_ID || 'gen-lang-client-0045594701',
    });
  }
  return {
    db: getFirestore(),
    auth: getAuth(),
  };
}
