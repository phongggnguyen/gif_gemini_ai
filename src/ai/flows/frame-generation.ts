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
    const numberOfFrames = 5; // Let's try with 5 frames for now, can be adjusted.

    for (let i = 0; i < numberOfFrames; i++) {
      let promptPayload: any = input.refinedPrompt;
      if (previousFrameUrl) {
        promptPayload = [
          {media: {url: previousFrameUrl}},
          {text: `Generate the next frame in an animation sequence based on the refined prompt: "${input.refinedPrompt}". Maintain character, style, and subject consistency with the provided image. The image should have a white background and be in PNG format.`}
        ];
      } else {
        // Initial frame prompt
        promptPayload = `Generate the first doodle-style image frame based on the following prompt: "${input.refinedPrompt}". The image should have a white background and be in PNG format.`;
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
        // Handle case where media or media.url is undefined, perhaps log an error or break
        console.warn(`Frame ${i+1} generation did not return a valid media URL.`);
        // Optionally, you could try to regenerate or skip this frame
      }
    }
    
    if (frameUrls.length === 0 && numberOfFrames > 0) {
        throw new Error('No frames could be generated. The AI might be having trouble with the prompt.');
    }


    return {frameUrls};
  }
);
