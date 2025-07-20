
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
import { firebaseApp } from '@/lib/firebase';
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
      setLoading(true);
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        const unsubProfile = onSnapshot(userDocRef, async (docSnap) => {
          if (docSnap.exists()) {
            const userProfile = docSnap.data() as User;
            setProfile(userProfile);
            if(!userProfile.online) {
               await updateDoc(userDocRef, { online: true, lastSeen: serverTimestamp() });
            }
          } else {
             // Profile will be created by auth functions
          }
           setLoading(false);
        });

        return () => unsubProfile();

      } else {
        if (user && profile) { // User is signing out
           const userDocRef = doc(db, 'users', user.uid);
           const docSnap = await getDoc(userDocRef);
           if (docSnap.exists()){
             await updateDoc(userDocRef, { online: false, lastSeen: serverTimestamp() });
           }
        }
        setUser(null);
        setProfile(null);
        setLoading(false);
      }
    });

    return () => unsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
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
        gender: 'Prefer not to say',
        interests: [],
        friends: [],
        blockedUsers: [],
        isGuest,
        ...data,
      };
      await setDoc(userDocRef, defaultProfile);
    }
  };

  const signInWithGoogle = async () => {
    const provider = new GoogleAuthProvider();
    const result = await signInWithPopup(auth, provider);
    await createProfile(result.user.uid, { 
        name: result.user.displayName, 
        avatar: result.user.photoURL 
    });
  };

  const signUpWithEmail = async (email: string, password: string) => {
     const result = await createUserWithEmailAndPassword(auth, email, password);
     await createProfile(result.user.uid, { name: email.split('@')[0] });
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
