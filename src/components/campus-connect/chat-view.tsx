
"use client";

import React, { useState, useRef, useEffect, UIEvent } from 'react';
import { Send, Bot, ArrowDown } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { User, Chat, Message } from '@/lib/types';
import { getFirestore, onSnapshot, collection, query, orderBy, addDoc, serverTimestamp, updateDoc, doc } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

interface ChatViewProps {
  chat: Chat;
  currentUser: User;
}

export default function ChatView({ chat, currentUser }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>([]);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const partner = chat.users?.find(u => u.id !== currentUser.id) || { name: 'Chat', avatar: '' };
  const db = getFirestore(firebaseApp);
  const [showScrollToBottom, setShowScrollToBottom] = useState(false);
  const isAtBottomRef = useRef(true);

  const scrollToBottom = (behavior: 'smooth' | 'auto' = 'auto') => {
    if (scrollAreaRef.current) {
        scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior });
    }
  };

  useEffect(() => {
    if (!chat.id) return;

    const messagesRef = collection(db, "chats", chat.id, "messages");
    const q = query(messagesRef, orderBy("timestamp", "asc"));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedMessages: Message[] = [];
      snapshot.forEach((doc) => {
        fetchedMessages.push({ id: doc.id, ...doc.data() } as Message);
      });
      setMessages(fetchedMessages);
    });

    return () => unsubscribe();
  }, [chat.id, db]);

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

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
    const text = textarea?.value.trim();

    if (text && chat.id) {
        const messagesRef = collection(db, "chats", chat.id, "messages");
        await addDoc(messagesRef, {
            senderId: currentUser.id,
            text: text,
            timestamp: serverTimestamp(),
        });
        
        const chatRef = doc(db, 'chats', chat.id);
        await updateDoc(chatRef, { lastMessageTimestamp: serverTimestamp() });

        if(textarea) textarea.value = '';
        scrollToBottom('smooth');
    }
  };

  return (
    <div className="h-full flex flex-col relative">
        <ScrollArea className="flex-grow p-4" ref={scrollAreaRef} onScroll={handleScroll}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-end gap-2',
                  message.senderId === currentUser.id ? 'justify-end' : 
                  message.senderId === 'ai-assistant' ? 'justify-center' : 'justify-start'
                )}
              >
                {message.senderId !== currentUser.id && message.senderId !== 'ai-assistant' && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={partner.avatar} alt={partner.name} />
                    <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                 {message.senderId === 'ai-assistant' && (
                    <Avatar className="h-8 w-8">
                        <div className="h-full w-full flex items-center justify-center bg-primary rounded-full">
                           <Bot className="h-5 w-5 text-primary-foreground" />
                        </div>
                    </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2 text-sm shadow',
                    message.senderId === currentUser.id
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : message.senderId === 'ai-assistant'
                      ? 'bg-secondary text-secondary-foreground text-center'
                      : 'bg-secondary text-secondary-foreground rounded-bl-none'
                  )}
                >
                  <p className={cn(message.senderId === 'ai-assistant' && 'italic')}>{message.text}</p>
                   {message.timestamp && message.senderId !== 'ai-assistant' && (
                    <p className={cn("text-xs mt-1", message.senderId === currentUser.id ? 'text-primary-foreground/70' : 'text-muted-foreground/70' )}>
                        {new Date((message.timestamp as any).toDate()).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                    </p>
                   )}
                </div>
              </div>
            ))}
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
  );
}
