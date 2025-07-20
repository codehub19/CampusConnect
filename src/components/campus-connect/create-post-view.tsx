
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Label } from '@/components/ui/label';
import { Loader2 } from 'lucide-react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
  DialogClose,
} from '@/components/ui/dialog';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { moderateMissedConnection } from '@/ai/flows/moderate-missed-connection';

interface CreatePostViewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  onPostCreated: () => void;
}

const locations = ["Library", "Cafeteria", "Student Union", "Gym", "Quad", "Bookstore", "Lecture Hall", "Coffee Shop", "Other"];
const times = ["Morning", "Afternoon", "Evening", "Night"];

export default function CreatePostView({ isOpen, onOpenChange, onPostCreated }: CreatePostViewProps) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [location, setLocation] = useState('');
  const [timeOfDay, setTimeOfDay] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const db = getFirestore(firebaseApp);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !profile || !title || !content || !location || !timeOfDay) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill out all fields to create a post.',
      });
      return;
    }
    setIsSubmitting(true);

    try {
      // Moderate content first
      const moderationResult = await moderateMissedConnection({ title, content });
      
      const newPost = {
        title,
        content,
        location,
        timeOfDay,
        authorId: user.uid,
        authorName: profile.isGuest ? 'A Guest' : profile.name,
        timestamp: serverTimestamp(),
        status: moderationResult.decision, // 'approved' or 'rejected'
      };

      await addDoc(collection(db, 'missed_connections'), newPost);
      
      if (moderationResult.decision === 'approved') {
        toast({
          title: 'Post Submitted!',
          description: 'Your post is now live on the board.',
        });
      } else {
        toast({
          variant: 'destructive',
          title: 'Post Rejected',
          description: `Your post could not be approved. Reason: ${moderationResult.reason}`,
        });
      }

      onPostCreated();
      onOpenChange(false);
      setTitle('');
      setContent('');
      setLocation('');
      setTimeOfDay('');
    } catch (error) {
      console.error("Error creating post:", error);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'Could not submit your post. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[525px]">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Create a Missed Connection Post</DialogTitle>
            <DialogDescription>
              Saw someone interesting? Post about it here. All posts are reviewed by our AI moderator before going live.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Title</Label>
              <Input id="title" placeholder="E.g., Blue backpack in the library" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="location">Location</Label>
                <Select value={location} onValueChange={setLocation}>
                  <SelectTrigger><SelectValue placeholder="Select a location" /></SelectTrigger>
                  <SelectContent>
                    {locations.map(loc => <SelectItem key={loc} value={loc}>{loc}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid gap-2">
                <Label htmlFor="time">Time of Day</Label>
                 <Select value={timeOfDay} onValueChange={setTimeOfDay}>
                  <SelectTrigger><SelectValue placeholder="Select a time" /></SelectTrigger>
                  <SelectContent>
                    {times.map(t => <SelectItem key={t} value={t}>{t}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="content">Your Post</Label>
              <Textarea id="content" placeholder="Describe the moment. Be respectful and avoid sharing personal info." rows={5} value={content} onChange={(e) => setContent(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit Post
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
