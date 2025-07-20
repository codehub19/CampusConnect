
"use client";

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import AuthView from '@/components/campus-connect/auth-view';
import { MainLayout } from '@/components/campus-connect/main-layout';
import PolicyView from '@/components/campus-connect/policy-view';
import { useState, useEffect } from 'react';
import ProfileSetupView from '@/components/campus-connect/profile-setup-view';
import HomeView from '@/components/campus-connect/home-view';
import MissedConnectionsView from '@/components/campus-connect/missed-connections-view';

type AppState = 'policy' | 'auth' | 'profile_setup' | 'home' | 'chat' | 'missed_connections';

function AppContent() {
  const { user, loading, profile } = useAuth();
  
  const getInitialState = (): AppState => {
    if (loading) return 'auth'; // Show loader, but logically it's part of auth flow
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

  const [appState, setAppState] = useState<AppState>('auth');
  
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

  const navigateTo = (state: AppState) => setAppState(state);

  switch (appState) {
    case 'policy':
      return <PolicyView onAgree={handleAgree} />;
    case 'auth':
      return <AuthView />;
    case 'profile_setup':
      return <ProfileSetupView />;
    case 'home':
      return <HomeView onNavigateTo1v1Chat={() => navigateTo('chat')} onNavigateToMissedConnections={() => navigateTo('missed_connections')} userName={profile?.name || 'User'} />;
    case 'chat':
      return <MainLayout onNavigateHome={() => navigateTo('home')} />;
    case 'missed_connections':
        return <MissedConnectionsView onNavigateHome={() => navigateTo('home')} />;
    default:
       return <AuthView />;
  }
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
