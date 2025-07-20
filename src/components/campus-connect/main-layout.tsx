"use client";

import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare } from 'lucide-react';
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
import ChatHeader from '@/components/campus-connect/chat-header';
import { useAuth } from '@/hooks/use-auth';
import type { User, Chat } from '@/lib/types';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, query, where, getDocs, deleteDoc, addDoc, updateDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'ai' }
  | { type: 'chat', data: { user: User, chat: Chat } };

export function MainLayout() {
  const { user, profile, logout, updateProfile } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [users, setUsers] = useState<User[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const { toast } = useToast();

  const db = getFirestore(firebaseApp);

  useEffect(() => {
    if (!user) return;
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('id', '!=', user.uid));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedUsers: User[] = [];
      snapshot.forEach((doc) => {
        fetchedUsers.push(doc.data() as User);
      });
      setUsers(fetchedUsers);
    });

    return () => unsubscribe();
  }, [user, db]);
  
  // Listen for matches
   useEffect(() => {
    if (!user || !isSearching) return;

    const waitingDocRef = doc(db, 'waiting_users', user.uid);
    const unsubscribe = onSnapshot(waitingDocRef, async (docSnap) => {
      if (docSnap.exists() && docSnap.data().matchedChatId) {
        const matchedChatId = docSnap.data().matchedChatId;
        await deleteDoc(waitingDocRef);
        
        const chatDocRef = doc(db, 'chats', matchedChatId);
        const chatDoc = await getDoc(chatDocRef);
        if(chatDoc.exists()) {
          const chatData = chatDoc.data() as Chat;
          const partnerId = chatData.userIds.find(id => id !== user.uid);
          if (partnerId) {
             const partnerDoc = await getDoc(doc(db, 'users', partnerId));
             if (partnerDoc.exists()) {
                const partnerProfile = partnerDoc.data() as User;
                setActiveView({ type: 'chat', data: { user: partnerProfile, chat: chatData } });
             }
          }
        }
        setIsSearching(false);
      }
    });

    return () => unsubscribe();
  }, [user, isSearching, db]);

  const handleProfileUpdate = async (updatedUser: User) => {
    await updateProfile(updatedUser);
    if(profile) {
       setActiveView(prev => {
        if(prev.type === 'chat' && prev.data.user.id === updatedUser.id) {
          return { ...prev, data: { ...prev.data, user: updatedUser } }
        }
        return prev;
      });
    }
  };

  const handleSelectChat = (user: User) => {
    // This part will be updated to fetch or create a chat from Firestore
    const mockChat: Chat = {
        id: `chat-${user.id}`,
        userIds: [profile!.id, user.id],
        messages: [],
    };
    setActiveView({ type: 'chat', data: { user, chat: mockChat } });
  };

  const handleSelectAi = () => {
    setActiveView({ type: 'ai' });
  };

  const handleFindChat = async () => {
    if (!user || !profile) return;

    if (isSearching) {
        setIsSearching(false);
        await deleteDoc(doc(db, 'waiting_users', user.uid));
        toast({ title: 'Search stopped.' });
        return;
    }

    setIsSearching(true);
    toast({ title: 'Searching for a chat...' });

    const waitingUsersRef = collection(db, 'waiting_users');
    const q = query(waitingUsersRef, where('id', '!=', user.uid));
    const querySnapshot = await getDocs(q);

    let partner: User | null = null;
    let partnerWaitingDocId: string | null = null;
    
    // Simple matchmaking: find the first user
    if(!querySnapshot.empty){
        const partnerDoc = querySnapshot.docs[0];
        partnerWaitingDocId = partnerDoc.id;
        partner = partnerDoc.data() as User;
    }

    if (partner && partnerWaitingDocId) {
        // Match found
        const newChatRef = doc(collection(db, 'chats'));
        const newChat: Chat = {
            id: newChatRef.id,
            userIds: [user.uid, partner.id],
            messages: [],
        };
        await setDoc(newChatRef, newChat);

        // Notify partner
        await updateDoc(doc(db, 'waiting_users', partnerWaitingDocId), { matchedChatId: newChatRef.id });
        
        setActiveView({type: 'chat', data: { user: partner, chat: newChat }});
        setIsSearching(false);
        toast({ title: "Chat found!", description: `You've been connected with ${partner.name}.` });
    } else {
        // No match, add to waiting list
        await setDoc(doc(db, 'waiting_users', user.uid), {
            id: user.uid,
            name: profile.name,
            avatar: profile.avatar,
            online: true,
            gender: profile.gender,
            interests: profile.interests,
            timestamp: serverTimestamp(),
        });
    }
  };
  
  const handleLeaveChat = () => {
    setActiveView({ type: 'welcome' });
    toast({ title: "You left the chat."});
  }

  if (!user || !profile) {
    return null; 
  }

  const renderView = () => {
    switch (activeView.type) {
      case 'chat':
        return activeView.data ? <ChatView user={activeView.data.user} chat={activeView.data.chat} currentUser={profile} /> : <WelcomeView onFindChat={handleFindChat} />;
      case 'ai':
        return <AiAssistantView />;
      case 'welcome':
      default:
        return <WelcomeView onFindChat={handleFindChat} />;
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
                       <AvatarImage src={profile.avatar} alt={profile.name} data-ai-hint="profile avatar" />
                       <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                    </Avatar>
                    <div className="flex flex-col items-start">
                      <span className="font-medium">{profile.name}</span>
                      <span className="text-xs text-muted-foreground">My Profile</span>
                    </div>
                  </Button>
                </DialogTrigger>
                <ProfileView user={profile} onOpenChange={setProfileOpen} onProfileUpdate={handleProfileUpdate} />
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
         <SidebarHeader>
            <Button onClick={logout} variant="ghost" className="w-full justify-center">
              Logout
            </Button>
        </SidebarHeader>
      </Sidebar>
      <SidebarInset>
        <div className="h-screen flex flex-col">
            <ChatHeader 
              activeView={activeView} 
              onFindChat={handleFindChat} 
              onLeaveChat={handleLeaveChat}
              isSearching={isSearching}
            />
            <div className="flex-1 min-h-0">
              {renderView()}
            </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
