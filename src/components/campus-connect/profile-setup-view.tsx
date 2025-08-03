
"use client";

import React, { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Checkbox } from '@/components/ui/checkbox';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { Loader2 } from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Textarea } from '../ui/textarea';

const allInterests = ['Gaming', 'Music', 'Sports', 'Movies', 'Reading', 'Hiking', 'Art', 'Coding', 'Cooking'];
const years = ["Freshman", "Sophomore", "Junior", "Senior", "Graduate"];

export default function ProfileSetupView() {
  const { profile, updateProfile } = useAuth();
  const { toast } = useToast();
  
  const [formData, setFormData] = useState<Partial<User>>({
    name: profile?.name || '',
    gender: profile?.gender || 'prefer-not-to-say',
    preference: profile?.preference || 'anyone',
    interests: profile?.interests || [],
    major: profile?.major || '',
    year: profile?.year || '',
    bio: profile?.bio || '',
  });
  const [isLoading, setIsLoading] = useState(false);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { id, value } = e.target;
    setFormData(prev => ({ ...prev, [id]: value }));
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
  
  const handleSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!formData.name) {
      toast({ variant: 'destructive', title: "Name is required."});
      return;
    }
    setIsLoading(true);
    try {
      await updateProfile({
        ...formData,
        profileComplete: true,
      });
      toast({
        title: 'Profile Setup Complete!',
        description: "Welcome to CampusConnect!",
      });
    } catch(error) {
      console.error(error);
      toast({ variant: 'destructive', title: "Error", description: "Could not save profile."})
    } finally {
        setIsLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 bg-background/80 backdrop-blur-sm flex items-center justify-center z-[100] p-4">
      <div className="bg-card border border-border rounded-2xl shadow-2xl max-w-lg w-full">
      <form onSubmit={handleSubmit} className="p-8">
          <div className="text-center">
            <h2 className="text-2xl font-bold text-white">Welcome! Let's set up your profile.</h2>
            <p className="mb-6 text-muted-foreground">This helps us connect you with the right people.</p>
          </div>
          <div className="grid gap-6 py-6">
            <div className="grid gap-2">
              <Label htmlFor="name">Display Name</Label>
              <Input id="name" value={formData.name} onChange={handleInputChange} placeholder="What should we call you?" />
            </div>
             <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
               <div className="grid gap-2">
                <Label htmlFor="major">Major</Label>
                <Input id="major" value={formData.major} onChange={handleInputChange} placeholder="E.g., Computer Science" />
              </div>
              <div className="grid gap-2">
                 <Label htmlFor="year">Year</Label>
                <Select value={formData.year} onValueChange={(value) => setFormData(p => ({...p, year: value}))}>
                    <SelectTrigger id="year"><SelectValue placeholder="Select year" /></SelectTrigger>
                    <SelectContent>
                      {years.map(y => <SelectItem key={y} value={y}>{y}</SelectItem>)}
                    </SelectContent>
                </Select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div className="grid gap-2">
                    <Label htmlFor="gender">Your Gender</Label>
                    <Select value={formData.gender} onValueChange={(value) => setFormData(p => ({...p, gender: value as User['gender']}))}>
                        <SelectTrigger id="gender"><SelectValue placeholder="Select gender" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="male">Male</SelectItem>
                            <SelectItem value="female">Female</SelectItem>
                            <SelectItem value="other">Other</SelectItem>
                            <SelectItem value="prefer-not-to-say">Prefer not to say</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
                 <div className="grid gap-2">
                    <Label htmlFor="preference">Chat With</Label>
                    <Select value={formData.preference} onValueChange={(value) => setFormData(p => ({...p, preference: value as User['preference']}))}>
                        <SelectTrigger id="preference"><SelectValue placeholder="Select preference" /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="anyone">Anyone</SelectItem>
                            <SelectItem value="males">Males</SelectItem>
                            <SelectItem value="females">Females</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </div>
            
            <div className="grid gap-2">
                <Label htmlFor="bio">Bio</Label>
                <Textarea id="bio" value={formData.bio} onChange={handleInputChange} placeholder="Tell us a little about yourself..." rows={3} />
            </div>

            <div className="grid gap-2">
              <Label>What are your interests?</Label>
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
          <Button type="submit" className="w-full font-bold" disabled={isLoading}>
            { isLoading ? <Loader2 className="animate-spin" /> : "Save and Start Chatting" }
          </Button>
      </form>
      </div>
    </div>
  );
}
