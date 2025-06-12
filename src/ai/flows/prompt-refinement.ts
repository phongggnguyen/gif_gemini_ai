
'use server';

/**
 * @fileOverview Refines the user's initial prompt using GenAI to generate a more detailed description for creating doodle-style GIFs.
 * If an image is provided, it's used as a primary reference.
 * Incorporates selected style and mood.
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
  selectedStyle: z
    .string()
    .optional()
    .describe('Optional. The selected art style for the GIF (e.g., "pixel-art", "watercolor").'),
  selectedMood: z
    .string()
    .optional()
    .describe('Optional. The selected mood for the GIF (e.g., "joyful", "mysterious").'),
});
export type RefinePromptInput = z.infer<typeof RefinePromptInputSchema>;

const RefinePromptOutputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe(
      'The refined prompt, expanded into a more detailed description suitable for generating doodle-style images, incorporating style and mood.'
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
  prompt: `You are an AI assistant designed to refine prompts for generating GIFs.
{{#if selectedStyle}}The target art style is "{{selectedStyle}}".{{else}}The target art style is a simple "doodle" or "cartoonish" style.{{/if}}
{{#if selectedMood}}The target mood is "{{selectedMood}}".{{else}}The target mood should be inferred from the user's original prompt or be neutral/fitting for a doodle.{{/if}}

{{#if uploadedImageDataUri}}
An image has been provided by the user. This image is the PRIMARY VISUAL REFERENCE for the main subject.
Your refined prompt MUST describe the subject from this image, adapted to the target style and mood. Then, incorporate the user's textual prompt to describe the action, context, or any modifications for this subject.
Image reference: {{media url=uploadedImageDataUri}}
{{/if}}

Analyze the user's textual input{{#if uploadedImageDataUri}} and the provided image's subject{{/if}}.
Identify the main subject and its key visual attributes (colors, shapes, unique characteristics as seen in the image if provided, otherwise infer from text).
Expand the original prompt into a detailed description suitable for an animated sequence.
The final animation should be on a white background.
Prioritize key visual elements from the image if available for the subject.
The animation should typically feature subtle, repetitive movements unless the style or action clearly dictates otherwise.
Consider ethical factors (e.g., avoid racial labels, use neutral skin tone descriptions if not clear from an image).

Original Textual Prompt: {{{originalPrompt}}}

Refined Prompt (This prompt will be used to generate multiple frames. Ensure it describes the main subject, its appearance based on the uploaded image if any, the requested action from the textual prompt, and incorporates the target style "{{#if selectedStyle}}{{selectedStyle}}{{else}}doodle{{/if}}" and mood "{{#if selectedMood}}{{selectedMood}}{{else}}as per prompt{{/if}}". Focus on a clear, actionable description for image generation):`,
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

    