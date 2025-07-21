
"use client";

import Image from 'next/image';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useState, useEffect, useRef } from 'react';
import { Button } from '@/components/ui/button';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';
import { useToast } from '@/hooks/use-toast';
import type { User, Chat, Call } from '@/lib/types';
import { cn } from '@/lib/utils';
import { getFirestore, doc, updateDoc, setDoc, onSnapshot, collection, addDoc, getDocs, writeBatch, deleteDoc, Unsubscribe } from 'firebase/firestore';
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
  call: Call;
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

export default function VideoCallView({ user, currentUser, chat, call, onOpenChange }: VideoCallViewProps) {
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

  const hangUp = async (notifyPartner = false) => {
    if (isHangingUp.current) return;
    isHangingUp.current = true;
    
    if (pc.current) {
      pc.current.getSenders().forEach(sender => sender.track?.stop());
      pc.current.ontrack = null;
      pc.current.onicecandidate = null;
      pc.current.onconnectionstatechange = null;
      pc.current.close();
      pc.current = null;
    }

    if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
    
    if (notifyPartner && chat.id && call.id) {
       const callDocRef = doc(db, 'chats', chat.id, 'calls', call.id);
       const callSnap = await getDocs(collection(callDocRef, 'offerCandidates'));
       const answerSnap = await getDocs(collection(callDocRef, 'answerCandidates'));
       const batch = writeBatch(db);
       callSnap.forEach(doc => batch.delete(doc.ref));
       answerSnap.forEach(doc => batch.delete(doc.ref));
       batch.delete(callDocRef);
       await batch.commit().catch(e => console.warn("Error cleaning up call docs:", e));
    }
    
    onOpenChange(false);
  };
  
  useEffect(() => {
    let unsubscribes: Unsubscribe[] = [];
    isHangingUp.current = false;
    
    const startStreamsAndSetupCall = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) localVideoRef.current.srcObject = stream;
        setHasCameraPermission(true);

        pc.current = new RTCPeerConnection(servers);
        const remoteStream = new MediaStream();

        stream.getTracks().forEach(track => pc.current?.addTrack(track, stream));
        
        pc.current.ontrack = event => {
          event.streams[0].getTracks().forEach(track => remoteStream.addTrack(track));
        };
        if(remoteVideoRef.current) remoteVideoRef.current.srcObject = remoteStream;

        const callDocRef = doc(db, 'chats', chat.id, 'calls', call.id);
        const offerCandidates = collection(callDocRef, 'offerCandidates');
        const answerCandidates = collection(callDocRef, 'answerCandidates');
        const isCaller = call.callerId === currentUser.id;

        pc.current.onicecandidate = event => {
          if (event.candidate) {
            const candidatesCollection = isCaller ? offerCandidates : answerCandidates;
            addDoc(candidatesCollection, event.candidate.toJSON());
          }
        };

        pc.current.onconnectionstatechange = () => {
          if(pc.current?.connectionState === 'disconnected' || pc.current?.connectionState === 'failed') {
            hangUp(true);
            toast({ variant: 'destructive', title: 'Call Disconnected' });
          }
        }

        if (isCaller) {
          const remoteCandidatesUnsub = onSnapshot(answerCandidates, snapshot => {
            snapshot.docChanges().forEach(async change => {
              if (change.type === 'added' && pc.current?.currentRemoteDescription) {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
              }
            });
          });
          unsubscribes.push(remoteCandidatesUnsub);

          const offerDescription = await pc.current.createOffer();
          await pc.current.setLocalDescription(offerDescription);

          await setDoc(callDocRef, {
            callerId: currentUser.id,
            offer: { sdp: offerDescription.sdp, type: offerDescription.type },
          });

          const callUnsub = onSnapshot(callDocRef, async (docSnap) => {
              const data = docSnap.data();
              if (pc.current && !pc.current.currentRemoteDescription && data?.answer) {
                  await pc.current.setRemoteDescription(new RTCSessionDescription(data.answer));
              }
          });
          unsubscribes.push(callUnsub);

        } else { // Is Answerer
          const remoteCandidatesUnsub = onSnapshot(offerCandidates, snapshot => {
              snapshot.docChanges().forEach(async change => {
                if (change.type === 'added' && pc.current?.currentRemoteDescription) {
                    pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
                }
              });
          });
          unsubscribes.push(remoteCandidatesUnsub);

          const callDocSnap = await getDoc(callDocRef);
          const callData = callDocSnap.data();
          if (callData?.offer && pc.current) {
            await pc.current.setRemoteDescription(new RTCSessionDescription(callData.offer));
            const answerDescription = await pc.current.createAnswer();
            await pc.current.setLocalDescription(answerDescription);
            await updateDoc(callDocRef, { answer: { type: answerDescription.type, sdp: answerDescription.sdp } });
          }
        }
      } catch (error: any) {
        console.error('Error accessing media devices:', error);
        setHasCameraPermission(false);
        const title = error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? 'No Camera/Mic Found' : 'Media Access Denied';
        const description = error.name === 'NotFoundError' || error.name === 'DevicesNotFoundError' ? 'Could not find a camera or microphone.' : 'Please enable camera & mic permissions.';
        toast({ variant: 'destructive', title, description });
        hangUp(true);
      }
    };
    
    startStreamsAndSetupCall();
    
    // Listen for hangup from other user
    const callDocRef = doc(db, 'chats', chat.id, 'calls', call.id);
    const callUnsub = onSnapshot(callDocRef, (docSnap) => {
        if (!docSnap.exists()) {
            if (!isHangingUp.current) {
                toast({ title: 'Call Ended', description: `The call has ended.` });
                hangUp(false); // don't notify partner since they initiated hangup
            }
        }
    });
    unsubscribes.push(callUnsub);

    return () => {
        unsubscribes.forEach(unsub => unsub());
        if (!isHangingUp.current) {
          hangUp(true);
        }
    }
  }, [chat.id, call.id, db, toast]);


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
