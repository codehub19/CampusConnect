
"use client";

import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from '@/components/ui/dialog';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Checkbox } from '@/components/ui/checkbox';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { useToast } from '@/hooks/use-toast';
import type { User, Event, MissedConnectionPost } from '@/lib/types';
import { getFirestore, collection, query, where, onSnapshot, doc, deleteDoc, updateDoc, arrayRemove, getDocs } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { ScrollArea } from '@/components/ui/scroll-area';
import { format } from 'date-fns';
import { Pencil, Trash2, Users, Newspaper, Calendar, UserMinus, LogOut } from 'lucide-react';
import CreateEventView from './create-event-view';
import { useAuth } from '@/hooks/use-auth';

interface ProfileViewProps {
  user: User;
  isOpen: boolean;
  onOpenChange: (open: boolean) => void;
  onProfileUpdate: (user: Partial<User>) => void;
}

const allInterests = ['Gaming', 'Music', 'Sports', 'Movies', 'Reading', 'Hiking', 'Art', 'Coding', 'Cooking'];

export default function ProfileView({ user, isOpen, onOpenChange, onProfileUpdate }: ProfileViewProps) {
  const { toast } = useToast();
  const { logout } = useAuth();
  const [formData, setFormData] = useState<User>(user);
  const [myEvents, setMyEvents] = useState<Event[]>([]);
  const [myPosts, setMyPosts] = useState<MissedConnectionPost[]>([]);
  const [eventToEdit, setEventToEdit] = useState<Event | null>(null);
  const [isEditEventOpen, setIsEditEventOpen] = useState(false);
  
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    if (isOpen && user) {
        setFormData(user);
    }
  }, [user, isOpen]);

  useEffect(() => {
    if (!isOpen || !user?.id) return;

    const eventsQuery = query(collection(db, 'events'), where('authorId', '==', user.id));
    const eventsUnsub = onSnapshot(eventsQuery, (snapshot) => {
        const userEvents = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Event));
        userEvents.sort((a, b) => {
          const dateA = a.date?.toDate?.().getTime() || 0;
          const dateB = b.date?.toDate?.().getTime() || 0;
          return dateB - dateA;
        });
        setMyEvents(userEvents);
    });

    const postsQuery = query(collection(db, 'missed_connections'), where('authorId', '==', user.id));
    const postsUnsub = onSnapshot(postsQuery, (snapshot) => {
        const userPosts = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissedConnectionPost));
        userPosts.sort((a, b) => {
            const dateA = a.timestamp?.toDate?.().getTime() || 0;
            const dateB = b.timestamp?.toDate?.().getTime() || 0;
            return dateB - dateA;
        });
        setMyPosts(userPosts);
    });

    return () => {
        eventsUnsub();
        postsUnsub();
    }
  }, [user?.id, isOpen, db]);
  
  const handleEditEvent = (event: Event) => {
    setEventToEdit(event);
    setIsEditEventOpen(true);
  };
  
  const handleDeleteEvent = async (eventId: string) => {
    try {
        await deleteDoc(doc(db, 'events', eventId));
        toast({ title: "Event Deleted" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete the event." });
    }
  };

  const handleDeletePost = async (postId: string) => {
    try {
        await deleteDoc(doc(db, 'missed_connections', postId));
        toast({ title: "Post Deleted" });
    } catch (error) {
        toast({ variant: 'destructive', title: "Error", description: "Could not delete the post." });
    }
  };

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => setFormData(prev => ({ ...prev, [e.target.id]: e.target.value }));
  const handleGenderChange = (value: string) => setFormData(prev => ({ ...prev, gender: value as User['gender'] }));
  const handleInterestChange = (interest: string, checked: boolean) => {
    setFormData(prev => {
      const currentInterests = prev.interests || [];
      const interests = checked ? [...currentInterests, interest] : currentInterests.filter(i => i !== interest);
      return { ...prev, interests };
    });
  };

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    onProfileUpdate(formData);
    toast({ title: 'Profile Saved' });
    onOpenChange(false);
  };
  
  const handleLogout = () => {
    onOpenChange(false);
    logout();
  }

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="p-0 max-w-3xl">
        <ScrollArea className="max-h-[90vh]">
          <div className="p-4 sm:p-6">
            <DialogHeader className="mb-6">
                <DialogTitle className="text-2xl">Profile & Settings</DialogTitle>
                <DialogDescription>Manage your profile and content.</DialogDescription>
            </DialogHeader>

            <Tabs defaultValue="profile" className="w-full">
              <TabsList className="grid w-full grid-cols-2 mb-6">
                <TabsTrigger value="profile">Profile</TabsTrigger>
                <TabsTrigger value="content">My Content</TabsTrigger>
              </TabsList>
              
              <div className="min-h-[450px]">
                <TabsContent value="profile">
                  <form onSubmit={handleSubmit}>
                      <Card>
                          <CardHeader>
                              <CardTitle>Edit Profile</CardTitle>
                              <CardDescription>Update your public information.</CardDescription>
                          </CardHeader>
                          <CardContent className="space-y-6">
                              <div className="flex items-center gap-4">
                                  <Avatar className="h-20 w-20">
                                      <AvatarImage src={formData.avatar} alt={formData.name} data-ai-hint="profile avatar" />
                                      <AvatarFallback>{formData.name.charAt(0)}</AvatarFallback>
                                  </Avatar>
                                  <p className="text-sm text-muted-foreground">Avatars are currently assigned. Custom uploads coming soon!</p>
                              </div>
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                                  <div className="space-y-2">
                                      <Label htmlFor="name">Name</Label>
                                      <Input id="name" value={formData.name} onChange={handleInputChange} />
                                  </div>
                                  <div className="space-y-2">
                                      <Label htmlFor="gender">Gender</Label>
                                      <Select value={formData.gender} onValueChange={handleGenderChange}>
                                          <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                                          <SelectContent>
                                              <SelectItem value="Male">Male</SelectItem>
                                              <SelectItem value="Female">Female</SelectItem>
                                              <SelectItem value="Other">Other</SelectItem>
                                              <SelectItem value="Prefer not to say">Prefer not to say</SelectItem>
                                          </SelectContent>
                                      </Select>
                                  </div>
                              </div>
                              <div className="space-y-2">
                                  <Label>Interests</Label>
                                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2 pt-1">
                                      {allInterests.map(interest => (
                                      <div key={interest} className="flex items-center gap-2">
                                          <Checkbox id={`interest-${interest}`} checked={formData.interests?.includes(interest)} onCheckedChange={(checked) => handleInterestChange(interest, !!checked)} />
                                          <Label htmlFor={`interest-${interest}`} className="font-normal">{interest}</Label>
                                      </div>
                                      ))}
                                  </div>
                              </div>
                          </CardContent>
                          <CardFooter className="justify-between">
                            <Button variant="ghost" onClick={handleLogout} className="text-muted-foreground">
                              <LogOut className="mr-2 h-4 w-4" />
                              Logout
                            </Button>
                            <Button type="submit">Save Changes</Button>
                          </CardFooter>
                      </Card>
                  </form>
                </TabsContent>

                <TabsContent value="content" className="space-y-6">
                  <Card>
                    <CardHeader><CardTitle>My Events</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {myEvents.length > 0 ? myEvents.map(event => (
                            <div key={event.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                                <Calendar className="h-5 w-5 text-muted-foreground flex-shrink-0" />
                                <div className="flex-grow min-w-0">
                                  <p className="font-medium truncate">{event.title}</p>
                                  <p className="text-xs text-muted-foreground">{format(event.date.toDate(), 'PPP')}</p>
                                </div>
                                <Button variant="ghost" size="icon" className="h-8 w-8 flex-shrink-0" onClick={() => handleEditEvent(event)}><Pencil className="h-4 w-4" /></Button>
                                <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8 flex-shrink-0"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete your event.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeleteEvent(event.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                            </div>
                        )) : <p className="text-sm text-muted-foreground px-2">You haven't created any events yet.</p>}
                    </CardContent>
                  </Card>
                  <Card>
                    <CardHeader><CardTitle>My Missed Connections</CardTitle></CardHeader>
                    <CardContent className="space-y-3">
                        {myPosts.length > 0 ? myPosts.map(post => (
                            <div key={post.id} className="flex items-center gap-3 p-2 rounded-md bg-secondary/50">
                                <Newspaper className="h-5 w-5 text-muted-foreground flex-shrink-0"/>
                                <div className="flex-grow min-w-0">
                                  <p className="font-medium truncate">{post.title}</p>
                                  <p className="text-xs text-muted-foreground">Status: <span className={post.status === 'approved' ? 'text-green-500' : 'text-yellow-500'}>{post.status}</span></p>
                                </div>
                                 <AlertDialog><AlertDialogTrigger asChild><Button variant="destructive" size="icon" className="h-8 w-8 flex-shrink-0"><Trash2 className="h-4 w-4" /></Button></AlertDialogTrigger><AlertDialogContent><AlertDialogHeader><AlertDialogTitle>Are you sure?</AlertDialogTitle><AlertDialogDescription>This will permanently delete your post.</AlertDialogDescription></AlertDialogHeader><AlertDialogFooter><AlertDialogCancel>Cancel</AlertDialogCancel><AlertDialogAction onClick={() => handleDeletePost(post.id)}>Delete</AlertDialogAction></AlertDialogFooter></AlertDialogContent></AlertDialog>
                            </div>
                        )) : <p className="text-sm text-muted-foreground px-2">You haven't created any posts yet.</p>}
                    </CardContent>
                  </Card>
                </TabsContent>
              </div>
            </Tabs>
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
