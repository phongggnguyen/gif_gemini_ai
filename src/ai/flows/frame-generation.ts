'use server';

/**
 * @fileOverview Frame generation flow using Gemini to create doodle-style image frames from a refined prompt.
 *
 * - generateFrames - A function that handles the frame generation process.
 * - GenerateFramesInput - The input type for the generateFrames function.
 * - GenerateFramesOutput - The return type for the generateFrames function.
 */

import {ai} from '@/ai/genkit';
import {z} from 'genkit';

const GenerateFramesInputSchema = z.object({
  refinedPrompt: z
    .string()
    .describe('A refined prompt suitable for generating doodle-style images.'),
});
export type GenerateFramesInput = z.infer<typeof GenerateFramesInputSchema>;

const GenerateFramesOutputSchema = z.object({
  frameUrls: z.array(z.string()).describe('An array of data URIs for the generated image frames.'),
});
export type GenerateFramesOutput = z.infer<typeof GenerateFramesOutputSchema>;

export async function generateFrames(input: GenerateFramesInput): Promise<GenerateFramesOutput> {
  return generateFramesFlow(input);
}

const frameGenerationPrompt = ai.definePrompt({
  name: 'frameGenerationPrompt',
  input: {schema: GenerateFramesInputSchema},
  output: {schema: z.string()},
  prompt: `Generate a doodle-style image frame based on the following prompt:\n\n{{{refinedPrompt}}}\n\nThe image should have a white background and be in PNG format. Return the image as a data URI.`,
});

const generateFramesFlow = ai.defineFlow(
  {
    name: 'generateFramesFlow',
    inputSchema: GenerateFramesInputSchema,
    outputSchema: GenerateFramesOutputSchema,
  },
  async input => {
    const frameUrls: string[] = [];
    // Generate 10 frames.  Can increase this later.
    for (let i = 0; i < 10; i++) {
      const {media} = await ai.generate({
        // IMPORTANT: ONLY the googleai/gemini-2.0-flash-exp model is able to generate images. You MUST use exactly this model to generate images.
        model: 'googleai/gemini-2.0-flash-exp',

        // simple prompt
        prompt: input.refinedPrompt,
        // OR, existing images can be provided in-context for editing, character reuse, etc.
        // prompt: [
        //   {media: {url: 'data:<mime_type>;base64,<b64_encoded_image>'}},
        //   {text: 'generate an image of this character in a jungle'},
        // ],

        config: {
          responseModalities: ['TEXT', 'IMAGE'], // MUST provide both TEXT and IMAGE, IMAGE only won't work
        },
      });

      //const {output} = await frameGenerationPrompt(input);
      frameUrls.push(media.url);
    }

    return {frameUrls};
  }
);
