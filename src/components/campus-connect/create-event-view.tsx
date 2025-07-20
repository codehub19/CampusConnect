
"use client";

import React, { useState, useEffect } from 'react';
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
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Calendar as CalendarIcon } from 'lucide-react';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import { cn } from '@/lib/utils';
import { generateEventImage } from '@/ai/flows/generate-event-image-flow';
import type { CampusEvent } from '@/lib/types';


interface CreateEventViewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  eventToEdit?: CampusEvent | null;
}

export default function CreateEventView({ isOpen, onOpenChange, eventToEdit }: CreateEventViewProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [date, setDate] = useState<Date | undefined>(undefined);
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { user, profile } = useAuth();
  const db = getFirestore(firebaseApp);
  
  const isEditMode = !!eventToEdit;

  useEffect(() => {
    if (isEditMode && eventToEdit) {
      setTitle(eventToEdit.title);
      setDescription(eventToEdit.description);
      setLocation(eventToEdit.location);
      setDate(eventToEdit.date?.toDate ? eventToEdit.date.toDate() : new Date(eventToEdit.date));
    } else {
      clearForm();
    }
  }, [eventToEdit, isEditMode]);


  const clearForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setDate(undefined);
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!title || !description || !location || !date) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill out all fields to create an event.',
      });
      return;
    }
    setIsSubmitting(true);

    try {
      if(isEditMode && eventToEdit) {
        // Update existing event
        const eventRef = doc(db, 'campus_events', eventToEdit.id);
        await updateDoc(eventRef, {
            title,
            description,
            location,
            date,
        });
        toast({
            title: 'Event Updated!',
            description: 'Your event details have been saved.',
        });

      } else {
        // Create new event
        const imageResult = await generateEventImage({
              title,
              description
        });
        
        const newEvent = {
          title,
          description,
          location,
          date,
          organizer: profile.name,
          authorId: user.uid,
          imageUrl: imageResult.imageUrl,
          chatId: `event-${Date.now()}-${Math.random()}`,
          timestamp: serverTimestamp(),
        };
        
        await addDoc(collection(db, 'campus_events'), newEvent);
        
        toast({
          title: 'Event Created!',
          description: 'Your event has been added to the campus feed.',
        });
      }
      
      onOpenChange(false);
      clearForm();
    } catch (error) {
      console.error("Error creating/updating event:", error);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: `Could not ${isEditMode ? 'update' : 'create'} your event. Please try again.`,
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
            <DialogTitle>{isEditMode ? 'Edit' : 'Create a New'} Campus Event</DialogTitle>
            <DialogDescription>
             {isEditMode ? 'Update the details for your event below.' : 'Fill in the details below. An AI-generated image will be created for your event banner.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="title">Event Title</Label>
              <Input id="title" placeholder="E.g., CS Club Tech Talk" value={title} onChange={(e) => setTitle(e.target.value)} />
            </div>
             <div className="grid grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" placeholder="E.g., Main Auditorium" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="date">Date & Time</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            variant={"outline"}
                            className={cn(
                            "justify-start text-left font-normal",
                            !date && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {date ? format(date, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={date}
                            onSelect={setDate}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>
            <div className="grid gap-2">
              <Label htmlFor="description">Description</Label>
              <Textarea id="description" placeholder="Tell everyone what your event is about." rows={4} value={description} onChange={(e) => setDescription(e.target.value)} />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              {isEditMode ? 'Save Changes' : 'Create Event'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
