
"use client";

import React, { useState, useRef, useEffect, UIEvent } from 'react';
import { Send, ArrowDown, ArrowLeft } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { User, Message, MessageContent, CampusEvent } from '@/lib/types';
import { getFirestore, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, doc, getDoc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import Image from 'next/image';

interface GroupChatViewProps {
  event: CampusEvent;
  currentUser: User;
  onLeaveChat: () => void;
}

interface EnrichedMessage extends Message {
    sender?: User;
}

export default function GroupChatView({ event, currentUser, onLeaveChat }: GroupChatViewProps) {
  const [messages, setMessages] = useState<EnrichedMessage[]>([]);
  const [usersCache, setUsersCache] = useState<{ [key: string]: User }>({});
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const db = getFirestore(firebaseApp);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    if (!event.chatId) return;

    const messagesRef = collection(db, "group_chats", event.chatId, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, async (snapshot) => {
      const fetchedMessages: Message[] = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as Message));
      
      const enrichedMessages: EnrichedMessage[] = [];
      const newUsersToFetch = new Set<string>();
      
      for (const msg of fetchedMessages) {
        let sender: User | undefined = usersCache[msg.senderId];
        if (!sender) {
            newUsersToFetch.add(msg.senderId);
        }
        enrichedMessages.push({ ...msg, sender });
      }

      if(newUsersToFetch.size > 0) {
        const newCache = {...usersCache};
        await Promise.all(Array.from(newUsersToFetch).map(async (userId) => {
            const userRef = doc(db, 'users', userId);
            const userSnap = await getDoc(userRef);
            if(userSnap.exists()){
                const userData = userSnap.data() as User;
                newCache[userId] = userData;
                enrichedMessages.forEach(msg => {
                    if (msg.senderId === userId) msg.sender = userData;
                });
            }
        }));
        setUsersCache(newCache);
      }

      setMessages(enrichedMessages);
    });

    return () => unsubscribe();
  }, [event.chatId, db, usersCache]);

  useEffect(() => {
    if (isAtBottomRef.current) {
        scrollToBottom();
    } else {
        setShowScrollToBottom(true);
    }
  }, [messages]);

  const handleScroll = (e: UIEvent<HTMLDivElement>) => {
    const { scrollTop, scrollHeight, clientHeight } = e.currentTarget;
    const isAtBottom = scrollHeight - scrollTop - clientHeight < 10;
    isAtBottomRef.current = isAtBottom;
    if (isAtBottom) {
      setShowScrollToBottom(false);
    }
  };

  const sendNewMessage = async (content: MessageContent) => {
    if (event.chatId) {
        const messagesRef = collection(db, "group_chats", event.chatId, "messages");
        await addDoc(messagesRef, {
            senderId: currentUser.id,
            content: content,
            timestamp: serverTimestamp(),
        });
        scrollToBottom('smooth');
    }
  }

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

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <div className="w-1/3">
            <Button variant="ghost" size="icon" onClick={onLeaveChat}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Events</span>
            </Button>
          </div>
          <h1 className="text-xl font-bold w-1/3 text-center truncate">{event.title}</h1>
          <div className="w-1/3 flex justify-end">
            {/* Can add actions like "View Event Details" here */}
          </div>
        </header>

        <div className="h-full flex flex-col relative flex-1">
            <ScrollArea className="flex-grow p-4" ref={scrollAreaRef} onScroll={handleScroll}>
            <div className="space-y-4">
                {messages.map((message, index) => {
                const showSenderInfo = index === 0 || messages[index - 1].senderId !== message.senderId;
                return (
                <div
                    key={message.id}
                    className={cn(
                    'flex items-end gap-2',
                    message.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                    )}
                >
                    {message.senderId !== currentUser.id && (
                    <Avatar className={cn("h-8 w-8", !showSenderInfo && 'invisible')}>
                        {message.sender && <AvatarImage src={message.sender.avatar} alt={message.sender.name} />}
                        {message.sender && <AvatarFallback>{message.sender.name.charAt(0)}</AvatarFallback>}
                    </Avatar>
                    )}
                    <div className={cn("flex flex-col", message.senderId === currentUser.id ? 'items-end' : 'items-start' )}>
                        {message.senderId !== currentUser.id && showSenderInfo && message.sender && (
                            <span className="text-xs text-muted-foreground ml-2 mb-1">{message.sender.name}</span>
                        )}
                        <div
                        className={cn(
                            'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2 text-sm shadow',
                            message.senderId === currentUser.id
                            ? 'bg-primary text-primary-foreground rounded-br-none'
                            : 'bg-secondary text-secondary-foreground rounded-bl-none'
                        )}
                        >
                            <p>{message.content.value as string}</p>
                        </div>
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
                <textarea
                    placeholder="Type a message..."
                    className="flex-1 resize-none bg-background focus-visible:ring-1 focus-visible:ring-offset-0 flex min-h-[40px] w-full rounded-md border border-input px-3 py-2 text-base ring-offset-background placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 md:text-sm"
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
  );
}
