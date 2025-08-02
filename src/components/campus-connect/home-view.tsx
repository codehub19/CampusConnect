
"use client";

import { useState } from "react";
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { CalendarDays, ArrowRight, HeartCrack, Lightbulb, Users, Bot } from "lucide-react";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import SuggestionView from "./suggestion-view";

interface HomeViewProps {
  onNavigateToEvents: () => void;
  onNavigateToMissedConnections: () => void;
  onNavigateToChat: () => void;
  onNavigateToAIChat: () => void;
  userName: string;
  onOpenProfile: () => void;
  userAvatar?: string;
  onlineCount: number | null;
}

export default function HomeView({ onNavigateToEvents, onNavigateToMissedConnections, onNavigateToChat, onNavigateToAIChat, userName, onOpenProfile, userAvatar, onlineCount }: HomeViewProps) {
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
                onClick={onNavigateToChat}
            >
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-primary/10 rounded-lg">
                            <Users className="h-8 w-8 text-primary" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">1-on-1 Chat</CardTitle>
                            <CardDescription>Chat, play games, and video call.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-muted-foreground mb-6">
                        Connect with another student, make friends, and enjoy real-time interactions.
                    </p>
                    <Button className="w-full font-bold text-lg py-6 mt-auto">
                        Find a Chat <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </CardContent>
            </Card>

            <Card 
                className="bg-card/80 border-border shadow-lg hover:shadow-green-500/10 hover:border-green-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer"
                onClick={onNavigateToEvents}
            >
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-green-500/10 rounded-lg">
                            <CalendarDays className="h-8 w-8 text-green-500" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">Campus Events</CardTitle>
                            <CardDescription>Discover what's happening on campus.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                    <p className="text-muted-foreground mb-6">
                        Find study groups, parties, club meetings, and more. Join event-specific group chats.
                    </p>
                    <Button variant="secondary" className="w-full font-bold text-lg py-6 mt-auto bg-green-500/10 hover:bg-green-500/20 text-green-400 border-green-500/20">
                        Browse Events <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </CardContent>
            </Card>

            <Card 
                className="bg-card/80 border-border shadow-lg hover:shadow-pink-500/10 hover:border-pink-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer"
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
                        Saw someone interesting? Post about it here. All posts are reviewed by our AI moderator.
                    </p>
                    <Button variant="outline" className="w-full font-bold text-lg py-6 mt-auto border-pink-500/50 hover:bg-pink-500/10 hover:text-pink-500">
                        View Board <ArrowRight className="ml-2 h-5 w-5" />
                    </Button>
                </CardContent>
            </Card>

             <Card 
                className="bg-card/80 border-border shadow-lg hover:shadow-yellow-500/10 hover:border-yellow-500/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer md:col-span-2 lg:col-span-3"
                onClick={onNavigateToAIChat}
            >
                <CardHeader>
                    <div className="flex items-center gap-4">
                        <div className="p-3 bg-yellow-500/10 rounded-lg">
                            <Bot className="h-8 w-8 text-yellow-500" />
                        </div>
                        <div>
                            <CardTitle className="text-2xl font-bold">AI Assistant</CardTitle>
                            <CardDescription>Get answers about campus life, ask for advice, or just chat.</CardDescription>
                        </div>
                    </div>
                </CardHeader>
                <CardContent className="flex-grow flex flex-col justify-between">
                     <p className="text-muted-foreground mb-6">
                        Your friendly AI guide to everything on campus. Powered by Google's Gemini models.
                    </p>
                    <Button variant="secondary" className="w-full font-bold text-lg py-6 mt-auto bg-yellow-500/10 hover:bg-yellow-500/20 text-yellow-400 border-yellow-500/20">
                        Chat with AI <ArrowRight className="ml-2 h-5 w-5" />
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
