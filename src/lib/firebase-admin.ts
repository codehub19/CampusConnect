
'use server';

import { getApps, initializeApp, cert, App } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

// Load environment variables from a specific path if needed, or root .env
config({ path: '.env' });

let app: App;

if (!getApps().length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      // Ensure the private key is correctly formatted
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };
    
    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        throw new Error('Firebase Admin SDK credentials (FIREBASE_PROJECT_ID, FIREBASE_CLIENT_EMAIL, FIREBASE_PRIVATE_KEY) are not fully defined in environment variables.');
    }

    app = initializeApp({
      credential: cert(serviceAccount),
    });
    
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    // Throw a specific, clear error to make debugging easier.
    throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
  }
} else {
  app = getApps()[0];
}

export const adminDb = getFirestore(app);
