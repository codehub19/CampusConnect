
"use client";

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Users, Newspaper, ArrowRight } from "lucide-react";

interface HomeViewProps {
  onNavigateTo1v1Chat: () => void;
  onNavigateToMissedConnections: () => void;
  userName: string;
}

export default function HomeView({ onNavigateTo1v1Chat, onNavigateToMissedConnections, userName }: HomeViewProps) {
  return (
    <div className="flex flex-col items-center justify-center min-h-screen bg-background p-4 sm:p-6">
      <div className="text-center mb-10">
        <h1 className="text-4xl sm:text-5xl font-bold text-foreground">Welcome, {userName}!</h1>
        <p className="text-lg text-muted-foreground mt-2">Choose how you want to connect today.</p>
      </div>
      <div className="grid grid-cols-1 md:grid-cols-2 gap-8 w-full max-w-4xl">
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
            <Button className="w-full font-bold text-lg py-6">
              Start Chatting <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
        
        <Card 
          className="bg-card/80 border-border shadow-lg hover:shadow-accent/20 hover:border-accent/50 transition-all duration-300 transform hover:-translate-y-1 flex flex-col cursor-pointer"
          onClick={onNavigateToMissedConnections}
        >
          <CardHeader>
            <div className="flex items-center gap-4">
              <div className="p-3 bg-accent/10 rounded-lg">
                <Newspaper className="h-8 w-8 text-accent" />
              </div>
              <div>
                <CardTitle className="text-2xl font-bold">Missed Connections</CardTitle>
                <CardDescription>Post anonymously about someone you saw on campus.</CardDescription>
              </div>
            </div>
          </CardHeader>
          <CardContent className="flex-grow flex flex-col justify-between">
            <p className="text-muted-foreground mb-6">
              Ever see someone you wanted to talk to but didn't get the chance? Post about it here and see what happens.
            </p>
            <Button variant="secondary" className="w-full font-bold text-lg py-6">
              View Board <ArrowRight className="ml-2 h-5 w-5" />
            </Button>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
