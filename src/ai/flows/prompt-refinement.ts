'use server';

/**
 * @fileOverview Refines the user's initial prompt using GenAI to generate a more detailed description for creating doodle-style GIFs.
 *
 * - refinePrompt - A function that refines the prompt.
 * - RefinePromptInput - The input type for the refinePrompt function.
 * - RefinePromptOutput - The return type for the refinePrompt function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const RefinePromptInputSchema = z.object({
  originalPrompt: z
    .string()
    .describe('The original prompt provided by the user.'),
});
export type RefinePromptInput = z.infer<typeof RefinePromptInputSchema>;

const RefinePromptOutputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe(
      'The refined prompt, expanded into a more detailed description suitable for generating doodle-style images.'
    ),
});
export type RefinePromptOutput = z.infer<typeof RefinePromptOutputSchema>;

export async function refinePrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  return refinePromptFlow(input);
}

const prompt = ai.definePrompt({
  name: 'refinePromptPrompt',
  input: {schema: RefinePromptInputSchema},
  output: {schema: RefinePromptOutputSchema},
  prompt: `You are an AI assistant designed to refine prompts for generating doodle-style GIFs.

  Analyze the user's input, identify the main subject, important attributes (colors, shapes, unique characteristics).
  Expand the original prompt into a more detailed description, suitable for a simple doodle/animated style on a white background.
  Prioritize key visual elements, consider ethical factors (e.g., avoid racial labels, use neutral skin tone descriptions).
  Ensure the style is doodle/cartoonish with subtle, repetitive movements.

  Original Prompt: {{{originalPrompt}}}

  Refined Prompt:`, // Expect the LLM to continue from here
});

const refinePromptFlow = ai.defineFlow(
  {
    name: 'refinePromptFlow',
    inputSchema: RefinePromptInputSchema,
    outputSchema: RefinePromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    return {refinedPrompt: output!.refinedPrompt!};
  }
);
