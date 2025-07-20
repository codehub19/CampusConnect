"use client";

import { AuthProvider, useAuth } from '@/hooks/use-auth';
import AuthView from '@/components/campus-connect/auth-view';
import { MainLayout } from '@/components/campus-connect/main-layout';
import PolicyView from '@/components/campus-connect/policy-view';
import { useState } from 'react';
import ProfileSetupView from '@/components/campus-connect/profile-setup-view';

function AppContent() {
  const { user, loading, profile } = useAuth();
  const [policyAgreed, setPolicyAgreed] = useState(() => {
    if (typeof window !== 'undefined') {
      return localStorage.getItem('policyAgreed') === 'true';
    }
    return false;
  });

  const handleAgree = () => {
     if (typeof window !== 'undefined') {
      localStorage.setItem('policyAgreed', 'true');
    }
    setPolicyAgreed(true);
  };

  if (loading) {
    return (
      <div className="flex h-screen w-screen items-center justify-center bg-background">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary"></div>
      </div>
    );
  }

  if (!policyAgreed) {
    return <PolicyView onAgree={handleAgree} />;
  }

  if (!user || !profile) {
    return <AuthView />;
  }
  
  if (!profile.profileComplete && !profile.isGuest) {
    return <ProfileSetupView />;
  }
  
  return <MainLayout />;
}

export default function Home() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}
