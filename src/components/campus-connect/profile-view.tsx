"use client";

import React from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
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
import type { User } from '@/lib/types';

interface ProfileViewProps {
  user: User;
  onOpenChange: (open: boolean) => void;
}

const allInterests = ['Gaming', 'Music', 'Sports', 'Movies', 'Reading', 'Hiking', 'Art', 'Coding', 'Cooking'];

export default function ProfileView({ user, onOpenChange }: ProfileViewProps) {
  const { toast } = useToast();

  const handleSubmit = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    toast({
      title: 'Profile Saved',
      description: 'Your profile information has been updated.',
    });
    onOpenChange(false);
  };

  return (
    <DialogContent className="sm:max-w-[480px]">
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
              <AvatarImage src="https://placehold.co/100x100" alt={user.name} data-ai-hint="profile avatar" />
              <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
            </Avatar>
            <Button type="button" variant="outline">Change Photo</Button>
          </div>
          <div className="grid gap-2">
            <Label htmlFor="name">Name</Label>
            <Input id="name" defaultValue={user.name} />
          </div>
          <div className="grid gap-2">
            <Label htmlFor="gender">Gender</Label>
            <Select defaultValue={user.gender}>
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
                    defaultChecked={user.interests.includes(interest)}
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
    </DialogContent>
  );
}
