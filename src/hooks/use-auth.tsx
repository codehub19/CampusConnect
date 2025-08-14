
"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from 'react';
import {
  getAuth,
  onAuthStateChanged,
  signOut,
  signInWithPopup,
  GoogleAuthProvider,
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  sendEmailVerification,
  sendPasswordResetEmail,
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
import { getDatabase, ref, onDisconnect, set, serverTimestamp as rtdbServerTimestamp, goOnline, goOffline } from 'firebase/database';
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
  sendPasswordReset: (email: string) => Promise<void>;
  logout: () => Promise<void>;
  updateProfile: (data: Partial<User>) => Promise<void>;
  authModalOpen: boolean;
  setAuthModalOpen: React.Dispatch<React.SetStateAction<boolean>>;
  requireAuth: (callback: () => void) => void;
}

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [user, setUser] = useState<FirebaseUser | null>(null);
  const [profile, setProfile] = useState<User | null>(null);
  const [loading, setLoading] = useState(true);
  const [authModalOpen, setAuthModalOpen] = useState(false);
  const { toast } = useToast();
  const auth = getAuth(firebaseApp);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        const userDocRef = doc(db, 'users', firebaseUser.uid);
        
        if (rtdb && firebaseUser.emailVerified) {
            goOnline(rtdb);
            const statusRef = ref(rtdb, `/status/${firebaseUser.uid}`);
            
            // This promise will resolve when the client is disconnected.
             onDisconnect(statusRef).set({ state: 'offline', last_changed: rtdbServerTimestamp() }).then(() => {
                updateDoc(userDocRef, { online: false, lastSeen: serverTimestamp() });
             });

             // Set the user's status to online in RTDB.
            await set(statusRef, { state: 'online', last_changed: rtdbServerTimestamp() });

            // Also update Firestore to reflect the online status immediately.
            await updateDoc(userDocRef, { online: true }).catch(() => {});
        }

        const unsubProfile = onSnapshot(userDocRef, (docSnap) => {
          if (docSnap.exists()) {
            const userProfile = { id: docSnap.id, ...docSnap.data() } as User;
            setProfile(userProfile);
          }
           setLoading(false);
        });
        return () => unsubProfile();
      } else {
        if(profile?.id && rtdb) {
            const statusRef = ref(rtdb, `/status/${profile.id}`);
            set(statusRef, { state: 'offline', last_changed: rtdbServerTimestamp() });
        }
        setUser(null);
        setProfile(null);
        setLoading(false);
        if (rtdb) {
            goOffline(rtdb);
        }
      }
    });

    return () => unsubscribe();
  }, [auth, db, profile?.id]);

  const requireAuth = useCallback((callback: () => void) => {
    if (user && profile?.profileComplete) {
      callback();
    } else {
      setAuthModalOpen(true);
    }
  }, [user, profile]);

  const createProfile = async (uid: string, data: Partial<User>) => {
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
        major: '',
        year: '',
        bio: '',
        blockedUsers: [],
        friends: [],
        profileComplete: false,
        pendingChatId: null,
        isGuest: false,
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
      setAuthModalOpen(false);
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
     // Ensure email is sent before we do anything else
     await sendEmailVerification(result.user);
     toast({
        title: 'Verification Email Sent',
        description: 'Please check your inbox to verify your email address.',
        duration: 10000,
     });
     setAuthModalOpen(false);
  };
    
  const signInWithEmail = async (email: string, password: string) => {
    const result = await signInWithEmailAndPassword(auth, email, password);
    if (!result.user.emailVerified) {
        await signOut(auth);
        throw new Error('Please verify your email before logging in. Check your inbox for a verification link.');
    }
    setAuthModalOpen(false);
  };

  const sendPasswordReset = async (email: string) => {
    await sendPasswordResetEmail(auth, email);
  };

  const updateProfile = async (data: Partial<User>) => {
    if (!user) throw new Error("You must be logged in to update your profile.");
    const userDocRef = doc(db, 'users', user.uid);
    await updateDoc(userDocRef, data);
  };

  const logout = async () => {
    if (user && rtdb) {
      const userDocRef = doc(db, 'users', user.uid);
      const statusRef = ref(rtdb, `/status/${user.uid}`);
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
    sendPasswordReset,
    logout,
    updateProfile,
    authModalOpen,
    setAuthModalOpen,
    requireAuth,
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
