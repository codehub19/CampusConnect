
'use server';
/**
 * @fileOverview A flow to generate an image for an event.
 *
 * - generateEventImage - Generates an image URL based on event details.
 * - GenerateEventImageInput - The input type for the function.
 * - GenerateEventImageOutput - The return type for the function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateEventImageInputSchema = z.object({
  title: z.string().describe('The title of the event.'),
  description: z.string().describe('The description of the event.'),
});
export type GenerateEventImageInput = z.infer<typeof GenerateEventImageInputSchema>;

const GenerateEventImageOutputSchema = z.object({
  imageUrl: z.string().describe('The URL of the generated image for the event.'),
});
export type GenerateEventImageOutput = z.infer<typeof GenerateEventImageOutputSchema>;


export async function generateEventImage(input: GenerateEventImageInput): Promise<GenerateEventImageOutput> {
  return generateEventImageFlow(input);
}

const generateEventImageFlow = ai.defineFlow(
  {
    name: 'generateEventImageFlow',
    inputSchema: GenerateEventImageInputSchema,
    outputSchema: GenerateEventImageOutputSchema,
  },
  async ({title, description}) => {
    // For now, we will use a placeholder service.
    // In a real application, you might use a service like DALL-E, Imagen, etc.
    // This flow is designed to be easily adaptable to such a service.
    
    // We can use the title and description to make the placeholder more relevant
    const keywords = `${title} ${description}`.toLowerCase();
    let theme = '4f46e5/ffffff'; // Default theme (primary/foreground)
    
    if (keywords.includes('music') || keywords.includes('festival') || keywords.includes('concert')) {
        theme = 'f59e0b/ffffff'; // Yellow
    } else if (keywords.includes('tech') || keywords.includes('startup') || keywords.includes('code') || keywords.includes('study')) {
        theme = '10b981/ffffff'; // Green
    } else if (keywords.includes('art') || keywords.includes('gallery') || keywords.includes('design')) {
        theme = 'ec4899/ffffff'; // Pink
    } else if (keywords.includes('sports') || keywords.includes('game') || keywords.includes('match') || keywords.includes('trip')) {
        theme = '3b82f6/ffffff'; // Blue
    }
    
    const imageUrl = `https://placehold.co/600x400/${theme}?text=${encodeURIComponent(title)}`;
    
    return { imageUrl };
  }
);
