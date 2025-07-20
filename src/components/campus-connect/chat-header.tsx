"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquarePlus, LogOut, Video, Gamepad2, UserPlus, ShieldAlert, MoreVertical } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu"
import type { User, Chat } from '@/lib/types';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'ai' }
  | { type: 'chat', data: { user: User, chat: Chat } };

interface ChatHeaderProps {
  activeView: ActiveView;
  onFindChat: () => void;
  onLeaveChat: () => void;
  isSearching: boolean;
}

export default function ChatHeader({ activeView, onFindChat, onLeaveChat, isSearching }: ChatHeaderProps) {
  const renderContent = () => {
    switch (activeView.type) {
      case 'chat':
        const { user } = activeView.data;
        return (
          <>
            <div className="flex items-center gap-3">
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div>
                    <h2 className="font-semibold text-lg">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{user.online ? 'Online' : 'Offline'}</p>
                </div>
            </div>
            <div className="flex items-center gap-1">
                 <Button variant="ghost" size="icon" className="rounded-full">
                    <UserPlus className="h-5 w-5" />
                    <span className="sr-only">Add Friend</span>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Gamepad2 className="h-5 w-5" />
                    <span className="sr-only">Play Game</span>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full">
                    <Video className="h-5 w-5" />
                    <span className="sr-only">Video Call</span>
                </Button>
                 <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="ghost" size="icon" className="rounded-full">
                        <MoreVertical className="h-5 w-5" />
                        <span className="sr-only">More Options</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end">
                    <DropdownMenuItem className="text-destructive focus:text-destructive-foreground focus:bg-destructive">
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      <span>Block User</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                <Button onClick={onLeaveChat} variant="destructive" size="sm" className="ml-2">
                    <LogOut className="mr-2 h-4 w-4" />
                    Leave
                </Button>
            </div>
          </>
        );
      case 'ai':
        return (
            <>
                <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-lg">AI Assistant</h2>
                </div>
                <Button onClick={() => window.location.reload()} variant="outline" size="sm">
                    End Chat
                </Button>
            </>
        );
      case 'welcome':
      default:
        return (
          <>
            <h2 className="font-semibold text-lg">Welcome</h2>
            <Button onClick={onFindChat} disabled={isSearching}>
              {isSearching ? (
                <>
                  <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                  Searching...
                </>
              ) : (
                <>
                  <MessageSquarePlus className="mr-2 h-4 w-4" />
                  Find New Chat
                </>
              )}
            </Button>
          </>
        );
    }
  };

  return (
    <div className="flex-shrink-0 flex items-center justify-between p-3 border-b">
      {renderContent()}
    </div>
  );
}
