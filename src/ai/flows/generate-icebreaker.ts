'use server';
/**
 * @fileOverview Generates an icebreaker message for two users based on their interests.
 *
 * - generateIcebreaker - A function that creates a conversation starter.
 * - GenerateIcebreakerInput - The input type for the generateIcebreaker function.
 * - GenerateIcebreakerOutput - The return type for the generateIcebreaker function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateIcebreakerInputSchema = z.object({
  userName1: z.string().describe('The name of the first user.'),
  interests1: z.array(z.string()).describe('A list of interests for the first user.'),
  userName2: z.string().describe('The name of the second user.'),
  interests2: z.array(z.string()).describe('A list of interests for the second user.'),
});
export type GenerateIcebreakerInput = z.infer<typeof GenerateIcebreakerInputSchema>;

const GenerateIcebreakerOutputSchema = z.object({
  icebreaker: z.string().describe('The generated icebreaker message.'),
});
export type GenerateIcebreakerOutput = z.infer<typeof GenerateIcebreakerOutputSchema>;

export async function generateIcebreaker(input: GenerateIcebreakerInput): Promise<GenerateIcebreakerOutput> {
  return generateIcebreakerFlow(input);
}

const prompt = ai.definePrompt({
  name: 'generateIcebreakerPrompt',
  input: {schema: GenerateIcebreakerInputSchema},
  output: {schema: GenerateIcebreakerOutputSchema},
  prompt: `You are a helpful and friendly AI assistant in a chat app called CampusConnect. Your goal is to help two users, {{userName1}} and {{userName2}}, start a conversation.

Their interests are:
- {{userName1}}: {{#each interests1}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}
- {{userName2}}: {{#each interests2}}{{{this}}}{{#unless @last}}, {{/unless}}{{/each}}

Analyze their interests. Find a common interest if one exists.
Generate a single, short, and friendly icebreaker question for them to discuss.
If they have a common interest, base the question on that.
If they don't have a common interest, create a general, fun question to get them talking.
Keep the tone light and encouraging. Address them both.

Example (with common interest): "Hey both! I see you're both into Gaming. What's the best game you've played recently?"
Example (no common interest): "Hey there! Here's a fun question to get you started: If you could have any superpower, what would it be and why?"
`,
});

const generateIcebreakerFlow = ai.defineFlow(
  {
    name: 'generateIcebreakerFlow',
    inputSchema: GenerateIcebreakerInputSchema,
    outputSchema: GenerateIcebreakerOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
