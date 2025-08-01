
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, SidebarRail } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Search, MessageSquare, ArrowLeft } from 'lucide-react';
import ChatView from './chat-view';
import WelcomeView from './welcome-view';
import VideoCallView from './video-call-view';
import type { Chat, User as UserProfile } from '@/lib/types';
import { collection, query, where, onSnapshot, getFirestore, getDocs, doc, runTransaction, addDoc, serverTimestamp, setDoc, updateDoc, deleteField } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'chat', data: { chat: Chat, user: UserProfile } };

export default function MainLayout({ onNavigateHome }: { onNavigateHome: () => void; }) {
  const { user, profile, logout } = useAuth();
  const [chats, setChats] = useState<Chat[]>([]);
  const [chatUsers, setChatUsers] = useState<Record<string, UserProfile>>({});
  const [isLoadingChats, setIsLoadingChats] = useState(true);
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
  const [isSearching, setIsSearching] = useState(false);
  const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
  
  const unsubscribeUserDoc = useRef<() => void | null>(null);
  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  const cleanupListeners = useCallback(() => {
    if (unsubscribeUserDoc.current) {
      unsubscribeUserDoc.current();
      unsubscribeUserDoc.current = null;
    }
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, 'chats'), where('memberIds', 'array-contains', user.uid));
    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedChats: Chat[] = [];
      const userIdsToFetch = new Set<string>();

      snapshot.forEach(doc => {
        const chat = { id: doc.id, ...doc.data() } as Chat;
        fetchedChats.push(chat);
        chat.memberIds.forEach(id => {
          if (id !== user.uid) userIdsToFetch.add(id);
        });
      });
      
      if(userIdsToFetch.size > 0){
        const newUsers = {...chatUsers};
        const usersToFetchNow = Array.from(userIdsToFetch).filter(id => !newUsers[id]);
        if(usersToFetchNow.length > 0){
            const usersQuery = query(collection(db, 'users'), where('id', 'in', usersToFetchNow));
            const usersSnapshot = await getDocs(usersQuery);
            usersSnapshot.forEach(doc => {
                newUsers[doc.id] = { id: doc.id, ...doc.data() } as UserProfile;
            });
            setChatUsers(newUsers);
        }
      }
      
      setChats(fetchedChats);
      setIsLoadingChats(false);
    });

    return () => unsubscribe();
  }, [user, db, chatUsers]);

  
  useEffect(() => {
     // This effect handles the listener for when a waiting user is found by someone else.
    if (isSearching) {
        if (unsubscribeUserDoc.current) unsubscribeUserDoc.current();

        const userDocRef = doc(db, 'users', user!.uid);
        unsubscribeUserDoc.current = onSnapshot(userDocRef, async (docSnap) => {
            const data = docSnap.data();
            if (data?.pendingChatId) {
                const chatId = data.pendingChatId;

                // Found a chat, stop searching and clean up
                setIsSearching(false);
                cleanupListeners();
                
                await updateDoc(userDocRef, { pendingChatId: deleteField() });
                
                const chatDoc = await getDoc(doc(db, 'chats', chatId));
                if (chatDoc.exists()) {
                    const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
                    const partnerId = chatData.memberIds.find(id => id !== user!.uid);
                    if (partnerId) {
                        const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                        if(partnerDoc.exists()){
                            setActiveView({ type: 'chat', data: { chat: chatData, user: partnerDoc.data() as UserProfile } });
                        }
                    }
                }
            }
        });
    } else {
        cleanupListeners();
    }

    return () => cleanupListeners();
  }, [isSearching, user, db, cleanupListeners]);

  const handleSelectChat = (chat: Chat) => {
    const partnerId = chat.memberIds.find(id => id !== user?.uid);
    if(partnerId && chatUsers[partnerId]){
        setActiveView({ type: 'chat', data: { chat, user: chatUsers[partnerId] } });
    }
  };

  const findNewChat = async () => {
    if (!user || !profile) return;
    if (isSearching) {
      // Stop searching
      await setDoc(doc(db, 'waiting_users', user.uid), { status: 'cancelled' }, { merge: true });
      setIsSearching(false);
      toast({ title: 'Search canceled' });
      return;
    }

    setIsSearching(true);
    toast({ title: 'Searching for a chat...' });

    const waitingUsersRef = collection(db, 'waiting_users');
    const blockedUsers = profile.blockedUsers || [];
    const q = query(
        waitingUsersRef, 
        where('uid', '!=', user.uid),
    );
    
    const querySnapshot = await getDocs(q);
    let matchFound = false;

    for (const docSnap of querySnapshot.docs) {
        const waitingUser = docSnap.data() as UserProfile;
        
        const myPreference = profile.preference;
        const theirPreference = waitingUser.preference;
        const myGender = profile.gender;
        const theirGender = waitingUser.gender;

        const iMatchTheirPreference = theirPreference === 'anyone' || theirPreference === `${myGender}s`;
        const theyMatchMyPreference = myPreference === 'anyone' || myPreference === `${theirGender}s`;
        
        if (
            !blockedUsers.includes(waitingUser.id) && 
            !(waitingUser.blockedUsers || []).includes(user.uid) &&
            iMatchTheirPreference && theyMatchMyPreference
        ) {
            
            // Found a potential partner, try to claim them in a transaction
            try {
                const newChatId = await runTransaction(db, async (transaction) => {
                    const waitingUserDocRef = doc(db, 'waiting_users', waitingUser.id);
                    const waitingUserDoc = await transaction.get(waitingUserDocRef);

                    if (!waitingUserDoc.exists()) {
                        // They were already matched, continue to next user
                        return null;
                    }
                    
                    transaction.delete(waitingUserDocRef);

                    const newChatDoc = doc(collection(db, 'chats'));
                    const chatData: Omit<Chat, 'id'> = {
                        memberIds: [user.uid, waitingUser.id],
                        members: {
                            [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: true },
                            [waitingUser.id]: { name: waitingUser.name, avatar: waitingUser.avatar, online: true, active: true },
                        },
                        createdAt: serverTimestamp()
                    }
                    transaction.set(newChatDoc, chatData);
                    
                    // Notify the other user by setting their pendingChatId
                    transaction.update(doc(db, 'users', waitingUser.id), { pendingChatId: newChatDoc.id });

                    return newChatDoc.id;
                });
                
                if (newChatId) {
                    matchFound = true;
                    const newChatDoc = await getDoc(doc(db, 'chats', newChatId));
                    setActiveView({
                        type: 'chat',
                        data: {
                            chat: { id: newChatId, ...newChatDoc.data() } as Chat,
                            user: waitingUser,
                        },
                    });
                    break; // Exit loop once a match is successfully made
                }

            } catch (error) {
                console.error("Matchmaking transaction failed:", error);
            }
        }
    }

    if(matchFound){
        setIsSearching(false);
        toast.dismiss();
    } else {
        // No match found, add to waiting pool
        await setDoc(doc(db, 'waiting_users', user.uid), {
            ...profile,
            uid: user.uid,
            timestamp: serverTimestamp(),
        });
    }
  };

  const renderActiveView = () => {
    switch (activeView.type) {
      case 'chat':
        return <ChatView key={activeView.data.chat.id} chat={activeView.data.chat} partner={activeView.data.user} onVideoCallToggle={setIsVideoCallOpen} />;
      case 'welcome':
      default:
        return <WelcomeView />;
    }
  };

  return (
    <SidebarProvider>
      {activeView.type === 'chat' && isVideoCallOpen &&
        <VideoCallView 
          chatId={activeView.data.chat.id}
          onClose={() => setIsVideoCallOpen(false)}
        />
      }
      <Sidebar>
        <SidebarHeader>
          <div className="flex items-center justify-between">
             <Button variant="ghost" size="icon" onClick={onNavigateHome}>
                <ArrowLeft />
             </Button>
            <h2 className="font-semibold text-lg">My Chats</h2>
            <SidebarTrigger />
          </div>
        </SidebarHeader>
        <SidebarContent className="p-2">
            <SidebarMenu>
                {isLoadingChats ? (
                    Array.from({length: 3}).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                ) : chats.length === 0 ? (
                    <div className="text-center text-sm text-muted-foreground p-4">No chats yet. Find one!</div>
                ) : (
                    chats.map(chat => {
                        const partnerId = chat.memberIds.find(id => id !== user?.uid);
                        if(!partnerId) return null;
                        const partner = chatUsers[partnerId];
                        return (
                        <SidebarMenuItem key={chat.id}>
                            <SidebarMenuButton
                            onClick={() => handleSelectChat(chat)}
                            isActive={activeView.type === 'chat' && activeView.data.chat.id === chat.id}
                            >
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={partner?.avatar} alt={partner?.name} />
                                <AvatarFallback>{partner?.name?.charAt(0) || '?'}</AvatarFallback>
                            </Avatar>
                            <span className="truncate">{partner?.name || 'Loading...'}</span>
                            </SidebarMenuButton>
                        </SidebarMenuItem>
                        )
                    })
                )}
            </SidebarMenu>
        </SidebarContent>
        <SidebarFooter className="p-2 space-y-2">
          <Button onClick={findNewChat} disabled={!profile?.profileComplete}>
            <Search className="mr-2 h-4 w-4" />
            {isSearching ? 'Stop Searching' : 'Find New Chat'}
          </Button>
          <Button variant="ghost" onClick={logout}>
            <LogOut className="mr-2 h-4 w-4" />
            Logout
          </Button>
        </SidebarFooter>
      </Sidebar>
      <SidebarInset>
        {renderActiveView()}
      </SidebarInset>
      <SidebarRail />
    </SidebarProvider>
  );
}
