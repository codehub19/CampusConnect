
"use client";

import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Home, HeartCrack, Loader2, Video, Gamepad2 } from 'lucide-react';
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
import { ScrollArea } from '@/components/ui/scroll-area';
import ChatView from '@/components/campus-connect/chat-view';
import AiAssistantView from '@/components/campus-connect/ai-assistant-view';
import WelcomeView from '@/components/campus-connect/welcome-view';
import ChatHeader from '@/components/campus-connect/chat-header';
import GameCenterView from '@/components/campus-connect/game-center-view';
import TicTacToe from '@/components/campus-connect/tic-tac-toe';
import ConnectFour from '@/components/campus-connect/connect-four';
import DotsAndBoxes from '@/components/campus-connect/dots-and-boxes';
import { useAuth } from '@/hooks/use-auth';
import type { User, Chat, GameState, GameType } from '@/lib/types';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, query, where, getDocs, deleteDoc, addDoc, updateDoc, serverTimestamp, arrayUnion, writeBatch, limit, runTransaction } from 'firebase/firestore';
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
  const { user, profile } = useAuth();
  const db = getFirestore(firebaseApp);
  const { toast } = useToast();
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isGameCenterOpen, setGameCenterOpen] = useState(false);
  const [isSearching, setIsSearching] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ callId: string, from: User } | null>(null);
  const [isVideoCallOpen, setVideoCallOpen] = useState(false);
  const [activeCallId, setActiveCallId] = useState<string | null>(null);
  
  const [listeners, setListeners] = useState<{ [key: string]: () => void }>({});

  const cleanupListeners = (keys: string[] = []) => {
    const newListeners = { ...listeners };
    const keysToClean = keys.length > 0 ? keys : Object.keys(newListeners);
    
    keysToClean.forEach(key => {
      if (newListeners[key]) {
        newListeners[key]();
        delete newListeners[key];
      }
    });

    if (keys.length > 0) {
      setListeners(newListeners);
    } else {
      setListeners({});
    }
  };

  useEffect(() => {
    if (activeView.type !== 'chat' || !user || !activeChat?.id) {
       cleanupListeners(['activeChat']);
       return;
    }
  
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
      setActiveChat(chatData);
  
      const partnerUserData = chatData.usersData?.[partner.id];
      if (partnerUserData && !partnerUserData.online && !chatData.isFriendChat) {
        toast({ title: "Partner Left", description: `${partner.name} has left the chat.` });
        handleLeaveChat(true); // Silently leave
      }
    });
  
    setListeners(prev => ({...prev, activeChat: newUnsubscribe}));
    
    return () => newUnsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView, activeChat?.id]);

  useEffect(() => {
    if (activeView.type !== 'chat' || !user?.id || isVideoCallOpen) {
      cleanupListeners(['call']);
      return;
    }
    
    const { chat, user: partner } = activeView.data;
    if (!chat.id) return;

    const callsRef = collection(db, 'chats', chat.id, 'calls');
    const q = query(callsRef, where('callerId', '!=', user.id));

    const newUnsubscribe = onSnapshot(q, (snapshot) => {
      snapshot.docChanges().forEach((change) => {
        if (change.type === 'added') {
          const callData = change.doc.data();
          if (callData.offer && !callData.answer) {
              setIncomingCall({ callId: change.doc.id, from: partner });
          }
        } else if (change.type === 'removed') {
            setIncomingCall(null);
        }
      });
    });

    setListeners(prev => ({...prev, call: newUnsubscribe}));
    return () => newUnsubscribe();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeView.type, user?.id, isVideoCallOpen]);


  useEffect(() => {
    return () => cleanupListeners();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

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
    
    setIsSearching(false);

    setActiveChat(chatData);
    setActiveView({ type: 'chat', data: { user: partnerSnap.data() as User, chat: chatData } });
  }

  const handleSelectAi = () => {
    handleLeaveChat(true);
    setActiveView({ type: 'ai' });
    setActiveChat(null);
  };
  
  useEffect(() => {
    if (!user?.uid) return () => {};

    const userDocRef = doc(db, 'users', user.uid);
    const unsubscribe = onSnapshot(userDocRef, async (docSnap) => {
        const userData = docSnap.data() as User;
        if (userData?.pendingChatId) {
            const matchedChatId = userData.pendingChatId;
            setIsSearching(false);
            
            await updateDoc(userDocRef, { pendingChatId: null });
            
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
            const partnerUserDocRef = doc(db, 'users', partnerProfile.id);

            try {
                await runTransaction(db, async (transaction) => {
                    const freshPartnerDoc = await transaction.get(partnerWaitingRef);
                    if (!freshPartnerDoc.exists()) {
                        return; // Partner already matched by someone else
                    }

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
                    transaction.delete(partnerWaitingRef);
                    transaction.update(partnerUserDocRef, { pendingChatId: newChatRef.id });
                    
                    setActiveChat(newChatData);
                    setActiveView({ type: 'chat', data: { user: partnerProfile, chat: newChatData } });
                    await addIcebreakerMessage(newChatRef.id, profile, partnerProfile);
                    matchMade = true; 
                });

                if (matchMade) break;
            } catch (error) {
                console.warn("Transaction to match with user failed, trying next:", error);
            }
        }

        if (matchMade) {
            setIsSearching(false);
            toast.dismiss();
        } else {
            await setDoc(doc(db, 'waiting_users', user.uid), {
                uid: user.uid,
                timestamp: serverTimestamp(),
            });
        }
    } catch (error) {
        console.error("Error finding new chat:", error);
        toast({ variant: 'destructive', title: 'Error', description: 'Could not find a chat. Please try again.' });
        setIsSearching(false);
        const waitingDocRef = doc(db, 'waiting_users', user.uid);
        if ((await getDoc(waitingDocRef)).exists()) {
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
    if (activeView.type !== 'chat' || !user) return;

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
            callId={activeCallId ?? undefined}
            setCallId={setActiveCallId}
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

  return (
    <SidebarProvider>
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
            <ScrollArea className="h-full">
                <div className="p-4">
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

                    <SidebarGroup>
                        <p className="px-2 text-xs font-semibold text-muted-foreground mb-2">CHATS</p>
                        <div className="p-4">
                            <WelcomeView onFindChat={findNewChat} isSearching={isSearching} />
                        </div>
                    </SidebarGroup>
                </div>
            </ScrollArea>
        </SidebarContent>
      </Sidebar>
      <SidebarInset>
        <div className="h-screen flex flex-col bg-card">
          <ChatHeader
            activeView={activeView}
            onFindChat={findNewChat}
            onLeaveChat={() => handleLeaveChat(false)}
            onGoToWelcome={() => setActiveView({ type: 'welcome' })}
            isSearching={isSearching}
            onAddFriend={() => {}}
            onRemoveFriend={() => {}}
            onBlockUser={(activeView.type === 'chat') ? () => handleBlockUser(activeView.data.user.id) : () => { }}
            onStartGame={() => setGameCenterOpen(true)}
            onVideoCall={handleInitiateCall}
            isFriend={false}
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
