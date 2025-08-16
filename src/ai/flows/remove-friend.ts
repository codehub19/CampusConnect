
'use server';
/**
 * @fileOverview A secure flow to finalize removing a friend.
 *
 * - removeFriend - Updates the other user's friend list after a removal.
 * - RemoveFriendInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin';
import { arrayRemove } from 'firebase-admin/firestore';


const RemoveFriendInputSchema = z.object({
  removerId: z.string().describe('The ID of the user who initiated the removal.'),
  removedId: z.string().describe('The ID of the user being removed.'),
});
export type RemoveFriendInput = z.infer<typeof RemoveFriendInputSchema>;

export async function removeFriend(input: RemoveFriendInput): Promise<void> {
  return removeFriendFlow(input);
}

const removeFriendFlow = ai.defineFlow(
  {
    name: 'removeFriendFlow',
    inputSchema: RemoveFriendInputSchema,
    outputSchema: z.void(),
  },
  async ({ removerId, removedId }) => {
    try {
      // This flow runs with admin privileges, so it can securely update
      // the document of the user who was removed.
      const removedUserRef = adminDb.collection('users').doc(removedId);
      
      // Remove the remover's ID from the removed user's friends list.
      await removedUserRef.update({
        friends: arrayRemove(removerId),
      });

      console.log(`Friendship removed between ${removerId} and ${removedId}.`);
    } catch (error) {
      console.error('Error in removeFriendFlow:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to finalize friend removal: ${error.message}`);
      }
      throw new Error('An unknown error occurred while finalizing the friend removal.');
    }
  }
);
