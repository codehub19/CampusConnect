"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Video, Gamepad2 } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Dialog, DialogTrigger } from '@/components/ui/dialog';
import VideoCallView from './video-call-view';
import TicTacToe from './tic-tac-toe';
import { cn } from '@/lib/utils';
import type { User, Chat, Message } from '@/lib/types';

interface ChatViewProps {
  user: User;
  chat: Chat;
  currentUser: User;
}

export default function ChatView({ user, chat, currentUser }: ChatViewProps) {
  const [messages, setMessages] = useState<Message[]>(chat.messages);
  const [isVideoCallOpen, setVideoCallOpen] = useState(false);
  const [isGameOpen, setGameOpen] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);

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
    <Card className="h-full flex flex-col border-0 rounded-xl shadow-none">
      <CardHeader className="flex flex-row items-center justify-between p-4 border-b">
        <div className="flex items-center gap-3">
          <Avatar className="h-10 w-10">
            <AvatarImage src={user.avatar} alt={user.name} />
            <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
          </Avatar>
          <div>
            <h2 className="font-semibold text-lg">{user.name}</h2>
            <p className="text-sm text-muted-foreground">{user.online ? 'Online' : 'Offline'}</p>
          </div>
        </div>
        <div className="flex items-center gap-2">
           <Dialog open={isGameOpen} onOpenChange={setGameOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Gamepad2 className="h-5 w-5" />
                <span className="sr-only">Play Game</span>
              </Button>
            </DialogTrigger>
            <TicTacToe onOpenChange={setGameOpen} />
          </Dialog>
          <Dialog open={isVideoCallOpen} onOpenChange={setVideoCallOpen}>
            <DialogTrigger asChild>
              <Button variant="ghost" size="icon" className="rounded-full">
                <Video className="h-5 w-5" />
                <span className="sr-only">Video Call</span>
              </Button>
            </DialogTrigger>
            <VideoCallView user={user} currentUser={currentUser} onOpenChange={setVideoCallOpen} />
          </Dialog>
        </div>
      </CardHeader>
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
                    <AvatarImage src={user.avatar} alt={user.name} />
                    <AvatarFallback>{user.name.charAt(0)}</AvatarFallback>
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
