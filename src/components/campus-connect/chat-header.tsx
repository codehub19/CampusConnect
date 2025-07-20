
"use client";

import React from 'react';
import { Button } from '@/components/ui/button';
import { Loader2, MessageSquarePlus, LogOut, Video, Gamepad2, UserPlus, ShieldAlert, MoreVertical, UserCheck, Menu, UserMinus, Search } from 'lucide-react';
import { Avatar, AvatarImage, AvatarFallback } from '@/components/ui/avatar';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
  DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu"
import type { User, Chat } from '@/lib/types';
import { useToast } from '@/hooks/use-toast';
import { SidebarTrigger } from '@/components/ui/sidebar';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'ai' }
  | { type: 'chat', data: { user: User, chat: Chat } };

interface ChatHeaderProps {
  activeView: ActiveView;
  onFindChat: () => void;
  onLeaveChat: () => void;
  onGoToWelcome: () => void;
  onAddFriend: () => void;
  onRemoveFriend: () => void;
  onBlockUser: () => void;
  onStartGame: () => void;
  onVideoCall: () => void;
  isSearching: boolean;
  isFriend?: boolean;
  isGuest?: boolean;
}

export default function ChatHeader({ activeView, onFindChat, onLeaveChat, onGoToWelcome, onAddFriend, onRemoveFriend, onBlockUser, isSearching, isFriend, isGuest, onStartGame, onVideoCall }: ChatHeaderProps) {
  const { toast } = useToast();

  const renderContent = () => {
    switch (activeView.type) {
      case 'chat':
        const { user } = activeView.data;
        return (
          <>
            <div className="flex items-center gap-3 min-w-0">
                <div className="md:hidden">
                    <SidebarTrigger>
                        <Menu />
                    </SidebarTrigger>
                </div>
                <Avatar className="h-10 w-10">
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="min-w-0">
                    <h2 className="font-semibold text-lg truncate">{user.name}</h2>
                    <p className="text-sm text-muted-foreground">{user.online ? 'Online' : 'Offline'}</p>
                </div>
            </div>
            <div className="flex items-center gap-1 md:gap-2 flex-shrink-0">
                 <Button 
                    variant="ghost" 
                    size="icon" 
                    className="rounded-full hidden sm:inline-flex" 
                    onClick={onAddFriend} 
                    disabled={isFriend || isGuest}
                    title={isGuest ? "Sign up to add friends" : (isFriend ? "Already friends" : "Add friend")}
                >
                    {isFriend ? <UserCheck className="h-5 w-5 text-green-500" /> : <UserPlus className="h-5 w-5" /> }
                    <span className="sr-only">Add Friend</span>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={onStartGame}>
                    <Gamepad2 className="h-5 w-5" />
                    <span className="sr-only">Play Game</span>
                </Button>
                <Button variant="ghost" size="icon" className="rounded-full" onClick={onVideoCall}>
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
                    <DropdownMenuItem 
                        className="sm:hidden"
                        onSelect={onAddFriend} 
                        disabled={isFriend || isGuest}
                    >
                        {isFriend ? <UserCheck className="mr-2 h-4 w-4 text-green-500" /> : <UserPlus className="mr-2 h-4 w-4" /> }
                        <span>{isFriend ? "Already friends" : "Add friend"}</span>
                    </DropdownMenuItem>
                    {!isFriend && (
                        <DropdownMenuItem 
                            className="text-destructive focus:text-destructive-foreground focus:bg-destructive sm:hidden"
                            onSelect={onLeaveChat}
                        >
                          <LogOut className="mr-2 h-4 w-4" />
                          <span>Leave Chat</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuSeparator className="sm:hidden" />
                    {isFriend && (
                        <DropdownMenuItem 
                            className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                            onSelect={onRemoveFriend}
                        >
                          <UserMinus className="mr-2 h-4 w-4" />
                          <span>Remove Friend</span>
                        </DropdownMenuItem>
                    )}
                    <DropdownMenuItem 
                        className="text-destructive focus:text-destructive-foreground focus:bg-destructive"
                        onSelect={onBlockUser}
                    >
                      <ShieldAlert className="mr-2 h-4 w-4" />
                      <span>Block User</span>
                    </DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
                {isFriend ? (
                    <Button onClick={onGoToWelcome} variant="outline" size="sm" className="ml-2 hidden sm:inline-flex">
                        <Search className="mr-2 h-4 w-4" />
                        Find Chat
                    </Button>
                ) : (
                    <Button onClick={onLeaveChat} variant="destructive" size="sm" className="ml-2 hidden sm:inline-flex">
                        <LogOut className="mr-2 h-4 w-4" />
                        Leave
                    </Button>
                )}
            </div>
          </>
        );
      case 'ai':
        return (
            <>
                <div className="flex items-center gap-3">
                    <div className="md:hidden">
                        <SidebarTrigger>
                            <Menu />
                        </SidebarTrigger>
                    </div>
                    <h2 className="font-semibold text-lg">AI Assistant</h2>
                </div>
                 <Button onClick={onLeaveChat} variant="outline" size="sm">
                    End Chat
                </Button>
            </>
        );
      case 'welcome':
      default:
        return (
          <>
            <div className="flex items-center gap-3">
              <div className="md:hidden">
                  <SidebarTrigger>
                      <Menu />
                  </SidebarTrigger>
              </div>
              <h2 className="font-semibold text-lg">Welcome</h2>
            </div>
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
