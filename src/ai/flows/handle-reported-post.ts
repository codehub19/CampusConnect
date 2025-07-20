
'use server';
/**
 * @fileOverview A flow to handle a post that has been reported multiple times.
 * 
 * - handleReportedPost - Deletes the post and restricts the author for 24 hours.
 * - HandleReportedPostInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { getFirestore, doc, deleteDoc, collection, getDocs, writeBatch, setDoc, serverTimestamp, Timestamp } from 'firebase/firestore';
import { firebaseApp } from '@/lib/firebase';

const HandleReportedPostInputSchema = z.object({
  postId: z.string().describe('The ID of the post to be handled.'),
  authorId: z.string().describe('The ID of the author of the post.'),
});
export type HandleReportedPostInput = z.infer<typeof HandleReportedPostInputSchema>;

export async function handleReportedPost(input: HandleReportedPostInput): Promise<void> {
  return handleReportedPostFlow(input);
}

const handleReportedPostFlow = ai.defineFlow(
  {
    name: 'handleReportedPostFlow',
    inputSchema: HandleReportedPostInputSchema,
    outputSchema: z.void(),
  },
  async ({ postId, authorId }) => {
    const db = getFirestore(firebaseApp);

    try {
      // 1. Delete the post and its subcollections (comments, reports)
      const postRef = doc(db, 'missed_connections', postId);
      
      const commentsRef = collection(postRef, 'comments');
      const commentsSnapshot = await getDocs(commentsRef);
      const reportsRef = collection(postRef, 'reports');
      const reportsSnapshot = await getDocs(reportsRef);
      
      const batch = writeBatch(db);
      
      commentsSnapshot.forEach((doc) => batch.delete(doc.ref));
      reportsSnapshot.forEach((doc) => batch.delete(doc.ref));
      batch.delete(postRef);
      
      await batch.commit();

      // 2. Restrict the author from posting for 24 hours
      const restrictionRef = doc(db, 'post_restrictions', authorId);
      const now = Timestamp.now();
      const expires = new Timestamp(now.seconds + 24 * 60 * 60, now.nanoseconds);
      
      await setDoc(restrictionRef, {
        userId: authorId,
        expires: expires,
        timestamp: serverTimestamp(),
      });
      
      console.log(`Post ${postId} deleted and author ${authorId} restricted.`);

    } catch (error) {
      console.error('Error handling reported post:', error);
      // We can re-throw the error if we want the caller to be aware of the failure.
      throw new Error(`Failed to handle reported post: ${error.message}`);
    }
  }
);
