
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
import type { Event } from '@/lib/types';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

const categories = ["Social", "Study", "Trip", "Sports", "Online", "Music", "Other"];

interface CreateEventViewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
  eventToEdit?: Event | null;
}

export default function CreateEventView({ isOpen, onOpenChange, eventToEdit }: CreateEventViewProps) {
  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [location, setLocation] = useState('');
  const [startDate, setStartDate] = useState<Date | undefined>(undefined);
  const [endDate, setEndDate] = useState<Date | undefined>(undefined);
  const [category, setCategory] = useState('');
  const [cost, setCost] = useState('');
  const [capacity, setCapacity] = useState('');
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
      setStartDate(eventToEdit.date?.toDate ? eventToEdit.date.toDate() : new Date(eventToEdit.date));
      setEndDate(eventToEdit.endDate?.toDate ? eventToEdit.endDate.toDate() : eventToEdit.endDate ? new Date(eventToEdit.endDate) : undefined);
      setCategory(eventToEdit.category || '');
      setCost(eventToEdit.cost || '');
      setCapacity(eventToEdit.capacity?.toString() || '');
    } else {
      clearForm();
    }
  }, [eventToEdit, isEditMode, isOpen]);


  const clearForm = () => {
    setTitle('');
    setDescription('');
    setLocation('');
    setStartDate(undefined);
    setEndDate(undefined);
    setCategory('');
    setCost('');
    setCapacity('');
  }

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !profile) return;
    if (!title || !description || !location || !startDate || !category) {
      toast({
        variant: 'destructive',
        title: 'Missing Information',
        description: 'Please fill out all required fields to create an event.',
      });
      return;
    }
    setIsSubmitting(true);

    try {
      const eventData: Partial<Event> = {
          title,
          description,
          location,
          date: startDate,
          endDate: endDate,
          category,
          cost,
          capacity: capacity ? parseInt(capacity) : null,
      };

      if(isEditMode && eventToEdit) {
        // Update existing event
        const eventRef = doc(db, 'events', eventToEdit.id);
        await updateDoc(eventRef, eventData);
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
        
        const newEvent: Omit<Event, 'id'> = {
          ...eventData,
          organizer: profile.name,
          authorId: user.uid,
          imageUrl: imageResult.imageUrl,
          chatId: `event-${Date.now()}-${Math.random()}`,
          timestamp: serverTimestamp(),
        };
        
        await addDoc(collection(db, 'events'), newEvent);
        
        toast({
          title: 'Event Created!',
          description: 'Your event has been added to the feed.',
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
      <DialogContent className="sm:max-w-2xl">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>{isEditMode ? 'Edit' : 'Create a New'} Event</DialogTitle>
            <DialogDescription>
             {isEditMode ? 'Update the details for your event below.' : 'Fill in the details below. An AI-generated image will be created for your event banner.'}
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="grid gap-2">
                <Label htmlFor="title">Event Title</Label>
                <Input id="title" placeholder="E.g., CS Club Tech Talk" value={title} onChange={(e) => setTitle(e.target.value)} />
              </div>
              <div className="grid gap-2">
                <Label htmlFor="category">Category</Label>
                <Select value={category} onValueChange={setCategory}>
                  <SelectTrigger id="category"><SelectValue placeholder="Select a category" /></SelectTrigger>
                  <SelectContent>
                    {categories.map(cat => <SelectItem key={cat} value={cat}>{cat}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </div>

             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="startDate">Start Date & Time</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="startDate"
                            variant={"outline"}
                            className={cn(
                            "justify-start text-left font-normal",
                            !startDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {startDate ? format(startDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={startDate}
                            onSelect={setStartDate}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="endDate">End Date & Time (Optional)</Label>
                     <Popover>
                        <PopoverTrigger asChild>
                        <Button
                            id="endDate"
                            variant={"outline"}
                            className={cn(
                            "justify-start text-left font-normal",
                            !endDate && "text-muted-foreground"
                            )}
                        >
                            <CalendarIcon className="mr-2 h-4 w-4" />
                            {endDate ? format(endDate, "PPP") : <span>Pick a date</span>}
                        </Button>
                        </PopoverTrigger>
                        <PopoverContent className="w-auto p-0">
                        <Calendar
                            mode="single"
                            selected={endDate}
                            onSelect={setEndDate}
                            initialFocus
                        />
                        </PopoverContent>
                    </Popover>
                </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
               <div className="grid gap-2">
                    <Label htmlFor="location">Location</Label>
                    <Input id="location" placeholder="E.g., Main Auditorium" value={location} onChange={(e) => setLocation(e.target.value)} />
                </div>
                <div className="grid gap-2">
                    <Label htmlFor="cost">Cost</Label>
                    <Input id="cost" placeholder="E.g., Free, $10, etc." value={cost} onChange={(e) => setCost(e.target.value)} />
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="capacity">Capacity (Optional)</Label>
                    <Input id="capacity" type="number" placeholder="E.g., 50" value={capacity} onChange={(e) => setCapacity(e.target.value)} />
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
