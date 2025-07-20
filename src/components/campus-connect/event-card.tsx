
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Calendar, Pin, MessageSquare } from 'lucide-react';
import type { CampusEvent } from '@/lib/types';
import { format } from 'date-fns';
import { useToast } from '@/hooks/use-toast';

interface EventCardProps {
  event: CampusEvent;
}

export default function EventCard({ event }: EventCardProps) {
  const { toast } = useToast();

  const handleJoinChat = () => {
    toast({
      title: "Coming Soon!",
      description: "Group chat functionality is currently under development.",
    });
  }

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-primary/10">
      <CardHeader className="p-0">
        <div className="relative h-48 w-full">
          <Image
            src={event.imageUrl}
            alt={event.title}
            layout="fill"
            objectFit="cover"
            data-ai-hint="event cover"
          />
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <CardTitle className="mb-2 text-xl">{event.title}</CardTitle>
        <div className="flex items-center text-sm text-muted-foreground mb-1">
          <Calendar className="mr-2 h-4 w-4" />
          <span>{format(new Date(event.date), 'EEE, MMM d, yyyy \'at\' h:mm a')}</span>
        </div>
        <div className="flex items-center text-sm text-muted-foreground mb-4">
          <Pin className="mr-2 h-4 w-4" />
          <span>{event.location}</span>
        </div>
        <CardDescription>{event.description}</CardDescription>
      </CardContent>
      <CardFooter className="p-6 pt-0 bg-card/50 flex-col items-stretch gap-4">
        <Button className="w-full" onClick={handleJoinChat}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Join Group Chat
        </Button>
        <p className="text-xs text-muted-foreground text-center">Organized by: {event.organizer}</p>
      </CardFooter>
    </Card>
  );
}
