
"use client";

import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Home, HeartCrack, UserX, Loader2, Video, Gamepad2, X } from 'lucide-react';
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
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';
import { Dialog } from '@/components/ui/dialog';
import ChatView from '@/components/campus-connect/chat-view';
import AiAssistantView from '@/components/campus-connect/ai-assistant-view';
import WelcomeView from '@/components/campus-connect/welcome-view';
import ChatHeader from '@/components/campus-connect/chat-header';
import GameCenterView from '@/components/campus-connect/game-center-view';
import TicTacToe from '@/components/campus-connect/tic-tac-toe';
import ConnectFour from '@/components/campus-connect/connect-four';
import DotsAndBoxes from '@/components/campus-connect/dots-and-boxes';
import { useAuth } from '@/hooks/use-auth';
import type { User, Chat, FriendRequest, GameState, GameType } from '@/lib/types';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, query, where, getDocs, deleteDoc, addDoc, updateDoc, serverTimestamp, arrayUnion, writeBatch, limit, runTransaction, arrayRemove } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import VideoCallView from './video-call-view';
import { generateIcebreaker } from '@/ai/flows/generate-icebreaker';

type ActiveView =
  | { type: 'welcome' }
  | { type: 'ai' }
  | { type: 'chat', data: { user: User, chat: Chat } };

interface MainLayoutProps {
  onNavigateHome: () => void;
  onNavigateToMissedConnections: () => void;
}

export function MainLayout({ onNavigateHome, onNavigateToMissedConnections }: MainLayoutProps) {
  const { user, profile, logout } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isGameCenterOpen, setGameCenterOpen] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callId: string, from: User } | null>(null);
  const [isVideoCallOpen, setVideoCallOpen] = useState(false);
  const [friendToRemove, setFriendToRemove] = useState<User | null>(null);
  const [callListener, setCallListener] = useState<() => void>(() => () => {});
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  const [activeChatListener, setActiveChatListener] = useState<() => void>(() => () => {});


  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  // Listen for friends
  useEffect(() => {
    if (!user?.uid || !profile || !Array.isArray(profile.friends)) {
      setFriends([]);
      return;
    }
    if (profile.friends.length === 0) {
      setFriends([]);
      return;
    }
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('id', 'in', profile.friends));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFriends: User[] = [];
      snapshot.forEach((doc) => {
        fetchedFriends.push(doc.data() as User);
      });
      setFriends(fetchedFriends);
    });
    return () => unsubscribe();
  }, [user?.uid, profile, db]);


  // Listen for friend requests
  useEffect(() => {
    if (!user?.uid) return;
    const requestsRef = collection(db, 'friend_requests');
    const q = query(requestsRef, where('toId', '==', user.uid), where('status', '==', 'pending'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedRequests: FriendRequest[] = [];
      snapshot.forEach((doc) => {
        fetchedRequests.push({ id: doc.id, ...doc.data() } as FriendRequest);
      });
      setFriendRequests(fetchedRequests);
    });
    return () => unsubscribe();
  }, [user?.uid, db]);

  // Listen for game state changes and partner leaving on the active chat
  useEffect(() => {
    activeChatListener(); // Unsubscribe from previous chat listener
    if (activeView.type !== 'chat' || !user || !activeChat?.id) return () => {};
  
    const { user: partner } = activeView.data;
    const chatRef = doc(db, 'chats', activeChat.id);
  
    const newUnsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (!docSnap.exists()) {
        toast({ variant: 'destructive', title: "Chat deleted", description: "This chat no longer exists." });
        setActiveView({ type: 'welcome' });
        setActiveChat(null);
        return;
      }
      
      const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
      setActiveChat(chatData); // Keep local activeChat state in sync
  
      const partnerUserData = chatData.usersData?.[partner.id];
      if (partnerUserData && !partnerUserData.online && !chatData.isFriendChat) {
        toast({ title: "Partner Left", description: `${partner.name} has left the chat.` });
        handleLeaveChat(true); // Silently leave
      }
    });
  
    setActiveChatListener(() => newUnsubscribe);
    return () => newUnsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView.type, activeChat?.id]);

    // Listen for incoming calls on the active chat
  useEffect(() => {
    callListener(); // Unsubscribe from previous listener
    if (activeView.type !== 'chat' || !user?.id || isVideoCallOpen) return () => {};
    
    const { chat, user: partner } = activeView.data;
    if (!chat.id) return () => {};

    const callsRef = collection(db, 'chats', chat.id, 'calls');
    const q = query(callsRef, where('callerId', '!=', user.id));

    const newUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const callData = change.doc.data();
          // Check for offer and ensure it's not an old, answered call
          if (callData.offer && !callData.answer) {
              setIncomingCall({ callId: change.doc.id, from: partner });
          }
        }
      });
    });

    setCallListener(() => newUnsubscribe); // Store the new unsubscribe function
    return () => newUnsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView.type, user?.id, isVideoCallOpen]);


  const addIcebreakerMessage = async (chatId: string, currentUser: User, partnerUser: User) => {
    try {
      const result = await generateIcebreaker({
        userName1: currentUser.name,
        interests1: currentUser.interests || [],
        userName2: partnerUser.name,
        interests2: partnerUser.interests || [],
      });

      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
        senderId: 'ai-assistant',
        content: { type: 'text', value: result.icebreaker },
        timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to generate icebreaker:", error);
    }
  };

  const openChat = async (chatData: Chat) => {
    if (!user || !profile) return;
    const partnerId = chatData.userIds.find(id => id !== user.uid);
    if (!partnerId) return;

    const partnerSnap = await getDoc(doc(db, 'users', partnerId));
    if (!partnerSnap.exists()) return;
    
    if (isSearching) {
        setIsSearching(false);
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        const waitingDocSnap = await getDoc(waitingDocRef);
        if (waitingDocSnap.exists()) {
            await deleteDoc(waitingDocRef);
        }
    }

    setActiveChat(chatData);
    setActiveView({ type: 'chat', data: { user: partnerSnap.data() as User, chat: chatData } });
  }

  const handleSelectChat = async (friend: User) => {
    if (!user || !profile) return;
  
    const sortedIds = [user.uid, friend.id].sort();
    const chatId = sortedIds.join('_');
    const chatDocRef = doc(db, "chats", chatId);
  
    try {
      const chatDocSnap = await getDoc(chatDocRef);
      let chatData: Chat;
  
      if (!chatDocSnap.exists()) {
        // Create new chat document
        const newChat: Chat = {
          id: chatId,
          userIds: sortedIds,
          game: null,
          isFriendChat: true,
          usersData: {
            [user.uid]: { online: true },
            [friend.id]: { online: friend.online ?? false }
          },
          lastMessageTimestamp: serverTimestamp(),
        };
        await setDoc(chatDocRef, newChat);
        await addIcebreakerMessage(chatId, profile, friend);
        chatData = newChat;
      } else {
        // Chat exists, update my online status
        chatData = { id: chatDocSnap.id, ...chatDocSnap.data() } as Chat;
        if (!chatData.usersData?.[user.uid]?.online) {
          await updateDoc(chatDocRef, { [`usersData.${user.uid}.online`]: true });
          chatData.usersData![user.uid].online = true;
        }
      }
      openChat(chatData);
    } catch (error) {
      console.error("Error opening chat with friend:", error);
      toast({
        variant: 'destructive',
        title: 'Error',
        description: 'Could not start chat. Please try again.'
      });
    }
  };

  const handleSelectAi = () => {
    handleLeaveChat(true);
    setActiveView({ type: 'ai' });
    setActiveChat(null);
  };
  
  // Listener for being matched by another user
  useEffect(() => {
    if (!user?.uid) return () => {};

    const waitingDocRef = doc(db, 'waiting_users', user.uid);
    const unsubscribe = onSnapshot(waitingDocRef, async (docSnap) => {
        if (docSnap.exists() && docSnap.data().matchedChatId) {
            const matchedChatId = docSnap.data().matchedChatId;
            setIsSearching(false);
            
            await deleteDoc(waitingDocRef);
            
            const chatRef = doc(db, 'chats', matchedChatId);
            const chatSnap = await getDoc(chatRef);
            if (chatSnap.exists()) {
                const chatData = { id: chatSnap.id, ...chatSnap.data() } as Chat;
                openChat(chatData);
            }
        }
    });

    return () => unsubscribe();
  }, [user?.uid, db]);


  const findNewChat = async () => {
    if (!user || !profile) return;

    if (activeChat) {
      await handleLeaveChat(true);
    }
    setActiveView({ type: 'welcome' });
    setIsSearching(true);
    toast({ title: 'Searching for a chat...' });

    try {
        const blockedUsers = profile.blockedUsers || [];
        const waitingUsersRef = collection(db, 'waiting_users');
        const q = query(
            waitingUsersRef,
            where("uid", "!=", user.uid),
            limit(20)
        );

        const querySnapshot = await getDocs(q);

        let matchMade = false;
        for (const partnerDoc of querySnapshot.docs) {
            const partnerWaitingData = partnerDoc.data();
            if (partnerWaitingData.matchedChatId) continue;

            const partnerProfileSnap = await getDoc(doc(db, 'users', partnerWaitingData.uid));
            if (!partnerProfileSnap.exists()) continue;
            
            const partnerProfile = partnerProfileSnap.data() as User;
            if (blockedUsers.includes(partnerProfile.id) || (partnerProfile.blockedUsers || []).includes(user.uid)) {
                continue;
            }

            const partnerWaitingRef = partnerDoc.ref;
            try {
                await runTransaction(db, async (transaction) => {
                    const freshPartnerDoc = await transaction.get(partnerWaitingRef);
                    if (!freshPartnerDoc.exists() || freshPartnerDoc.data().matchedChatId) {
                        return;
                    }

                    // Create a unique, consistent chat ID for non-friend chats
                    const newChatRef = doc(collection(db, 'chats'));
                    
                    const newChatData: Chat = {
                        id: newChatRef.id,
                        userIds: [user.uid, partnerProfile.id].sort(),
                        game: null,
                        isFriendChat: false,
                        usersData: {
                            [user.uid]: { online: true },
                            [partnerProfile.id]: { online: true }
                        },
                        lastMessageTimestamp: serverTimestamp(),
                    };
                    transaction.set(newChatRef, newChatData);
                    transaction.update(partnerWaitingRef, { matchedChatId: newChatRef.id });
                    
                    setActiveChat(newChatData);
                    setActiveView({ type: 'chat', data: { user: partnerProfile, chat: newChatData } });
                    await addIcebreakerMessage(newChatRef.id, profile, partnerProfile);
                    matchMade = true;
                });

                if (matchMade) break;
            } catch (error) {
                console.warn("Transaction failed, trying next user:", error);
            }
        }

        if (matchMade) {
            setIsSearching(false);
            toast.dismiss();
        } else {
            await setDoc(doc(db, 'waiting_users', user.uid), {
                uid: user.uid,
                displayName: profile.name,
                isGuest: profile.isGuest ?? false,
                timestamp: serverTimestamp(),
                matchedChatId: null,
            });
        }
    } catch (error) {
        console.error("Error finding new chat:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find a chat. Please try again.' });
        setIsSearching(false);
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        const waitingDocSnap = await getDoc(waitingDocRef);
        if (waitingDocSnap.exists()) {
            await deleteDoc(waitingDocRef);
        }
    }
  };

  const handleLeaveChat = async (isSilent = false) => {
    if (activeView.type === 'chat' && user) {
      const { chat } = activeView.data;
      if (chat && !chat.isFriendChat) {
        const chatRef = doc(db, 'chats', chat.id);
        try {
          const chatSnap = await getDoc(chatRef);
          if (chatSnap.exists()) {
             await deleteDoc(chatRef);
          }
        } catch (error) {
          console.warn("Could not delete chat on leave:", error);
        }
      }
    }
    
    if(isSearching && user) {
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        const waitingDocSnap = await getDoc(waitingDocRef);
        if (waitingDocSnap.exists()) {
            await deleteDoc(waitingDocRef);
        }
        setIsSearching(false);
    }
    
    setVideoCallOpen(false);
    setIncomingCall(null);
    setActiveView({ type: 'welcome' });
    setActiveChat(null);
    if (!isSilent) {
      toast({ title: "You left the chat." });
    }
  };

  const handleAddFriend = async (friendId: string) => {
    if (!user || !profile || profile.isGuest) return;
    const requestId = [user.uid, friendId].sort().join('_');
    const requestRef = doc(db, 'friend_requests', requestId);

    try {
      await setDoc(requestRef, {
        fromId: user.uid,
        toId: friendId,
        fromName: profile.name,
        fromAvatar: profile.avatar,
        status: 'pending',
        timestamp: serverTimestamp()
      });
      toast({ title: "Friend request sent!" });
    } catch (error) {
      console.error("Error sending friend request:", error);
      toast({ variant: 'destructive', title: "Error", description: "Could not send friend request." });
    }
  };

  const handleRemoveFriend = async () => {
    if (!user || !friendToRemove) return;

    const batch = writeBatch(db);

    const meRef = doc(db, 'users', user.uid);
    batch.update(meRef, { friends: arrayRemove(friendToRemove.id) });

    const friendRef = doc(db, 'users', friendToRemove.id);
    batch.update(friendRef, { friends: arrayRemove(user.uid) });

    try {
      await batch.commit();
      toast({ title: "Friend Removed", description: `You are no longer friends with ${friendToRemove.name}.` });
      handleLeaveChat(true);
    } catch (error) {
      console.error("Error removing friend:", error);
      toast({ variant: 'destructive', title: 'Error', description: 'Could not remove friend.' });
    } finally {
      setFriendToRemove(null);
    }
  };

  const handleAcceptRequest = async (requestId: string, fromId: string) => {
    if (!user) return;
    const batch = writeBatch(db);

    const meRef = doc(db, 'users', user.uid);
    batch.update(meRef, { friends: arrayUnion(fromId) });

    const friendRef = doc(db, 'users', fromId);
    batch.update(friendRef, { friends: arrayUnion(user.uid) });

    const requestRef = doc(db, 'friend_requests', requestId);
    batch.delete(requestRef);

    await batch.commit();
    toast({ title: "Friend added!" });
  };

  const handleDeclineRequest = async (requestId: string) => {
    await deleteDoc(doc(db, 'friend_requests', requestId));
    toast({ title: "Request declined." });
  };

  const handleBlockUser = async (userIdToBlock: string) => {
    if (!user) return;
    const userRef = doc(db, 'users', user.uid);
    await updateDoc(userRef, {
      blockedUsers: arrayUnion(userIdToBlock)
    });
    toast({ variant: 'destructive', title: 'User Blocked', description: "You will no longer be matched with this user." });
    handleLeaveChat();
  };

  const handleInviteToGame = async (gameType: GameType) => {
    if (activeView.type !== 'chat') return;
    if (!user) return;

    const { chat, user: partner } = activeView.data;
    const chatRef = doc(db, 'chats', chat.id);

    let initialGameState: GameState | null = null;

    if (gameType === 'ticTacToe') {
      initialGameState = {
        type: 'ticTacToe',
        status: 'pending',
        board: Array(9).fill(null),
        turn: partner.id,
        players: { [user.uid]: 'X', [partner.id]: 'O' },
        winner: null,
        initiatorId: user.uid,
      };
    } else if (gameType === 'connectFour') {
      initialGameState = {
        type: 'connectFour',
        status: 'pending',
        board: Array(42).fill(null),
        turn: partner.id,
        players: { [user.uid]: 1, [partner.id]: 2 },
        winner: null,
        initiatorId: user.uid,
      };
    } else if (gameType === 'dotsAndBoxes') {
      const gridSize = 4;
      initialGameState = {
        type: 'dotsAndBoxes',
        status: 'pending',
        gridSize,
        h_lines: Array((gridSize + 1) * gridSize).fill(null),
        v_lines: Array(gridSize * (gridSize + 1)).fill(null),
        boxes: Array(gridSize * gridSize).fill(null),
        scores: { [user.uid]: 0, [partner.id]: 0 },
        turn: partner.id,
        players: { [user.uid]: 'p1', [partner.id]: 'p2' },
        winner: null,
        initiatorId: user.uid,
      };
    }
    await updateDoc(chatRef, { game: initialGameState });
    setGameCenterOpen(false);
  };

  const handleAcceptGame = async () => {
    if (activeView.type !== 'chat' || !activeChat?.game) return;
    const chatRef = doc(db, 'chats', activeChat.id);
    await updateDoc(chatRef, {
      'game.status': 'active',
      'game.turn': activeChat.game.initiatorId,
    });
  };

  const handleQuitGame = async () => {
    if (activeView.type !== 'chat' || !activeChat?.game) return;
    const chatRef = doc(db, 'chats', activeChat.id);
    await updateDoc(chatRef, { game: null });
  };

  const handleInitiateCall = async () => {
    if (activeView.type !== 'chat' || isVideoCallOpen) return;
    setVideoCallOpen(true);
  };
  
  const handleAnswerCall = () => {
    if (!incomingCall) return;
    setActiveCallId(incomingCall.callId);
    setVideoCallOpen(true);
    setIncomingCall(null);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall || !activeChat?.id) return;
    const callDocRef = doc(db, 'chats', activeChat.id, 'calls', incomingCall.callId);
    try {
        await deleteDoc(callDocRef);
    } catch (e) { console.error("Error declining call", e)}
    setIncomingCall(null);
    toast({
      title: 'Call Declined',
      description: 'You declined the call.',
    });
  };

  if (!user || !profile) {
    return (
        <div className="flex h-screen w-screen items-center justify-center bg-background">
            <Loader2 className="h-12 w-12 animate-spin text-primary" />
        </div>
    );
  }

  const renderGameView = () => {
    if (!activeChat?.game || !activeChat?.id) return null;
    switch (activeChat.game.type) {
      case 'ticTacToe':
        return <TicTacToe game={activeChat.game} currentUserId={user.uid} onAcceptGame={handleAcceptGame} onQuitGame={handleQuitGame} chatId={activeChat.id} />;
      case 'connectFour':
        return <ConnectFour game={activeChat.game} currentUserId={user.uid} onAcceptGame={handleAcceptGame} onQuitGame={handleQuitGame} chatId={activeChat.id} />;
      case 'dotsAndBoxes':
        return <DotsAndBoxes game={activeChat.game} currentUserId={user.uid} onAcceptGame={handleAcceptGame} onQuitGame={handleQuitGame} chatId={activeChat.id} />;
      default:
        return null;
    }
  };

  const renderView = () => {
    if (isVideoCallOpen && activeView.type === 'chat') {
      return (
          <VideoCallView
            user={activeView.data.user}
            currentUser={profile}
            chat={activeView.data.chat}
            callId={activeCallId}
            onOpenChange={(open) => {
                if(!open) {
                    setVideoCallOpen(false);
                    setActiveCallId(null);
                }
            }}
          />
      )
    }

    switch (activeView.type) {
      case 'chat':
        return (
          <div className="h-full flex flex-col md:flex-row">
            <div className="flex-1 min-h-0 flex flex-col h-full">
              <ChatView chat={activeView.data.chat} currentUser={profile} />
            </div>
            {activeChat?.game && (
              <div className="md:w-[400px] md:border-l bg-card flex-shrink-0">
                {renderGameView()}
              </div>
            )}
          </div>
        )
      case 'ai':
        return <AiAssistantView />;
      case 'welcome':
      default:
        return <WelcomeView onFindChat={findNewChat} isSearching={isSearching} />;
    }
  };

  const isFriend = (activeView.type === 'chat') ? !!activeChat?.isFriendChat : false;

  return (
    <SidebarProvider>
       <AlertDialog open={!!friendToRemove} onOpenChange={(open) => !open && setFriendToRemove(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Remove Friend?</AlertDialogTitle>
            <AlertDialogDescription>
              Are you sure you want to remove {friendToRemove?.name} as a friend? You will no longer see this chat.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction onClick={handleRemoveFriend}>Remove</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      <AlertDialog open={!!incomingCall}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Incoming Call</AlertDialogTitle>
            <AlertDialogDescription>
              You have an incoming video call from {incomingCall?.from.name}.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel onClick={handleDeclineCall}>Decline</AlertDialogCancel>
            <AlertDialogAction onClick={handleAnswerCall}>Accept</AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      
      <Dialog open={isGameCenterOpen} onOpenChange={setGameCenterOpen}>
        <GameCenterView
          onInvite={handleInviteToGame}
          isGuest={profile.isGuest}
        />
      </Dialog>

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
              <div className="w-full justify-start gap-2 flex items-center p-2">
                <Avatar className="h-8 w-8">
                  <AvatarImage src={profile.avatar} alt={profile.name} data-ai-hint="profile avatar" />
                  <AvatarFallback>{profile.name.charAt(0)}</AvatarFallback>
                </Avatar>
                <div className="flex flex-col items-start">
                  <span className="font-medium">{profile.name}</span>
                </div>
              </div>
            </SidebarMenuItem>
          </SidebarMenu>

          <SidebarSeparator />
          <SidebarGroup>
            <SidebarMenu>
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onNavigateHome}
                  tooltip="Home"
                >
                  <Home />
                  <span>Home</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
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
              <SidebarMenuItem>
                <SidebarMenuButton
                  onClick={onNavigateToMissedConnections}
                  tooltip="Missed Connections"
                >
                  <HeartCrack />
                  <span>Missed Connections</span>
                </SidebarMenuButton>
              </SidebarMenuItem>
            </SidebarMenu>
          </SidebarGroup>
          <SidebarSeparator />

          {!profile.isGuest && (
            <>
              {friendRequests.length > 0 && (
                <SidebarGroup>
                  <SidebarMenu>
                    <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">Friend Requests</p>
                    {friendRequests.map(req => (
                      <SidebarMenuItem key={req.id}>
                        <div className="flex items-center w-full justify-between p-2">
                          <div className="flex items-center gap-2">
                            <Avatar className="h-6 w-6">
                              <AvatarImage src={req.fromAvatar} alt={req.fromName} />
                              <AvatarFallback>{req.fromName.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="text-sm">{req.fromName}</span>
                          </div>
                          <div className="flex gap-1">
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleAcceptRequest(req.id, req.fromId)}>✓</Button>
                            <Button size="sm" variant="ghost" className="h-6 w-6 p-0" onClick={() => handleDeclineRequest(req.id)}>×</Button>
                          </div>
                        </div>
                      </SidebarMenuItem>
                    ))}
                  </SidebarMenu>
                </SidebarGroup>
              )}
              <SidebarGroup>
                <SidebarMenu>
                  <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">Friends</p>
                  {friends.map(friend => (
                    <SidebarMenuItem key={friend.id}>
                      <SidebarMenuButton
                        onClick={() => handleSelectChat(friend)}
                        isActive={activeView.type === 'chat' && activeView.data?.user.id === friend.id}
                        tooltip={friend.name}
                      >
                        <Avatar className="h-6 w-6 relative flex items-center justify-center">
                          <AvatarImage src={friend.avatar} alt={friend.name} />
                          <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                          {friend.online && <span className="absolute bottom-0 right-0 block h-2 w-2 rounded-full bg-green-500 ring-2 ring-sidebar-background" />}
                        </Avatar>
                        <span>{friend.name}</span>
                      </SidebarMenuButton>
                    </SidebarMenuItem>
                  ))}
                  {friends.length === 0 && (
                    <p className="px-2 text-xs text-muted-foreground">No friends yet.</p>
                  )}
                </SidebarMenu>
              </SidebarGroup>
            </>
          )}

        </SidebarContent>
        <SidebarHeader>
          <Button onClick={logout} variant="ghost" className="w-full justify-center">
            Logout
          </Button>
        </SidebarHeader>
      </Sidebar>
      <SidebarInset>
        <div className="h-screen flex flex-col bg-card">
          <ChatHeader
            activeView={activeView}
            onFindChat={findNewChat}
            onLeaveChat={() => handleLeaveChat(false)}
            onGoToWelcome={() => setActiveView({ type: 'welcome' })}
            isSearching={isSearching}
            onAddFriend={(activeView.type === 'chat') ? () => handleAddFriend(activeView.data.user.id) : () => { }}
            onRemoveFriend={(activeView.type === 'chat') ? () => setFriendToRemove(activeView.data.user) : () => { }}
            onBlockUser={(activeView.type === 'chat') ? () => handleBlockUser(activeView.data.user.id) : () => { }}
            onStartGame={() => setGameCenterOpen(true)}
            onVideoCall={handleInitiateCall}
            isFriend={isFriend}
            isGuest={profile.isGuest || ((activeView.type === 'chat') && activeView.data.user.isGuest)}
          />
          <div className="flex-1 min-h-0">
            {renderView()}
          </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
