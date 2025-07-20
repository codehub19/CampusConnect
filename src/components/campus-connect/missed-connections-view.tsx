
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, PlusCircle, Pin, Clock } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, query, where, onSnapshot, orderBy } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import type { MissedConnectionPost } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import CreatePostView from './create-post-view';

interface MissedConnectionsViewProps {
  onNavigateHome: () => void;
}

const PostSkeleton = () => (
  <Card>
    <CardHeader>
      <Skeleton className="h-6 w-3/4" />
      <Skeleton className="h-4 w-1/2" />
    </CardHeader>
    <CardContent>
      <div className="space-y-2">
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-full" />
        <Skeleton className="h-4 w-5/6" />
      </div>
    </CardContent>
    <CardFooter className="flex justify-between">
       <Skeleton className="h-6 w-24" />
       <Skeleton className="h-6 w-32" />
    </CardFooter>
  </Card>
);

export default function MissedConnectionsView({ onNavigateHome }: MissedConnectionsViewProps) {
  const [posts, setPosts] = useState<MissedConnectionPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatePostOpen, setCreatePostOpen] = useState(false);
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const postsRef = collection(db, 'missed_connections');
    const q = query(postsRef, where('status', '==', 'approved'), orderBy('timestamp', 'desc'));

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: MissedConnectionPost[] = [];
      snapshot.forEach(doc => {
        fetchedPosts.push({ id: doc.id, ...doc.data() } as MissedConnectionPost);
      });
      setPosts(fetchedPosts);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching posts: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  return (
    <>
      <CreatePostView 
        isOpen={isCreatePostOpen}
        onOpenChange={setCreatePostOpen}
        onPostCreated={() => { /* Could trigger a refetch if needed */ }}
      />
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center justify-between p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <Button variant="ghost" size="icon" onClick={onNavigateHome}>
            <ArrowLeft className="h-5 w-5" />
            <span className="sr-only">Back to Home</span>
          </Button>
          <h1 className="text-xl font-bold">Missed Connections</h1>
          <Button onClick={() => setCreatePostOpen(true)}>
            <PlusCircle className="mr-2 h-4 w-4" />
            Create Post
          </Button>
        </header>
        <main className="flex-1 overflow-hidden">
          <ScrollArea className="h-full">
            <div className="p-4 md:p-8 space-y-6">
              {isLoading ? (
                Array.from({ length: 3 }).map((_, i) => <PostSkeleton key={i} />)
              ) : posts.length > 0 ? (
                posts.map(post => (
                  <Card key={post.id} className="bg-card/80 border-border shadow-md">
                    <CardHeader>
                      <CardTitle>{post.title}</CardTitle>
                      <CardDescription>
                        Posted by {post.authorName} - {post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'just now'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                    </CardContent>
                    <CardFooter className="flex items-center justify-start gap-4 text-sm text-muted-foreground">
                       <Badge variant="outline" className="flex items-center gap-1.5">
                          <Pin className="h-3 w-3" />
                          {post.location}
                       </Badge>
                       <Badge variant="outline" className="flex items-center gap-1.5">
                          <Clock className="h-3 w-3" />
                          {post.timeOfDay}
                       </Badge>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="text-center py-20">
                    <p className="text-lg font-semibold">No posts yet!</p>
                    <p className="text-muted-foreground">Be the first to share a missed connection.</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </>
  );
}
