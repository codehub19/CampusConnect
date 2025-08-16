
'use server';
/**
 * @fileOverview A secure flow to finalize a friend request acceptance.
 *
 * - acceptFriendRequest - Updates the requester's friend list after an acceptance.
 * - AcceptFriendRequestInput - The input type for the function.
 */

import { ai } from '@/ai/genkit';
import { z } from 'genkit';
import { adminDb } from '@/lib/firebase-admin';
import { arrayUnion } from 'firebase/firestore';


const AcceptFriendRequestInputSchema = z.object({
  requesterId: z.string().describe('The ID of the user who sent the friend request.'),
  accepterId: z.string().describe('The ID of the user who accepted the request.'),
});
export type AcceptFriendRequestInput = z.infer<typeof AcceptFriendRequestInputSchema>;

export async function acceptFriendRequest(input: AcceptFriendRequestInput): Promise<void> {
  return acceptFriendRequestFlow(input);
}

const acceptFriendRequestFlow = ai.defineFlow(
  {
    name: 'acceptFriendRequestFlow',
    inputSchema: AcceptFriendRequestInputSchema,
    outputSchema: z.void(),
  },
  async ({ requesterId, accepterId }) => {
    try {
      // This flow runs with admin privileges, so it can securely update
      // the document of the user who *sent* the request.
      const requesterUserRef = adminDb.collection('users').doc(requesterId);
      
      // Add the accepter's ID to the requester's friends list.
      await requesterUserRef.update({
        friends: arrayUnion(accepterId),
      });

      console.log(`Friendship finalized between ${requesterId} and ${accepterId}.`);
    } catch (error) {
      console.error('Error in acceptFriendRequestFlow:', error);
      if (error instanceof Error) {
        throw new Error(`Failed to finalize friend request: ${error.message}`);
      }
      throw new Error('An unknown error occurred while finalizing the friend request.');
    }
  }
);
