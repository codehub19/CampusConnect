"use client";

import Image from 'next/image';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useState } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import type { User } from '@/lib/types';

interface VideoCallViewProps {
  user: User;
  onOpenChange: (open: boolean) => void;
}

export default function VideoCallView({ user, onOpenChange }: VideoCallViewProps) {
  const [isMicOn, setMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(true);

  return (
    <DialogContent className="max-w-4xl h-[90vh] bg-background p-0 flex flex-col">
      <DialogHeader className="p-4 border-b">
        <DialogTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <span>Video Call with {user.name}</span>
        </DialogTitle>
      </DialogHeader>
      <div className="flex-1 grid grid-cols-1 md:grid-cols-2 gap-2 p-2 relative">
        <div className="relative rounded-lg overflow-hidden bg-secondary">
          <Image src="https://placehold.co/800x600" alt="Remote person's video" layout="fill" objectFit="cover" data-ai-hint="person video call" />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
            {user.name}
          </div>
        </div>
        <div className="relative rounded-lg overflow-hidden bg-secondary">
          {isCameraOn ? (
            <Image src="https://placehold.co/800x600" alt="Your video" layout="fill" objectFit="cover" data-ai-hint="selfie video call" />
          ) : (
             <div className="w-full h-full bg-card flex items-center justify-center">
               <Avatar className="h-32 w-32">
                 <AvatarImage src="https://placehold.co/100x100" data-ai-hint="profile avatar" />
                 <AvatarFallback>You</AvatarFallback>
               </Avatar>
             </div>
          )}
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
            You
          </div>
        </div>
      </div>
      <div className="flex justify-center items-center gap-4 p-4 border-t bg-card">
        <Button
          variant={isMicOn ? 'secondary' : 'destructive'}
          size="icon"
          className="rounded-full h-14 w-14"
          onClick={() => setMicOn(!isMicOn)}
        >
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>
        <Button
          variant={isCameraOn ? 'secondary' : 'destructive'}
          size="icon"
          className="rounded-full h-14 w-14"
          onClick={() => setCameraOn(!isCameraOn)}
        >
          {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full h-14 w-14"
          onClick={() => onOpenChange(false)}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </DialogContent>
  );
}
