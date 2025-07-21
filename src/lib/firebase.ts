// This file is machine-generated - edit at your own risk.
import { initializeApp, getApp, getApps } from "firebase/app";
import { getFirestore, enableIndexedDbPersistence } from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

// Your web app's Firebase configuration
// IMPORTANT: DO NOT COMMIT THIS FILE WITH KEYS TO PUBLIC REPOSITORIES
const firebaseConfig = {
  apiKey: process.env.NEXT_PUBLIC_FIREBASE_API_KEY,
  authDomain: process.env.NEXT_PUBLIC_FIREBASE_AUTH_DOMAIN,
  projectId: process.env.NEXT_PUBLIC_FIREBASE_PROJECT_ID,
  storageBucket: process.env.NEXT_PUBLIC_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: process.env.NEXT_PUBLIC_FIREBASE_MESSAGING_SENDER_ID,
  appId: process.env.NEXT_PUBLIC_FIREBASE_APP_ID,
  databaseURL: process.env.NEXT_PUBLIC_FIREBASE_DATABASE_URL,
};

// Initialize Firebase
export const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();
export const storage = getStorage(firebaseApp);
export const rtdb = getDatabase(firebaseApp);

// Enable offline persistence for Firestore
const db = getFirestore(firebaseApp);
if (typeof window !== 'undefined') {
  try {
    enableIndexedDbPersistence(db);
  } catch (err) {
    if (err.code === 'failed-precondition') {
      console.warn('Firestore persistence failed: Multiple tabs open');
    } else if (err.code === 'unimplemented') {
      console.warn('Firestore persistence not available in this browser');
    }
  }
}
