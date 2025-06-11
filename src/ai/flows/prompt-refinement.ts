
'use server';

/**
 * @fileOverview Refines the user's initial prompt using GenAI to generate a more detailed description for creating doodle-style GIFs.
 * If an image is provided, it's used as a primary reference.
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
  uploadedImageDataUri: z
    .string()
    .optional()
    .describe(
      "Optional. A user-uploaded image as a data URI that must include a MIME type and use Base64 encoding. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
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
{{#if uploadedImageDataUri}}
An image has been provided by the user. This image is the PRIMARY VISUAL REFERENCE for the subject.
Your refined prompt MUST describe the subject from this image, and then incorporate the user's textual prompt to describe the action, context, or any modifications.
Image reference: {{media url=uploadedImageDataUri}}
{{/if}}
Analyze the user's textual input{{#if uploadedImageDataUri}} and the provided image's subject{{/if}}. Identify the main subject, its key visual attributes (colors, shapes, unique characteristics as seen in the image if provided, otherwise infer from text).
Expand the original prompt into a detailed description suitable for a simple doodle/animated style on a white background.
Prioritize key visual elements from the image if available.
Maintain a simple, doodle/cartoonish style with subtle, repetitive movements for the animation.
Consider ethical factors (e.g., avoid racial labels, use neutral skin tone descriptions if not clear from an image).

Original Textual Prompt: {{{originalPrompt}}}

Refined Prompt (ensure this describes the subject from the image if one was uploaded, performing the action from the text prompt):`,
});

const refinePromptFlow = ai.defineFlow(
  {
    name: 'refinePromptFlow',
    inputSchema: RefinePromptInputSchema,
    outputSchema: RefinePromptOutputSchema,
  },
  async input => {
    const {output} = await prompt(input);
    if (!output || !output.refinedPrompt) {
      throw new Error('AI failed to generate a refined prompt.');
    }
    return {refinedPrompt: output.refinedPrompt};
  }
);

    