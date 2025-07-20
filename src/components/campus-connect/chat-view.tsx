
"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { cn } from '@/lib/utils';
import type { User, Chat, Message } from '@/lib/types';

interface ChatViewProps {
  chat: Chat;
  currentUser: User;
}

export default function ChatView({ chat, currentUser }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(chat.messages);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const partner = chat.users?.find(u => u.id !== currentUser.id) || { name: 'Chat', avatar: '' };

  useEffect(() => {
    setMessages(chat.messages);
  }, [chat.messages]);

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight });
    }
  }, [messages]);

  const handleSendMessage = (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
    if (textarea && textarea.value.trim() !== '') {
      // This is a mock send message. In a real app this would call a backend.
      const newMessage: Message = {
        id: `msg-${Date.now()}`,
        senderId: currentUser.id,
        text: textarea.value.trim(),
        timestamp: new Date(),
      };
      setMessages([...messages, newMessage]);
      textarea.value = '';
    }
  };

  return (
    <Card className="h-full flex flex-col border-0 rounded-none shadow-none">
      <CardContent className="flex-1 p-0">
        <ScrollArea className="h-full p-4" ref={scrollAreaRef}>
          <div className="space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={cn(
                  'flex items-end gap-2',
                  message.senderId === currentUser.id ? 'justify-end' : 'justify-start'
                )}
              >
                {message.senderId !== currentUser.id && (
                  <Avatar className="h-8 w-8">
                    <AvatarImage src={partner.avatar} alt={partner.name} />
                    <AvatarFallback>{partner.name.charAt(0)}</AvatarFallback>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2 text-sm shadow',
                    message.senderId === currentUser.id
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary text-secondary-foreground rounded-bl-none'
                  )}
                >
                  <p>{message.text}</p>
                  <p className={cn("text-xs mt-1", message.senderId === currentUser.id ? 'text-primary-foreground/70' : 'text-muted-foreground/70' )}>
                    {new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' })}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
          <Textarea
            placeholder="Type a message..."
            className="flex-1 resize-none bg-background focus-visible:ring-1 focus-visible:ring-offset-0"
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
      </CardFooter>
    </Card>
  );
}
