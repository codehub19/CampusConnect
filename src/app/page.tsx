
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
import { Loader2 } from 'lucide-react';
import { goOffline, goOnline } from 'firebase/database';
import { rtdb } from '@/lib/firebase';
import AiAssistantView from '@/components/campus-connect/ai-assistant-view';
import { Button } from '@/components/ui/button';
import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert';
import MainLayoutWrapper from '@/components/campus-connect/main-layout';

type AppState = 'loading' | 'policy' | 'auth' | 'verify_email' | 'profile_setup' | 'home' | 'events' | 'missed_connections' | 'chat' | 'ai_chat';

function VerifyEmailView({ onTryAnotherEmail }: { onTryAnotherEmail: () => void }) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background p-4">
            <Alert className="max-w-md">
                <AlertTitle className="text-xl font-bold">Verify Your Email</AlertTitle>
                <AlertDescription>
                    We've sent a verification link to your email address. Please check your inbox and click the link to continue. You can close this page after verifying.
                </AlertDescription>
                <div className="mt-4">
                    <Button variant="link" onClick={onTryAnotherEmail} className="p-0 text-muted-foreground">
                        Use a different email address
                    </Button>
                </div>
            </Alert>
        </div>
    );
}

function AppContent() {
  const { user, loading, profile, updateProfile, authModalOpen, setAuthModalOpen, logout } = useAuth();
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [appState, setAppState] = useState<AppState>('home'); // Default to home
  const [initialLoading, setInitialLoading] = useState(true);

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
      return;
    }
     // Once loading is false, the initial load is complete
    setInitialLoading(false);

    if (typeof window !== 'undefined' && localStorage.getItem('policyAgreed') !== 'true') {
      setAppState('policy');
      return;
    }

    if (!user) {
        // User is not logged in, but we allow them to browse.
        // We set the app state to home, but don't handle auth here.
        // Auth is handled by the modal triggered by `requireAuth`.
        if (['profile_setup', 'verify_email', 'chat'].includes(appState)) {
             setAppState('home');
        }
        return;
    }

    if (!user.emailVerified) {
        setAppState('verify_email');
        return;
    }
    
    if (profile && !profile.profileComplete) {
      setAppState('profile_setup');
      return;
    }
    
    // If we've gotten past all checks and are in a state only for logged-out/setup users, move to home.
    if (['policy', 'auth', 'verify_email', 'profile_setup'].includes(appState)) {
      setAppState('home');
    }

  }, [loading, user, profile, appState]);


  const handleAgree = () => {
    if (typeof window !== 'undefined') {
      localStorage.setItem('policyAgreed', 'true');
    }
    // The useEffect will now handle transitioning to the correct state
    setAppState('home');
  };

  const handleTryAnotherEmail = async () => {
    await logout();
    setAuthModalOpen(true);
    setAppState('home'); // or 'auth' to show the modal immediately
  };

  const navigateTo = (state: AppState) => {
    setAppState(state);
  }

  if (initialLoading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <Loader2 className="h-12 w-12 animate-spin text-primary" />
      </div>
    );
  }

  return (
    <>
      {authModalOpen && <AuthView />}
      {profile && <ProfileView user={profile} isOpen={isProfileOpen} onOpenChange={setProfileOpen} onProfileUpdate={updateProfile} />}

      {(() => {
        switch (appState) {
          case 'policy':
            return <PolicyView onAgree={handleAgree} />;
          case 'verify_email':
            return <VerifyEmailView onTryAnotherEmail={handleTryAnotherEmail} />;
          case 'profile_setup':
            return <ProfileSetupView />;
          case 'home':
            return <HomeView 
              onNavigateToEvents={() => navigateTo('events')} 
              onNavigateToMissedConnections={() => navigateTo('missed_connections')}
              onNavigateToChat={() => navigateTo('chat')}
              onNavigateToAIChat={() => navigateTo('ai_chat')}
              userName={profile?.name || 'Guest'}
              onOpenProfile={() => setProfileOpen(true)}
              userAvatar={profile?.avatar}
            />;
          case 'events':
            return <EventsView onNavigateHome={() => navigateTo('home')} />;
          case 'missed_connections':
            return <MissedConnectionsView onNavigateHome={() => navigateTo('home')} />;
          case 'chat':
            return <MainLayoutWrapper onNavigateHome={() => navigateTo('home')} />;
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
            return <HomeView onNavigateToEvents={() => navigateTo('events')} onNavigateToMissedConnections={() => navigateTo('missed_connections')} onNavigateToChat={() => navigateTo('chat')} onNavigateToAIChat={() => navigateTo('ai_chat')} userName="Guest" onOpenProfile={() => setProfileOpen(true)} />;
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
