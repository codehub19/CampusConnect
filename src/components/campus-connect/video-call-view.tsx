
"use client";

import Image from 'next/image';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import {
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { User } from '@/lib/types';
import { currentUser } from '@/lib/data';
import { cn } from '@/lib/utils';

interface VideoCallViewProps {
  user: User;
  onOpenChange: (open: boolean) => void;
}

export default function VideoCallView({ user, onOpenChange }: VideoCallViewProps) {
  const [isMicOn, setMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    const getCameraPermission = async () => {
      // If permission is already granted or denied, don't ask again.
      if (hasCameraPermission !== null) return;
      
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true });
        setHasCameraPermission(true);

        if (videoRef.current) {
          videoRef.current.srcObject = stream;
        }
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use this feature.',
        });
      }
    };

    getCameraPermission();
    
    // Cleanup function to stop the video stream when the component unmounts
    return () => {
        if (videoRef.current && videoRef.current.srcObject) {
            const stream = videoRef.current.srcObject as MediaStream;
            stream.getTracks().forEach(track => track.stop());
        }
    };
  }, [hasCameraPermission, toast]);

  const handleToggleCamera = () => {
    if (videoRef.current && videoRef.current.srcObject) {
        const stream = videoRef.current.srcObject as MediaStream;
        const videoTrack = stream.getVideoTracks()[0];
        videoTrack.enabled = !isCameraOn;
        setCameraOn(!isCameraOn);
    } else {
        setCameraOn(!isCameraOn);
    }
  };


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
          <Image src={user.avatar} alt="Remote person's video" layout="fill" objectFit="cover" data-ai-hint="person video call" />
          <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
            {user.name}
          </div>
        </div>
        <div className="relative rounded-lg overflow-hidden bg-secondary flex items-center justify-center">
            <video ref={videoRef} className={cn("w-full aspect-auto h-full object-cover", { 'hidden': !isCameraOn || !hasCameraPermission })} autoPlay muted />
            {(!isCameraOn || !hasCameraPermission) && (
               <div className="w-full h-full bg-card flex items-center justify-center flex-col gap-4">
                 <Avatar className="h-32 w-32">
                   <AvatarImage src={currentUser.avatar} data-ai-hint="profile avatar" />
                   <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                 </Avatar>
                 {hasCameraPermission === false && (
                    <Alert variant="destructive" className="w-auto">
                        <AlertTitle>Camera Access Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera access to use this feature.
                        </AlertDescription>
                    </Alert>
                 )}
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
          onClick={handleToggleCamera}
          disabled={hasCameraPermission === false}
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
