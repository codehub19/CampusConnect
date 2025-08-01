
"use client";

import React, { createContext, useContext, useEffect, useState } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signInAnonymously,
  type User as FirebaseUser,
} from 'firebase/auth';
import {
  getFirestore,
  doc,
  onSnapshot,
  setDoc,
  getDoc,
  updateDoc,
  serverTimestamp,
} from 'firebase/firestore';
import { getDatabase, ref, onDisconnect, set, serverTimestamp as rtdbServerTimestamp } from 'firebase/database';
import { firebaseApp, rtdb } from '@/lib/firebase';
import type { User } from '@/lib/types';
import { useToast } from './use-toast';

interface AuthContextType {
  user: FirebaseUser | null;
  profile: User | null;
  loading: boolean;
  signInWithGoogle: () => Promise<void>;
  signUpWithEmail: (email: string, password: string) => Promise<void>;
  signInWithEmail: (email: string, password: string) => Promise<void>;
  signInAsGuest: (displayName: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const { toast } = useToast();
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        const statusRef = ref(rtdb, `/status/${firebaseUser.uid}`);
        
        // Firestore and RTDB online status
        await updateDoc(userDocRef, { online: true }).catch(() => {}); // Fails if doc doesn't exist, which is fine
        await set(statusRef, { state: 'online', last_changed: rtdbServerTimestamp() });
        onDisconnect(statusRef).set({ state: 'offline', last_changed: rtdbServerTimestamp() });


        const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userProfile = { id: docSnap.id, ...docSnap.data() } as User;
            setProfile(userProfile);
          }
           setLoading(false);
        });
        return () => unsubProfile();
      } else {
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  }, [auth, db]);

  const createProfile = async (uid: string, data: Partial<User>, isGuest = false) => {
    const userDocRef = doc(db, 'users', uid);
    const userDoc = await getDoc(userDocRef);
    if (!userDoc.exists()) {
      const defaultProfile: User = {
        id: uid,
        name: data.name || 'Anonymous',
        avatar: data.avatar || `https://placehold.co/100x100/FFFFFF/121820?text=${(data.name || 'A').charAt(0)}`,
        online: true,
        gender: 'prefer-not-to-say',
        preference: 'anyone',
        interests: [],
        blockedUsers: [],
        isGuest,
        profileComplete: isGuest, // Guests don't need profile setup
        ...data,
      };
      await setDoc(userDocRef, defaultProfile);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    try {
      const result = await signInWithPopup(auth, provider);
      const userDocRef = doc(db, 'users', result.user.uid);
      const userDoc = await getDoc(userDocRef);
      if (!userDoc.exists()) {
          await createProfile(result.user.uid, { 
              name: result.user.displayName, 
              avatar: result.user.photoURL,
              profileComplete: false,
          });
      }
    } catch (error: any) {
      if (error.code === 'auth/popup-closed-by-user') {
        toast({
          variant: 'default',
          title: 'Login Canceled',
          description: 'You canceled the Google Sign-In process.',
        });
        return;
      }
      throw error;
    }
  };

  const signUpWithEmail = async (email: string, password: string) => {
     const result = await createUserWithEmailAndPassword(auth, email, password);
     await createProfile(result.user.uid, { 
        name: email.split('@')[0],
        profileComplete: false,
     });
  };
    
  const signInWithEmail = async (email: string, password: string) => {
    await signInWithEmailAndPassword(auth, email, password);
  };

  const signInAsGuest = async (displayName: string) => {
    if (!displayName) throw new Error("Display name cannot be empty.");
    const result = await signInAnonymously(auth);
    await createProfile(result.user.uid, { name: displayName }, true);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) throw new Error("You must be logged in to update your profile.");
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, data);
  };

  const logout = async () => {
    if (user) {
      const userDocRef = doc(db, 'users', user.uid);
      const statusRef = ref(rtdb, `/status/${user.uid}`);
      
      // Set offline status before signing out
      await updateDoc(userDocRef, { online: false, lastSeen: serverTimestamp() }).catch(e => console.error("Error setting user offline:", e));
      await set(statusRef, { state: 'offline', last_changed: rtdbServerTimestamp() }).catch(e => console.error("Error setting RTDB status offline:", e));
    }
    await signOut(auth);
  };

  const value = {
    user,
    profile,
    loading,
    signInWithGoogle,
    signUpWithEmail,
    signInWithEmail,
    signInAsGuest,
    logout,
    updateProfile,
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export const useAuth = () => {
  const context = useContext(AuthContext);
  if (context === undefined) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return context;
};
