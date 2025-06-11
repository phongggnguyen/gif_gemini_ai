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

const generateFramesFlow = ai.defineFlow(
  {
    name: 'generateFramesFlow',
    inputSchema: GenerateFramesInputSchema,
    outputSchema: GenerateFramesOutputSchema,
  },
  async input => {
    const frameUrls: string[] = [];
    let previousFrameUrl: string | null = null;
    const numberOfFrames = 10; // Generate 10 frames

    for (let i = 0; i < numberOfFrames; i++) {
      let promptPayload: any;
      if (previousFrameUrl) {
        // For subsequent frames, provide the previous frame as context
        promptPayload = [
          {media: {url: previousFrameUrl}},
          {text: `Generate the next frame in an animation sequence based on the refined prompt: "${input.refinedPrompt}". Critically, ensure the main subject (character, object) is highly consistent with the provided image (previous frame). Maintain style, and overall scene consistency. The image should have a white background and be in PNG format.`}
        ];
      } else {
        // For the first frame
        promptPayload = `Generate the first doodle-style image frame based on the following prompt: "${input.refinedPrompt}". The image should have a white background and be in PNG format. This is the very first frame of an animation sequence.`;
      }

      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: promptPayload,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
        },
      });

      if (media && media.url) {
        frameUrls.push(media.url);
        previousFrameUrl = media.url; // Set the current frame as previous for the next iteration
      } else {
        // Handle case where media or media.url is undefined
        console.warn(`Frame ${i+1} generation did not return a valid media URL. Prompt: ${JSON.stringify(promptPayload)}`);
        // If the first frame fails, it's unlikely subsequent ones will work well with consistency.
        if (i === 0) {
          throw new Error(`Could not generate the first frame. AI might be having trouble with the prompt: "${input.refinedPrompt}"`);
        }
        // For subsequent frames, we could try to skip, or use the last successful frame again,
        // but for simplicity, we'll throw an error if any frame fails after the first.
        throw new Error(`Failed to generate frame ${i+1} after a successful start. This might indicate an issue with maintaining consistency or a temporary AI problem.`);
      }
    }
    
    if (frameUrls.length < numberOfFrames) {
        // This case should ideally be caught by the loop's error handling, but as a fallback:
        throw new Error(`Could not generate all ${numberOfFrames} frames as requested. Only ${frameUrls.length} were created.`);
    }

    return {frameUrls};
  }
);
