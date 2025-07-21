
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
import { ref, onValue } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import { Loader2 } from 'lucide-react';

type AppState = 'policy' | 'auth' | 'profile_setup' | 'home' | 'chat' | 'events' | 'missed_connections';

function AppContent() {
  const { user, loading, profile, updateProfile } = useAuth();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [appState, setAppState] = useState<AppState>('auth');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    // Listen for online user count from Realtime Database
    const statusRef = ref(rtdb, 'status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
        if (snapshot.exists()) {
            const statuses = snapshot.val();
            const count = Object.values(statuses).filter((status: any) => status.state === 'online').length;
            setOnlineCount(count);
        } else {
            setOnlineCount(0);
        }
    }, (error) => {
        console.error("Error fetching online user count from RTDB:", error);
        setOnlineCount(0);
    });

    return () => unsubscribe();
  }, []);
  
  const getInitialState = (): AppState => {
    if (loading) return 'auth';
    if (typeof window !== 'undefined' && localStorage.getItem('policyAgreed') !== 'true') {
      return 'policy';
    }
    if (!user) {
      return 'auth';
    }
    // If the profile is not yet loaded, wait in an auth-like state
    if (!profile) {
      return 'auth';
    }
    if (!profile.profileComplete && !profile.isGuest) {
      return 'profile_setup';
    }
    return 'home';
  };
  
  // Effect to manage state transitions based on auth changes
  useEffect(() => {
    const initialState = getInitialState();
    // Only update app state if it's different, to avoid unnecessary re-renders.
    // Especially important for after profile setup, to not revert to 'home' prematurely.
    if (initialState !== 'profile_setup' || appState !== 'home') {
      setAppState(initialState);
    }
  }, [loading, user, profile]);


  const handleAgree = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('policyAgreed', 'true');
    }
    setAppState(getInitialState());
  };

  const navigateTo = (state: AppState) => {
    setAppState(state);
  }

  // This is the key fix: Show a loading spinner until auth and profile are ready.
  if (loading || (user && !profile)) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
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
