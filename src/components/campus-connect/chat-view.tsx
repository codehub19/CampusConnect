
"use client";

import React, { useState, useRef, useEffect, UIEvent, useCallback } from 'react';
import { Send, ArrowDown, IceCream, Image as ImageIcon, Gamepad2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { User, Message, MessageContent, Chat, GameState, ImageMessageContent, TextMessageContent } from '@/lib/types';
import { getFirestore, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc } from 'firebase/firestore';
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from 'firebase/storage';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';
import Image from 'next/image';
import { useToast } from '@/hooks/use-toast';
import GameCenterView from './game-center-view';
import TicTacToe from './tic-tac-toe';
import ConnectFour from './connect-four';
import DotsAndBoxes from './dots-and-boxes';
import { generateIcebreaker } from '@/ai/flows/generate-icebreaker';
import { AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent, AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle } from '@/components/ui/alert-dialog';


interface ChatViewProps {
  chat: Chat;
  partner: User;
  onLeaveChat: () => void;
}

export default function ChatView({ chat, partner, onLeaveChat }: ChatViewProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGameCenterOpen, setGameCenterOpen] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(chat.game || null);
  const [isSending, setIsSending] = useState(false);
  const [incomingGameInvite, setIncomingGameInvite] = useState<GameState | null>(null);

  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast, dismiss } = useToast();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const lastScrollTopRef = useRef(0);

  const handleScroll = () => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    const isAtBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 50;
    const isScrollingUp = scrollArea.scrollTop < lastScrollTopRef.current;
    
    if (isAtBottom) {
      setShowScrollToBottom(false);
    } else if (isScrollingUp) {
      setShowScrollToBottom(true);
    }
    lastScrollTopRef.current = scrollArea.scrollTop;
  };

  useEffect(() => {
    const scrollArea = scrollAreaRef.current;
    if (!scrollArea) return;

    if (!showScrollToBottom) {
      scrollArea.scrollTo({ top: scrollArea.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, showScrollToBottom]);


  useEffect(() => {
      const gameData = chat.game;
      setGameState(gameData || null);

      if (gameData?.status === 'pending' && gameData?.initiatorId !== user?.uid) {
      setIncomingGameInvite(gameData);
      } else {
      setIncomingGameInvite(null);
      }
  }, [chat.game, user?.uid]);


  useEffect(() => {
    if (!chat.id || !user) return;
    const messagesRef = collection(db, "chats", chat.id, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
        const scrollArea = scrollAreaRef.current;
        let wasAtBottom = false;
        if (scrollArea) {
            wasAtBottom = scrollArea.scrollHeight - scrollArea.scrollTop - scrollArea.clientHeight < 50;
        }

        const allMessages = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
        setMessages(allMessages);

        if (wasAtBottom) {
            setShowScrollToBottom(false);
        } else if (snapshot.docChanges().some(change => change.type === 'added')) {
            const lastMessage = allMessages[allMessages.length - 1];
            if (lastMessage && lastMessage.senderId !== user.uid) {
                setShowScrollToBottom(true);
            }
        }
    });

    return () => unsubscribeMessages();
}, [chat.id, db, user]);

  const sendNewMessage = async (content: MessageContent) => {
    if (!user) return;
    const messagesRef = collection(db, "chats", chat.id, "messages");
    await addDoc(messagesRef, {
        senderId: user.uid,
        content: content,
        timestamp: serverTimestamp(),
        status: 'sent',
    });
    setShowScrollToBottom(false);
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
    const text = textarea?.value.trim();

    if (text) {
        setIsSending(true);
        await sendNewMessage({ type: 'text', value: text });
        if(textarea) textarea.value = '';
        setTimeout(() => setIsSending(false), 500);
    }
  };
  
    const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
        const file = e.target.files?.[0];
        if (!file || !user) return;

        const MAX_SIZE_MB = 1;
        const TARGET_SIZE_BYTES = MAX_SIZE_MB * 1024 * 1024;
        let processingToastId: string | undefined;
        let uploadToastId: string | undefined;

        try {
            ({ id: processingToastId } = toast({ title: 'Processing image...' }));

            let imageBlob: Blob = file;

            if (file.size > TARGET_SIZE_BYTES) {
                imageBlob = await new Promise((resolve, reject) => {
                    const img = document.createElement('img');
                    img.src = URL.createObjectURL(file);
                    img.onload = () => {
                        const canvas = document.createElement('canvas');
                        const ctx = canvas.getContext('2d');
                        if (!ctx) return reject(new Error('Could not get canvas context'));
                        
                        const scaleFactor = Math.sqrt(TARGET_SIZE_BYTES / file.size);
                        canvas.width = img.width * scaleFactor;
                        canvas.height = img.height * scaleFactor;

                        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
                        canvas.toBlob((blob) => {
                            if (blob) {
                                resolve(blob);
                            } else {
                                reject(new Error('Canvas to Blob conversion failed'));
                            }
                        }, 'image/jpeg', 0.8);
                    };
                    img.onerror = reject;
                });
            }
            
            if (processingToastId) dismiss(processingToastId);
            ({ id: uploadToastId } = toast({ title: 'Uploading image...' }));

            const imageRef = storageRef(storage, `chat-images/${chat.id}/${Date.now()}-${file.name.split('.')[0]}.jpg`);
            const snapshot = await uploadBytes(imageRef, imageBlob);
            const url = await getDownloadURL(snapshot.ref);

            await sendNewMessage({ type: 'image', value: { url, name: file.name }});
            
            if (uploadToastId) dismiss(uploadToastId);
            toast({ title: 'Image sent!' });
        } catch (error: any) {
            console.error("Image upload failed:", error);
            if(processingToastId) dismiss(processingToastId);
            if(uploadToastId) dismiss(uploadToastId);
            let description = 'Could not upload your image. Please try again.';
            if (error.code === 'storage/unauthorized') {
                description = 'Upload failed. You do not have permission. Please check Storage security rules in your Firebase project.';
            } else if (error.code === 'storage/retry-limit-exceeded' || error.message.includes('CORS')) {
                description = 'Upload failed. Please check your Firebase Storage CORS configuration.';
            }
            toast({ 
                variant: 'destructive', 
                title: 'Upload Failed', 
                description: description,
            });
        } finally {
            if (fileInputRef.current) {
                fileInputRef.current.value = '';
            }
        }
    };

  const handleGenerateIcebreaker = async () => {
    if (!profile || !partner) return;
    toast({ title: 'Generating an icebreaker...' });
    try {
      const result = await generateIcebreaker({
        userName1: profile.name,
        interests1: profile.interests,
        userName2: partner.name,
        interests2: partner.interests,
      });
      await sendNewMessage({ type: 'text', value: result.icebreaker });
    } catch (error) {
      toast({ variant: 'destructive', title: 'Error', description: 'Could not generate icebreaker.'});
    }
  };

  const handleGameInviteResponse = async (accept: boolean) => {
    if (!incomingGameInvite || !user) return;
    const {id: toastId} = toast({ title: 'Responding to invite...' });
    
    const chatRef = doc(db, 'chats', chat.id);
    if(accept) {
        const gameUpdate: any = { 'game.status': 'active', 'game.turn': incomingGameInvite.initiatorId };
        if (incomingGameInvite.gameType === 'tic-tac-toe') {
            gameUpdate['game.players'] = { [incomingGameInvite.initiatorId]: 'X', [user.uid]: 'O' };
        }
        await updateDoc(chatRef, gameUpdate);
    } else {
        await updateDoc(chatRef, { game: null });
    }
    setIncomingGameInvite(null);
    dismiss(toastId);
  }
  
  const renderGame = () => {
    if (!gameState || !user) return null;
    const gameType = gameState.gameType || gameState.type;
    switch (gameType) {
      case 'tic-tac-toe': return <TicTacToe chatId={chat.id} gameState={gameState} setGameState={setGameState} />;
      case 'connect-four': return <ConnectFour chatId={chat.id} gameState={gameState} setGameState={setGameState} />;
      case 'dots-and-boxes': return <DotsAndBoxes chatId={chat.id} gameState={gameState} setGameState={setGameState} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
        <AlertDialog open={!!incomingGameInvite} onOpenChange={() => setIncomingGameInvite(null)}>
            <AlertDialogContent>
                <AlertDialogHeader>
                    <AlertDialogTitle>Game Invitation!</AlertDialogTitle>
                    <AlertDialogDescription>
                        {partner.name} wants to play {incomingGameInvite?.gameType || incomingGameInvite?.type}!
                    </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                    <AlertDialogCancel onClick={() => handleGameInviteResponse(false)}>Decline</AlertDialogCancel>
                    <AlertDialogAction onClick={() => handleGameInviteResponse(true)}>Accept</AlertDialogAction>
                </AlertDialogFooter>
            </AlertDialogContent>
        </AlertDialog>

        <GameCenterView 
            isOpen={isGameCenterOpen}
            onOpenChange={setGameCenterOpen}
            chatId={chat.id}
            partnerId={partner.id}
        />
        
        <div className={cn("flex flex-1 min-h-0", gameState && "flex-col md:flex-row")}>
             {gameState && (
                <div className="w-full md:w-2/5 md:max-w-md border-b md:border-b-0 md:border-r">
                    {renderGame()}
                </div>
             )}
            <div className="flex flex-col flex-1 min-h-0 relative">
                 <ScrollArea className="flex-grow p-4" ref={scrollAreaRef} onScroll={handleScroll}>
                    <div className="space-y-4">
                        {messages.map((message) => {
                        const isSender = message.senderId === user?.uid;
                        return (
                        <div
                            key={message.id}
                            className={cn('flex items-end gap-2', isSender ? 'justify-end' : 'justify-start')}
                        >
                            {!isSender && (
                            <Avatar className="h-8 w-8">
                                <AvatarImage src={partner.avatar} alt={partner.name} />
                                <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
                            </Avatar>
                            )}
                            <div className={cn(
                                'max-w-xs md:max-w-md lg:max-w-lg rounded-xl px-4 py-2.5 text-sm shadow',
                                isSender
                                ? 'bg-gradient-to-br from-primary to-purple-600 text-white rounded-br-none'
                                : 'bg-secondary text-secondary-foreground rounded-bl-none'
                            )}>
                                {message.content.type === 'text' && <p className="whitespace-pre-wrap">{(message.content as TextMessageContent).value}</p>}
                                {message.content.type === 'image' && (
                                    <Image 
                                        src={(message.content as ImageMessageContent).value.url} 
                                        alt={(message.content as ImageMessageContent).value.name} 
                                        width={200} 
                                        height={200} 
                                        className="rounded-md object-cover cursor-pointer"
                                        onClick={() => window.open((message.content as ImageMessageContent).value.url, '_blank')}
                                    />
                                )}
                            </div>
                        </div>
                        )})}
                    </div>
                </ScrollArea>
                {showScrollToBottom && (
                    <Button
                        onClick={() => { 
                           setShowScrollToBottom(false);
                        }}
                        variant="secondary"
                        size="icon"
                        className="absolute bottom-20 right-4 rounded-full h-10 w-10 shadow-lg"
                    >
                        <ArrowDown className="h-5 w-5" />
                    </Button>
                )}
                <div className="p-4 border-t bg-background">
                    <form onSubmit={handleSendMessage} className="flex w-full items-start gap-2">
                        <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={handleGenerateIcebreaker}>
                            <IceCream className="h-5 w-5 text-pink-400" />
                            <span className="sr-only">Generate Icebreaker</span>
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon className="h-5 w-5" />
                             <span className="sr-only">Upload Image</span>
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                         <Button type="button" variant="ghost" size="icon" onClick={() => setGameCenterOpen(true)}>
                            <Gamepad2 className="h-5 w-5" />
                            <span className="sr-only">Play a game</span>
                        </Button>
                        <Textarea
                            placeholder="Type a message..."
                            className="flex-1 resize-none bg-secondary border-transparent focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    (e.target as HTMLTextAreaElement).form?.requestSubmit();
                                }
                            }}
                        />
                        <Button type="submit" size="icon" className={cn("rounded-full flex-shrink-0 bg-primary hover:bg-primary/90 transition-transform active:scale-90", isSending && "animate-out scale-125 fade-out-0")}>
                            <Send className="h-5 w-5" />
                            <span className="sr-only">Send</span>
                        </Button>
                    </form>
            </div>
            </div>
        </div>
    </div>
  );
}
