
"use client";

import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Card, CardHeader, CardTitle, CardDescription, CardContent, CardFooter } from '@/components/ui/card';
import { ArrowLeft, PlusCircle, Pin, Clock, MessageSquare, AlertTriangle, Send } from 'lucide-react';
import { ScrollArea } from '@/components/ui/scroll-area';
import { Badge } from '@/components/ui/badge';
import { getFirestore, collection, query, where, onSnapshot, orderBy, doc, addDoc, serverTimestamp, runTransaction, getDoc, writeBatch, deleteDoc, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';
import type { MissedConnectionPost, MissedConnectionComment } from '@/lib/types';
import { formatDistanceToNow } from 'date-fns';
import { Skeleton } from '@/components/ui/skeleton';
import CreatePostView from './create-post-view';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/components/ui/accordion';
import { Textarea } from '@/components/ui/textarea';
import { useAuth } from '@/hooks/use-auth';
import { useToast } from '@/hooks/use-toast';
import { handleReportedPost } from '@/ai/flows/handle-reported-post';


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

const CommentSection = ({ postId }: { postId: string }) => {
  const [comments, setComments] = useState<MissedConnectionComment[]>([]);
  const [newComment, setNewComment] = useState("");
  const { user } = useAuth();
  const db = getFirestore(firebaseApp);

  useEffect(() => {
    const commentsRef = collection(db, 'missed_connections', postId, 'comments');
    const q = query(commentsRef, orderBy('timestamp', 'asc'));
    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedComments = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() } as MissedConnectionComment));
      setComments(fetchedComments);
    });
    return () => unsubscribe();
  }, [db, postId]);

  const handleAddComment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!user || !newComment.trim()) return;
    
    const commentsRef = collection(db, 'missed_connections', postId, 'comments');
    await addDoc(commentsRef, {
      authorId: user.uid,
      text: newComment.trim(),
      timestamp: serverTimestamp(),
    });
    setNewComment("");
  };

  return (
    <AccordionItem value={`comments-${postId}`}>
      <AccordionTrigger>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <MessageSquare className="h-4 w-4" />
          <span>Comments ({comments.length})</span>
        </div>
      </AccordionTrigger>
      <AccordionContent>
        <div className="space-y-4 pt-2">
          {comments.map(comment => (
            <div key={comment.id} className="text-sm">
              <p className="text-foreground/90 bg-secondary p-2 rounded-md">{comment.text}</p>
              <p className="text-xs text-muted-foreground mt-1">
                Posted by an anonymous user {comment.timestamp ? formatDistanceToNow(comment.timestamp.toDate(), { addSuffix: true }) : ''}
              </p>
            </div>
          ))}
          {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet.</p>}
          <form onSubmit={handleAddComment} className="flex gap-2 pt-4">
            <Textarea 
              placeholder="Add an anonymous comment..." 
              value={newComment}
              onChange={(e) => setNewComment(e.target.value)}
              rows={1}
              className="resize-none"
            />
            <Button type="submit" size="icon" disabled={!newComment.trim()}>
              <Send className="h-4 w-4"/>
            </Button>
          </form>
        </div>
      </AccordionContent>
    </AccordionItem>
  )
}

export default function MissedConnectionsView({ onNavigateHome }: MissedConnectionsViewProps) {
  const [posts, setPosts] = useState<MissedConnectionPost[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [isCreatePostOpen, setCreatePostOpen] = useState(false);
  const db = getFirestore(firebaseApp);
  const { user } = useAuth();
  const { toast } = useToast();

  useEffect(() => {
    const fortyEightHoursAgo = Timestamp.fromMillis(Date.now() - 48 * 60 * 60 * 1000);
    const postsRef = collection(db, 'missed_connections');
    const q = query(
        postsRef, 
        orderBy('timestamp', 'desc'),
        where('timestamp', '>', fortyEightHoursAgo)
    );

    const unsubscribe = onSnapshot(q, (snapshot) => {
      const fetchedPosts: MissedConnectionPost[] = [];
      snapshot.forEach(doc => {
        const post = { id: doc.id, ...doc.data() } as MissedConnectionPost;
        // Filter for approved posts on the client side
        if (post.status === 'approved') {
          fetchedPosts.push(post);
        }
      });
      setPosts(fetchedPosts);
      setIsLoading(false);
    }, (error) => {
      console.error("Error fetching posts: ", error);
      setIsLoading(false);
    });

    return () => unsubscribe();
  }, [db]);

  const handleReportPost = async (post: MissedConnectionPost) => {
    if (!user) return;
    const reportRef = doc(db, 'missed_connections', post.id, 'reports', user.uid);
    const postRef = doc(db, 'missed_connections', post.id);

    try {
      await runTransaction(db, async (transaction) => {
        const reportDoc = await transaction.get(reportRef);
        if (reportDoc.exists()) {
          throw new Error("You have already reported this post.");
        }
        
        const postDoc = await transaction.get(postRef);
        if (!postDoc.exists()) {
          throw new Error("This post no longer exists.");
        }

        const currentReportCount = postDoc.data().reportCount || 0;
        const newReportCount = currentReportCount + 1;
        
        transaction.set(reportRef, { timestamp: serverTimestamp() });
        transaction.update(postRef, { reportCount: newReportCount });
        
        return newReportCount;
      }).then(async (newReportCount) => {
         toast({ title: "Post Reported", description: "Thank you for your feedback." });
         if (newReportCount !== undefined && newReportCount >= 10) {
            await handleReportedPost({ postId: post.id, authorId: post.authorId });
            toast({ variant: 'destructive', title: "Post Removed", description: "This post has been removed due to multiple reports." });
         }
      });
    } catch (error: any) {
        toast({ variant: 'destructive', title: "Report Failed", description: error.message });
    }
  };

  return (
    <>
      <CreatePostView 
        isOpen={isCreatePostOpen}
        onOpenChange={setCreatePostOpen}
      />
      <div className="flex flex-col h-screen bg-background text-foreground">
        <header className="flex items-center p-4 border-b border-border sticky top-0 bg-background/80 backdrop-blur-sm z-10">
          <div className="w-1/3">
            <Button variant="ghost" size="icon" onClick={onNavigateHome}>
              <ArrowLeft className="h-5 w-5" />
              <span className="sr-only">Back to Home</span>
            </Button>
          </div>
          <h1 className="text-xl font-bold w-1/3 text-center truncate">Missed Connections</h1>
          <div className="w-1/3 flex justify-end">
            <Button onClick={() => setCreatePostOpen(true)} size="sm">
              <PlusCircle className="mr-2 h-4 w-4" />
              Create
            </Button>
          </div>
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
                        Posted by an anonymous user - {post.timestamp ? formatDistanceToNow(post.timestamp.toDate(), { addSuffix: true }) : 'just now'}
                      </CardDescription>
                    </CardHeader>
                    <CardContent>
                      <p className="text-foreground/90 whitespace-pre-wrap">{post.content}</p>
                    </CardContent>
                    <CardFooter className="flex-col items-start gap-4">
                      <div className="flex items-center justify-start gap-4 text-sm text-muted-foreground">
                        <Badge variant="outline" className="flex items-center gap-1.5">
                            <Pin className="h-3 w-3" />
                            {post.location}
                        </Badge>
                        <Badge variant="outline" className="flex items-center gap-1.5">
                            <Clock className="h-3 w-3" />
                            {post.timeOfDay}
                        </Badge>
                         <Button variant="ghost" size="icon" className="h-8 w-8 ml-auto text-muted-foreground hover:text-destructive" onClick={() => handleReportPost(post)}>
                          <AlertTriangle className="h-4 w-4"/>
                          <span className="sr-only">Report Post</span>
                        </Button>
                      </div>
                       <Accordion type="single" collapsible className="w-full">
                         <CommentSection postId={post.id} />
                       </Accordion>
                    </CardFooter>
                  </Card>
                ))
              ) : (
                <div className="text-center py-20">
                    <p className="text-lg font-semibold">No posts yet!</p>
                    <p className="text-muted-foreground">Be the first to share a missed connection!</p>
                </div>
              )}
            </div>
          </ScrollArea>
        </main>
      </div>
    </>
  );
}
