
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
import type { Chat, User as UserProfile, FriendRequest } from '@/lib/types';
import { collection, query, where, onSnapshot, getFirestore, getDocs, doc, runTransaction, addDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, orderBy, getDoc, arrayUnion, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import { Skeleton } from '../ui/skeleton';
import ChatHeader from './chat-header';
import GameCenterView from './game-center-view';
import { cn } from '@/lib/utils';
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs"

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'chat', data: { chat: Chat, user: UserProfile } };

const MainLayoutContext = React.createContext<{
  activeView: ActiveView;
  setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
  onBlockUser: () => void;
  onLeaveChat: () => void;
  onVideoCallToggle: (isOpen: boolean) => void;
  onGameToggle: (isOpen: boolean) => void;
  isSearching: boolean;
  onFindNewChat: () => void;
  onStartChatWithFriend: (friendId: string) => void;
} | null>(null);

const useMainLayout = () => {
    const context = React.useContext(MainLayoutContext);
    if (!context) throw new Error('useMainLayout must be used within a MainLayoutProvider');
    return context;
};

function LayoutUI({ onNavigateHome, onLogout }: { onNavigateHome: () => void; onLogout: () => void; }) {
    const { profile, user } = useAuth();
    const { onFindNewChat, isSearching, onStartChatWithFriend, activeView } = useMainLayout();
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const db = getFirestore(firebaseApp);
    const { toast } = useToast();
    
    // Listen for friend requests
    useEffect(() => {
      if (!user) return;
      const q = query(collection(db, 'friend_requests'), where("toId", "==", user.uid), where("status", "==", "pending"));
      const unsubscribe = onSnapshot(q, (snapshot) => {
        const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
        setFriendRequests(requests);
      });
      return () => unsubscribe();
    }, [user, db]);

    // Listen for friends list
    useEffect(() => {
        if (!user || !profile?.friends || profile.friends.length === 0) {
            setFriends([]);
            return;
        }
        const friendsQuery = query(collection(db, "users"), where("id", "in", profile.friends));
        const unsubscribe = onSnapshot(friendsQuery, (snapshot) => {
            const friendsData = snapshot.docs.map(doc => doc.data() as UserProfile);
            setFriends(friendsData);
        });
        return () => unsubscribe();
    }, [user, profile?.friends, db]);

    const handleAcceptFriend = async (req: FriendRequest) => {
        const batch = writeBatch(db);
        batch.update(doc(db, 'users', req.toId), { friends: arrayUnion(req.fromId) });
        batch.update(doc(db, 'users', req.fromId), { friends: arrayUnion(req.toId) });
        batch.update(doc(db, 'friend_requests', req.id), { status: 'accepted' });
        await batch.commit();
        toast({ title: 'Friend Added!' });
    };

    const handleDeclineFriend = async (reqId: string) => {
        await deleteDoc(doc(db, 'friend_requests', reqId));
        toast({ title: 'Request Declined' });
    };

    return (
        <SidebarProvider>
            <Sidebar>
                <SidebarHeader>
                    <div className="flex items-center justify-between">
                         <Button variant="ghost" size="icon" onClick={onNavigateHome}><ArrowLeft /></Button>
                         <h2 className="font-semibold text-lg">{profile?.name}</h2>
                         <Button variant="ghost" size="icon" onClick={onLogout}><LogOut /></Button>
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
                             <Button onClick={onFindNewChat} disabled={isSearching} className="w-full">
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
            <SidebarInset>
                <MainHeader />
                {activeView.type === 'chat' 
                    ? <ChatView key={activeView.data.chat.id} chat={activeView.data.chat} partner={activeView.data.user} />
                    : <WelcomeView />
                }
            </SidebarInset>
        </SidebarProvider>
    );
}

function MainHeader() {
    const { activeView, onBlockUser, onLeaveChat, onVideoCallToggle, onGameToggle } = useMainLayout();
    const { isMobile } = useSidebar();

    return (
       <div className={cn("flex h-14 items-center justify-between gap-4 border-b bg-background p-2 px-4", isMobile && 'pl-12')}>
             {isMobile && <div className="absolute left-2 top-1/2 -translate-y-1/2"><SidebarTrigger /></div> }
            {activeView.type === 'chat' ? (
                <ChatHeader
                    partner={activeView.data.user}
                    onGameClick={() => onGameToggle(true)}
                    onVideoCallClick={() => onVideoCallToggle(true)}
                    onBlockUser={onBlockUser}
                    onLeaveChat={onLeaveChat}
                />
            ) : (
                 <h2 className="font-semibold text-lg">Welcome</h2>
            )}
       </div>
    );
}

function MainLayoutContent({ onNavigateHome }: { onNavigateHome: () => void; }) {
    const { user, profile, logout } = useAuth();
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
    
    const startChatWithFriend = async (friendId: string) => {
        if (!user) return;
        const sortedIds = [user.uid, friendId].sort();
        const chatId = sortedIds.join('_');
        const chatRef = doc(db, 'chats', chatId);

        let chatDoc = await getDoc(chatRef);
        let chatData: Chat;

        if (!chatDoc.exists()) {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if(!friendDoc.exists()) return toast({title: "Error", description: "Could not find user."});
            const friendProfile = friendDoc.data() as UserProfile;
            
            const newChatData: Omit<Chat, 'id'> = {
                memberIds: sortedIds,
                members: {
                    [user.uid]: { name: profile!.name, avatar: profile!.avatar, online: true, active: true },
                    [friendId]: { name: friendProfile.name, avatar: friendProfile.avatar, online: true, active: true },
                },
                isFriendChat: true,
                createdAt: serverTimestamp(),
            };
            await setDoc(chatRef, newChatData);
            chatDoc = await getDoc(chatRef);
        }

        chatData = {id: chatDoc.id, ...chatDoc.data()} as Chat;
        const partnerProfile = await getDoc(doc(db, 'users', friendId)).then(d => d.data() as UserProfile);
        
        setActiveView({ type: 'chat', data: { chat: chatData, user: partnerProfile }});
    }

    const findNewChat = async () => {
        if (!user || !profile) return;
        if (isSearching) {
            await deleteDoc(doc(db, 'waiting_users', user.uid));
            setIsSearching(false);
            toast({ title: 'Search canceled' });
            return;
        }

        setIsSearching(true);
        toast({ title: 'Searching for a chat...' });

        const waitingUsersRef = collection(db, 'waiting_users');
        const q = query(waitingUsersRef, where('uid', '!=', user.uid));

        const querySnapshot = await getDocs(q);
        let matchFound = false;
        
        for (const docSnap of querySnapshot.docs) {
            const waitingUser = docSnap.data() as UserProfile;
            if (waitingUser.matchedChatId) continue;
            
            const iMatchTheirPreference = profile.gender ? (waitingUser.preference === 'anyone' || waitingUser.preference === `${profile.gender}s`) : true;
            const theyMatchMyPreference = waitingUser.gender ? (profile.preference === 'anyone' || profile.preference === `${waitingUser.gender}s`) : true;

            if (!profile.blockedUsers?.includes(waitingUser.id) && !waitingUser.blockedUsers?.includes(user.uid) && iMatchTheirPreference && theyMatchMyPreference) {
                const partnerFinal = waitingUser;
                const newChatRef = doc(collection(db, 'chats'));

                try {
                    await runTransaction(db, async (transaction) => {
                        const waitingUserDocRef = doc(db, 'waiting_users', partnerFinal.id);
                        const waitingUserDoc = await transaction.get(waitingUserDocRef);
                        if (!waitingUserDoc.exists() || waitingUserDoc.data().matchedChatId) return; // Already matched
                        
                        transaction.update(waitingUserDocRef, { matchedChatId: newChatRef.id });

                        const chatData: Omit<Chat, 'id'> = {
                            memberIds: [user.uid, partnerFinal.id].sort(),
                            members: {
                                [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: true },
                                [partnerFinal.id]: { name: partnerFinal.name, avatar: partnerFinal.avatar, online: true, active: true },
                            },
                            isFriendChat: false,
                            createdAt: serverTimestamp()
                        }
                        transaction.set(newChatRef, chatData);
                    });
                     const chatDoc = await getDoc(newChatRef);
                     setActiveView({ type: 'chat', data: { chat: {id: chatDoc.id, ...chatDoc.data()} as Chat, user: partnerFinal } });
                     matchFound = true;
                     
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
        
        setIsSearching(true);
        toast({ title: "No users found, waiting for someone to join..." });
        await setDoc(doc(db, 'waiting_users', user.uid), { ...profile, id: user.uid, uid: user.uid, timestamp: serverTimestamp() });
    };
    
    // Listener for when someone finds YOU
    useEffect(() => {
        if (!user || !isSearching) return;
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        const unsubscribe = onSnapshot(waitingDocRef, async (docSnap) => {
            if (docSnap.exists() && docSnap.data()?.matchedChatId) {
                const matchedChatId = docSnap.data().matchedChatId;
                await deleteDoc(waitingDocRef);
                const chatDoc = await getDoc(doc(db, 'chats', matchedChatId));
                if (chatDoc.exists()) {
                    const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
                    const partnerId = chatData.memberIds.find(id => id !== user.uid)!;
                    const partnerProfile = (await getDoc(doc(db, 'users', partnerId))).data() as UserProfile;
                    setActiveView({type: 'chat', data: { chat: chatData, user: partnerProfile }});
                }
                setIsSearching(false);
            }
        });
        return () => unsubscribe();
    }, [user, isSearching, db]);

    const handleBlockUser = async () => {
        if (activeView.type !== 'chat') return;
        const partnerId = activeView.data.user.id;
        if (!user || !partnerId) return;

        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: arrayUnion(partnerId) });
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
        isSearching,
        onFindNewChat: findNewChat,
        onStartChatWithFriend: startChatWithFriend,
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
            <LayoutUI onNavigateHome={onNavigateHome} onLogout={logout} />
        </MainLayoutContext.Provider>
    );
}

export default function MainLayoutWrapper({ onNavigateHome }: { onNavigateHome: () => void; }) {
    return (
        <MainLayoutContent onNavigateHome={onNavigateHome} />
    )
}
