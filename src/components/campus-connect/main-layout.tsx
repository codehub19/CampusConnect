
"use client";

import React, { useState, useEffect } from 'react';
import { Bot, MessageSquare, Home, CalendarDays } from 'lucide-react';
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
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ProfileView from '@/components/campus-connect/profile-view';
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
}

export function MainLayout({ onNavigateHome }: MainLayoutProps) {
  const { user, profile, logout, updateProfile } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
  const [activeChat, setActiveChat] = useState<Chat | null>(null);
  const [isProfileOpen, setProfileOpen] = useState(false);
  const [isGameCenterOpen, setGameCenterOpen] = useState(false);
  const [friends, setFriends] = useState<User[]>([]);
  const [friendRequests, setFriendRequests] = useState<FriendRequest[]>([]);
  const [isSearching, setIsSearching] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{ chat: Chat, from: User } | null>(null);
  const [isVideoCallOpen, setVideoCallOpen] = useState(false);
  
  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  // Listen for friends
  useEffect(() => {
    if (!user || !profile?.friends) return;

    const friendsIds = profile.friends;
    if (friendsIds.length === 0) {
      setFriends([]);
      return;
    }
    
    const usersRef = collection(db, 'users');
    const q = query(usersRef, where('id', 'in', friendsIds));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedFriends: User[] = [];
      snapshot.forEach((doc) => {
        fetchedFriends.push(doc.data() as User);
      });
      setFriends(fetchedFriends);
    });

    return () => unsubscribe();
  }, [user, profile?.friends, db]);

  // Listen for friend requests
  useEffect(() => {
    if (!user) return;
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
  }, [user, db]);

  // Cleanup waiting user on tab close
  useEffect(() => {
    const handleBeforeUnload = (e: BeforeUnloadEvent) => {
      if (user && isSearching) {
        deleteDoc(doc(db, 'waiting_users', user.uid));
      }
    };
    window.addEventListener('beforeunload', handleBeforeUnload);
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
      if (user && isSearching) {
         deleteDoc(doc(db, 'waiting_users', user.uid));
      }
    };
  }, [user, isSearching, db]);


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
          const chatData = { id: chatDoc.id, ...chatDoc.data() } as Chat;
          const partnerId = chatData.userIds.find((id:string) => id !== user.uid);
          if (partnerId) {
             const partnerDoc = await getDoc(doc(db, 'users', partnerId));
             if (partnerDoc.exists()) {
                const partnerProfile = partnerDoc.data() as User;
                setActiveChat(chatData);
                setActiveView({ type: 'chat', data: { user: partnerProfile, chat: chatData } });
             }
          }
        }
        setIsSearching(false);
      }
    });

    return () => unsubscribe();
  }, [user, isSearching, db, profile]);
  
  // Listen for incoming calls, game state, and partner leaving on the active chat
  useEffect(() => {
    if (activeView.type !== 'chat' || !user) return;

    const { chat, user: partner } = activeView.data;
    const chatRef = doc(db, 'chats', chat.id);

    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (!docSnap.exists()) {
          toast({ variant: 'destructive', title: "Chat deleted" });
          setActiveView({ type: 'welcome' });
          setActiveChat(null);
          return;
      }
      const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
      
      setActiveChat(chatData); // Keep the active chat state updated
      
      // Handle partner leaving
      const partnerUserData = chatData.usersData?.[partner.id];
      if (partnerUserData && !partnerUserData.online && !chatData.isFriendChat) {
        toast({ title: "Partner Left", description: `${partner.name} has left the chat.` });
        handleLeaveChat(true); // silent leave, just update UI
      }
      
      if (chatData.call && chatData.call.callerId !== user?.uid && !isVideoCallOpen) {
          setIncomingCall({ chat: chatData, from: partner });
      } else if (!chatData.call && incomingCall?.chat.id === chatData.id) {
          setIncomingCall(null);
      }
    });
    
    return () => unsubscribe();

  }, [activeView, user, db, isVideoCallOpen, incomingCall, toast]);


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

  const addIcebreakerMessage = async (chatId: string, currentUser: User, partnerUser: User) => {
    try {
      const result = await generateIcebreaker({
        userName1: currentUser.name,
        interests1: currentUser.interests,
        userName2: partnerUser.name,
        interests2: partnerUser.interests,
      });

      const messagesRef = collection(db, "chats", chatId, "messages");
      await addDoc(messagesRef, {
          senderId: 'ai-assistant',
          text: result.icebreaker,
          timestamp: serverTimestamp(),
      });
    } catch (error) {
      console.error("Failed to generate icebreaker:", error);
      // Fail silently, don't block chat experience
    }
  };

  const handleSelectChat = async (friend: User) => {
    if(!user || !profile) return;
    
    const sortedIds = [user.uid, friend.id].sort();
    const chatId = sortedIds.join('_');
    const chatDocRef = doc(db, "chats", chatId);

    let chatDoc = await getDoc(chatDocRef);
    let chatData: Chat;

    if (!chatDoc.exists()) {
      const newChat: Chat = {
        id: chatId,
        userIds: sortedIds,
        game: null,
        isFriendChat: true,
        usersData: {
            [user.uid]: { online: true },
            [friend.id]: { online: friend.online }
        }
      };
      await setDoc(chatDocRef, newChat);
      await addIcebreakerMessage(chatId, profile, friend);
      chatData = newChat;
    } else {
        chatData = {id: chatDoc.id, ...chatDoc.data()} as Chat;
        if (!chatData.usersData?.[user.uid]?.online) {
            await updateDoc(chatDocRef, { [`usersData.${user.uid}.online`]: true });
        }
    }
    
    setActiveChat(chatData);
    setActiveView({ type: 'chat', data: { user: friend, chat: chatData } });
  };

  const handleSelectAi = () => {
    setActiveView({ type: 'ai' });
    setActiveChat(null);
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
    const blockedByMe = profile.blockedUsers || [];
    
    const q = query(waitingUsersRef, where('id', '!=', user.uid), limit(10));
    const querySnapshot = await getDocs(q);

    let partner: User | null = null;
    let partnerWaitingDocId: string | null = null;
    
    const potentialPartners = querySnapshot.docs.map(doc => ({ id: doc.id, data: doc.data() as User }));

    for (const potentialPartner of potentialPartners) {
        const partnerProfileDoc = await getDoc(doc(db, 'users', potentialPartner.id));
        if (!partnerProfileDoc.exists()) continue;

        const partnerProfile = partnerProfileDoc.data() as User;
        const blockedMe = partnerProfile.blockedUsers || [];

        if(!blockedByMe.includes(potentialPartner.id) && !blockedMe.includes(user.uid)) {
            partnerWaitingDocId = potentialPartner.id;
            partner = partnerProfile;
            break;
        }
    }


    if (partner && partnerWaitingDocId && profile) {
        const newChatRef = doc(collection(db, 'chats'));
        const newChat: Chat = {
            id: newChatRef.id,
            userIds: [user.uid, partner.id].sort(),
            game: null,
            isFriendChat: false,
            usersData: {
                [user.uid]: { online: true },
                [partner.id]: { online: true }
            }
        };
        await setDoc(newChatRef, newChat);

        await addIcebreakerMessage(newChatRef.id, profile, partner);

        await updateDoc(doc(db, 'waiting_users', partnerWaitingDocId), { matchedChatId: newChatRef.id });
        
        setActiveChat(newChat);
        setActiveView({type: 'chat', data: { user: partner, chat: newChat }});
        setIsSearching(false);
        toast({ title: "Chat found!", description: `You've been connected with ${partner.name}.` });
    } else {
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
  
  const handleLeaveChat = async (isSilent = false) => {
    if (activeView.type === 'chat' && user) {
      const { chat } = activeView.data;
      const chatRef = doc(db, 'chats', chat.id);
      
      const chatSnap = await getDoc(chatRef);
      if(chatSnap.exists()) {
         // Mark the user as inactive
        await updateDoc(chatRef, {
            [`usersData.${user.uid}.online`]: false
        });
      }
    }
    setActiveView({ type: 'welcome' });
    setActiveChat(null);
    if (!isSilent) {
        toast({ title: "You left the chat."});
    }
  }

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

  const handleAcceptRequest = async (requestId: string, fromId: string) => {
    if(!user) return;
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
      if(!user) return;
      const userRef = doc(db, 'users', user.uid);
      await updateDoc(userRef, {
          blockedUsers: arrayUnion(userIdToBlock)
      });
      toast({ variant: 'destructive', title: 'User Blocked', description: "You will no longer be matched with this user." });
      handleLeaveChat();
  }

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
  
  const handleAnswerCall = () => {
    if (!incomingCall) return;
    setActiveChat(incomingCall.chat);
    setActiveView({ type: 'chat', data: { user: incomingCall.from, chat: incomingCall.chat } });
    setVideoCallOpen(true);
    setIncomingCall(null);
  };

  const handleDeclineCall = async () => {
    if (!incomingCall) return;
    const chatRef = doc(db, 'chats', incomingCall.chat.id);
    await updateDoc(chatRef, { call: null });
    setIncomingCall(null);
    toast({
      title: 'Call Declined',
      description: 'You declined the call.',
    });
  };


  if (!user || !profile) {
    return null; 
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
            <Dialog open={isVideoCallOpen} onOpenChange={setVideoCallOpen}>
              <VideoCallView 
                user={activeView.data.user} 
                currentUser={profile} 
                chat={activeView.data.chat}
                onOpenChange={setVideoCallOpen} 
              />
            </Dialog>
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
        return <WelcomeView onFindChat={handleFindChat} />;
    }
  };

  return (
    <SidebarProvider>
       {incomingCall && (
        <Dialog open={!!incomingCall} onOpenChange={() => setIncomingCall(null)}>
            <DialogContent>
                <DialogHeader>
                    <DialogTitle>Incoming Call</DialogTitle>
                    <DialogDescription>
                        You have an incoming video call from {incomingCall.from.name}.
                    </DialogDescription>
                </DialogHeader>
                <DialogFooter>
                    <Button variant="outline" onClick={handleDeclineCall}>Decline</Button>
                    <Button onClick={handleAnswerCall}>Accept</Button>
                </DialogFooter>
            </DialogContent>
        </Dialog>
      )}

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
              onFindChat={handleFindChat} 
              onLeaveChat={() => handleLeaveChat(false)}
              isSearching={isSearching}
              onAddFriend={(activeView.type === 'chat') ? () => handleAddFriend(activeView.data.user.id) : () => {}}
              onBlockUser={(activeView.type === 'chat') ? () => handleBlockUser(activeView.data.user.id) : () => {}}
              onStartGame={() => setGameCenterOpen(true)}
              onVideoCall={() => setVideoCallOpen(true)}
              isFriend={(activeView.type === 'chat') ? profile.friends?.includes(activeView.data.user.id) : false}
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
