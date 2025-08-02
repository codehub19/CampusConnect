
"use client";

import React, { useEffect, useRef, useState, useCallback } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff, PhoneCall } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, getDocs, writeBatch, query, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import type { Call } from '@/lib/types';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle, AlertDialogTrigger } from '@/components/ui/alert-dialog';

const servers = {
  iceServers: [
    {
      urls: ['stun:stun1.l.google.com:19302', 'stun:stun2.l.google.com:19302'],
    },
  ],
  iceCandidatePoolSize: 10,
};

interface VideoCallViewProps {
  chatId: string;
  onClose: () => void;
}

export default function VideoCallView({ chatId, onClose }: VideoCallViewProps) {
  const { user, profile } = useAuth();
  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);
  const remoteStreamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isAudioMuted, setAudioMuted] = useState(false);
  const [isVideoMuted, setVideoMuted] = useState(false);
  const [isCallActive, setIsCallActive] = useState(false);
  const [incomingCall, setIncomingCall] = useState<{id: string, data: Call} | null>(null);
  
  const isPolitelyEndingCall = useRef(false);

  const callDocUnsubscribe = useRef<() => void | null>(null);
  const answerCandidatesUnsubscribe = useRef<() => void | null>(null);
  const offerCandidatesUnsubscribe = useRef<() => void | null>(null);

  const cleanupPeerConnection = useCallback(() => {
    if (pc.current) {
        pc.current.ontrack = null;
        pc.current.onicecandidate = null;
        pc.current.close();
        pc.current = null;
    }
     if (localStreamRef.current) {
      localStreamRef.current.getTracks().forEach(track => track.stop());
      localStreamRef.current = null;
    }
     if (localVideoRef.current) localVideoRef.current.srcObject = null;
     if (remoteVideoRef.current) remoteVideoRef.current.srcObject = null;
  }, []);

  const hangUp = useCallback(async (notify = true) => {
    if (isPolitelyEndingCall.current && !notify) return;
    if (notify) {
        isPolitelyEndingCall.current = true;
    }
    
    cleanupPeerConnection();

    if (callDocUnsubscribe.current) callDocUnsubscribe.current();
    if (answerCandidatesUnsubscribe.current) answerCandidatesUnsubscribe.current();
    if (offerCandidatesUnsubscribe.current) offerCandidatesUnsubscribe.current();
    
    if (notify && chatId) {
        try {
            const callsQuery = query(collection(db, 'chats', chatId, 'calls'));
            const callsSnapshot = await getDocs(callsQuery);
            const batch = writeBatch(db);
            callsSnapshot.forEach((callDoc) => {
                batch.delete(callDoc.ref);
            });
            await batch.commit();
        } catch (e) {
            console.warn("Could not delete call documents.", e);
        }
    }

    setIsCallActive(false);
    isPolitelyEndingCall.current = false;
    onClose();
  }, [chatId, db, cleanupPeerConnection, onClose]);

  const startCall = async () => {
    if (isCallActive || !chatId || !user) return;
    
    pc.current = new RTCPeerConnection(servers);
    remoteStreamRef.current = new MediaStream();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        localStreamRef.current.getTracks().forEach(track => {
           if (!pc.current?.getSenders().find(s => s.track === track)) {
             pc.current?.addTrack(track, localStreamRef.current!)
           }
        });
    } catch (error) {
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Permissions Denied', description: 'Camera and microphone access required.' });
        return;
    }
    
    setIsCallActive(true);

    const callDocRef = doc(collection(db, 'chats', chatId, 'calls'));
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    pc.current.onicecandidate = event => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStreamRef.current?.addTrack(track);
      });
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await setDoc(callDocRef, { offer, callerId: user.uid, answered: false });

    callDocUnsubscribe.current = onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();
      if (pc.current && !pc.current.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current.setRemoteDescription(answerDescription);
      }
    });

    answerCandidatesUnsubscribe.current = onSnapshot(answerCandidates, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
            if (pc.current?.currentRemoteDescription) {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        }
      });
    });
  };

  const answerCall = async (callId: string, offer: any) => {
    if (isCallActive || !chatId) return;
    
    pc.current = new RTCPeerConnection(servers);
    remoteStreamRef.current = new MediaStream();

    try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        localStreamRef.current.getTracks().forEach(track => {
           if (!pc.current?.getSenders().find(s => s.track === track)) {
             pc.current?.addTrack(track, localStreamRef.current!)
           }
        });
    } catch (error) {
        setHasCameraPermission(false);
        toast({ variant: 'destructive', title: 'Permissions Denied', description: 'Camera and microphone access required.' });
        return;
    }
    
    setIsCallActive(true);

    const callDocRef = doc(db, 'chats', chatId, 'calls', callId);
    const answerCandidates = collection(callDocRef, 'answerCandidates');
    const offerCandidates = collection(callDocRef, 'offerCandidates');

    pc.current.onicecandidate = event => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    pc.current.ontrack = (event) => {
      event.streams[0].getTracks().forEach((track) => {
        remoteStreamRef.current?.addTrack(track);
      });
      if (remoteVideoRef.current && remoteVideoRef.current.srcObject !== remoteStreamRef.current) {
        remoteVideoRef.current.srcObject = remoteStreamRef.current;
      }
    };
    
    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
    await updateDoc(callDocRef, { answer, answered: true });

    offerCandidatesUnsubscribe.current = onSnapshot(offerCandidates, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
            if (pc.current?.currentRemoteDescription) {
                pc.current?.addIceCandidate(new RTCIceCandidate(change.doc.data()));
            }
        }
      });
    });
  };
  
  useEffect(() => {
    const callsCollection = collection(db, 'chats', chatId, 'calls');
    const unsubscribe = onSnapshot(callsCollection, (snapshot) => {
      snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
              const callData = change.doc.data() as Call;
              if (!isCallActive && callData.callerId !== user?.uid && !callData.answered) {
                  setIncomingCall({id: change.doc.id, data: callData});
              }
          } else if (change.type === 'removed') {
              if (isCallActive) {
                  toast({title: "Call Ended", description: "Your partner has ended the call."});
                  hangUp(false);
              }
          }
      });
    });
    
    return () => {
      unsubscribe();
      if(isCallActive) hangUp(true);
    };
  }, [chatId, db, user, isCallActive, profile?.name, toast, hangUp]);


  const toggleAudio = () => {
    if(!localStreamRef.current) return;
    localStreamRef.current.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    setAudioMuted(prev => !prev);
  }

  const toggleVideo = () => {
    if(!localStreamRef.current) return;
    localStreamRef.current.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    setVideoMuted(prev => !prev);
  }

  const handleDecline = async () => {
    if(!incomingCall) return;
    const callDocRef = doc(db, 'chats', chatId, 'calls', incomingCall.id);
    await deleteDoc(callDocRef);
    setIncomingCall(null);
  }

  const handleAccept = () => {
    if(!incomingCall) return;
    answerCall(incomingCall.id, incomingCall.data.offer)
    setIncomingCall(null);
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
        <AlertDialog open={!!incomingCall}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Incoming Call</AlertDialogTitle>
                    <AlertDialogDescription>
                       {profile?.name || 'Someone'} is calling...
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={handleDecline}>Decline</AlertDialogCancel>
                    <AlertDialogAction onClick={handleAccept}>Accept</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-6 right-6 w-1/3 max-w-[150px] md:w-1/4 md:max-w-xs rounded-xl shadow-2xl border-2 border-primary" />
        
        {!isCallActive && (
            <Button onClick={startCall} size="lg" className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 rounded-full h-20 w-20">
                <PhoneCall className="h-8 w-8" />
            </Button>
        )}

        {isCallActive && (
            <div className="absolute bottom-8 flex space-x-4 bg-black/30 backdrop-blur-md p-3 rounded-full">
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full" onClick={toggleAudio}>
                    {isAudioMuted ? <MicOff /> : <Mic />}
                </Button>
                <Button variant="secondary" size="icon" className="h-12 w-12 rounded-full" onClick={toggleVideo}>
                    {isVideoMuted ? <VideoOff /> : <Video />}
                </Button>
                <Button variant="destructive" size="icon" className="h-12 w-12 rounded-full" onClick={() => hangUp(true)}>
                    <PhoneOff />
                </Button>
            </div>
        )}
        
        {hasCameraPermission === false && (
            <div className="absolute inset-0 flex items-center justify-center bg-black/50">
              <div className="bg-background p-6 rounded-lg max-w-sm text-center">
                  <h3 className="text-lg font-bold">Camera Access Required</h3>
                  <p className="text-sm text-muted-foreground mt-2">
                      Please allow camera access to use this feature. You may need to refresh the page and grant permissions in your browser settings.
                  </p>
                  <Button onClick={onClose} className="mt-4">Close</Button>
              </div>
            </div>
        )}
    </div>
  );
}
