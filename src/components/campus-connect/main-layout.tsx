
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarMenu, SidebarMenuItem, SidebarMenuButton, SidebarFooter, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Search, UserPlus, X, Check, MessageSquare, ArrowLeft, Users } from 'lucide-react';
import ChatView from './chat-view';
import WelcomeView from './welcome-view';
import VideoCallView from './video-call-view';
import type { Chat, User as UserProfile, FriendRequest, WaitingUser } from '@/lib/types';
import { collection, query, where, onSnapshot, getFirestore, getDocs, doc, runTransaction, addDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, orderBy, getDoc, arrayUnion, writeBatch, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import ChatHeader from './chat-header';
import GameCenterView from './game-center-view';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import InactivityTimer from './inactivity-timer';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'chat', data: { chat: Chat, user: UserProfile } };

const MainLayoutContext = React.createContext<{
  activeView: ActiveView;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
  onBlockUser: () => void;
  onLeaveChat: (source: 'manual' | 'timeout') => void;
  onVideoCallToggle: (isOpen: boolean) => void;
  onGameToggle: (isOpen: boolean) => void;
  isSearching: boolean;
  onFindNewChat: () => void;
  onStopSearching: () => void;
  onStartChatWithFriend: (friendId: string) => void;
  onNavigateHome: () => void;
} | null>(null);

const useMainLayout = () => {
    const context = React.useContext(MainLayoutContext);
    if (!context) {
        throw new Error('useMainLayout must be used within a MainLayoutProvider');
    }
    return context;
};

function LayoutUI() {
    const { profile } = useAuth();
    const { onFindNewChat, isSearching, onStopSearching, onStartChatWithFriend, onNavigateHome } = useMainLayout();
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const db = getFirestore(firebaseApp);
    const { toast } = useToast();
    
    // Listen for friend requests
    useEffect(() => {
      if (!profile || profile.isGuest) return;
      const q = query(collection(db, 'friend_requests'), where("toId", "==", profile.id), where("status", "==", "pending"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setFriendRequests(requests);
      });
      return () => unsubscribe();
    }, [profile, db]);

    // Listen for friends list
    useEffect(() => {
        if (!profile || !profile.friends || profile.friends.length === 0) {
            setFriends([]);
            return;
        }
        const friendsQuery = query(collection(db, "users"), where("id", "in", profile.friends));
        const unsubscribe = onSnapshot(friendsQuery, (snapshot) => {
            const friendsData = snapshot.docs.map(doc => doc.data() as UserProfile);
            setFriends(friendsData);
        });
        return () => unsubscribe();
    }, [profile, db]);

    const handleAcceptFriend = async (req: FriendRequest) => {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', req.toId), { friends: arrayUnion(req.fromId) });
        
        const fromUserRef = doc(db, 'users', req.fromId);
        batch.update(fromUserRef, { friends: arrayUnion(req.toId) });

        batch.update(doc(db, 'friend_requests', req.id), { status: 'accepted' });
        
        await batch.commit();
        toast({ title: 'Friend Added!' });
    };

    const handleDeclineFriend = async (reqId: string) => {
        await deleteDoc(doc(db, 'friend_requests', reqId));
        toast({ title: 'Request Declined' });
    };
    
    const handleFindClick = () => {
        if (isSearching) {
            onStopSearching();
        } else {
            onFindNewChat();
        }
    }

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                     <div className="flex items-center justify-between">
                         <Button variant="ghost" size="icon" onClick={onNavigateHome}><ArrowLeft /></Button>
                         <h2 className="font-semibold text-lg">{profile?.name}</h2>
                         <Button variant="ghost" size="icon" onClick={() => useAuth().logout()}><LogOut /></Button>
                    </div>
                </SidebarHeader>
                <SidebarContent>
                    <Tabs defaultValue="friends" className="w-full p-2">
                        <TabsList className="grid w-full grid-cols-2">
                            <TabsTrigger value="random">Random Chat</TabsTrigger>
                            <TabsTrigger value="friends">Friends</TabsTrigger>
                        </TabsList>
                        <TabsContent value="random" className="text-center p-4 space-y-4">
                             <p className="text-sm text-muted-foreground">Find a random user to chat with.</p>
                             <Button onClick={handleFindClick} className="w-full">
                                <Search className="mr-2 h-4 w-4" />
                                {isSearching ? 'Searching...' : 'Find New Chat'}
                            </Button>
                        </TabsContent>
                        <TabsContent value="friends">
                            {friendRequests.length > 0 && (
                                <div className="space-y-2 py-2">
                                     <h4 className="font-semibold text-sm px-2">Friend Requests</h4>
                                     {friendRequests.map(req => (
                                         <div key={req.id} className="flex items-center justify-between p-2 rounded-md hover:bg-sidebar-accent">
                                            <span>{req.fromName}</span>
                                            <div className="flex gap-2">
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => handleAcceptFriend(req)}><Check/></Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDeclineFriend(req.id)}><X/></Button>
                                            </div>
                                         </div>
                                     ))}
                                </div>
                            )}
                            <div className="space-y-1 py-2">
                                <h4 className="font-semibold text-sm px-2">Friends ({friends.length})</h4>
                                {friends.length > 0 ? friends.map(friend => (
                                    <div key={friend.id} onClick={() => onStartChatWithFriend(friend.id)} className="flex items-center justify-between p-2 rounded-md hover:bg-sidebar-accent cursor-pointer">
                                        <div className="flex items-center gap-2">
                                            <Avatar className="h-8 w-8"><AvatarImage src={friend.avatar} /><AvatarFallback>{friend.name[0]}</AvatarFallback></Avatar>
                                            <span>{friend.name}</span>
                                        </div>
                                        <div className={cn("h-2.5 w-2.5 rounded-full", friend.online ? 'bg-green-500' : 'bg-gray-500')} />
                                    </div>
                                )) : <p className="text-xs text-center text-muted-foreground p-4">No friends yet. Find a chat and add someone!</p>}
                            </div>
                        </TabsContent>
                    </Tabs>
                </SidebarContent>
            </Sidebar>
            <MainHeader />
        </SidebarProvider>
    );
}

function MainHeader() {
    const { onBlockUser, onLeaveChat, onVideoCallToggle, onGameToggle, activeView } = useMainLayout();
    const { isMobile } = useSidebar();
    const [showInactivityTimer, setShowInactivityTimer] = useState(false);
    const [activityKey, setActivityKey] = useState(0);

    const handleMessageSent = useCallback(() => {
        setActivityKey(prev => prev + 1);
    }, []);

    useEffect(() => {
        if(activeView.type === 'chat') {
            setShowInactivityTimer(true);
        } else {
            setShowInactivityTimer(false);
        }
    }, [activeView.type]);

    return (
       <SidebarInset>
             <div className={cn("flex h-14 items-center justify-between gap-4 border-b bg-background p-2 px-4", isMobile && 'pl-12')}>
                <div className="absolute left-2 top-1/2 -translate-y-1/2"><SidebarTrigger /></div> 
                {activeView.type === 'chat' ? (
                    <>
                        <ChatHeader
                            partner={activeView.data.user}
                            onGameClick={() => onGameToggle(true)}
                            onVideoCallClick={() => onVideoCallToggle(true)}
                            onBlockUser={onBlockUser}
                            onLeaveChat={() => onLeaveChat('manual')}
                        />
                         {showInactivityTimer && (
                             <InactivityTimer
                                key={activityKey}
                                onIdle={() => onLeaveChat('timeout')}
                            />
                         )}
                    </>
                ) : (
                    <div className="flex items-center gap-2">
                         <h2 className="font-semibold text-lg">Welcome</h2>
                    </div>
                )}
             </div>
              {activeView.type === 'chat' 
                    ? <ChatView key={activeView.data.chat.id} chat={activeView.data.chat} partner={activeView.data.user} onMessageSent={handleMessageSent} />
                    : <WelcomeView />
                }
       </SidebarInset>
    );
}

function MainLayoutContent({ onNavigateHome }: { onNavigateHome: () => void; }) {
    const { user, profile } = useAuth();
    const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
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

    const switchToChat = useCallback(async (chatId: string) => {
        if (!user) return;
        cleanupListeners();
        setIsSearching(false);
        
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { [`members.${user.uid}.active`]: true });
        
        const chatDoc = await getDoc(chatRef);
        if (chatDoc.exists()) {
            const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
            const partnerId = chatData.memberIds.find(id => id !== user.uid)!;
            
            const unsubPartner = onSnapshot(doc(db, 'users', partnerId), (doc) => {
                  if(doc.exists()){
                     const partnerProfile = doc.data() as UserProfile;
                     setActiveView(prev => {
                         if(prev.type === 'chat' && prev.data.user.id === partnerId){
                             return {...prev, data: {...prev.data, user: partnerProfile}}
                         } else if (prev.type === 'welcome' || (prev.type === 'chat' && prev.data.user.id !== partnerId)) {
                             // This handles the initial switch to chat
                              return { type: 'chat', data: { chat: chatData, user: partnerProfile } };
                         }
                         return prev;
                     });
                  }
              });

              const originalCleanup = unsubscribeUserDoc.current;
              unsubscribeUserDoc.current = () => {
                  originalCleanup?.();
                  unsubPartner();
              };
        }
    }, [user, db, cleanupListeners]);

    const stopSearching = useCallback(async () => {
        if (!user) return;
        setIsSearching(false);
        cleanupListeners();
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        if((await getDoc(waitingDocRef)).exists()){
            await deleteDoc(waitingDocRef);
        }
        toast({ title: 'Search canceled' });
    }, [user, db, cleanupListeners, toast]);
    
    const listenForMatches = useCallback(() => {
        if (!user || !profile) return;
        cleanupListeners();
        const waitingDocRef = doc(db, "waiting_users", user.uid);
        unsubscribeUserDoc.current = onSnapshot(waitingDocRef, async (docSnap) => {
             if (docSnap.exists() && docSnap.data().pendingChatId) {
                const chatId = docSnap.data().pendingChatId;
                await deleteDoc(waitingDocRef);
                switchToChat(chatId);
            }
        });
    }, [user, profile, db, cleanupListeners, switchToChat]);
    
    const findNewChat = useCallback(async () => {
        if (!user || !profile || isSearching) return;
    
        setIsSearching(true);
        toast({ title: 'Searching for a chat...' });
    
        const waitingUsersRef = collection(db, 'waiting_users');
        const q = query(waitingUsersRef, where('uid', '!=', user.uid));
        const querySnapshot = await getDocs(q);

        const myBlockedUsers = profile.blockedUsers || [];
        
        let matchFound = false;

        const potentialPartners = querySnapshot.docs
            .map(doc => doc.data() as WaitingUser)
            .filter(partner => !myBlockedUsers.includes(partner.uid));
        
        for (const partner of potentialPartners) {
             const partnerProfileDoc = await getDoc(doc(db, "users", partner.uid));
             if (partnerProfileDoc.exists()) {
                 const partnerProfile = partnerProfileDoc.data() as UserProfile;
                 const partnerIsBlocked = (partnerProfile.blockedUsers || []).includes(user.uid);
                 
                 if (!partnerIsBlocked) {
                    const partnerWaitingDocRef = doc(db, "waiting_users", partner.uid);
                    try {
                        const newChatRef = await addDoc(collection(db, "chats"), {
                            createdAt: serverTimestamp(),
                            memberIds: [user.uid, partner.uid].sort(),
                            members: {
                                [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: true, isGuest: profile.isGuest },
                                [partner.uid]: { name: partner.name, avatar: partner.avatar, online: true, active: false, isGuest: partner.isGuest },
                            },
                            isFriendChat: false,
                        });
                        
                        await updateDoc(partnerWaitingDocRef, { pendingChatId: newChatRef.id });
                        switchToChat(newChatRef.id);
                        matchFound = true;
                        break; 
                    } catch (e) {
                         console.error("Error creating chat with partner:", partner.uid, e);
                    }
                 }
             }
        }
        
        if (!matchFound) {
            const waitingDocRef = doc(db, 'waiting_users', user.uid);
            await setDoc(waitingDocRef, { 
                uid: user.uid,
                name: profile.name,
                avatar: profile.avatar,
                isGuest: profile.isGuest ?? false,
                timestamp: serverTimestamp(),
                pendingChatId: null
            });
            listenForMatches();
        } else {
             dismiss();
        }
        
    }, [user, profile, isSearching, db, switchToChat, toast, dismiss, listenForMatches]);

    useEffect(() => {
        if (activeView.type === 'chat') {
            const partnerId = activeView.data.user.id;
            const unsub = onSnapshot(doc(db, "users", partnerId), (doc) => {
                if (doc.exists() && doc.data().online === false && activeView.type === 'chat') {
                     toast({ title: "Partner has left the chat.", description: "Finding a new partner..." });
                     handleLeaveChat('manual'); // Force leave current chat
                }
            });
            return () => unsub();
        }
    }, [activeView, db, toast]);
    
    
    useEffect(() => {
        if (user && !isSearching && activeView.type === 'welcome') {
            // This is to catch if a match was made while user was not searching
            // Or to start listening if they just logged in.
            listenForMatches();
        }
        return () => {
            if(!isSearching) {
                 cleanupListeners();
            }
        };
    }, [user, isSearching, activeView.type, listenForMatches, cleanupListeners]);
    
    const startChatWithFriend = async (friendId: string) => {
        if (!user || !profile) return;
        await stopSearching();
        const sortedIds = [user.uid, friendId].sort();
        
        const q = query(collection(db, "chats"), 
            where("isFriendChat", "==", true),
            where("memberIds", "==", sortedIds)
        );

        const querySnapshot = await getDocs(q);

        let chatData: Chat;
        
        if (!querySnapshot.empty) {
            const chatDoc = querySnapshot.docs[0];
            chatData = {id: chatDoc.id, ...chatDoc.data()} as Chat;
        } else {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if(!friendDoc.exists()) return toast({title: "Error", description: "Could not find user."});
            const friendProfile = friendDoc.data() as UserProfile;
            
            const newChatData = {
                memberIds: sortedIds,
                members: {
                    [user.uid]: { name: profile!.name, avatar: profile!.avatar, online: true, active: true, isGuest: profile.isGuest },
                    [friendId]: { name: friendProfile.name, avatar: friendProfile.avatar, online: true, active: false, isGuest: friendProfile.isGuest },
                },
                isFriendChat: true,
                createdAt: serverTimestamp(),
            };
            const chatDocRef = await addDoc(collection(db, "chats"), newChatData);
            const newChatDoc = await getDoc(chatDocRef);
            chatData = {id: newChatDoc.id, ...newChatDoc.data()} as Chat;
        }
        switchToChat(chatData.id);
    }
    
    const handleBlockUser = async () => {
        if (activeView.type !== 'chat') return;
        const partnerId = activeView.data.user.id;
        if (!user || !partnerId) return;

        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: arrayUnion(partnerId) });
        toast({ title: "User Blocked", description: `You will not be matched with ${activeView.data.user.name} again.` });
        
        const chatId = activeView.data.chat.id;
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { [`members.${user.uid}.active`]: false });
        
        setActiveView({ type: 'welcome' });
        findNewChat();
    }

    const handleLeaveChat = useCallback(async (source: 'manual' | 'timeout' = 'manual') => {
        if (activeView.type !== 'chat' || !user) return;
        const chatId = activeView.data.chat.id;
        const isFriendChat = activeView.data.chat.isFriendChat;
        
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { [`members.${user.uid}.active`]: false });
        
        if(source === 'manual' && !isFriendChat) {
            toast({ title: "You have left the chat." });
        } else if (source === 'timeout') {
            toast({ title: "Chat ended due to inactivity.", description: "Finding a new partner..." });
        }
        
        setActiveView({ type: 'welcome' });
        
        if(!isFriendChat) {
            findNewChat();
        }
    }, [activeView, user, db, toast, findNewChat]);

    const providerValue = {
        activeView,
        setActiveView,
        onBlockUser: handleBlockUser,
        onLeaveChat: handleLeaveChat,
        onVideoCallToggle: setIsVideoCallOpen,
        onGameToggle: setGameCenterOpen,
        isSearching,
        onFindNewChat: findNewChat,
        onStopSearching: stopSearching,
        onStartChatWithFriend: startChatWithFriend,
        onNavigateHome,
    };

    return (
        <MainLayoutContext.Provider value={providerValue}>
            {activeView.type === 'chat' && isVideoCallOpen &&
                <VideoCallView chatId={activeView.data.chat.id} onClose={() => setIsVideoCallOpen(false)} />
            }
             {activeView.type === 'chat' && isGameCenterOpen &&
                <GameCenterView
                    isOpen={isGameCenterOpen}
                    onOpenChange={setGameCenterOpen}
                    chatId={activeView.data.chat.id}
                    partnerId={activeView.data.user.id}
                />
            }
            <LayoutUI />
        </MainLayoutContext.Provider>
    );
}

export default function MainLayoutWrapper({ onNavigateHome }: { onNavigateHome: () => void; }) {
    return (
        <MainLayoutContent onNavigateHome={onNavigateHome} />
    )
}
