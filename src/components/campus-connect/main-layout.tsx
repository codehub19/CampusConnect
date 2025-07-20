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
import { getFirestore, collection, onSnapshot, doc, getDoc, setDoc, query, where, getDocs, deleteDoc, addDoc, updateDoc, serverTimestamp, arrayUnion, writeBatch, limit } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useToast } from '@/hooks/use-toast';

type ActiveView = 
  | { type: 'welcome' }
  | { type: 'ai' }
  | { type: 'chat', data: { user: User, chat: Chat } };

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
    if (!chatDoc.exists()) {
      const newChat: Chat = {
        id: chatId,
        userIds: sortedIds,
        messages: [],
      };
      await setDoc(chatDocRef, newChat);
      chatDoc = await getDoc(chatDocRef);
    }
    
    setActiveView({ type: 'chat', data: { user: friend, chat: chatDoc.data() as Chat } });
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
    
    const q = query(waitingUsersRef, where('id', '!=', user.uid));
    const querySnapshot = await getDocs(q);

    let partner: User | null = null;
    let partnerWaitingDocId: string | null = null;
    
    for (const partnerDoc of querySnapshot.docs) {
        const waitingUser = partnerDoc.data() as User;
        if (waitingUser.id === user.uid) continue;
        const partnerProfileDoc = await getDoc(doc(db, 'users', waitingUser.id));
        const partnerProfile = partnerProfileDoc.data() as User;
        const blockedMe = partnerProfile.blockedUsers || [];

        if(!blockedByMe.includes(waitingUser.id) && !blockedMe.includes(user.uid)) {
            partnerWaitingDocId = partnerDoc.id;
            partner = waitingUser;
            break;
        }
    }


    if (partner && partnerWaitingDocId) {
        const newChatRef = doc(collection(db, 'chats'));
        const newChat: any = {
            id: newChatRef.id,
            userIds: [user.uid, partner.id],
            messages: [],
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

  if (!user || !profile) {
    return null; 
  }

  const renderView = () => {
    switch (activeView.type) {
      case 'chat':
        return activeView.data ? <ChatView user={activeView.data.user} chat={activeView.data.chat} currentUser={profile} /> : <WelcomeView onFindChat={handleFindChat} />;
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
        <div className="h-screen flex flex-col">
            <ChatHeader 
              activeView={activeView} 
              onFindChat={handleFindChat} 
              onLeaveChat={handleLeaveChat}
              isSearching={isSearching}
              onAddFriend={handleAddFriend}
              onBlockUser={handleBlockUser}
              isFriend={activeView.type === 'chat' ? profile.friends?.includes(activeView.data.user.id) : false}
              isGuest={profile.isGuest || (activeView.type === 'chat' && activeView.data.user.isGuest)}
            />
            <div className="flex-1 min-h-0">
              {renderView()}
            </div>
        </div>
      </SidebarInset>
    </SidebarProvider>
  );
}
