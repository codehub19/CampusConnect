
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
import type { User, Chat } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getFirestore, doc, updateDoc, getDoc, onSnapshot, collection, addDoc, getDocs, writeBatch } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

interface VideoCallViewProps {
  user: User; // The person being called
  currentUser: User;
  chat: Chat;
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

export default function VideoCallView({ user, currentUser, chat, onOpenChange }: VideoCallViewProps) {
  const [isMicOn, setMicOn] = useState(true);
  const [isCameraOn, setCameraOn] = useState(true);
  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  
  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const { toast } = useToast();
  const db = getFirestore(firebaseApp);
  
  const hangUp = async () => {
    if (pc.current) {
      pc.current.close();
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
    }

    if(chat.id) {
       const chatRef = doc(db, 'chats', chat.id);
       const chatSnap = await getDoc(chatRef);
       if (chatSnap.exists() && chatSnap.data().call) {
         await updateDoc(chatRef, { call: null });
       }

       const callCandidates = collection(chatRef, 'callCandidates');
       const answerCandidates = collection(chatRef, 'answerCandidates');
       
       const callCandidatesSnapshot = await getDocs(callCandidates);
       const answerCandidatesSnapshot = await getDocs(answerCandidates);

       if (!callCandidatesSnapshot.empty || !answerCandidatesSnapshot.empty) {
            const batch = writeBatch(db);
            callCandidatesSnapshot.forEach(doc => batch.delete(doc.ref));
            answerCandidatesSnapshot.forEach(doc => batch.delete(doc.ref));
            await batch.commit();
       }
    }
    
    onOpenChange(false);
  };
  
  useEffect(() => {
    pc.current = new RTCPeerConnection(servers);
    
    const startStreams = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            localStreamRef.current = stream;
            
            stream.getTracks().forEach(track => {
                pc.current?.addTrack(track, stream);
            });
            
            if (localVideoRef.current) {
                localVideoRef.current.srcObject = stream;
            }
            setHasCameraPermission(true);

        } catch (error) {
            console.error('Error accessing camera:', error);
            setHasCameraPermission(false);
            toast({
              variant: 'destructive',
              title: 'Media Access Denied',
              description: 'Please enable camera & mic permissions in your browser.',
            });
            return;
        }

        const remoteStream = new MediaStream();
        pc.current.ontrack = (event) => {
            event.streams[0].getTracks().forEach(track => {
                remoteStream.addTrack(track);
            });
        };

        if (remoteVideoRef.current) {
            remoteVideoRef.current.srcObject = remoteStream;
        }

        // --- Caller logic ---
        if (chat.call && chat.call.callerId === currentUser.id) {
            const callCandidates = collection(db, 'chats', chat.id, 'callCandidates');
            pc.current.onicecandidate = event => {
                event.candidate && addDoc(callCandidates, event.candidate.toJSON());
            };
            
            const offerDescription = await pc.current.createOffer();
            await pc.current.setLocalDescription(offerDescription);
            
            await updateDoc(doc(db, 'chats', chat.id), { call: { ...chat.call, offer: offerDescription.toJSON() }});
        }
        
        // --- Answerer logic ---
        if (chat.call && chat.call.callerId !== currentUser.id && chat.call.offer) {
            const answerCandidates = collection(db, 'chats', chat.id, 'answerCandidates');
            pc.current.onicecandidate = event => {
                event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
            };

            await pc.current.setRemoteDescription(new RTCSessionDescription(chat.call.offer));
            
            const answerDescription = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answerDescription);

            await updateDoc(doc(db, 'chats', chat.id), { call: { ...chat.call, answer: answerDescription.toJSON() } });
        }
    };

    startStreams();

    const chatRef = doc(db, 'chats', chat.id);
    const unsubscribe = onSnapshot(chatRef, (docSnap) => {
        const data = docSnap.data();
        if (!data?.call) {
            if(pc.current?.connectionState === 'connected'){
                hangUp();
                toast({ title: 'Call Ended', description: `${user.name} has ended the call.` });
            }
            return;
        }
        // Answer logic for caller
        if (pc.current && !pc.current.currentRemoteDescription && data.call.answer) {
             pc.current.setRemoteDescription(new RTCSessionDescription(data.call.answer));
        }
    });

    const callCandidatesUnsub = onSnapshot(collection(chatRef, 'callCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        });
    });

    const answerCandidatesUnsub = onSnapshot(collection(chatRef, 'answerCandidates'), (snapshot) => {
        snapshot.docChanges().forEach((change) => {
            if (change.type === 'added') {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        });
    });

    return () => {
        hangUp();
        unsubscribe();
        callCandidatesUnsub();
        answerCandidatesUnsub();
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const toggleMediaStream = (type: 'video' | 'audio', state: boolean) => {
    if (localStreamRef.current) {
      const track = type === 'video' ? localStreamRef.current.getVideoTracks()[0] : localStreamRef.current.getAudioTracks()[0];
      if (track) {
        track.enabled = state;
      }
    }
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

  return (
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
             <video ref={localVideoRef} className={cn("w-full h-full object-cover", { 'hidden': !isCameraOn || hasCameraPermission === false })} autoPlay muted playsInline />
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
          onClick={hangUp}
        >
          <PhoneOff className="h-6 w-6" />
        </Button>
      </div>
    </DialogContent>
  );
}
