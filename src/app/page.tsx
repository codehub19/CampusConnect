
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
import { Loader2 } from 'lucide-react';
import { getDatabase, ref, onValue, goOffline, goOnline } from 'firebase/database';
import { firebaseApp, rtdb } from '@/lib/firebase';

type AppState = 'loading' | 'policy' | 'auth' | 'profile_setup' | 'home' | 'chat' | 'events' | 'missed_connections';

function AppContent() {
  const { user, loading, profile, updateProfile } = useAuth();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [appState, setAppState] = useState<AppState>('loading');
  const [onlineCount, setOnlineCount] = useState<number | null>(null);

  useEffect(() => {
    // Only establish RTDB connection if user is logged in
    if (!user) {
        if(rtdb) goOffline(rtdb);
        return;
    }
    goOnline(rtdb);

    const statusRef = ref(rtdb, 'status');
    const unsubscribe = onValue(statusRef, (snapshot) => {
        const statuses = snapshot.val() || {};
        const count = Object.values(statuses).filter((status: any) => status.state === 'online').length;
        setOnlineCount(count);
    });

    return () => unsubscribe();
  }, [user]);

  
  // Effect to manage state transitions based on auth changes and policy agreement
  useEffect(() => {
    if (loading) {
      setAppState('loading');
      return;
    }
    
    if (typeof window !== 'undefined' && localStorage.getItem('policyAgreed') !== 'true') {
      setAppState('policy');
      return;
    }

    if (!user) {
      setAppState('auth');
      return;
    }
    
    if (!profile) {
      // Still waiting for profile to load, stay in a loading-like state
      setAppState('loading');
      return;
    }

    if (!profile.profileComplete && !profile.isGuest) {
      setAppState('profile_setup');
      return;
    }
    
    // If we've gotten past profile setup, default to home.
    // Avoids reverting to 'home' if user navigates away and state changes.
    if (appState === 'profile_setup' || appState === 'auth' || appState === 'policy' || appState === 'loading') {
      setAppState('home');
    }

  }, [loading, user, profile, appState]);


  const handleAgree = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('policyAgreed', 'true');
    }
    // The useEffect will now handle transitioning to the correct state
    setAppState('loading');
  };

  const navigateTo = (state: AppState) => {
    setAppState(state);
  }

  if (appState === 'loading') {
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
