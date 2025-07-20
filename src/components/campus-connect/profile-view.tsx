
"use client";

import React, { useState, useEffect } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { useToast } from '@/hooks/use-toast';
import type { User, Chat, CampusEvent, MissedConnectionPost } from '@/lib/types';
import { getFirestore, collection, query, where, getDocs, orderBy, limit, onSnapshot, doc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Pencil, Trash2 } from 'lucide-react';
import CreateEventView from './create-event-view';

interface ProfileViewProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdate: (user: Partial<User>) => void;
}

const allInterests = ['Gaming', 'Music', 'Sports', 'Movies', 'Reading', 'Hiking', 'Art', 'Coding', 'Cooking'];

export default function ProfileView({ user, isOpen, onOpenChange, onProfileUpdate }: ProfileViewProps) {
  const { toast } = useToast();
  const [formData, setFormData] = useState<User>(user);
  const [friends, setFriends] = useState<User[]>([]);
  const [recentChats, setRecentChats] = useState<{user: User, lastMessage: string}[]>([]);
  const [myEvents, setMyEvents] = useState<CampusEvent[]>([]);
  const [myPosts, setMyPosts] = useState<MissedConnectionPost[]>([]);
  const [eventToEdit, setEventToEdit] = useState<CampusEvent | null>(null);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    if (!isOpen || !user) return;

    setFormData(user); // Reset form data when dialog opens
    
    // Fetch friends
    if (user.friends && user.friends.length > 0) {
        const friendsQuery = query(collection(db, 'users'), where('id', 'in', user.friends));
        getDocs(friendsQuery).then(snapshot => {
            setFriends(snapshot.docs.map(doc => doc.data() as User));
        });
    } else {
        setFriends([]);
    }

    // Fetch my events
    const eventsQuery = query(collection(db, 'campus_events'), where('authorId', '==', user.id), orderBy('date', 'desc'));
    const eventsUnsub = onSnapshot(eventsQuery, (snapshot) => {
      setMyEvents(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as CampusEvent)));
    });

    // Fetch my posts
    const postsQuery = query(collection(db, 'missed_connections'), where('authorId', '==', user.id), orderBy('timestamp', 'desc'));
    const postsUnsub = onSnapshot(postsQuery, (snapshot) => {
        setMyPosts(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissedConnectionPost)));
    });

    // Fetch recent chats
    const chatsQuery = query(
        collection(db, 'chats'),
        where('userIds', 'array-contains', user.id),
        orderBy('lastMessageTimestamp', 'desc'),
        limit(5)
    );
    
    const chatsUnsub = onSnapshot(chatsQuery, async (snapshot) => {
        const chatsData: {user: User, lastMessage: string}[] = [];
        for (const docSnap of snapshot.docs) {
            const chat = docSnap.data() as Chat;
            const partnerId = chat.userIds.find(id => id !== user.id);
            if(partnerId) {
                const userDoc = await getDocs(query(collection(db, 'users'), where('id', '==', partnerId)));
                if(!userDoc.empty) {
                    const partnerUser = userDoc.docs[0].data() as User;
                    const messagesQuery = query(collection(db, 'chats', chat.id, 'messages'), orderBy('timestamp', 'desc'), limit(1));
                    const lastMessageSnap = await getDocs(messagesQuery);
                    const lastMessage = lastMessageSnap.empty ? "No messages yet" : lastMessageSnap.docs[0].data().text;
                    chatsData.push({user: partnerUser, lastMessage });
                }
            }
        }
        setRecentChats(chatsData);
    });

    return () => {
        eventsUnsub();
        postsUnsub();
        chatsUnsub();
    }

  }, [user, isOpen, db]);
  
  const handleEditEvent = (event: CampusEvent) => {
    setEventToEdit(event);
    setIsEditEventOpen(true);
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    try {
        await deleteDoc(doc(db, 'campus_events', eventId));
        toast({ title: "Event Deleted", description: "The event has been successfully removed." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete the event." });
        console.error("Error deleting event:", error);
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
        await deleteDoc(doc(db, 'missed_connections', postId));
        toast({ title: "Post Deleted", description: "The post has been successfully removed." });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete the post." });
        console.error("Error deleting post:", error);
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
  };
  
  const handleGenderChange = (value: string) => {
    setFormData(prev => ({ ...prev, gender: value as User['gender'] }));
  };

  const handleInterestChange = (interest: string, checked: boolean) => {
    setFormData(prev => {
      const currentInterests = prev.interests || [];
      const interests = checked
        ? [...currentInterests, interest]
        : currentInterests.filter(i => i !== interest);
      return { ...prev, interests };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onProfileUpdate(formData);
    toast({
      title: 'Profile Saved',
      description: 'Your profile information has been updated.',
    });
    onOpenChange(false);
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md p-0">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-6">
            <form onSubmit={handleSubmit}>
              <DialogHeader>
                <DialogTitle>Profile & Preferences</DialogTitle>
                <DialogDescription>
                  Make changes to your profile here. Click save when you're done.
                </DialogDescription>
              </DialogHeader>
              <div className="grid gap-6 py-6">
                <div className="flex items-center gap-4">
                  <Avatar className="h-20 w-20">
                    <AvatarImage src={formData.avatar} alt={formData.name} data-ai-hint="profile avatar" />
                    <AvatarFallback>{formData.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                  <p className="text-sm text-muted-foreground">Profile avatars are currently assigned. Custom uploads coming soon!</p>
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="name">Name</Label>
                  <Input id="name" value={formData.name} onChange={handleInputChange} />
                </div>
                <div className="grid gap-2">
                  <Label htmlFor="gender">Gender</Label>
                  <Select value={formData.gender} onValueChange={handleGenderChange}>
                    <SelectTrigger id="gender">
                      <SelectValue placeholder="Select gender" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="Male">Male</SelectItem>
                      <SelectItem value="Female">Female</SelectItem>
                      <SelectItem value="Other">Other</SelectItem>
                      <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div className="grid gap-2">
                  <Label>Interests</Label>
                  <div className="grid grid-cols-2 md:grid-cols-3 gap-2 mt-1">
                    {allInterests.map(interest => (
                      <div key={interest} className="flex items-center gap-2">
                        <Checkbox
                          id={`interest-${interest}`}
                          checked={formData.interests?.includes(interest)}
                          onCheckedChange={(checked) => handleInterestChange(interest, !!checked)}
                        />
                        <Label htmlFor={`interest-${interest}`} className="font-normal">{interest}</Label>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
              <DialogFooter>
                <Button type="button" variant="ghost" onClick={() => onOpenChange(false)}>Cancel</Button>
                <Button type="submit">Save Changes</Button>
              </DialogFooter>
            </form>

             <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-3">My Campus Events</h3>
                  <div className="space-y-3">
                      {myEvents.length > 0 ? myEvents.map(event => (
                          <div key={event.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                              <div className="flex-grow">
                                <p className="font-medium">{event.title}</p>
                                <p className="text-xs text-muted-foreground">{format(event.date.toDate(), 'PPP')}</p>
                              </div>
                              <Button variant="ghost" size="icon" className="h-8 w-8" onClick={() => handleEditEvent(event)}><Pencil className="h-4 w-4" /></Button>
                              <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete your event. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeleteEvent(event.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                          </div>
                      )) : <p className="text-sm text-muted-foreground">You haven't created any events yet.</p>}
                  </div>
              </div>
              
               <div className="mt-6 pt-6 border-t">
                  <h3 className="text-lg font-semibold mb-3">My Missed Connections</h3>
                  <div className="space-y-3">
                      {myPosts.length > 0 ? myPosts.map(post => (
                          <div key={post.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                              <div className="flex-grow">
                                <p className="font-medium truncate">{post.title}</p>
                                <p className="text-xs text-muted-foreground">Status: <span className={post.status === 'approved' ? 'text-green-500' : 'text-yellow-500'}>{post.status}</span></p>
                              </div>
                               <AlertDialog>
                                <AlertDialogTrigger asChild>
                                   <Button variant="destructive" size="icon" className="h-8 w-8"><Trash2 className="h-4 w-4" /></Button>
                                </AlertDialogTrigger>
                                <AlertDialogContent>
                                    <AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete your post. This action cannot be undone.</AlertDialogDescription></AlertDialogHeader>
                                    <AlertDialogFooter>
                                        <AlertDialogCancel>Cancel</AlertDialogCancel>
                                        <AlertDialogAction onClick={() => handleDeletePost(post.id)}>Delete</AlertDialogAction>
                                    </AlertDialogFooter>
                                </AlertDialogContent>
                              </AlertDialog>
                          </div>
                      )) : <p className="text-sm text-muted-foreground">You haven't created any posts yet.</p>}
                  </div>
              </div>


            <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-3">Friends ({friends.length})</h3>
                <div className="space-y-3">
                    {friends.length > 0 ? friends.map(friend => (
                        <div key={friend.id} className="flex items-center gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={friend.avatar} alt={friend.name} />
                                <AvatarFallback>{friend.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <span className="font-medium">{friend.name}</span>
                        </div>
                    )) : <p className="text-sm text-muted-foreground">No friends yet. Start chatting to add some!</p>}
                </div>
            </div>

            <div className="mt-6 pt-6 border-t">
                <h3 className="text-lg font-semibold mb-3">Recent Chats</h3>
                <div className="space-y-4">
                    {recentChats.length > 0 ? recentChats.map(chat => (
                        <div key={chat.user.id} className="flex items-start gap-3">
                            <Avatar className="h-9 w-9">
                                <AvatarImage src={chat.user.avatar} alt={chat.user.name} />
                                <AvatarFallback>{chat.user.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            <div className="min-w-0">
                              <p className="font-medium truncate">{chat.user.name}</p>
                              <p className="text-sm text-muted-foreground truncate">{chat.lastMessage}</p>
                            </div>
                        </div>
                    )) : <p className="text-sm text-muted-foreground">No recent conversations.</p>}
                </div>
            </div>
          </div>
        </ScrollArea>
        {eventToEdit && (
            <CreateEventView 
                isOpen={isEditEventOpen}
                onOpenChange={(open) => {
                    setIsEditEventOpen(open);
                    if (!open) setEventToEdit(null);
                }}
                eventToEdit={eventToEdit}
            />
        )}
      </DialogContent>
    </Dialog>
  );
}
