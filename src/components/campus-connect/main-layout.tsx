
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
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
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
    const handleBeforeUnload = async (e: BeforeUnloadEvent) => {
      if (user && isSearching) {
        // This is a best-effort attempt. Most modern browsers will not wait for the async operation to complete.
        // A more robust solution involves Cloud Functions and Firestore presence.
        await deleteDoc(doc(db, 'waiting_users', user.uid));
      }
    };
  
    window.addEventListener('beforeunload', handleBeforeUnload);
  
    return () => {
      window.removeEventListener('beforeunload', handleBeforeUnload);
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
          const chatData = chatDoc.data() as any;
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
  }, [user, isSearching, db]);

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
        messages: [],
        game: null,
      };
      await setDoc(chatDocRef, newChat);
      chatData = newChat;
    } else {
        chatData = chatDoc.data() as Chat;
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
    
    // We query for a limited number of users to avoid large reads.
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
            partner = potentialPartner.data;
            break;
        }
    }


    if (partner && partnerWaitingDocId) {
        const newChatRef = doc(collection(db, 'chats'));
        const newChat: Chat = {
            id: newChatRef.id,
            userIds: [user.uid, partner.id],
            messages: [],
            game: null,
        };
        await setDoc(newChatRef, newChat);

        await updateDoc(doc(db, 'waiting_users', partnerWaitingDocId), { matchedChatId: newChatRef.id });
        
        const partnerProfile = (await getDoc(doc(db, 'users', partner.id))).data() as User;
        setActiveView({type: 'chat', data: { user: partnerProfile, chat: newChat }});
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
  
  const handleLeaveChat = () => {
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

      const { chat } = activeView.data;
      const chatRef = doc(db, 'chats', chat.id);

      const initialGameState: any = {
        type: gameType,
        status: 'pending',
        board: Array(9).fill(null),
        turn: activeView.data.user.id,
        players: {
            [user!.uid]: 'X',
            [activeView.data.user.id]: 'O'
        },
        winner: null,
      };

      await updateDoc(chatRef, { game: initialGameState });
      setActiveView({ ...activeView, type: 'game' });
  };

  const handleGameUpdate = (newGameData: any | null) => {
    if (activeView.type === 'game' || activeView.type === 'chat') {
        const newChatState = { ...activeView.data.chat, game: newGameData };
        const newType = newGameData ? 'game' : 'chat';
        setActiveView({ type: newType, data: { ...activeView.data, chat: newChatState } });
    }
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
        let newWinner = null;
        
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
    await updateDoc(chatRef, { 'game.status': 'active' });
  };
  
  const handleQuitGame = async () => {
      if (activeView.type !== 'game') return;
      const chatRef = doc(db, 'chats', activeView.data.chat.id);
      await updateDoc(chatRef, { game: null });
  };


  if (!user || !profile) {
    return null; 
  }

  const renderView = () => {
    switch (activeView.type) {
      case 'chat':
        return activeView.data ? <ChatView chat={activeView.data.chat} currentUser={profile} /> : <WelcomeView onFindChat={handleFindChat} />;
      case 'game':
        if (!activeView.data.chat.game) return <WelcomeView onFindChat={handleFindChat} />;
        return (
            <div className="h-full flex flex-col md:flex-row">
                <div className="flex-1 min-h-0">
                    <ChatView chat={activeView.data.chat} currentUser={profile} />
                </div>
                <div className="md:w-1/3 md:border-l">
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
        <div className="h-screen flex flex-col">
            <ChatHeader 
              activeView={activeView} 
              onFindChat={handleFindChat} 
              onLeaveChat={handleLeaveChat}
              isSearching={isSearching}
              onAddFriend={handleAddFriend}
              onBlockUser={handleBlockUser}
              onStartGame={() => handleStartGame('ticTacToe')}
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
