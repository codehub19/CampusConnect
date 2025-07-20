"use client";

import React, { useState } from 'react';
import { Bot, MessageSquare, User as UserIcon } from 'lucide-react';
import {
  SidebarProvider,
  Sidebar,
  SidebarHeader,
  SidebarContent,
  SidebarInset,
  SidebarMenu,
  SidebarMenuItem,
  SidebarMenuButton,
  SidebarGroup,
  SidebarSeparator,
} from '@/components/ui/sidebar';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import ProfileView from '@/components/campus-connect/profile-view';
import ChatView from '@/components/campus-connect/chat-view';
import AiAssistantView from '@/components/campus-connect/ai-assistant-view';
import WelcomeView from '@/components/campus-connect/welcome-view';
import { users, chats, currentUser } from '@/lib/data';
import type { User, Chat } from '@/lib/types';

export function MainLayout() {
  const [activeView, setActiveView] = useState<{ type: 'welcome' | 'chat' | 'ai', data?: { user: User, chat: Chat } }>({ type: 'welcome' });
  const [isProfileOpen, setProfileOpen] = useState(false);

  const handleSelectChat = (user: User) => {
    const chat = chats.find(c => c.userIds.includes(user.id));
    if (chat) {
      setActiveView({ type: 'chat', data: { user, chat } });
    }
  };

  const handleSelectAi = () => {
    setActiveView({ type: 'ai' });
  };
  
  const renderView = () => {
    switch (activeView.type) {
      case 'chat':
        return activeView.data ? <ChatView user={activeView.data.user} chat={activeView.data.chat} /> : <WelcomeView />;
      case 'ai':
        return <AiAssistantView />;
      case 'welcome':
      default:
        return <WelcomeView />;
    }
  };

  return (
    <SidebarProvider>
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center gap-2">
            <Button variant="ghost" size="icon" className="h-8 w-8 bg-primary text-primary-foreground rounded-full">
              <MessageSquare className="h-4 w-4" />
            </Button>
            <h1 className="text-lg font-semibold text-foreground">CampusConnect</h1>
          </div>
        </SidebarHeader>
        <SidebarContent>
          <SidebarMenu>
            <SidebarMenuItem>
              <Dialog open={isProfileOpen} onOpenChange={setProfileOpen}>
                <DialogTrigger asChild>
                  <Button variant="ghost" className="w-full justify-start gap-2">
                    <Avatar className="h-8 w-8">
                       <AvatarImage src="https://placehold.co/100x100" alt={currentUser.name} data-ai-hint="profile avatar" />
                       <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{currentUser.name}</span>
                      <span className="text-xs text-muted-foreground">My Profile</span>
                    </div>
                  </Button>
                </DialogTrigger>
                <ProfileView user={currentUser} onOpenChange={setProfileOpen} />
              </Dialog>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarSeparator />
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={handleSelectAi}
                  isActive={activeView.type === 'ai'}
                  tooltip="AI Assistant"
                >
                  <Bot />
                  <span>AI Assistant</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarSeparator />
          <SidebarGroup>
            <SidebarMenu>
              {users.map(user => (
                <SidebarMenuItem key={user.id}>
                  <SidebarMenuButton
                    onClick={() => handleSelectChat(user)}
                    isActive={activeView.type === 'chat' && activeView.data?.user.id === user.id}
                    tooltip={user.name}
                  >
                    <Avatar className="h-6 w-6 relative flex items-center justify-center">
                      <AvatarImage src={user.avatar} alt={user.name} />
                      <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
                      {user.online && <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-sidebar-background" />}
                    </Avatar>
                    <span>{user.name}</span>
                  </SidebarMenuButton>
                </SidebarMenuItem>
              ))}
            </SidebarMenu>
          </SidebarGroup>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>{renderView()}</SidebarInset>
    </SidebarProvider>
  );
}
