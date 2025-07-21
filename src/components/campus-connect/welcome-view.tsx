
"use client";

import { Button } from '@/components/ui/button';
import { Loader2, MessageSquareDashed, Search } from 'lucide-react';

interface WelcomeViewProps {
  onFindChat: () => void;
  isSearching: boolean;
}

export default function WelcomeView({ onFindChat, isSearching }: WelcomeViewProps) {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-card rounded-xl p-6 text-center">
      <MessageSquareDashed className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold tracking-tight">Welcome to CampusConnect</h2>
      <p className="text-muted-foreground mb-6 max-w-sm">Select a friend from the sidebar to start a conversation, or find a new person to chat with.</p>
      <Button onClick={onFindChat} disabled={isSearching}>
        {isSearching ? (
          <>
            <Loader2 className="mr-2 h-4 w-4 animate-spin" />
            Searching...
          </>
        ) : (
          <>
            <Search className="mr-2 h-4 w-4" />
            Find New Chat
          </>
        )}
      </Button>
    </div>
  );
}

    