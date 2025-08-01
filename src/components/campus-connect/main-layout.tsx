
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Search, MessageSquare, ArrowLeft, Gamepad2, Video, MoreVertical } from 'lucide-react';
import ChatView from './chat-view';
import WelcomeView from './welcome-view';
import VideoCallView from './video-call-view';
import type { Chat, User as UserProfile } from '@/lib/types';
import { collection, query, where, onSnapshot, getFirestore, getDocs, doc, runTransaction, addDoc, serverTimestamp, setDoc, updateDoc, deleteField, writeBatch, deleteDoc, orderBy, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from '../ui/dropdown-menu';
import ChatHeader from './chat-header';
import GameCenterView from './game-center-view';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'chat', data: { chat: Chat, user: UserProfile } };

function MainHeader({ onNavigateHome }: { onNavigateHome: () => void }) {
    const { activeView, onBlockUser, onLeaveChat, onVideoCallToggle, onGameToggle } = useMainLayout();

    if (activeView.type !== 'chat') {
      return (
         <div className="flex h-14 items-center justify-between gap-4 border-b bg-background p-2 px-4">
             <div className="flex items-center gap-2">
                <SidebarTrigger className="md:hidden" />
            </div>
             <h2 className="font-semibold text-lg">Welcome</h2>
         </div>
      )
    }

    return (
       <ChatHeader
          partner={activeView.data.user}
          onGameClick={() => onGameToggle(true)}
          onVideoCallClick={() => onVideoCallToggle(true)}
          onBlockUser={onBlockUser}
          onLeaveChat={onLeaveChat}
        />
    )
}

type MainLayoutContextType = {
  activeView: ActiveView;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
  onBlockUser: () => void;
  onLeaveChat: () => void;
  onVideoCallToggle: (isOpen: boolean) => void;
  onGameToggle: (isOpen: boolean) => void;
  isSearching: boolean;
};

const MainLayoutContext = React.createContext<MainLayoutContextType | null>(null);

const useMainLayout = () => {
    const context = React.useContext(MainLayoutContext);
    if (!context) {
        throw new Error('useMainLayout must be used within a MainLayoutProvider');
    }
    return context;
};

function LayoutUI({ onNavigateHome, onFindNewChat, chats, chatUsers, isLoadingChats, onSelectChat, onLogout }: {
    onNavigateHome: () => void;
    onFindNewChat: () => void;
    chats: Chat[];
    chatUsers: Record<string, UserProfile>;
    isLoadingChats: boolean;
    onSelectChat: (chat: Chat) => void;
    onLogout: () => void;
}) {
    const { activeView, isSearching } = useMainLayout();
    const { user } = useAuth();
    
    const renderActiveView = () => {
        switch (activeView.type) {
            case 'chat':
                return <ChatView key={activeView.data.chat.id} chat={activeView.data.chat} partner={activeView.data.user} />;
            case 'welcome':
            default:
                return <WelcomeView />;
        }
    };

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center justify-between">
                        <Button variant="ghost" size="icon" onClick={onNavigateHome}><ArrowLeft /></Button>
                        <h2 className="font-semibold text-lg">My Chats</h2>
                        <div className="w-7 h-7" />
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <SidebarMenu>
                        {isLoadingChats ? (
                            Array.from({ length: 3 }).map((_, i) => <Skeleton key={i} className="h-12 w-full" />)
                        ) : chats.length === 0 ? (
                            <div className="text-center text-sm text-muted-foreground p-4">No chats yet. Find one!</div>
                        ) : (
                            chats.map(chat => {
                                const partnerId = chat.memberIds.find(id => id !== user?.uid);
                                if (!partnerId) return null;
                                const partner = chatUsers[partnerId];
                                return (
                                    <SidebarMenuItem key={chat.id}>
                                        <SidebarMenuButton
                                            onClick={() => onSelectChat(chat)}
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
                    <Button onClick={onFindNewChat} disabled={isSearching}>
                        <Search className="mr-2 h-4 w-4" />
                        {isSearching ? 'Searching...' : 'Find New Chat'}
                    </Button>
                    <Button variant="ghost" onClick={onLogout}>
                        <LogOut className="mr-2 h-4 w-4" />
                        Logout
                    </Button>
                </SidebarFooter>
            </Sidebar>
            <SidebarInset>
                 <MainHeader onNavigateHome={onNavigateHome} />
                {renderActiveView()}
            </SidebarInset>
        </SidebarProvider>
    );
}

function MainLayoutContent({ onNavigateHome }: { onNavigateHome: () => void; }) {
    const { user, profile, logout } = useAuth();
    const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
    const [chats, setChats] = useState<Chat[]>([]);
    const [chatUsers, setChatUsers] = useState<Record<string, UserProfile>>({});
    const [isLoadingChats, setIsLoadingChats] = useState(true);
    const [isSearching, setIsSearching] = useState(false);
    const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
    const [isGameCenterOpen, setGameCenterOpen] = useState(false);
    
    const unsubscribeUserDoc = useRef<() => void | null>(null);
    const { toast, dismiss } = useToast();
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
            
            // Client-side sorting
            fetchedChats.sort((a, b) => {
              const timeA = a.createdAt?.seconds || 0;
              const timeB = b.createdAt?.seconds || 0;
              return timeB - timeA;
            });

            if (userIdsToFetch.size > 0) {
                const newUsers = { ...chatUsers };
                const usersToFetchNow = Array.from(userIdsToFetch).filter(id => !newUsers[id]);
                if (usersToFetchNow.length > 0) {
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
        }, (error) => {
            console.error("Firestore query failed:", error);
            setIsLoadingChats(false);
            toast({
                variant: 'destructive',
                title: 'Could not load chats',
                description: 'Please check your connection or try again later.',
            });
        });

        return () => unsubscribe();
    }, [user, db, chatUsers, toast]);

    useEffect(() => {
        if (isSearching && user) {
            if (unsubscribeUserDoc.current) unsubscribeUserDoc.current();
            const userDocRef = doc(db, 'users', user.uid);
            unsubscribeUserDoc.current = onSnapshot(userDocRef, async (docSnap) => {
                const data = docSnap.data();
                if (data?.pendingChatId) {
                    const chatId = data.pendingChatId;
                    setIsSearching(false);
                    cleanupListeners();

                    await updateDoc(userDocRef, { pendingChatId: deleteField() });

                    const chatDoc = await getDoc(doc(db, 'chats', chatId));
                    if (chatDoc.exists()) {
                        const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
                        const partnerId = chatData.memberIds.find(id => id !== user.uid);
                        if (partnerId) {
                            let partner = chatUsers[partnerId];
                            if (!partner) {
                                const partnerDoc = await getDoc(doc(db, 'users', partnerId));
                                if (partnerDoc.exists()) {
                                    partner = { id: partnerDoc.id, ...partnerDoc.data() } as UserProfile;
                                    setChatUsers(prev => ({ ...prev, [partnerId]: partner }));
                                }
                            }
                            if (partner) {
                                setActiveView({ type: 'chat', data: { chat: chatData, user: partner } });
                            }
                        }
                    }
                }
            });
        } else {
            cleanupListeners();
        }
        return () => cleanupListeners();
    }, [isSearching, user, db, cleanupListeners, chatUsers]);

    const handleSelectChat = (chat: Chat) => {
        const partnerId = chat.memberIds.find(id => id !== user?.uid);
        if (partnerId && chatUsers[partnerId]) {
            setActiveView({ type: 'chat', data: { chat, user: chatUsers[partnerId] } });
        }
    };

    const findNewChat = async () => {
        if (!user || !profile) return;
        if (isSearching) {
            const waitingUserRef = doc(db, 'waiting_users', user.uid);
            await deleteDoc(waitingUserRef);
            setIsSearching(false);
            toast({ title: 'Search canceled' });
            return;
        }

        setIsSearching(true);
        toast({ title: 'Searching for a chat...' });

        const waitingUsersRef = collection(db, 'waiting_users');
        const blockedUsers = profile.blockedUsers || [];
        const q = query(waitingUsersRef, where('uid', '!=', user.uid));

        const querySnapshot = await getDocs(q);
        let matchFound = false;
        
        for (const docSnap of querySnapshot.docs) {
            const waitingUser = docSnap.data() as UserProfile;
            
            const iMatchTheirPreference = profile.gender ? (waitingUser.preference === 'anyone' || waitingUser.preference === `${profile.gender}s`) : true;
            const theyMatchMyPreference = waitingUser.gender ? (profile.preference === 'anyone' || profile.preference === `${waitingUser.gender}s`) : true;

            if (!blockedUsers.includes(waitingUser.id) && !(waitingUser.blockedUsers || []).includes(user.uid) && iMatchTheirPreference && theyMatchMyPreference) {
                 
                 const partnerFinal = waitingUser;
                 try {
                     const newChatId = await runTransaction(db, async (transaction) => {
                         const waitingUserDocRef = doc(db, 'waiting_users', partnerFinal.id);
                         const waitingUserDoc = await transaction.get(waitingUserDocRef);
                         if (!waitingUserDoc.exists()) return null;
     
                         transaction.delete(waitingUserDocRef);
     
                         const newChatRef = doc(collection(db, 'chats'));
                         const chatData: Omit<Chat, 'id'> = {
                             memberIds: [user.uid, partnerFinal.id],
                             members: {
                                 [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: true },
                                 [partnerFinal.id]: { name: partnerFinal.name, avatar: partnerFinal.avatar, online: true, active: true },
                             },
                             createdAt: serverTimestamp()
                         }
                         transaction.set(newChatRef, chatData);
     
                         transaction.update(doc(db, 'users', partnerFinal.id), { pendingChatId: newChatRef.id });
                         return newChatRef.id;
                     });
     
                     if (newChatId) {
                         const newChatDoc = await getDoc(doc(db, 'chats', newChatId));
                         if (newChatDoc.exists()) {
                             setActiveView({
                                 type: 'chat',
                                 data: {
                                     chat: { id: newChatId, ...newChatDoc.data() } as Chat,
                                     user: partnerFinal,
                                 },
                             });
                         }
                         matchFound = true;
                     }
                 } catch (error) {
                     console.error("Matchmaking transaction failed:", error);
                     toast({ variant: 'destructive', title: "Matchmaking failed", description: "Please try again." });
                 }
                 if (matchFound) break;
            }
        }
        
        setIsSearching(false);
        dismiss();

        if (matchFound) return;
        
        // No match found, so wait
        setIsSearching(true);
        toast({ title: "No users found, waiting for someone to join..." });
        await setDoc(doc(db, 'waiting_users', user.uid), {
            ...profile,
            id: user.uid,
            uid: user.uid,
            timestamp: serverTimestamp(),
        });
    };

    const handleBlockUser = async () => {
        if (activeView.type !== 'chat') return;
        const partnerId = activeView.data.user.id;
        if (!user || !partnerId) return;

        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: [...(profile?.blockedUsers || []), partnerId] });
        toast({ title: "User Blocked", description: `You will not be matched with ${activeView.data.user.name} again.` });
        setActiveView({ type: 'welcome' });
    };

    const handleLeaveChat = async () => {
        if (activeView.type !== 'chat') return;
        const chatId = activeView.data.chat.id;
        if (!user || !chatId) return;

        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { [`members.${user.uid}.active`]: false });
        toast({ title: "You have left the chat." });
        setActiveView({ type: 'welcome' });
    }

    const providerValue = {
        activeView,
        setActiveView,
        onBlockUser: handleBlockUser,
        onLeaveChat: handleLeaveChat,
        onVideoCallToggle: setIsVideoCallOpen,
        onGameToggle: setGameCenterOpen,
        isSearching
    };

    return (
        <MainLayoutContext.Provider value={providerValue}>
            {activeView.type === 'chat' && isVideoCallOpen &&
                <VideoCallView
                    chatId={activeView.data.chat.id}
                    onClose={() => setIsVideoCallOpen(false)}
                />
            }
             {activeView.type === 'chat' && isGameCenterOpen &&
                <GameCenterView
                    isOpen={isGameCenterOpen}
                    onOpenChange={setGameCenterOpen}
                    chatId={activeView.data.chat.id}
                    partnerId={activeView.data.user.id}
                />
            }
            <LayoutUI 
                onNavigateHome={onNavigateHome}
                onFindNewChat={findNewChat}
                chats={chats}
                chatUsers={chatUsers}
                isLoadingChats={isLoadingChats}
                onSelectChat={handleSelectChat}
                onLogout={logout}
            />
        </MainLayoutContext.Provider>
    );
}

export default function MainLayoutWrapper({ onNavigateHome }: { onNavigateHome: () => void; }) {
    return (
        <MainLayoutContent onNavigateHome={onNavigateHome} />
    )
}
