
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
import { Dialog, DialogTrigger, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import ProfileView from '@/components/campus-connect/profile-view';
import ChatView from '@/components/campus-connect/chat-view';
import AiAssistantView from '@/components/campus-connect/ai-assistant-view';
import WelcomeView from '@/components/campus-connect/welcome-view';
import ChatHeader from '@/components/campus-connect/chat-header';
import { useAuth } from '@/hooks/use-auth';
import type { User, Chat, FriendRequest } from '@/lib/types';
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, query, where, getDocs, deleteDoc, addDoc, updateDoc, serverTimestamp, arrayUnion, writeBatch, limit, runTransaction } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';
import TicTacToe from './tic-tac-toe';
import VideoCallView from './video-call-view';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'ai' }
  | { type: 'chat', data: { user: User, chat: Chat } }
  | { type: 'game', data: { user: User, chat: Chat } };

export function MainLayout() {
  const { user, profile, logout, updateProfile } = useAuth();
  const [activeView, setActiveView] = useState<ActiveView>({ type: 'welcome' });
  const [isProfileOpen, setProfileOpen] = useState(false);
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
                setActiveView({ type: 'chat', data: { user: partnerProfile, chat: chatData } });
             }
          }
        }
        setIsSearching(false);
      }
    });

    return () => unsubscribe();
  }, [user, isSearching, db, profile]);
  
  // Listen for incoming calls on the active chat
  useEffect(() => {
    if (activeView.type !== 'chat' && activeView.type !== 'game') return;

    const { chat } = activeView.data;
    const chatRef = doc(db, 'chats', chat.id);

    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
      if (!docSnap.exists()) return;
      const chatData = { id: docSnap.id, ...docSnap.data() } as Chat;
      
      // Update local chat state
      setActiveView(prev => {
        if ((prev.type === 'chat' || prev.type === 'game') && prev.data.chat.id === chatData.id) {
            const newType = chatData.game ? 'game' : 'chat';
            return { type: newType, data: { ...prev.data, chat: chatData } };
        }
        return prev;
      });
      
      if (chatData.call && chatData.call.callerId !== user?.uid && !isVideoCallOpen) {
          const partner = activeView.data.user;
          setIncomingCall({ chat: chatData, from: partner });
      } else if (!chatData.call && incomingCall?.chat.id === chatData.id) {
          // Caller hung up before answering
          setIncomingCall(null);
      }

      // Partner leaves chat notification
      if (chatData.userIds.includes(user!.uid) && chatData.userIds.includes(activeView.data.user.id)) {
        const partnerId = activeView.data.user.id;
        const partnerDocInChat = (chatData as any).usersData?.[partnerId];
        if (partnerDocInChat && !partnerDocInChat.online) {
            toast({
                title: 'User Left',
                description: `${activeView.data.user.name} has left the chat.`,
            });
            handleLeaveChat();
        }
      }
    });
    
    return () => unsubscribe();

  }, [activeView, user, db, isVideoCallOpen, incomingCall, toast]);


  const handleProfileUpdate = async (updatedUser: User) => {
    await updateProfile(updatedUser);
    if(profile) {
       setActiveView(prev => {
        if((prev.type === 'chat' || prev.type === 'game') && prev.data.user.id === updatedUser.id) {
          return { ...prev, data: { ...prev.data, user: updatedUser } }
        }
        return prev;
      });
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
      };
      await setDoc(chatDocRef, newChat);
      chatData = newChat;
    } else {
        chatData = {id: chatDoc.id, ...chatDoc.data()} as Chat;
    }
    
    setActiveView({ type: 'chat', data: { user: friend, chat: chatData } });
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
            partner = partnerProfile; // Use the full profile
            break;
        }
    }


    if (partner && partnerWaitingDocId) {
        const newChatRef = doc(collection(db, 'chats'));
        const newChat: Chat = {
            id: newChatRef.id,
            userIds: [user.uid, partner.id].sort(),
            game: null,
        };
        await setDoc(newChatRef, newChat);

        await updateDoc(doc(db, 'waiting_users', partnerWaitingDocId), { matchedChatId: newChatRef.id });
        
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
  
  const handleLeaveChat = async () => {
    if ((activeView.type === 'chat' || activeView.type === 'game') && user) {
        const { chat } = activeView.data;
        const userRef = doc(db, 'users', user.uid);
        await updateDoc(userRef, { online: false, lastSeen: serverTimestamp() });
    }
    setActiveView({ type: 'welcome' });
    toast({ title: "You left the chat."});
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

  const handleStartGame = async (gameType: 'ticTacToe') => {
      if (activeView.type !== 'chat') return;
      if (!user) return;

      const { chat } = activeView.data;
      const chatRef = doc(db, 'chats', chat.id);

      const initialGameState: any = {
        type: gameType,
        status: 'pending',
        board: Array(9).fill(null),
        turn: activeView.data.user.id,
        players: {
            [user.uid]: 'X',
            [activeView.data.user.id]: 'O'
        },
        winner: null,
      };

      await updateDoc(chatRef, { game: initialGameState });
  };

  const handleMakeMove = async (index: number) => {
    if (activeView.type !== 'game') return;
    const { chat, user: partner } = activeView.data;
    const { game } = chat;
    if (!game || game.status !== 'active' || game.turn !== user?.uid || game.board[index] !== null) {
      return;
    }
    
    const chatRef = doc(db, 'chats', chat.id);
    
    try {
      await runTransaction(db, async (transaction) => {
        const freshChatDoc = await transaction.get(chatRef);
        if (!freshChatDoc.exists()) throw new Error("Chat does not exist");
        
        const freshGame = freshChatDoc.data().game;
        if (!freshGame || freshGame.turn !== user?.uid || freshGame.board[index] !== null) return;

        const newBoard = [...freshGame.board];
        newBoard[index] = freshGame.players[user!.uid];

        const calculateWinner = (squares: any[]) => {
            const lines = [
              [0, 1, 2], [3, 4, 5], [6, 7, 8],
              [0, 3, 6], [1, 4, 7], [2, 5, 8],
              [0, 4, 8], [2, 4, 6],
            ];
            for (let i = 0; i < lines.length; i++) {
              const [a, b, c] = lines[i];
              if (squares[a] && squares[a] === squares[b] && squares[a] === squares[c]) {
                return squares[a];
              }
            }
            return null;
        };
        
        const winnerSymbol = calculateWinner(newBoard);
        const isDraw = newBoard.every(cell => cell !== null);
        let newStatus = freshGame.status;
        let newWinner: string | null = null;
        
        if (winnerSymbol) {
            newStatus = 'finished';
            newWinner = Object.keys(freshGame.players).find(key => freshGame.players[key] === winnerSymbol) || null;
        } else if (isDraw) {
            newStatus = 'finished';
            newWinner = 'draw';
        }

        const newGameData = {
          ...freshGame,
          board: newBoard,
          turn: newStatus === 'finished' ? null : partner.id,
          status: newStatus,
          winner: newWinner,
        };

        transaction.update(chatRef, { game: newGameData });
      });
    } catch (e) {
      console.error("Game move transaction failed:", e);
      toast({ variant: 'destructive', title: "Error", description: "Could not make move." });
    }
  };

  const handleAcceptGame = async () => {
    if (activeView.type !== 'game') return;
    const chatRef = doc(db, 'chats', activeView.data.chat.id);
    await updateDoc(chatRef, { 
        'game.status': 'active',
        'game.turn': activeView.data.user.id, // Initiator's turn
    });
  };
  
  const handleQuitGame = async () => {
      if (activeView.type !== 'game') return;
      const chatRef = doc(db, 'chats', activeView.data.chat.id);
      await updateDoc(chatRef, { game: null });
  };
  
  const handleAnswerCall = () => {
    if (!incomingCall) return;
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

  const renderView = () => {
    if (isVideoCallOpen && (activeView.type === 'chat' || activeView.type === 'game')) {
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
        return <ChatView chat={activeView.data.chat} currentUser={profile} />;
      case 'game':
        if (!activeView.data.chat.game) return <ChatView chat={activeView.data.chat} currentUser={profile} />;
        return (
            <div className="h-full flex flex-col md:flex-row">
                <div className="flex-1 min-h-0">
                    <ChatView chat={activeView.data.chat} currentUser={profile} />
                </div>
                <div className="md:w-[400px] md:border-l">
                    <TicTacToe 
                        game={activeView.data.chat.game} 
                        currentUserId={user.uid}
                        onMakeMove={handleMakeMove}
                        onAcceptGame={handleAcceptGame}
                        onQuitGame={handleQuitGame}
                    />
                </div>
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
                        isActive={(activeView.type === 'chat' || activeView.type === 'game') && activeView.data?.user.id === friend.id}
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
              onLeaveChat={handleLeaveChat}
              isSearching={isSearching}
              onAddFriend={handleAddFriend}
              onBlockUser={handleBlockUser}
              onStartGame={() => handleStartGame('ticTacToe')}
              onVideoCall={() => setVideoCallOpen(true)}
              isFriend={(activeView.type === 'chat' || activeView.type === 'game') ? profile.friends?.includes(activeView.data.user.id) : false}
              isGuest={profile.isGuest || ((activeView.type === 'chat' || activeView.type === 'game') && activeView.data.user.isGuest)}
            />
            <div className="flex-1 min-h-0">
              {renderView()}
            </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
