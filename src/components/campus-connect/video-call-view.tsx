
"use client";

import Image from 'next/image';
import { Mic, MicOff, Video, VideoOff, PhoneOff, Loader2 } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { User, Chat } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getFirestore, doc, onSnapshot, collection, addDoc, getDocs, writeBatch, updateDoc, deleteDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/components/ui/dialog';

interface VideoCallViewProps {
  user: User; // The person being called
  currentUser: User;
  chat: Chat;
  callId?: string;
  onOpenChange: (open: boolean) => void;
}

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

export default function VideoCallView({ user, currentUser, chat, callId, onOpenChange }: VideoCallViewProps) {
  const [isMicOn, setMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);
  const isHangingUp = useRef(false);

  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  const hangUp = async (notifyPartner = false) => {
    if (isHangingUp.current) return;
    isHangingUp.current = true;
    
    pc.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());

    if (notifyPartner && chat.id && callId) {
        const callDocRef = doc(db, 'chats', chat.id, 'calls', callId);
        await deleteDoc(callDocRef).catch(e => console.warn("Failed to delete call doc:", e));
    }
    
    onOpenChange(false);
  };
  
  useEffect(() => {
    const setupCall = async () => {
        pc.current = new RTCPeerConnection(servers);
        remoteStreamRef.current = new MediaStream();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setHasCameraPermission(true);

            stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
        } catch (error) {
            console.error("Media devices error:", error);
            setHasCameraPermission(false);
            toast({ variant: 'destructive', title: "Permission Denied", description: "Camera and mic are needed for calls."});
            return;
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }

        pc.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStreamRef.current?.addTrack(track);
            });
        };

        const callDocRef = doc(db, 'chats', chat.id, 'calls', callId!);
        const offerCandidates = collection(callDocRef, 'offerCandidates');
        const answerCandidates = collection(callDocRef, 'answerCandidates');

        pc.current.onicecandidate = event => {
            if (event.candidate) {
                addDoc(answerCandidates, event.candidate.toJSON());
            }
        };

        const callDocSnapshot = await getDoc(callDocRef);
        const { offer } = callDocSnapshot.data() as any;
        await pc.current.setRemoteDescription(new RTCSessionDescription(offer));

        const answerDescription = await pc.current.createAnswer();
        await pc.current.setLocalDescription(answerDescription);

        const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
        await updateDoc(callDocRef, { answer });

        onSnapshot(offerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                }
            });
        });

    };

    const createCall = async () => {
        const callDocRef = doc(collection(db, 'chats', chat.id, 'calls'));
        const offerCandidates = collection(callDocRef, 'offerCandidates');
        const answerCandidates = collection(callDocRef, 'answerCandidates');

        pc.current = new RTCPeerConnection(servers);
        remoteStreamRef.current = new MediaStream();

        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            if (localVideoRef.current) localVideoRef.current.srcObject = stream;
            setHasCameraPermission(true);

            stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
        } catch (error) {
            console.error("Media devices error:", error);
            setHasCameraPermission(false);
            toast({ variant: 'destructive', title: "Permission Denied", description: "Camera and mic are needed for calls."});
            return;
        }

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStreamRef.current;
        }
        
        pc.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStreamRef.current?.addTrack(track);
            });
        };

        pc.current.onicecandidate = event => {
            if (event.candidate) {
                addDoc(offerCandidates, event.candidate.toJSON());
            }
        };

        const offerDescription = await pc.current.createOffer();
        await pc.current.setLocalDescription(offerDescription);
        
        const offer = { type: offerDescription.type, sdp: offerDescription.sdp };
        await setDoc(callDocRef, { offer, callerId: currentUser.id, answer: null });
        
        onSnapshot(callDocRef, (snapshot) => {
            const data = snapshot.data();
            if (!pc.current?.currentRemoteDescription && data?.answer) {
                pc.current?.setRemoteDescription(new RTCSessionDescription(data.answer));
            }
        });
        
        onSnapshot(answerCandidates, (snapshot) => {
            snapshot.docChanges().forEach((change) => {
                if (change.type === 'added') {
                    pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                }
            });
        });
    }

    if(callId) { // This user is answering
        setupCall();
    } else { // This user is initiating
        createCall();
    }

    return () => {
        hangUp(true);
    };
  }, [chat.id, callId, db, toast]);


  const toggleMediaStream = (type: 'video' | 'audio', state: boolean) => {
    localStreamRef.current?.getTracks().forEach(track => {
        if (track.kind === type) track.enabled = state;
    });
  };

  const handleToggleCamera = () => {
    const newState = !isCameraOn;
    setCameraOn(newState);
    toggleMediaStream('video', newState);
  };

  const handleToggleMic = () => {
    const newState = !isMicOn;
    setMicOn(newState);
    toggleMediaStream('audio', newState);
  };

  if(hasCameraPermission === null) {
      return (
        <Dialog open>
            <DialogContent className="w-full max-w-md h-auto bg-background p-6 flex flex-col items-center justify-center gap-4">
                <Loader2 className="h-10 w-10 animate-spin text-primary" />
                <p className="text-lg font-medium">Starting video call...</p>
                <p className="text-sm text-muted-foreground text-center">Please allow camera and microphone access when prompted.</p>
            </DialogContent>
        </Dialog>
      )
  }

  return (
    <Dialog open onOpenChange={() => hangUp(true)}>
    <DialogContent className="w-full max-w-4xl h-full sm:h-[90vh] bg-background p-0 flex flex-col">
      <DialogHeader className="p-4 border-b shrink-0">
        <DialogTitle className="flex items-center gap-2">
          <Video className="h-5 w-5 text-primary" />
          <span>Video Call with {user.name}</span>
        </DialogTitle>
      </DialogHeader>
      
      <div className="flex-1 relative bg-secondary overflow-hidden">
        {/* Remote Video */}
        <video ref={remoteVideoRef} className="w-full h-full object-cover" autoPlay playsInline />
        <div className="absolute bottom-2 left-2 bg-black/50 text-white text-sm px-2 py-1 rounded">
            {user.name}
        </div>
        
        {/* Local Video (Picture-in-Picture) */}
        <div className="absolute top-4 right-4 w-32 h-48 sm:w-40 sm:h-56 rounded-lg overflow-hidden border-2 border-border bg-card shadow-lg">
             <video ref={localVideoRef} className={cn("w-full h-full object-cover", { 'transform -scale-x-100': true, 'hidden': !isCameraOn || hasCameraPermission === false })} autoPlay muted playsInline />
             {(!isCameraOn || hasCameraPermission === false) && (
               <div className="w-full h-full bg-card flex items-center justify-center flex-col gap-4 p-2">
                 <Avatar className="h-16 w-16 sm:h-20 sm:w-20">
                   <AvatarImage src={currentUser.avatar} data-ai-hint="profile avatar" />
                   <AvatarFallback>{currentUser.name.charAt(0)}</AvatarFallback>
                 </Avatar>
                 {hasCameraPermission === false && (
                    <Alert variant="destructive" className="w-auto text-xs text-center">
                        <AlertTitle>Media Required</AlertTitle>
                        <AlertDescription>
                            Please allow camera & mic access.
                        </AlertDescription>
                    </Alert>
                 )}
               </div>
            )}
             <div className="absolute bottom-1 left-1 bg-black/50 text-white text-xs px-1 py-0.5 rounded">
                You
            </div>
        </div>
      </div>
      
      <div className="flex justify-center items-center gap-4 p-4 border-t bg-card shrink-0">
        <Button
          variant={isMicOn ? 'secondary' : 'destructive'}
          size="icon"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14"
          onClick={handleToggleMic}
          disabled={hasCameraPermission === false}
        >
          {isMicOn ? <Mic className="h-6 w-6" /> : <MicOff className="h-6 w-6" />}
        </Button>
        <Button
          variant={isCameraOn ? 'secondary' : 'destructive'}
          size="icon"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14"
          onClick={handleToggleCamera}
          disabled={hasCameraPermission === false}
        >
          {isCameraOn ? <Video className="h-6 w-6" /> : <VideoOff className="h-6 w-6" />}
        </Button>
        <Button
          variant="destructive"
          size="icon"
          className="rounded-full h-12 w-12 sm:h-14 sm:w-14"
          onClick={() => hangUp(true)}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </DialogContent>
    </Dialog>
  );
}
