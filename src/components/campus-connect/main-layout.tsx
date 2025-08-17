
"use client";

import React, { useState, useEffect, useRef, useCallback } from 'react';
import { Sidebar, SidebarProvider, SidebarTrigger, SidebarContent, SidebarHeader, SidebarInset, useSidebar } from "@/components/ui/sidebar";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { useAuth } from "@/hooks/use-auth";
import { LogOut, Search, X, Check, ArrowLeft, Users } from 'lucide-react';
import ChatView from "@/components/campus-connect/chat-view";
import WelcomeView from "@/components/campus-connect/welcome-view";
import VideoCallView from "@/components/campus-connect/video-call-view";
import type { Chat, User as UserProfile, FriendRequest, WaitingUser } from '@/lib/types';
import { collection, query, where, onSnapshot, getFirestore, getDocs, doc, runTransaction, addDoc, serverTimestamp, setDoc, updateDoc, deleteDoc, orderBy, getDoc, arrayUnion, writeBatch, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from "@/hooks/use-toast";
import { Skeleton } from "@/components/ui/skeleton";
import ChatHeader from "@/components/campus-connect/chat-header";
import { cn } from "@/lib/utils";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { acceptFriendRequest } from '@/ai/flows/accept-friend-request';

type ActiveView =
    | { type: 'welcome' }
    | { type: 'chat', data: { chat: Chat, user: UserProfile } };

const MainLayoutContext = React.createContext<{
    activeView: ActiveView;
    setActiveView: React.Dispatch<React.SetStateAction<ActiveView>>;
    onBlockUser: () => void;
    onLeaveChat: () => void;
    onVideoCallToggle: (isOpen: boolean) => void;
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

    useEffect(() => {
        if (!profile?.id) return;
        const q = query(collection(db, 'friend_requests'), where("toId", "==", profile.id), where("status", "==", "pending"));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const requests = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as FriendRequest));
            setFriendRequests(requests);
        });
        return () => unsubscribe();
    }, [profile?.id, db]);

    useEffect(() => {
        if (!profile?.friends || profile.friends.length === 0) {
            setFriends([]);
            return;
        }
        const friendsQuery = query(collection(db, "users"), where("id", "in", profile.friends));
        const unsubscribe = onSnapshot(friendsQuery, (snapshot) => {
            const friendsData = snapshot.docs.map(doc => doc.data() as UserProfile);
            setFriends(friendsData);
        }, (error) => {
            console.error("Error fetching friends: ", error);
        });
        return () => unsubscribe();
    }, [profile?.friends, db]);

    const handleAcceptFriend = async (req: FriendRequest) => {
        if (!profile) return;
        const batch = writeBatch(db);

        const currentUserRef = doc(db, 'users', profile.id);
        batch.update(currentUserRef, { friends: arrayUnion(req.fromId) });

        const requestRef = doc(db, 'friend_requests', req.id);
        batch.update(requestRef, { status: 'accepted' });

        try {
            await batch.commit();

            await acceptFriendRequest({
                requesterId: req.fromId,
                accepterId: profile.id,
            });
            
            toast({ title: 'Friend Added!' });
        } catch (error) {
            console.error("Error accepting friend request: ", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not add friend. Please try again.' });
        }
    };

    const handleDeclineFriend = async (reqId: string) => {
        try {
            await deleteDoc(doc(db, 'friend_requests', reqId));
            toast({ title: 'Request Declined' });
        } catch (error) {
            console.error("Error declining friend request:", error);
            toast({ variant: 'destructive', title: 'Error', description: 'Could not decline request.' });
        }
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
                        <Button variant="ghost" size="icon" onClick={onNavigateHome} aria-label="Back to Home"><ArrowLeft /></Button>
                        <h2 className="font-semibold text-lg">{profile?.name}</h2>
                        <Button variant="ghost" size="icon" onClick={logout} aria-label="Log Out"><LogOut /></Button>
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
                            <Button onClick={handleFindClick} className="w-full" aria-label={isSearching ? 'Stop searching for a chat' : 'Find a new chat'}>
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
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-green-500" onClick={() => handleAcceptFriend(req)} aria-label={`Accept friend request from ${req.fromName}`}><Check /></Button>
                                                <Button size="icon" variant="ghost" className="h-7 w-7 text-red-500" onClick={() => handleDeclineFriend(req.id)} aria-label={`Decline friend request from ${req.fromName}`}><X /></Button>
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
                                )) : 
                                <div className="text-center text-xs text-muted-foreground p-4 flex flex-col items-center gap-4">
                                    <Users className="h-10 w-10 text-muted-foreground/50" />
                                    <div>
                                        <p className="font-semibold text-sm">No Friends Yet</p>
                                        <p>Find a chat, make a connection, and add friends to see them here!</p>
                                    </div>
                                </div>
                                }
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
    const { onBlockUser, onLeaveChat, onVideoCallToggle, activeView } = useMainLayout();
    const { isMobile } = useSidebar();
    return (
        <SidebarInset>
            <div className="h-full flex flex-col">
                <div className={cn("flex h-14 flex-shrink-0 items-center justify-between gap-4 border-b bg-background p-2 px-4", isMobile && 'pl-12')}>
                    <div className="absolute left-2 top-1/2 -translate-y-1/2"><SidebarTrigger /></div>
                    {activeView.type === 'chat' ? (
                        <ChatHeader
                            partner={activeView.data.user}
                            onGameClick={() => { /* Not implemented in this version */ }}
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

    const waitingListenerUnsub = useRef<(() => void) | null>(null);
    const chatListenerUnsub = useRef<(() => void) | null>(null);
    const partnerListenerUnsub = useRef<(() => void) | null>(null);

    const { toast, dismiss } = useToast();
    const db = getFirestore(firebaseApp);

    const cleanupListeners = useCallback(() => {
        if (waitingListenerUnsub.current) waitingListenerUnsub.current();
        if (chatListenerUnsub.current) chatListenerUnsub.current();
        if (partnerListenerUnsub.current) partnerListenerUnsub.current();
        waitingListenerUnsub.current = null;
        chatListenerUnsub.current = null;
        partnerListenerUnsub.current = null;
    }, []);

    const handleLeaveChat = useCallback(async (showToast = true) => {
        if (activeView.type !== 'chat' || !user) return;
        const chatId = activeView.data.chat.id;

        try {
            const chatRef = doc(db, 'chats', chatId);
            await updateDoc(chatRef, { [`members.${user.uid}.active`]: false });
        } catch (error) {
            console.warn("Could not leave chat, it may have been deleted already:", error);
        }
        
        cleanupListeners();
        setActiveView({ type: 'welcome' });
        
        if (showToast) {
            toast({ title: "You have left the chat." });
        }
    }, [activeView.type, user, db, toast, cleanupListeners]);

    const switchToChat = useCallback(async (chatId: string) => {
        if (!user) return;
        
        const chatDocRef = doc(db, 'chats', chatId);
        const chatDocSnap = await getDoc(chatDocRef);
        if (!chatDocSnap.exists()) {
            toast({ variant: 'destructive', title: "Error", description: "Chat not found." });
            return;
        }

        const chatData = { id: chatDocSnap.id, ...chatDocSnap.data() } as Chat;
        const partnerId = chatData.memberIds.find(id => id !== user.uid);
        if (!partnerId) {
             toast({ variant: 'destructive', title: "Error", description: "Could not find chat partner." });
            return;
        }

        const partnerDocSnap = await getDoc(doc(db, 'users', partnerId));
        if (!partnerDocSnap.exists()) {
            toast({ variant: 'destructive', title: "Error", description: "Partner's profile not found." });
            return;
        }

        const partnerProfile = partnerDocSnap.data() as UserProfile;
        
        cleanupListeners();
        setIsSearching(false);
        dismiss();

        setActiveView({ type: 'chat', data: { chat: chatData, user: partnerProfile } });

    }, [user, db, cleanupListeners, dismiss, toast]);

    useEffect(() => {
        if (activeView.type !== 'chat' || !user) {
            return;
        }

        const { chat, user: partner } = activeView.data;
        const chatRef = doc(db, 'chats', chat.id);
        const partnerRef = doc(db, 'users', partner.id);
        
        updateDoc(chatRef, { [`members.${user.uid}.active`]: true });

        chatListenerUnsub.current = onSnapshot(chatRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedChatData = { id: docSnap.id, ...docSnap.data() } as Chat;
                const partnerIsActive = updatedChatData.members[partner.id]?.active;

                if (partnerIsActive === false) {
                    toast({ title: "Partner Left", description: `${partner.name} has left the chat.` });
                    handleLeaveChat(false);
                } else {
                    setActiveView(prev => (prev.type === 'chat' ? { ...prev, data: { ...prev.data, chat: updatedChatData } } : prev));
                }
            } else {
                toast({ title: "Chat ended", description: "This chat no longer exists." });
                handleLeaveChat(false);
            }
        });

        partnerListenerUnsub.current = onSnapshot(partnerRef, (docSnap) => {
            if (docSnap.exists()) {
                const updatedPartnerData = docSnap.data() as UserProfile;
                setActiveView(prev => (prev.type === 'chat' ? { ...prev, data: { ...prev.data, user: updatedPartnerData } } : prev));
            } else {
                 toast({ title: "Error", description: "Partner's account could not be found." });
                 handleLeaveChat(false);
            }
        });

        return () => {
            cleanupListeners();
        };
    }, [activeView, user, db, toast, handleLeaveChat, cleanupListeners]);
    
    const listenForMatches = useCallback(() => {
        if (!user) return;
        cleanupListeners();
        
        const waitingDocRef = doc(db, "waiting_users", user.uid);
        waitingListenerUnsub.current = onSnapshot(waitingDocRef, async (docSnap) => {
            const waitingData = docSnap.data();
            if (waitingData?.matchedChatId) {
                const chatId = waitingData.matchedChatId;
                await deleteDoc(waitingDocRef);
                switchToChat(chatId);
            }
        });
    }, [user, db, cleanupListeners, switchToChat]);
    
    const findNewChat = useCallback(async () => {
        if (!user || !profile || isSearching) return;

        setIsSearching(true);
        const { id: toastId } = toast({ title: 'Searching for a chat...' });

        try {
            // Step 1: Query for potential partners *outside* the transaction.
            const waitingUsersRef = collection(db, 'waiting_users');
            const q = query(waitingUsersRef, where('uid', '!=', user.uid), limit(10));
            const waitingSnapshot = await getDocs(q);

            const blockedByMe = profile.blockedUsers || [];
            const potentialPartners = waitingSnapshot.docs
                .map(d => d.data() as WaitingUser)
                .filter(p => 
                    !p.matchedChatId &&
                    !blockedByMe.includes(p.uid) && 
                    !(p.blockedUsers || []).includes(user.uid)
                );

            let partner: WaitingUser | null = potentialPartners.length > 0 ? potentialPartners[0] : null;

            // Step 2: Run the transaction
            const resultChatId = await runTransaction(db, async (transaction) => {
                if (partner) {
                    const partnerWaitingRef = doc(db, 'waiting_users', partner.uid);
                    const partnerDoc = await transaction.get(partnerWaitingRef);

                    // Verify the partner is still available inside the transaction
                    if (!partnerDoc.exists() || partnerDoc.data().matchedChatId) {
                        // Partner was matched by someone else, return null to signal a retry or wait
                        return null;
                    }
                    
                    const partnerProfileSnap = await transaction.get(doc(db, 'users', partner.uid));
                    if (!partnerProfileSnap.exists()) throw new Error("Partner profile not found.");
                    const partnerProfile = partnerProfileSnap.data() as UserProfile;

                    const newChatRef = doc(collection(db, 'chats'));
                    transaction.set(newChatRef, {
                        createdAt: serverTimestamp(),
                        memberIds: [user.uid, partner.uid].sort(),
                        members: {
                            [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: false },
                            [partner.uid]: { name: partnerProfile.name, avatar: partnerProfile.avatar, online: true, active: false }
                        },
                        isFriendChat: false,
                        game: null
                    });
                    
                    transaction.update(partnerWaitingRef, { matchedChatId: newChatRef.id });
                    return newChatRef.id;
                } else {
                    // No partners found, so add self to the waiting pool.
                    const myWaitingRef = doc(db, 'waiting_users', user.uid);
                    transaction.set(myWaitingRef, {
                        uid: user.uid,
                        timestamp: serverTimestamp(),
                        blockedUsers: profile.blockedUsers || [],
                        matchedChatId: null
                    });
                    return null;
                }
            });

            if (resultChatId) {
                await switchToChat(resultChatId);
            } else if (!partner) {
                // We added ourselves to the waiting pool, now listen.
                listenForMatches();
            } else {
                // We tried to match but failed, retry.
                dismiss(toastId);
                findNewChat();
            }

        } catch (err: any) {
            setIsSearching(false);
            dismiss(toastId);
            console.error('Matchmaking error:', err);
            toast({
                variant: 'destructive',
                title: 'Matchmaking failed',
                description: err?.message ?? 'Could not find a match.'
            });
        }
    }, [user, profile, isSearching, db, toast, dismiss, listenForMatches, switchToChat]);

    const startChatWithFriend = async (friendId: string) => {
        if (!user || !profile) return;
        const sortedIds = [user.uid, friendId].sort();

        const q = query(collection(db, "chats"),
            where("isFriendChat", "==", true),
            where("memberIds", "==", sortedIds),
            limit(1)
        );

        const querySnapshot = await getDocs(q);
        if (!querySnapshot.empty) {
            await switchToChat(querySnapshot.docs[0].id);
        } else {
            const newChatRef = await addDoc(collection(db, "chats"), {
                createdAt: serverTimestamp(),
                isFriendChat: true,
                memberIds: sortedIds,
                members: {
                    [user.uid]: { name: profile.name, avatar: profile.avatar, online: true, active: true },
                    [friendId]: { name: 'Loading...', avatar: '', online: true, active: true },
                },
                game: null
            });
            await switchToChat(newChatRef.id);
        }
    }

    const stopSearching = async () => {
        if (!user || !isSearching) return;
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
        if (activeView.type !== 'chat' || !user) return;
        const partnerId = activeView.data.user.id;
        
        await updateDoc(doc(db, 'users', user.uid), { blockedUsers: arrayUnion(partnerId) });
        toast({ title: "User Blocked", description: `You will not be matched with ${activeView.data.user.name} again.` });
        handleLeaveChat(false);
    }

    const providerValue = {
        activeView,
        setActiveView,
        onBlockUser: handleBlockUser,
        onLeaveChat: () => handleLeaveChat(true),
        onVideoCallToggle: setIsVideoCallOpen,
        isSearching,
        onFindNewChat: findNewChat,
        onStopSearching: stopSearching,
        onStartChatWithFriend: startChatWithFriend,
        onNavigateHome,
    };
    
    if (loading) {
        return <div className="h-screen w-screen flex items-center justify-center"><Skeleton className="h-12 w-12 rounded-full" /></div>;
    }

    return (
        <MainLayoutContext.Provider value={providerValue}>
            {activeView.type === 'chat' && isVideoCallOpen &&
                <VideoCallView chatId={activeView.data.chat.id} onClose={() => setIsVideoCallOpen(false)} />
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
