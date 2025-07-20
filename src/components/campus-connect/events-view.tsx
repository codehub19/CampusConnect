
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import EventCard from './event-card'; // We will create this next
import type { CampusEvent } from '@/lib/types';
import { format } from 'date-fns';

interface EventsViewProps {
  onNavigateHome: () => void;
}

// Placeholder data for now
const placeholderEvents: CampusEvent[] = [
  {
    id: '1',
    title: 'Annual Tech Summit 2024',
    description: 'Join us for a day of tech talks, workshops, and networking with industry leaders.',
    location: 'Main Auditorium',
    date: new Date('2024-10-26T09:00:00'),
    organizer: 'Computer Science Club',
    imageUrl: `https://placehold.co/600x400/4f46e5/ffffff`,
    chatId: 'chat-event-1'
  },
  {
    id: '2',
    title: 'Fall Music Festival',
    description: 'Live bands, food trucks, and good vibes on the main quad. Don\'t miss out!',
    location: 'University Quad',
    date: new Date('2024-11-02T14:00:00'),
    organizer: 'Student Activities Board',
    imageUrl: `https://placehold.co/600x400/f59e0b/ffffff`,
    chatId: 'chat-event-2'
  },
  {
    id: '3',
    title: 'Startup Career Fair',
    description: 'Connect with innovative startups looking to hire interns and full-time employees.',
    location: 'Student Union Ballroom',
    date: new Date('2024-11-09T10:00:00'),
    organizer: 'Career Services',
    imageUrl: `https://placehold.co/600x400/10b981/ffffff`,
    chatId: 'chat-event-3'
  },
];


const EventSkeleton = () => (
  <div className="rounded-lg border bg-card text-card-foreground shadow-sm">
    <Skeleton className="h-[200px] w-full rounded-t-lg" />
    <div className="p-6">
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6 mt-2" />
      <div className="flex justify-between items-center mt-4">
        <Skeleton className="h-8 w-24" />
        <Skeleton className="h-10 w-32" />
      </div>
    </div>
  </div>
);

export default function EventsView({ onNavigateHome }: EventsViewProps) {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    // Simulate fetching data
    const timer = setTimeout(() => {
      setEvents(placeholderEvents);
      setIsLoading(false);
    }, 1000);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <Button variant="ghost" size="icon" onClick={onNavigateHome}>
          <ArrowLeft className="h-5 w-5" />
          <span className="sr-only">Back to Home</span>
        </Button>
        <h1 className="text-xl font-bold">Campus Events</h1>
        <Button>
          <PlusCircle className="mr-2 h-4 w-4" />
          Create Event
        </Button>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <EventSkeleton key={i} />)
              ) : events.length > 0 ? (
                events.map(event => (
                  <EventCard key={event.id} event={event} />
                ))
              ) : (
                <div className="text-center py-20 col-span-full">
                  <p className="text-lg font-semibold">No events scheduled.</p>
                  <p className="text-muted-foreground">Check back soon for more events!</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
  );
}
