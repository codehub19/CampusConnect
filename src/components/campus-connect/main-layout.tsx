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
    const { profile, logout } = useAuth();
    const { onFindNewChat, isSearching, onStopSearching, onStartChatWithFriend, onNavigateHome } = useMainLayout();
    const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
    const [friends, setFriends] = useState<UserProfile[]>([]);
    const db = getFirestore(firebaseApp);
    const { toast } = useToast();

    // Listen for friend requests
    useEffect(() => {
        if (!profile) return;
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
                        <Button variant="ghost" size="icon" onClick={logout}><LogOut /></Button>
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
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => handleAcceptFriend(req)}><Check /></Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDeclineFriend(req.id)}><X /></Button>
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

    return (
        <SidebarInset>
            <div className="h-full flex flex-col">
                <div className={cn("flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b bg-background p-2 px-4", isMobile && 'pl-12')}>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2"><SidebarTrigger /></div>
                    {activeView.type === 'chat' ? (
                        <ChatHeader
                            partner={activeView.data.user}
                            onGameClick={() => onGameToggle(true)}
                            onVideoCallClick={() => onVideoCallToggle(true)}
                            onBlockUser={onBlockUser}
                            onLeaveChat={onLeaveChat}
                        />
                    ) : (
                        <div className="flex items-center gap-2">
                            <h2 className="font-semibold text-lg">Welcome</h2>
                        </div>
                    )}
                </div>
                <div className="flex-1 min-h-0">
                    {activeView.type === 'chat'
                        ? <ChatView key={activeView.data.chat.id} chat={activeView.data.chat} partner={activeView.data.user} onLeaveChat={onLeaveChat} />
                        : <WelcomeView />
                    }
                </div>
            </div>
        </SidebarInset>
    );
}

function MainLayoutContent({ onNavigateHome }: { onNavigateHome: () => void; }) {
    const { user, profile, loading } = useAuth();
    const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
    const [isSearching, setIsSearching] = useState(false);
    const [isVideoCallOpen, setIsVideoCallOpen] = useState(false);
    const [isGameCenterOpen, setGameCenterOpen] = useState(false);

    const waitingListenerUnsub = useRef<() => void | null>(null);
    const partnerListenerUnsub = useRef<() => void | null>(null);
    const chatListenerUnsub = useRef<() => void | null>(null); // New listener for the chat doc

    const { toast, dismiss } = useToast();
    const db = getFirestore(firebaseApp);

    const cleanupListeners = useCallback(() => {
        if (waitingListenerUnsub.current) waitingListenerUnsub.current();
        if (partnerListenerUnsub.current) partnerListenerUnsub.current();
        if (chatListenerUnsub.current) chatListenerUnsub.current();
        waitingListenerUnsub.current = null;
        partnerListenerUnsub.current = null;
        chatListenerUnsub.current = null;
    }, []);

    const handleLeaveChat = useCallback(async (showToast = true) => {
        if (activeView.type !== 'chat') return;
        const chatId = activeView.data.chat.id;
        if (!user || !chatId) return;

        cleanupListeners();
        const chatRef = doc(db, 'chats', chatId);
        await updateDoc(chatRef, { [`members.${user.uid}.active`]: false });
        if (showToast) {
            toast({ title: "You have left the chat." });
        }
        setActiveView({ type: 'welcome' });
    }, [activeView, user, db, toast, cleanupListeners]);


    const switchToChat = useCallback(async (chatId: string) => {
        if (!user) return;
        setIsSearching(false);
        cleanupListeners();
        dismiss();

        const chatRef = doc(db, 'chats', chatId);
        const chatDoc = await getDoc(chatRef);

        if (chatDoc.exists()) {
            const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
            const partnerId = chatData.memberIds.find(id => id !== user.uid)!;
            const partnerProfileDoc = await getDoc(doc(db, 'users', partnerId));
            if (partnerProfileDoc.exists()) {
                const partnerProfile = partnerProfileDoc.data() as UserProfile;
                setActiveView({ type: 'chat', data: { chat: chatData, user: partnerProfile } });
                await updateDoc(chatRef, { [`members.${user.uid}.active`]: true });
            }
        }
    }, [user, db, dismiss, cleanupListeners]);

    const listenForMatches = useCallback(() => {
        if (!user) return;
        cleanupListeners();
        
        const waitingDocRef = doc(db, "waiting_users", user.uid);
        waitingListenerUnsub.current = onSnapshot(waitingDocRef, async (docSnap) => {
            const waitingData = docSnap.data();
            if (waitingData && waitingData.matchedChatId) {
                const chatId = waitingData.matchedChatId;
                cleanupListeners();
                await deleteDoc(waitingDocRef);
                switchToChat(chatId);
            }
        });
    }, [user, db, cleanupListeners, switchToChat]);

    const findNewChat = useCallback(async () => {
        if (!user || !profile || isSearching) return;

        setIsSearching(true);
        const { id: toastId } = toast({ title: 'Searching for a chat...' });

        const waitingUsersRef = collection(db, 'waiting_users');
        const q = query(waitingUsersRef, where('uid', '!=', user.uid), limit(10));
        const querySnapshot = await getDocs(q);

        const blockedByMe = profile.blockedUsers || [];
        const potentialPartners = querySnapshot.docs
            .map(doc => ({ id: doc.id, ref: doc.ref, ...doc.data() } as WaitingUser & { id: string, ref: any }))
            .filter(partner =>
                !blockedByMe.includes(partner.id) &&
                !(partner.blockedUsers || []).includes(user.uid)
            );

        if (potentialPartners.length > 0) {
            const partner = potentialPartners[0];
            const partnerId = partner.id;

            const partnerProfileDoc = await getDoc(doc(db, "users", partnerId));
            if (!partnerProfileDoc.exists()) {
                setIsSearching(false);
                dismiss(toastId);
                toast({ variant: 'destructive', title: 'Match Error', description: 'Could not find partner profile.' });
                return;
            }
            const partnerProfile = partnerProfileDoc.data() as UserProfile;
            
            const newChatRef = await addDoc(collection(db, "chats"), {
                createdAt: serverTimestamp(),
                memberIds: [user.uid, partnerId].sort(),
                members: {
                    [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: false },
                    [partnerId]: { name: partnerProfile.name, avatar: partnerProfile.avatar, online: true, active: false },
                },
                isFriendChat: false,
            });

            await updateDoc(partner.ref, { matchedChatId: newChatRef.id });
            
            await switchToChat(newChatRef.id);
            dismiss(toastId);

        } else {
            await setDoc(doc(db, 'waiting_users', user.uid), {
                uid: user.uid,
                blockedUsers: profile.blockedUsers || [],
                timestamp: serverTimestamp()
            });
            listenForMatches();
        }
    }, [user, profile, isSearching, db, toast, dismiss, listenForMatches, switchToChat]);

    // ** THE FIX IS HERE **
    // This effect now handles ALL logic related to an active chat session.
    useEffect(() => {
        // Ensure previous listeners are cleaned up before starting new ones.
        cleanupListeners();

        if (activeView.type === 'chat') {
            const chatId = activeView.data.chat.id;
            const partnerId = activeView.data.user.id;
            
            // Listener 1: For the chat document itself
            const chatRef = doc(db, 'chats', chatId);
            chatListenerUnsub.current = onSnapshot(chatRef, (docSnap) => {
                if (docSnap.exists()) {
                    const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
                    const partnerIsActive = chatData.members[partnerId]?.active;

                    // The reliable "partner left" check.
                    if (partnerIsActive === false) {
                        toast({
                            title: "Partner Left",
                            description: `${activeView.data.user.name} has left the chat.`
                        });
                        handleLeaveChat(false);
                    } else {
                        // If the partner is still active, update the chat state
                        setActiveView(prev => {
                            if (prev.type === 'chat') {
                                return { ...prev, data: { ...prev.data, chat: chatData } };
                            }
                            return prev;
                        });
                    }
                } else {
                    // Chat document was deleted
                    handleLeaveChat(false);
                }
            });

            // Listener 2: For the partner's global user profile (for online status icon, name changes, etc.)
            partnerListenerUnsub.current = onSnapshot(doc(db, 'users', partnerId), (doc) => {
                if (doc.exists()) {
                    const partnerData = doc.data() as UserProfile;
                    setActiveView(prev => {
                        if (prev.type === 'chat') {
                            return { ...prev, data: { ...prev.data, user: partnerData } };
                        }
                        return prev;
                    });
                }
            });
        }

        // Cleanup function for this effect
        return () => {
            cleanupListeners();
        };
    }, [activeView.type, activeView.data?.chat.id, db, toast, handleLeaveChat, cleanupListeners]);


    const startChatWithFriend = async (friendId: string) => {
        if (!user || !profile) return;
        const sortedIds = [user.uid, friendId].sort();

        const q = query(collection(db, "chats"),
            where("isFriendChat", "==", true),
            where("memberIds", "==", sortedIds)
        );

        const querySnapshot = await getDocs(q);

        let chatData: Chat;

        if (!querySnapshot.empty) {
            const chatDoc = querySnapshot.docs[0];
            chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
        } else {
            const friendDoc = await getDoc(doc(db, 'users', friendId));
            if (!friendDoc.exists()) return toast({ title: "Error", description: "Could not find user." });
            const friendProfile = friendDoc.data() as UserProfile;

            const newChatData = {
                memberIds: sortedIds,
                members: {
                    [user.uid]: { name: profile!.name, avatar: profile!.avatar, online: true, active: true },
                    [friendId]: { name: friendProfile.name, avatar: friendProfile.avatar, online: true, active: true },
                },
                isFriendChat: true,
                createdAt: serverTimestamp(),
            };
            const chatDocRef = await addDoc(collection(db, "chats"), newChatData);
            const newChatDoc = await getDoc(chatDocRef);
            chatData = { id: newChatDoc.id, ...newChatDoc.data() } as Chat;
        }

        const partnerProfileDoc = await getDoc(doc(db, 'users', friendId));
        if (partnerProfileDoc.exists()) {
            const partnerProfile = partnerProfileDoc.data() as UserProfile;
            setActiveView({ type: 'chat', data: { chat: chatData, user: partnerProfile } });
        }
    }


    const stopSearching = async () => {
        if (!user) return;
        setIsSearching(false);
        cleanupListeners();
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        if ((await getDoc(waitingDocRef)).exists()) {
            await deleteDoc(waitingDocRef);
        }
        dismiss();
        toast({ title: 'Search canceled' });
    }

    const handleBlockUser = async () => {
        if (activeView.type !== 'chat') return;
        const partnerId = activeView.data.user.id;
        if (!user || !partnerId) return;

        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: arrayUnion(partnerId) });
        toast({ title: "User Blocked", description: `You will not be matched with ${activeView.data.user.name} again.` });
        handleLeaveChat();
    }

    const providerValue = {
        activeView,
        setActiveView,
        onBlockUser: handleBlockUser,
        onLeaveChat: () => handleLeaveChat(true),
        onVideoCallToggle: setIsVideoCallOpen,
        onGameToggle: setGameCenterOpen,
        isSearching,
        onFindNewChat: findNewChat,
        onStopSearching: stopSearching,
        onStartChatWithFriend: startChatWithFriend,
        onNavigateHome,
    };
    
    if (loading) {
        return (
            <div className="h-screen w-screen flex items-center justify-center">
                <Skeleton className="h-12 w-12 rounded-full" />
            </div>
        );
    }

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
