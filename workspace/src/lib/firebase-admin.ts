
import { getApps, initializeApp, cert } from 'firebase-admin/app';
import { getFirestore } from 'firebase-admin/firestore';
import { config } from 'dotenv';

// Load environment variables from .env file
config({ path: '.env' });

// Initialize Firebase Admin SDK only if it hasn't been initialized yet
if (!getApps().length) {
  try {
    const serviceAccount = {
      projectId: process.env.FIREBASE_PROJECT_ID,
      clientEmail: process.env.FIREBASE_CLIENT_EMAIL,
      privateKey: process.env.FIREBASE_PRIVATE_KEY?.replace(/\\n/g, '\n'),
    };

    if (!serviceAccount.projectId || !serviceAccount.clientEmail || !serviceAccount.privateKey) {
        throw new Error('Firebase Admin SDK credentials are not defined in environment variables.');
    }

    initializeApp({
      credential: cert(serviceAccount),
    });
    
  } catch (error: any) {
    console.error('Firebase Admin SDK initialization error:', error.message);
    // If initialization fails, we should not proceed.
    // Throwing an error here will make it clear that the configuration is wrong.
    throw new Error(`Failed to initialize Firebase Admin SDK: ${error.message}`);
  }
}

export const adminDb = getFirestore();
