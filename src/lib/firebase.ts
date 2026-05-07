import { initializeApp } from 'firebase/app';
import { getAuth } from 'firebase/auth';
import { getFirestore, enableMultiTabIndexedDbPersistence } from 'firebase/firestore';
const firebaseConfig = {
  "projectId": (import.meta as any).env.VITE_FIREBASE_PROJECT_ID,
  "appId": (import.meta as any).env.VITE_FIREBASE_APP_ID,
  "apiKey": (import.meta as any).env.VITE_FIREBASE_API_KEY,
  "authDomain": (import.meta as any).env.VITE_FIREBASE_AUTH_DOMAIN,
  "firestoreDatabaseId": (import.meta as any).env.VITE_FIREBASE_DB_ID || "",
  "storageBucket": (import.meta as any).env.VITE_FIREBASE_SB,
  "messagingSenderId": (import.meta as any).env.VITE_FIREBASE_SENDER_ID,
  "measurementId": ""
};

// Validation
if (!firebaseConfig.apiKey || firebaseConfig.apiKey === "undefined") {
  console.error("Firebase API Key is missing! Check your environment variables.");
}

const app = initializeApp(firebaseConfig);
export const db = getFirestore(app, firebaseConfig.firestoreDatabaseId);

// Enable persistence for local caching
if (typeof window !== 'undefined') {
  enableMultiTabIndexedDbPersistence(db).catch((err) => {
    if (err.code === 'failed-precondition') {
      // Multiple tabs open, persistence can only be enabled in one tab at a time.
      console.warn('Firestore persistence failed-precondition (multiple tabs)');
    } else if (err.code === 'unimplemented') {
      // The current browser does not support all of the features required to enable persistence
      console.warn('Firestore persistence unimplemented in this browser');
    }
  });
}

export const auth = getAuth();

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
  console.error('Firestore Error: ', JSON.stringify(errInfo));
  throw new Error(JSON.stringify(errInfo));
}

// CRITICAL CONSTRAINT: Test connection initially
async function testConnection() {
  try {
    const { doc, getDocFromServer } = await import('firebase/firestore');
    await getDocFromServer(doc(db, 'admins', 'connection_test'));
  } catch (error) {
    // Silent catch, mainly for logging in devtools if needed
  }
}
testConnection();
