"use client";

import React, { useState, useRef, useEffect } from 'react';
import { Send, Bot, Sparkles } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from '@/components/ui/avatar';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardContent, CardFooter } from '@/components/ui/card';
import { Textarea } from '@/components/ui/textarea';
import { ScrollArea } from '@/components/ui/scroll-area';
import { useToast } from '@/hooks/use-toast';
import { cn } from '@/lib/utils';
import { aiAssistantAnswersQuestions } from '@/ai/flows/ai-assistant-answers-questions';
import { Skeleton } from '@/components/ui/skeleton';

interface AIMessage {
  id: string;
  role: 'user' | 'assistant';
  text: string;
  timestamp: Date;
}

export default function AiAssistantView() {
  const [messages, setMessages] = useState<AIMessage[]>([
    {
      id: 'ai-intro',
      role: 'assistant',
      text: "Hello! I'm your campus AI assistant. Ask me anything about campus life, from dining hall hours to the best study spots!",
      timestamp: new Date(),
    }
  ]);
  const [isLoading, setIsLoading] = useState(false);
  const scrollAreaRef = useRef<HTMLDivElement>(null);
  const { toast } = useToast();

  useEffect(() => {
    if (scrollAreaRef.current) {
      scrollAreaRef.current.scrollTo({ top: scrollAreaRef.current.scrollHeight, behavior: 'smooth' });
    }
  }, [messages, isLoading]);

  const handleSendMessage = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const form = e.currentTarget;
    const textarea = form.querySelector<HTMLTextAreaElement>('textarea');
    const question = textarea?.value.trim();

    if (question) {
      const userMessage: AIMessage = {
        id: `user-${Date.now()}`,
        role: 'user',
        text: question,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMessage]);
      setIsLoading(true);
      if(textarea) textarea.value = '';

      try {
        const result = await aiAssistantAnswersQuestions({ question });
        const assistantMessage: AIMessage = {
          id: `ai-${Date.now()}`,
          role: 'assistant',
          text: result.answer,
          timestamp: new Date(),
        };
        setMessages(prev => [...prev, assistantMessage]);
      } catch (error) {
        console.error("AI Assistant Error:", error);
        toast({
          variant: 'destructive',
          title: 'Error',
          description: 'Failed to get a response from the AI assistant.',
        });
      } finally {
        setIsLoading(false);
      }
    }
  };

  return (
    <Card className="h-full flex flex-col border-0 rounded-xl shadow-none">
      <CardHeader className="flex flex-row items-center gap-3 p-4 border-b">
        <Avatar className="h-10 w-10">
          <div className="h-full w-full flex items-center justify-center bg-primary rounded-full">
            <Bot className="h-6 w-6 text-primary-foreground" />
          </div>
        </Avatar>
        <div>
          <h2 className="font-semibold text-lg">AI Assistant</h2>
          <p className="text-sm text-muted-foreground">Online</p>
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
                  message.role === 'user' ? 'justify-end' : 'justify-start'
                )}
              >
                {message.role === 'assistant' && (
                  <Avatar className="h-8 w-8">
                     <div className="h-full w-full flex items-center justify-center bg-primary rounded-full">
                        <Bot className="h-5 w-5 text-primary-foreground" />
                     </div>
                  </Avatar>
                )}
                <div
                  className={cn(
                    'max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2 text-sm shadow',
                    message.role === 'user'
                      ? 'bg-primary text-primary-foreground rounded-br-none'
                      : 'bg-secondary text-secondary-foreground rounded-bl-none'
                  )}
                >
                  <p>{message.text}</p>
                </div>
              </div>
            ))}
            {isLoading && (
              <div className="flex items-end gap-2 justify-start">
                  <Avatar className="h-8 w-8">
                    <div className="h-full w-full flex items-center justify-center bg-primary rounded-full">
                      <Bot className="h-5 w-5 text-primary-foreground" />
                    </div>
                  </Avatar>
                  <div className="max-w-xs md:max-w-md lg:max-w-lg rounded-lg px-3 py-2 text-sm shadow bg-secondary text-secondary-foreground rounded-bl-none">
                    <div className="flex items-center gap-2">
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="w-3 h-3 rounded-full" />
                      <Skeleton className="w-3 h-3 rounded-full" />
                    </div>
                  </div>
              </div>
            )}
          </div>
        </ScrollArea>
      </CardContent>
      <CardFooter className="p-4 border-t">
        <form onSubmit={handleSendMessage} className="flex w-full items-center gap-2">
          <Textarea
            placeholder="Ask the AI assistant..."
            className="flex-1 resize-none bg-background focus-visible:ring-1 focus-visible:ring-offset-0"
            rows={1}
            disabled={isLoading}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                (e.target as HTMLTextAreaElement).form?.requestSubmit();
              }
            }}
          />
          <Button type="submit" size="icon" className="rounded-full flex-shrink-0" disabled={isLoading}>
            <Send className="h-5 w-5" />
            <span className="sr-only">Send</span>
          </Button>
        </form>
      </CardFooter>
    </Card>
  );
}
