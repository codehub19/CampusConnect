
"use client";

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import AuthView from '@/components/campus-connect/auth-view';
import { MainLayout } from '@/components/campus-connect/main-layout';
import PolicyView from '@/components/campus-connect/policy-view';
import { useState, useEffect } from 'react';
import ProfileSetupView from '@/components/campus-connect/profile-setup-view';
import HomeView from '@/components/campus-connect/home-view';
import EventsView from '@/components/campus-connect/events-view';
import MissedConnectionsView from '@/components/campus-connect/missed-connections-view';
import ProfileView from '@/components/campus-connect/profile-view';
import { getFirestore, collection, query, where, onSnapshot } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

type AppState = 'policy' | 'auth' | 'profile_setup' | 'home' | 'chat' | 'events' | 'missed_connections';

function AppContent() {
  const { user, loading, profile, updateProfile } = useAuth();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [appState, setAppState] = useState<AppState>('auth');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);
  const db = getFirestore(firebaseApp);
  
  useEffect(() => {
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('online', '==', true));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      setOnlineCount(snapshot.size);
    }, (error) => {
      console.error("Error fetching online user count:", error);
      setOnlineCount(0);
    });

    return () => unsubscribe();
  }, [db]);
  
  const getInitialState = (): AppState => {
    if (loading) return 'auth';
    if (typeof window !== 'undefined' && localStorage.getItem('policyAgreed') !== 'true') {
      return 'policy';
    }
    if (!user || !profile) {
      return 'auth';
    }
    if (!profile.profileComplete && !profile.isGuest) {
      return 'profile_setup';
    }
    return 'home';
  };
  
  // Effect to manage state transitions based on auth changes
  useEffect(() => {
    setAppState(getInitialState());
  }, [loading, user, profile]);


  const handleAgree = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('policyAgreed', 'true');
    }
    setAppState(getInitialState());
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  const navigateTo = (state: AppState) => {
    setAppState(state);
  }

  return (
    <>
      {profile && <ProfileView user={profile} isOpen={isProfileOpen} onOpenChange={setProfileOpen} onProfileUpdate={updateProfile} />}

      {(() => {
        switch (appState) {
          case 'policy':
            return <PolicyView onAgree={handleAgree} />;
          case 'auth':
            return <AuthView onlineCount={onlineCount} />;
          case 'profile_setup':
            return <ProfileSetupView />;
          case 'home':
            return <HomeView 
              onNavigateTo1v1Chat={() => navigateTo('chat')} 
              onNavigateToEvents={() => navigateTo('events')} 
              onNavigateToMissedConnections={() => navigateTo('missed_connections')} 
              userName={profile?.name || 'User'}
              onOpenProfile={() => setProfileOpen(true)}
              userAvatar={profile?.avatar}
              onlineCount={onlineCount}
            />;
          case 'chat':
            return <MainLayout onNavigateHome={() => navigateTo('home')} onNavigateToMissedConnections={() => navigateTo('missed_connections')} />;
          case 'events':
            return <EventsView onNavigateHome={() => navigateTo('home')} />;
          case 'missed_connections':
            return <MissedConnectionsView onNavigateHome={() => navigateTo('home')} />;
          default:
            return <AuthView onlineCount={onlineCount} />;
        }
      })()}
    </>
  )
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
