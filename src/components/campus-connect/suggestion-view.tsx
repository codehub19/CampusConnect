
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
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
import { useToast } from '@/hooks/use-toast';
import { getFirestore, collection, addDoc, serverTimestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

interface SuggestionViewProps {
  isOpen: boolean;
  onOpenChange: (isOpen: boolean) => void;
}

export default function SuggestionView({ isOpen, onOpenChange }: SuggestionViewProps) {
  const [suggestion, setSuggestion] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  
  const { toast } = useToast();
  const { user } = useAuth();
  const db = getFirestore(firebaseApp);

  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!user || !suggestion.trim()) {
      toast({
        variant: 'destructive',
        title: 'Suggestion cannot be empty.',
      });
      return;
    }
    setIsSubmitting(true);

    try {
      await addDoc(collection(db, 'suggestions'), {
        text: suggestion,
        userId: user.uid,
        timestamp: serverTimestamp(),
      });
      
      toast({
        title: 'Suggestion Submitted!',
        description: 'Thank you for your feedback.',
      });
      
      onOpenChange(false);
      setSuggestion('');
    } catch (error) {
      console.error("Error submitting suggestion:", error);
      toast({
        variant: 'destructive',
        title: 'Submission Error',
        description: 'Could not submit your suggestion. Please try again.',
      });
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <Dialog open={isOpen} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit}>
          <DialogHeader>
            <DialogTitle>Have a Suggestion?</DialogTitle>
            <DialogDescription>
              We'd love to hear your ideas for improving CampusConnect.
            </DialogDescription>
          </DialogHeader>
          <div className="grid gap-4 py-4">
            <div className="grid gap-2">
              <Label htmlFor="suggestion" className="sr-only">Your Suggestion</Label>
              <Textarea 
                id="suggestion" 
                placeholder="Tell us what you're thinking..." 
                rows={5} 
                value={suggestion} 
                onChange={(e) => setSuggestion(e.target.value)} 
              />
            </div>
          </div>
          <DialogFooter>
            <DialogClose asChild>
              <Button type="button" variant="ghost">Cancel</Button>
            </DialogClose>
            <Button type="submit" disabled={isSubmitting}>
              {isSubmitting && <Loader2 className="mr-2 h-4 w-4 animate-spin" />}
              Submit
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
