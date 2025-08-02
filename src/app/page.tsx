
"use client";

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import AuthView from '@/components/campus-connect/auth-view';
import PolicyView from '@/components/campus-connect/policy-view';
import { useState, useEffect } from 'react';
import ProfileSetupView from '@/components/campus-connect/profile-setup-view';
import HomeView from '@/components/campus-connect/home-view';
import EventsView from '@/components/campus-connect/events-view';
import MissedConnectionsView from '@/components/campus-connect/missed-connections-view';
import ProfileView from '@/components/campus-connect/profile-view';
import MainLayout from '@/components/campus-connect/main-layout';
import { Loader2 } from 'lucide-react';
import { goOffline, goOnline } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import AiAssistantView from '@/components/campus-connect/ai-assistant-view';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';

type AppState = 'loading' | 'policy' | 'auth' | 'verify_email' | 'profile_setup' | 'home' | 'events' | 'missed_connections' | 'chat' | 'ai_chat';

function VerifyEmailView() {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
            <Alert className="max-w-md">
                <AlertTitle className="text-xl font-bold">Verify Your Email</AlertTitle>
                <AlertDescription>
                    We've sent a verification link to your email address. Please check your inbox and click the link to continue. You can close this page after verifying.
                </AlertDescription>
            </Alert>
        </div>
    );
}

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

    if (!user.emailVerified) {
        setAppState('verify_email');
        return;
    }
    
    if (!profile) {
      // Still waiting for profile to load, stay in a loading-like state
      setAppState('loading');
      return;
    }

    if (!profile.profileComplete) {
      setAppState('profile_setup');
      return;
    }
    
    // If we've gotten past profile setup, default to home.
    // Avoids reverting to 'home' if user navigates away and state changes.
    if (['profile_setup', 'auth', 'policy', 'loading', 'verify_email'].includes(appState)) {
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
          case 'verify_email':
            return <VerifyEmailView />;
          case 'profile_setup':
            return <ProfileSetupView />;
          case 'home':
            return <HomeView 
              onNavigateToEvents={() => navigateTo('events')} 
              onNavigateToMissedConnections={() => navigateTo('missed_connections')}
              onNavigateToChat={() => navigateTo('chat')}
              onNavigateToAIChat={() => navigateTo('ai_chat')}
              userName={profile?.name || 'User'}
              onOpenProfile={() => setProfileOpen(true)}
              userAvatar={profile?.avatar}
              onlineCount={onlineCount}
            />;
          case 'events':
            return <EventsView onNavigateHome={() => navigateTo('home')} />;
          case 'missed_connections':
            return <MissedConnectionsView onNavigateHome={() => navigateTo('home')} />;
          case 'chat':
            return <MainLayout onNavigateHome={() => navigateTo('home')} />;
          case 'ai_chat':
            return (
              <div className="flex h-screen">
                <div className="w-full max-w-2xl mx-auto flex flex-col h-full p-4">
                  <Button onClick={() => navigateTo('home')} className="mb-4 self-start">Back to Home</Button>
                  <AiAssistantView />
                </div>
              </div>
            );
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
