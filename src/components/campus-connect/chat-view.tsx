
"use client";

import React, { useState, useRef, useEffect, UIEvent, useCallback } from 'react';
import { Send, ArrowDown, Bot, IceCream, Image as ImageIcon } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Textarea } from '@/components/ui/textarea';
import { cn } from '@/lib/utils';
import type { User, Message, MessageContent, Chat, GameState } from '@/lib/types';
import { getFirestore, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, doc, updateDoc, writeBatch } from 'firebase/firestore';
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

interface ChatViewProps {
  chat: Chat;
  partner: User;
}

export default function ChatView({ chat, partner }: ChatViewProps) {
  const { user, profile } = useAuth();
  const [messages, setMessages] = useState<Message[]>([]);
  const [isGameCenterOpen, setGameCenterOpen] = useState(false);
  const [gameState, setGameState] = useState<GameState | null>(null);
  
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { toast } = useToast();
  const db = getFirestore(firebaseApp);
  const storage = getStorage(firebaseApp);

  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    setTimeout(() => {
        if (scrollAreaRef.current) {
            scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior });
        }
    }, 100);
  };
  
  useEffect(() => {
    const messagesRef = collection(db, "chats", chat.id, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribeMessages = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      setMessages(fetchedMessages);
    });
    
    const chatDocRef = doc(db, 'chats', chat.id);
    const unsubscribeChat = onSnapshot(chatDocRef, (docSnap) => {
        const chatData = docSnap.data();
        const gameData = chatData?.game;
        setGameState(gameData || null);

        if (gameData?.status === 'pending' && gameData?.initiatorId !== user?.uid) {
            toast({
                title: 'Game Invitation!',
                description: `${partner.name} wants to play ${gameData.gameType || gameData.type}!`,
                duration: 15000,
                action: (
                    <div className="flex gap-2">
                        <Button onClick={async () => {
                            const chatRef = doc(db, 'chats', chat.id);
                            const gameUpdate: any = { 'game.status': 'active', 'game.turn': gameData.initiatorId };
                            if (gameData.type === 'tic-tac-toe') {
                                gameUpdate['game.players'] = { [gameData.initiatorId]: 'X', [user!.uid]: 'O' };
                            }
                            await updateDoc(chatRef, gameUpdate);
                        }}>Accept</Button>
                        <Button variant="destructive" onClick={async () => {
                             const chatRef = doc(db, 'chats', chat.id);
                             await updateDoc(chatRef, { game: null });
                        }}>Decline</Button>
                    </div>
                )
            });
        }
    });

    return () => {
        unsubscribeMessages();
        unsubscribeChat();
    };
  }, [chat.id, db, user?.uid, partner.name, toast]);

  useEffect(() => {
    if (isAtBottomRef.current) {
        scrollToBottom();
    } else {
        setShowScrollToBottom(true);
    }
  }, [messages, gameState]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setShowScrollToBottom(false);
    }
  };

  const sendNewMessage = async (content: MessageContent) => {
    if (!user) return;
    const messagesRef = collection(db, "chats", chat.id, "messages");
    await addDoc(messagesRef, {
        senderId: user.uid,
        content: content,
        timestamp: serverTimestamp(),
        status: 'sent',
    });
    scrollToBottom('smooth');
  };

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
    const text = textarea?.value.trim();

    if (text) {
        await sendNewMessage({ type: 'text', value: text });
        if(textarea) textarea.value = '';
    }
  };
  
  const handleImageUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file || !user) return;

    const imageRef = storageRef(storage, `chat-images/${chat.id}/${Date.now()}-${file.name}`);
    try {
        const snapshot = await uploadBytes(imageRef, file);
        const url = await getDownloadURL(snapshot.ref);
        await sendNewMessage({ type: 'image', value: { url, name: file.name }});
    } catch (error) {
        console.error("Image upload failed:", error);
        toast({ variant: 'destructive', title: 'Upload Failed', description: 'Could not upload your image.' });
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
  
  const renderGame = () => {
    if (!gameState || !user) return null;
    const gameType = gameState.gameType || gameState.type;
    switch (gameType) {
      case 'tic-tac-toe': return <TicTacToe chatId={chat.id} gameState={gameState} />;
      case 'connect-four': return <ConnectFour chatId={chat.id} gameState={gameState} />;
      case 'dots-and-boxes': return <DotsAndBoxes chatId={chat.id} gameState={gameState} />;
      default: return null;
    }
  };

  return (
    <div className="flex flex-col h-full bg-background text-foreground">
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
            <div className="flex flex-col flex-1 overflow-hidden">
                 <ScrollArea className="flex-grow p-4" ref={scrollAreaRef} onScroll={handleScroll}>
                    <div className="space-y-4">
                        {messages.map((message, index) => {
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
                                'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2 text-sm shadow',
                                isSender
                                ? 'bg-primary text-primary-foreground rounded-br-none'
                                : 'bg-secondary text-secondary-foreground rounded-bl-none'
                            )}>
                                {message.content.type === 'text' && <p>{message.content.value as string}</p>}
                                {message.content.type === 'image' && <Image src={(message.content.value as any).url} alt={(message.content.value as any).name} width={200} height={200} className="rounded-md"/>}
                            </div>
                        </div>
                        )})}
                    </div>
                </ScrollArea>
                {showScrollToBottom && (
                    <Button
                        onClick={() => scrollToBottom('smooth')}
                        variant="secondary"
                        size="icon"
                        className="absolute bottom-20 right-4 rounded-full h-10 w-10 shadow-lg animate-bounce"
                    >
                        <ArrowDown className="h-5 w-5" />
                    </Button>
                )}
                <div className="p-4 border-t">
                    <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
                        <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={handleGenerateIcebreaker}>
                            <IceCream className="h-5 w-5 text-pink-400" />
                        </Button>
                        <Button type="button" variant="ghost" size="icon" className="flex-shrink-0" onClick={() => fileInputRef.current?.click()}>
                            <ImageIcon className="h-5 w-5" />
                        </Button>
                        <input type="file" ref={fileInputRef} onChange={handleImageUpload} accept="image/*" className="hidden" />
                        <Textarea
                            placeholder="Type a message..."
                            className="flex-1 resize-none"
                            rows={1}
                            onKeyDown={(e) => {
                                if (e.key === 'Enter' && !e.shiftKey) {
                                    e.preventDefault();
                                    (e.target as HTMLTextAreaElement).form?.requestSubmit();
                                }
                            }}
                        />
                        <Button type="submit" size="icon" className="rounded-full flex-shrink-0">
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

