
'use server';

/**
 * @fileOverview Refines the user's prompt.
 * If it's a continuation of a story, it uses the previous segment's context.
 * If an image is provided (initial, or last frame of prev segment, or new upload for current segment), it's used as a primary reference.
 * Incorporates selected style and mood.
 * If new image provided for current segment, it's prioritized for new subjects.
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
  uploadedImageDataUri: z 
    .string()
    .optional()
    .describe(
      "Optional. A primary reference image as a data URI. For the first segment, this is the user's initial upload. For continuation segments, this could be a new image uploaded by the user for *this specific segment*, or if none, it's the last frame of the previous segment. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  newImageProvidedForCurrentSegment: z.boolean().optional().default(false)
    .describe('Whether the uploadedImageDataUri for this segment is a new user upload specific to this segment.'),
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
The final animation should be on a white background and typically feature subtle, repetitive movements unless the style or action clearly dictates otherwise.
Consider ethical factors (e.g., avoid racial labels, use neutral skin tone descriptions if not clear from an image).

Target Art Style: "{{#if selectedStyle}}{{selectedStyle}}{{else}}doodle or cartoonish{{/if}}".
Target Mood: "{{#if selectedMood}}{{selectedMood}}{{else}}as per prompt or neutral{{/if}}".

{{#if isContinuation}}
  This is a continuation of an animated story.
  The previous part of the story was (this is the refined description for the previous segment): "{{{previousSegmentRefinedPrompt}}}".
  The user wants the story to continue with this new action/event for THIS CURRENT segment: "{{{originalPrompt}}}"

  {{#if uploadedImageDataUri}}
    An image has been provided as visual context for THIS CURRENT segment.
    {{#if newImageProvidedForCurrentSegment}}
      This image ({{media url=uploadedImageDataUri}}) is a NEW UPLOAD by the user, intended as a PRIMARY VISUAL REFERENCE for a NEW SUBJECT or a significant change in THIS segment.
      Your task: Create a refined prompt for THIS segment.
      1. Analyze the user's input ("{{{originalPrompt}}}") and the new uploaded image.
      2. If the user's input describes a NEW main subject appearing (e.g., "a cat joins the dog", "a flower blooms"), your refined prompt should describe the new subject based on THIS NEWLY UPLOADED IMAGE.
      3. The existing subjects/scene elements from the previous segment ("{{{previousSegmentRefinedPrompt}}}") should be described as CONTINUING, if appropriate for the story.
      4. Combine these elements (existing subjects + new subject from image + user's action) into one cohesive scene description for this segment.
      Example: If previous prompt was "A happy Shiba Inu dog is running in a field." and the user's new input is "A fluffy white cat appears and sits next to the dog." and they upload an image of a fluffy white cat, the refined prompt should be something like: "The happy Shiba Inu dog continues running in the field. A fluffy white cat, matching the appearance of the provided new image, appears and sits gracefully next to the dog. The scene maintains the established style and mood."
      5. If the user's input and new image suggest a complete scene change or replacement of the main subject, prioritize that interpretation.
    {{else}}
      This image ({{media url=uploadedImageDataUri}}) is the LAST FRAME from the PREVIOUS story segment, provided as general visual context. No new image was uploaded by the user specifically for THIS segment.
      Your task: Create a refined prompt for THIS segment.
      1. Your refined prompt MUST describe the scene CONTINUING from the visual context of this provided image (last frame of previous segment) and the previous story context ("{{{previousSegmentRefinedPrompt}}}").
      2. Incorporate the user's new action/event ("{{{originalPrompt}}}").
      3. Maintain consistency with the overall story, subject appearance (from previous context), art style, and mood.
    {{/if}}
  {{else}}
    No specific image reference was provided for this continuing segment (other than the context from the previous refined prompt). Describe the scene based on the previous story context and the new user input.
  {{/if}}
  Refined Prompt for this CONTINUING segment:
{{else}}
  This is the FIRST segment of a new animation.
  {{#if uploadedImageDataUri}}
    An image has been provided by the user to define the main subject for the START of the story. This image is the PRIMARY VISUAL REFERENCE.
    Image reference for initial subject: {{media url=uploadedImageDataUri}}
    User's textual input for the first segment: "{{{originalPrompt}}}"
    Your task: Create a detailed, refined prompt for this FIRST animation segment.
    1. The main subject's appearance MUST be based on the provided image.
    2. Expand the user's input ("{{{originalPrompt}}}") to describe the action or context for this subject.
    3. Incorporate the target art style and mood.
  {{else}}
    User's textual input for the first segment: "{{{originalPrompt}}}"
    Your task: Create a detailed, refined prompt for this FIRST animation segment.
    1. Infer the main subject and its key visual attributes from the text.
    2. Expand the user's input into a detailed description suitable for an animated sequence.
    3. Incorporate the target art style and mood.
  {{/if}}
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
