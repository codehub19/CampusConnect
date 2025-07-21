
"use client";

import Image from 'next/image';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardFooter, CardHeader } from '@/components/ui/card';
import { Calendar, Pin, MessageSquare, Tag, Users, DollarSign, CalendarOff } from 'lucide-react';
import type { Event } from '@/lib/types';
import { format } from 'date-fns';
import { Badge } from '@/components/ui/badge';

interface EventCardProps {
  event: Event;
  onJoinChat: (event: Event) => void;
}

export default function EventCard({ event, onJoinChat }: EventCardProps) {
  const startDate = event.date?.toDate ? event.date.toDate() : new Date(event.date);
  const endDate = event.endDate?.toDate ? event.endDate.toDate() : (event.endDate ? new Date(event.endDate) : null);

  const formatDateRange = () => {
    const startFormatted = format(startDate, 'EEE, MMM d');
    if (endDate) {
      const endFormatted = format(endDate, 'EEE, MMM d, yyyy');
      if (startFormatted === format(endDate, 'EEE, MMM d')) {
        return format(startDate, 'EEE, MMM d, yyyy');
      }
      return `${startFormatted} - ${endFormatted}`;
    }
    return format(startDate, 'EEE, MMM d, yyyy \'at\' h:mm a');
  };

  return (
    <Card className="flex flex-col h-full overflow-hidden transition-all duration-300 hover:shadow-primary/10">
      <CardHeader className="p-0 relative">
        <div className="relative h-48 w-full">
          <Image
            src={event.imageUrl}
            alt={event.title}
            layout="fill"
            objectFit="cover"
            data-ai-hint="event cover"
            className="bg-secondary"
          />
           <Badge variant="secondary" className="absolute top-2 right-2">{event.category}</Badge>
        </div>
      </CardHeader>
      <CardContent className="p-6 flex-grow">
        <h3 className="font-bold text-xl mb-2">{event.title}</h3>
        <div className="text-sm text-muted-foreground space-y-2">
            <div className="flex items-start">
              <Calendar className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>{formatDateRange()}</span>
            </div>
            <div className="flex items-start">
              <Pin className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>{event.location}</span>
            </div>
            <div className="flex items-start">
              <Users className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>{event.capacity ? `${event.capacity} spots` : 'Open attendance'}</span>
            </div>
             <div className="flex items-start">
              <DollarSign className="mr-2 h-4 w-4 mt-0.5 shrink-0" />
              <span>{event.cost || 'Free'}</span>
            </div>
        </div>
        <p className="text-sm text-foreground/80 mt-4 line-clamp-3">{event.description}</p>
      </CardContent>
      <CardFooter className="p-6 pt-0 bg-card/50 flex-col items-stretch gap-4">
        <Button className="w-full" onClick={() => onJoinChat(event)}>
          <MessageSquare className="mr-2 h-4 w-4" />
          Join Group Chat
        </Button>
        <p className="text-xs text-muted-foreground text-center">Organized by: {event.organizer}</p>
      </CardFooter>
    </Card>
  );
}
