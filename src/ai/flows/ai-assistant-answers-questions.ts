// This file is machine-generated - edit at your own risk.

'use server';

/**
 * @fileOverview AI assistant for answering campus-related questions.
 *
 * - aiAssistantAnswersQuestions - A function that answers general campus-related questions.
 * - AiAssistantAnswersQuestionsInput - The input type for the aiAssistantAnswersQuestions function.
 * - AiAssistantAnswersQuestionsOutput - The return type for the aiAssistantAnswersQuestions function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const AiAssistantAnswersQuestionsInputSchema = z.object({
  question: z.string().describe('The question about campus life.'),
});
export type AiAssistantAnswersQuestionsInput = z.infer<typeof AiAssistantAnswersQuestionsInputSchema>;

const AiAssistantAnswersQuestionsOutputSchema = z.object({
  answer: z.string().describe('The answer to the question about campus life.'),
});
export type AiAssistantAnswersQuestionsOutput = z.infer<typeof AiAssistantAnswersQuestionsOutputSchema>;

export async function aiAssistantAnswersQuestions(input: AiAssistantAnswersQuestionsInput): Promise<AiAssistantAnswersQuestionsOutput> {
  return aiAssistantAnswersQuestionsFlow(input);
}

const prompt = ai.definePrompt({
  name: 'aiAssistantAnswersQuestionsPrompt',
  input: {schema: AiAssistantAnswersQuestionsInputSchema},
  output: {schema: AiAssistantAnswersQuestionsOutputSchema},
  prompt: `You are a helpful AI assistant providing information about campus life.

  Question: {{{question}}}
  Answer: `,
});

const aiAssistantAnswersQuestionsFlow = ai.defineFlow(
  {
    name: 'aiAssistantAnswersQuestionsFlow',
    inputSchema: AiAssistantAnswersQuestionsInputSchema,
    outputSchema: AiAssistantAnswersQuestionsOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return output!;
  }
);
