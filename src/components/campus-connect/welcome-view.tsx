
"use client";

import React from 'react';
import { Bot, MessageSquareText, Search } from 'lucide-react';
import { Button } from '@/components/ui/button';

export default function WelcomeView() {
  return (
    <div className="flex flex-col items-center justify-center h-full text-center p-8 bg-background">
      <MessageSquareText className="h-16 w-16 text-primary mb-4" />
      <h1 className="text-3xl font-bold mb-2">Welcome to 1-on-1 Chat</h1>
      <p className="text-muted-foreground max-w-md mb-6">
        You're all set! Use the sidebar to start a new random chat or continue a previous conversation.
      </p>
      <div className="flex flex-col gap-4 w-full max-w-xs">
          <p className="text-sm text-muted-foreground">
            Click "Find New Chat" in the sidebar to get started.
          </p>
      </div>
    </div>
  );
}
