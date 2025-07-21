
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
import { getFirestore, doc, updateDoc, getDoc, onSnapshot, collection, addDoc, getDocs, writeBatch, Unsubscribe } from 'firebase/firestore';
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
  const isHangingUp = useRef(false);

  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  const hangUp = async (politely = false) => {
    if (isHangingUp.current) return;
    isHangingUp.current = true;
    
    if (pc.current) {
      pc.current.getSenders().forEach(sender => sender.track?.stop());
      pc.current.ontrack = null;
      pc.current.onicecandidate = null;
      pc.current.close();
      pc.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (politely && chat.id) {
       const chatRef = doc(db, 'chats', chat.id);
       const chatSnap = await getDoc(chatRef);
       if (chatSnap.exists() && chatSnap.data().call) {
         // Clear ICE candidates
         const callCandidates = collection(chatRef, 'callCandidates');
         const answerCandidates = collection(chatRef, 'answerCandidates');
         const callCandidatesSnapshot = await getDocs(callCandidates);
         const answerCandidatesSnapshot = await getDocs(answerCandidates);

         const batch = writeBatch(db);
         callCandidatesSnapshot.forEach(doc => batch.delete(doc.ref));
         answerCandidatesSnapshot.forEach(doc => batch.delete(doc.ref));
         await batch.commit();

         await updateDoc(chatRef, { call: null });
       }
    }
    
    onOpenChange(false);
  };
  
  useEffect(() => {
    let unsubscribes: Unsubscribe[] = [];
    isHangingUp.current = false;
    
    const startStreams = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setHasCameraPermission(true);
        return stream;
      } catch (error: any) {
        console.error('Error accessing media devices:', error);
        setHasCameraPermission(false);
        const title = error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? 'No Camera/Mic Found' : 'Media Access Denied';
        const description = error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? 'Could not find a camera or microphone. Please check your hardware and browser settings.' : 'Please enable camera & mic permissions to use video chat.';
        toast({ variant: 'destructive', title, description });
        hangUp(true);
        return null;
      }
    };

    const setupCall = async () => {
        pc.current = new RTCPeerConnection(servers);
        const localStream = await startStreams();
        if (!localStream) return;

        localStream.getTracks().forEach(track => {
            if (pc.current) {
                pc.current.addTrack(track, localStream)
            }
        });
        
        const remoteStream = new MediaStream();
        pc.current.ontrack = event => {
          event.streams[0].getTracks().forEach(track => {
            remoteStream.addTrack(track);
          });
        };
        if(remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

        const chatRef = doc(db, 'chats', chat.id);
        const callCandidates = collection(chatRef, 'callCandidates');
        const answerCandidates = collection(chatRef, 'answerCandidates');
        const isCaller = chat.call?.callerId === currentUser.id;

        pc.current.onicecandidate = event => {
          if (event.candidate) {
            const candidatesCollection = isCaller ? callCandidates : answerCandidates;
            addDoc(candidatesCollection, event.candidate.toJSON());
          }
        };

        if (isCaller) {
          const remoteCandidatesUnsub = onSnapshot(answerCandidates, snapshot => {
            snapshot.docChanges().forEach(async change => {
              if (change.type === 'added') {
                  if (pc.current?.currentRemoteDescription) {
                    await pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                  }
              }
            });
          });
          unsubscribes.push(remoteCandidatesUnsub);

          const offerDescription = await pc.current.createOffer();
          await pc.current.setLocalDescription(offerDescription);
          await updateDoc(chatRef, { 'call.offer': offerDescription.toJSON() });

          const callUnsub = onSnapshot(chatRef, async (docSnap) => {
              const data = docSnap.data();
              if (pc.current && !pc.current.currentRemoteDescription && data?.call?.answer) {
                  await pc.current.setRemoteDescription(new RTCSessionDescription(data.call.answer));
              }
          });
          unsubscribes.push(callUnsub);

        } else { // Is Answerer
          const remoteCandidatesUnsub = onSnapshot(callCandidates, snapshot => {
              snapshot.docChanges().forEach(async change => {
                if (change.type === 'added') {
                    if (pc.current?.currentRemoteDescription) {
                        await pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                    }
                }
              });
          });
          unsubscribes.push(remoteCandidatesUnsub);

          const offer = chat.call?.offer;
          if (offer && pc.current) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
            const answerDescription = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answerDescription);
            await updateDoc(chatRef, { 'call.answer': answerDescription.toJSON() });
          }
        }
    };
    
    setupCall();
    
    const chatRef = doc(db, 'chats', chat.id);
    const chatUnsub = onSnapshot(chatRef, (docSnap) => {
        if (!docSnap.exists() || !docSnap.data()?.call) {
            if (!isHangingUp.current) {
                toast({ title: 'Call Ended', description: `The call has ended.` });
                hangUp(false);
            }
        }
    });
    unsubscribes.push(chatUnsub);

    return () => {
        unsubscribes.forEach(unsub => unsub());
        if (!isHangingUp.current) {
          hangUp(true);
        }
    }
  }, [chat.id, db, toast]);


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
  );
}
