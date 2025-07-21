
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { ArrowLeft, PlusCircle } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Skeleton } from '@/components/ui/skeleton';
import EventCard from './event-card';
import type { CampusEvent } from '@/lib/types';
import CreateEventView from './create-event-view';
import GroupChatView from './group-chat-view'; // Import the new component
import { getFirestore, collection, query, orderBy, onSnapshot, where } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import { useAuth } from '@/hooks/use-auth';

interface EventsViewProps {
  onNavigateHome: () => void;
}

const EventSkeleton = () => (
  <div className="flex flex-col h-full overflow-hidden transition-all duration-300 rounded-lg border bg-card text-card-foreground shadow-sm">
      <Skeleton className="h-48 w-full" />
    <div className="p-6 flex-grow">
      <Skeleton className="h-6 w-3/4 mb-2" />
      <Skeleton className="h-4 w-1/2 mb-4" />
      <Skeleton className="h-4 w-full" />
      <Skeleton className="h-4 w-5/6 mt-2" />
    </div>
     <div className="p-6 pt-0 bg-card/50 flex-col items-stretch gap-4">
        <Skeleton className="h-10 w-full" />
        <Skeleton className="h-4 w-1/3 mx-auto mt-4" />
    </div>
  </div>
);

export default function EventsView({ onNavigateHome }: EventsViewProps) {
  const [events, setEvents] = useState<CampusEvent[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreateEventOpen, setCreateEventOpen] = useState(false);
  const [activeEventChat, setActiveEventChat] = useState<CampusEvent | null>(null);
  const db = getFirestore(firebaseApp);
  const { profile, user } = useAuth();

  useEffect(() => {
    const eventsRef = collection(db, 'campus_events');
    const q = query(
        eventsRef, 
        where('date', '>=', new Date()),
        orderBy('date', 'asc')
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedEvents: CampusEvent[] = [];
      snapshot.forEach(doc => {
        fetchedEvents.push({ id: doc.id, ...doc.data() } as CampusEvent);
      });
      setEvents(fetchedEvents);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching events: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db]);
  
  const handleCreateEventClick = () => {
    setCreateEventOpen(true);
  }

  const handleJoinChat = (event: CampusEvent) => {
    setActiveEventChat(event);
  };

  const handleLeaveChat = () => {
    setActiveEventChat(null);
  }

  if (activeEventChat && user && profile) {
    return (
      <GroupChatView 
        event={activeEventChat}
        currentUser={profile}
        onLeaveChat={handleLeaveChat}
      />
    )
  }

  return (
    <>
    <CreateEventView isOpen={isCreateEventOpen} onOpenChange={setCreateEventOpen} />
    <div className="flex flex-col h-screen bg-background text-foreground">
      <header className="flex items-center p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <div className="w-1/3">
            <Button variant="ghost" size="icon" onClick={onNavigateHome}>
                <ArrowLeft className="h-5 w-5" />
                <span className="sr-only">Back to Home</span>
            </Button>
        </div>
        <h1 className="text-xl font-bold w-1/3 text-center">Campus Events</h1>
        <div className="w-1/3 flex justify-end">
            <Button onClick={handleCreateEventClick} disabled={profile?.isGuest} size="sm">
                <PlusCircle className="mr-2 h-4 w-4" />
                Create
            </Button>
        </div>
      </header>
      <main className="flex-1 overflow-hidden">
        <ScrollArea className="h-full">
          <div className="p-4 md:p-8">
            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <EventSkeleton key={i} />)
              ) : events.length > 0 ? (
                events.map(event => (
                  <EventCard key={event.id} event={event} onJoinChat={handleJoinChat} />
                ))
              ) : (
                <div className="text-center py-20 col-span-full">
                  <p className="text-lg font-semibold">No upcoming events scheduled.</p>
                  <p className="text-muted-foreground">Check back soon or create the first event!</p>
                </div>
              )}
            </div>
          </div>
        </ScrollArea>
      </main>
    </div>
    </>
  );
}
