
import { initializeApp, getApp, getApps } from "firebase/app";
import { 
  getFirestore, 
  initializeFirestore,
  persistentLocalCache, 
  persistentMultipleTabManager 
} from "firebase/firestore";
import { getStorage } from "firebase/storage";
import { getDatabase } from "firebase/database";

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
const firebaseApp = !getApps().length ? initializeApp(firebaseConfig) : getApp();

// Initialize services
const storage = getStorage(firebaseApp);
const rtdb = getDatabase(firebaseApp);

// Initialize Firestore with offline persistence
let db;
try {
  db = initializeFirestore(firebaseApp, {
    localCache: persistentLocalCache({ tabManager: persistentMultipleTabManager() })
  });
} catch (e) {
  console.error("Firestore offline persistence could not be enabled:", e);
  db = getFirestore(firebaseApp);
}

export { firebaseApp, storage, rtdb, db };
