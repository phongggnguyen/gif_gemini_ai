
'use server';

/**
 * @fileOverview Refines the user's prompt.
 * If it's a continuation of a story, it uses the previous segment's context.
 * If an image is provided (initial or last frame of prev segment), it's used as a primary reference.
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
    .describe('The original prompt for the first segment, or the user input for what happens next in a story.'),
  uploadedImageDataUri: z // For first segment: user's image. For continuation: last frame of previous segment.
    .string()
    .optional()
    .describe(
      "Optional. A reference image as a data URI. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  selectedStyle: z
    .string()
    .optional()
    .describe('Optional. The selected art style for the GIF (e.g., "pixel-art", "watercolor").'),
  selectedMood: z
    .string()
    .optional()
    .describe('Optional. The selected mood for the GIF (e.g., "joyful", "mysterious").'),
  isContinuation: z.boolean().optional().default(false)
    .describe('Whether this is a continuation of a story.'),
  previousSegmentRefinedPrompt: z.string().optional()
    .describe('The refined prompt of the previous story segment, if this is a continuation.')
});
export type RefinePromptInput = z.infer<typeof RefinePromptInputSchema>;

const RefinePromptOutputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe(
      'The refined prompt, expanded into a more detailed description suitable for generating images, incorporating style, mood, and story context.'
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
  prompt: `You are an AI assistant designed to refine prompts for generating animated GIF segments.
The final animation should be on a white background.
The animation should typically feature subtle, repetitive movements unless the style or action clearly dictates otherwise.
Consider ethical factors (e.g., avoid racial labels, use neutral skin tone descriptions if not clear from an image).

Target Art Style: "{{#if selectedStyle}}{{selectedStyle}}{{else}}doodle or cartoonish{{/if}}".
Target Mood: "{{#if selectedMood}}{{selectedMood}}{{else}}as per prompt or neutral{{/if}}".

{{#if isContinuation}}
  This is a continuation of an animated story.
  The previous part of the story was (this is the refined description for the previous segment): "{{{previousSegmentRefinedPrompt}}}".
  {{#if uploadedImageDataUri}}
  An image representing the FINAL SCENE of the PREVIOUS story segment is provided. This image is the PRIMARY VISUAL STARTING POINT for THIS NEW segment.
  Your refined prompt MUST describe the subject and scene CONTINUING DIRECTLY from this provided image, adapting to the new user input.
  Image reference of previous segment's end: {{media url=uploadedImageDataUri}}
  {{/if}}
  The user wants the story to continue with this new action/event: "{{{originalPrompt}}}"
  
  Your task: Create a refined prompt for the NEXT segment. This prompt should:
  1. Describe the scene starting from the visual context of the provided image (if any).
  2. Incorporate the user's new action/event ("{{{originalPrompt}}}").
  3. Maintain consistency with the overall story, subject appearance, art style ("{{#if selectedStyle}}{{selectedStyle}}{{else}}doodle{{/if}}"), and mood ("{{#if selectedMood}}{{selectedMood}}{{else}}as per prompt{{/if}}").
  4. Clearly describe the visual elements and actions for this new segment.
  Refined Prompt for this CONTINUING segment:
{{else}}
  This is the FIRST segment of a new animation.
  {{#if uploadedImageDataUri}}
  An image has been provided by the user to define the main subject for the START of the story. This image is the PRIMARY VISUAL REFERENCE.
  Your refined prompt MUST describe the subject from this image, adapted to the target style and mood. Then, incorporate the user's textual prompt to describe the action or context for this subject.
  Image reference for initial subject: {{media url=uploadedImageDataUri}}
  {{/if}}
  User's textual input for the first segment: "{{{originalPrompt}}}"

  Your task: Create a detailed, refined prompt for this FIRST animation segment.
  1. Identify the main subject and its key visual attributes (from the image if provided, otherwise infer from text).
  2. Expand the user's input into a detailed description suitable for an animated sequence.
  3. Incorporate the target art style ("{{#if selectedStyle}}{{selectedStyle}}{{else}}doodle{{/if}}") and mood ("{{#if selectedMood}}{{selectedMood}}{{else}}as per prompt{{/if}}").
  Refined Prompt for this FIRST segment:
{{/if}}`,
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
    
    