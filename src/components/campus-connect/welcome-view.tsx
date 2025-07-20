"use client";

import { MessageSquareDashed } from 'lucide-react';

export default function WelcomeView() {
  return (
    <div className="flex h-full flex-col items-center justify-center bg-card rounded-xl">
      <MessageSquareDashed className="h-16 w-16 text-muted-foreground mb-4" />
      <h2 className="text-2xl font-bold tracking-tight">Welcome to CampusConnect</h2>
      <p className="text-muted-foreground">Select a friend or the AI assistant to start chatting.</p>
    </div>
  );
}
