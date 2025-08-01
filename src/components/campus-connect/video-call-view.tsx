
"use client";

import React, { useEffect, useRef, useState } from 'react';
import { Button } from '@/components/ui/button';
import { Mic, MicOff, Video, VideoOff, PhoneOff } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { useAuth } from '@/hooks/use-auth';
import { getFirestore, collection, doc, onSnapshot, addDoc, setDoc, deleteDoc, getDocs, writeBatch, query, updateDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import type { Call } from '@/lib/types';
import { Alert, AlertTitle, AlertDescription } from '@/components/ui/alert';

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
  const { user } = useAuth();
  const { toast } = useToast();
  const db = getFirestore(firebaseApp);

  const localVideoRef = useRef<HTMLVideoElement>(null);
  const remoteVideoRef = useRef<HTMLVideoElement>(null);
  const pc = useRef<RTCPeerConnection | null>(null);
  const localStreamRef = useRef<MediaStream | null>(null);

  const [hasCameraPermission, setHasCameraPermission] = useState<boolean | null>(null);
  const [isAudioMuted, setAudioMuted] = useState(false);
  const [isVideoMuted, setVideoMuted] = useState(false);
  const [callId, setCallId] = useState<string | null>(null);

  useEffect(() => {
    const initPeerConnection = () => {
      pc.current = new RTCPeerConnection(servers);
    };

    const getCameraPermission = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
        localStreamRef.current = stream;
        if (localVideoRef.current) {
          localVideoRef.current.srcObject = stream;
        }
        setHasCameraPermission(true);
        initPeerConnection();
        setupCallListeners();
      } catch (error) {
        console.error('Error accessing camera:', error);
        setHasCameraPermission(false);
        toast({
          variant: 'destructive',
          title: 'Camera Access Denied',
          description: 'Please enable camera permissions in your browser settings to use video chat.',
        });
        onClose();
      }
    };
    
    const setupCallListeners = () => {
      const callDocsRef = collection(db, 'chats', chatId, 'calls');
      
      const unsubscribe = onSnapshot(callDocsRef, (snapshot) => {
        snapshot.docChanges().forEach(async (change) => {
          if (change.type === 'added') {
            const callData = change.doc.data() as Call;
            if (callData.callerId !== user?.uid) { // I am the callee
              await answerCall(change.doc.id, callData.offer);
            }
          }
        });
      });
      return unsubscribe;
    };
    
    getCameraPermission();
    
    return () => {
      hangUp();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const startCall = async () => {
    if (!pc.current || !localStreamRef.current || !user) return;

    localStreamRef.current.getTracks().forEach(track => pc.current!.addTrack(track, localStreamRef.current!));

    const callDocRef = doc(collection(db, 'chats', chatId, 'calls'));
    setCallId(callDocRef.id);
    const offerCandidates = collection(callDocRef, 'offerCandidates');
    const answerCandidates = collection(callDocRef, 'answerCandidates');

    pc.current.onicecandidate = event => {
      event.candidate && addDoc(offerCandidates, event.candidate.toJSON());
    };

    const offerDescription = await pc.current.createOffer();
    await pc.current.setLocalDescription(offerDescription);

    const offer = { sdp: offerDescription.sdp, type: offerDescription.type };
    await setDoc(callDocRef, { offer, callerId: user.uid, answered: false });

    onSnapshot(callDocRef, (snapshot) => {
      const data = snapshot.data();
      if (!pc.current?.currentRemoteDescription && data?.answer) {
        const answerDescription = new RTCSessionDescription(data.answer);
        pc.current?.setRemoteDescription(answerDescription);
      }
    });

    onSnapshot(answerCandidates, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          const candidate = new RTCIceCandidate(change.doc.data());
          pc.current?.addIceCandidate(candidate);
        }
      });
    });

    pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  };

  const answerCall = async (id: string, offer: any) => {
    if (!pc.current || !localStreamRef.current || !user) return;
    setCallId(id);

    const callDocRef = doc(db, 'chats', chatId, 'calls', id);
    const answerCandidates = collection(callDocRef, 'answerCandidates');
    const offerCandidates = collection(callDocRef, 'offerCandidates');

    pc.current.onicecandidate = event => {
        event.candidate && addDoc(answerCandidates, event.candidate.toJSON());
    };

    localStreamRef.current.getTracks().forEach(track => {
      pc.current!.addTrack(track, localStreamRef.current!);
    });

    await pc.current.setRemoteDescription(new RTCSessionDescription(offer));
    const answerDescription = await pc.current.createAnswer();
    await pc.current.setLocalDescription(answerDescription);

    const answer = { type: answerDescription.type, sdp: answerDescription.sdp };
    await updateDoc(callDocRef, { answer, answered: true });

    onSnapshot(offerCandidates, snapshot => {
      snapshot.docChanges().forEach(change => {
        if (change.type === 'added') {
          let data = change.doc.data();
          pc.current?.addIceCandidate(new RTCIceCandidate(data));
        }
      });
    });

     pc.current.ontrack = (event) => {
      if (remoteVideoRef.current) {
        remoteVideoRef.current.srcObject = event.streams[0];
      }
    };
  };
  
  const hangUp = async () => {
    pc.current?.close();
    localStreamRef.current?.getTracks().forEach(track => track.stop());

    if(callId) {
      const callDocRef = doc(db, 'chats', chatId, 'calls', callId);
      const offerCandidatesQuery = await getDocs(collection(callDocRef, 'offerCandidates'));
      const answerCandidatesQuery = await getDocs(collection(callDocRef, 'answerCandidates'));
      
      const batch = writeBatch(db);
      offerCandidatesQuery.forEach(doc => batch.delete(doc.ref));
      answerCandidatesQuery.forEach(doc => batch.delete(doc.ref));
      batch.delete(callDocRef);
      await batch.commit();
    }
    
    onClose();
  };

  const toggleAudio = () => {
    localStreamRef.current?.getAudioTracks().forEach(track => track.enabled = !track.enabled);
    setAudioMuted(prev => !prev);
  }

  const toggleVideo = () => {
    localStreamRef.current?.getVideoTracks().forEach(track => track.enabled = !track.enabled);
    setVideoMuted(prev => !prev);
  }

  return (
    <div className="fixed inset-0 bg-black/90 flex flex-col items-center justify-center z-50">
        <video ref={remoteVideoRef} autoPlay playsInline className="h-full w-full object-contain" />
        <video ref={localVideoRef} autoPlay playsInline muted className="absolute bottom-6 right-6 w-1/3 max-w-[150px] md:w-1/4 md:max-w-xs rounded-xl shadow-2xl border-2 border-primary" />
        
        {!callId && hasCameraPermission && (
            <Button onClick={startCall} className="absolute top-6">Start Call</Button>
        )}

        <div className="absolute bottom-8 flex space-x-4 bg-black/30 backdrop-blur-md p-3 rounded-full">
            <Button variant="secondary" size="icon" onClick={toggleAudio}>
                {isAudioMuted ? <MicOff /> : <Mic />}
            </Button>
            <Button variant="secondary" size="icon" onClick={toggleVideo}>
                {isVideoMuted ? <VideoOff /> : <Video />}
            </Button>
            <Button variant="destructive" size="icon" onClick={hangUp}>
                <PhoneOff />
            </Button>
        </div>
        
        {hasCameraPermission === false && (
            <Alert variant="destructive" className="absolute top-1/2 -translate-y-1/2 max-w-sm">
                <AlertTitle>Camera Access Required</AlertTitle>
                <AlertDescription>
                    Please allow camera access to use this feature. You may need to refresh the page and grant permissions.
                </AlertDescription>
            </Alert>
        )}
    </div>
  );
}
