'use server';
/**
 * @fileOverview A moderation flow to approve or reject "Missed Connections" posts.
 *
 * - moderateMissedConnection - A function that handles the moderation process.
 * - ModerateMissedConnectionInput - The input type for the function.
 * - ModerateMissedConnectionOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const ModerateMissedConnectionInputSchema = z.object({
  title: z.string().describe('The title of the Missed Connection post.'),
  content: z.string().describe('The content of the Missed Connection post.'),
});
export type ModerateMissedConnectionInput = z.infer<typeof ModerateMissedConnectionInputSchema>;

const ModerateMissedConnectionOutputSchema = z.object({
  decision: z.enum(['approved', 'rejected']).describe('The moderation decision.'),
  reason: z.string().describe('A brief reason for the decision, especially if rejected.'),
});
export type ModerateMissedConnectionOutput = z.infer<typeof ModerateMissedConnectionOutputSchema>;

export async function moderateMissedConnection(input: ModerateMissedConnectionInput): Promise<ModerateMissedConnectionOutput> {
  return moderateMissedConnectionFlow(input);
}

const prompt = ai.definePrompt({
  name: 'moderateMissedConnectionPrompt',
  input: {schema: ModerateMissedConnectionInputSchema},
  output: {schema: ModerateMissedConnectionOutputSchema},
  prompt: `You are a content moderator for a campus chat app. Your task is to review "Missed Connections" posts.
  The rules are:
  1. The post must be positive and respectful in tone.
  2. It must not contain personally identifiable information (full names, phone numbers, exact addresses, social media handles).
  3. It must not contain hateful, harassing, or explicit content.
  4. It should be a genuine attempt at a "missed connection" and not spam.

  Review the following post and decide if it should be 'approved' or 'rejected'. Provide a brief reason.

  Title: {{{title}}}
  Content: {{{content}}}
  `,
});

const moderateMissedConnectionFlow = ai.defineFlow(
  {
    name: 'moderateMissedConnectionFlow',
    inputSchema: ModerateMissedConnectionInputSchema,
    outputSchema: ModerateMissedConnectionOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
