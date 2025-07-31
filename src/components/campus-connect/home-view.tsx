
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, CalendarDays, ArrowRight, HeartCrack, Lightbulb } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SuggestionView from "./suggestion-view";

interface HomeViewProps {
  onNavigateTo1v1Chat: () => void;
  onNavigateToEvents: () => void;
  onNavigateToMissedConnections: () => void;
  userName: string;
  onOpenProfile: () => void;
  userAvatar?: string;
  onlineCount: number | null;
}

export default function HomeView({ onNavigateTo1v1Chat, onNavigateToEvents, onNavigateToMissedConnections, userName, onOpenProfile, userAvatar, onlineCount }: HomeViewProps) {
  const [isSuggestionOpen, setSuggestionOpen] = useState(false);

  return (
    <>
    <SuggestionView isOpen={isSuggestionOpen} onOpenChange={setSuggestionOpen} />
    <div className="flex flex-col min-h-screen bg-background">
       <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
        <h1 className="text-xl font-bold text-foreground">CampusConnect</h1>
        <Button onClick={onOpenProfile} variant="ghost" size="icon" className="rounded-full h-10 w-10">
            <Avatar className="h-10 w-10">
                <AvatarImage src={userAvatar} alt={userName} data-ai-hint="profile avatar" />
                <AvatarFallback>{userName.charAt(0)}</AvatarFallback>
            </Avatar>
        </Button>
      </header>

      <main className="flex-1 flex flex-col items-center justify-center p-4 sm:p-6">
        <div className="text-center mb-10">
            <h1 className="text-4xl sm:text-5xl font-bold text-foreground">Welcome, {userName}!</h1>
            <p className="text-lg text-muted-foreground mt-2">Choose how you want to connect today.</p>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 w-full max-w-6xl">
            <Card 
            className="bg-card/80 border-border shadow-lg hover:shadow-primary/20 hover:border-primary/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer"
            onClick={onNavigateTo1v1Chat}
            >
            <CardHeader>
                <div className="flex items-center gap-4">
                <div className="p-3 bg-primary/10 rounded-lg">
                    <Users className="h-8 w-8 text-primary" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold">1-on-1 Chat</CardTitle>
                    <CardDescription>Connect with a random student or a friend.</CardDescription>
                </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
                <p className="text-muted-foreground mb-6">
                Jump into a private conversation. Find new people based on your interests or catch up with existing friends.
                </p>
                <Button className="w-full font-bold text-lg py-6 mt-auto">
                Start Chatting <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </CardContent>
            </Card>
            
            <Card 
            className="bg-card/80 border-border shadow-lg hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer"
            onClick={onNavigateToEvents}
            >
            <CardHeader>
                <div className="flex items-center gap-4">
                <div className="p-3 bg-accent/10 rounded-lg">
                    <CalendarDays className="h-8 w-8 text-accent" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold">Events</CardTitle>
                    <CardDescription>Find events and join group chats.</CardDescription>
                </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
                <p className="text-muted-foreground mb-6">
                Discover what's happening around you, from club fairs to trips, and chat with other attendees.
                </p>
                <Button variant="secondary" className="w-full font-bold text-lg py-6 mt-auto">
                View Events <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </CardContent>
            </Card>

            <Card 
            className="bg-card/80 border-border shadow-lg hover:shadow-pink-500/10 hover:border-pink-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer md:col-span-2 lg:col-span-1"
            onClick={onNavigateToMissedConnections}
            >
            <CardHeader>
                <div className="flex items-center gap-4">
                <div className="p-3 bg-pink-500/10 rounded-lg">
                    <HeartCrack className="h-8 w-8 text-pink-500" />
                </div>
                <div>
                    <CardTitle className="text-2xl font-bold">Missed Connections</CardTitle>
                    <CardDescription>Post anonymously about someone you saw.</CardDescription>
                </div>
                </div>
            </CardHeader>
            <CardContent className="flex-grow flex flex-col justify-between">
                <p className="text-muted-foreground mb-6">
                Saw someone interesting? Post about it here. All posts are reviewed by our AI moderator before going live.
                </p>
                <Button variant="outline" className="w-full font-bold text-lg py-6 mt-auto border-pink-500/50 hover:bg-pink-500/10 hover:text-pink-500">
                View Board <ArrowRight className="ml-2 h-5 w-5" />
                </Button>
            </CardContent>
            </Card>
        </div>
      </main>

       <div className="fixed bottom-4 left-4 z-50">
        <Button onClick={() => setSuggestionOpen(true)} variant="outline" size="icon" className="rounded-full h-14 w-14 shadow-lg bg-card/80 border-border hover:bg-accent">
            <Lightbulb className="h-6 w-6 text-yellow-400" />
        </Button>
      </div>
    </div>
    </>
  );
}
