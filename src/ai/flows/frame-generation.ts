
'use server';

/**
 * @fileOverview Frame generation flow using Gemini to create image frames.
 * Uses a refined prompt, an optional uploaded image, and optional style/mood.
 * Subsequent frames use the previous frame for consistency.
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
    .describe('A refined prompt suitable for generating images, incorporating style and mood.'),
  uploadedImageDataUri: z
    .string()
    .optional()
    .describe(
      "Optional. A user-uploaded image as a data URI to be used as the base for the first frame. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
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
    const numberOfFrames = 10; 

    const baseStyleInstruction = input.selectedStyle ? `The desired art style is "${input.selectedStyle}".` : 'The desired art style is a simple "doodle" or "cartoonish" style.';
    const baseMoodInstruction = input.selectedMood ? `The overall mood should be "${input.selectedMood}".` : 'The overall mood should be neutral or as implied by the refined prompt.';

    for (let i = 0; i < numberOfFrames; i++) {
      let promptPayload: any;
      let textPromptContent: string;

      if (i === 0) { // First frame
        if (input.uploadedImageDataUri) {
          textPromptContent = `Generate the FIRST image frame. ${baseStyleInstruction} ${baseMoodInstruction} The user's detailed prompt for the animation is: "${input.refinedPrompt}". CRITICALLY, the main subject of THIS FRAME MUST be based on the provided image. Adapt the subject from the image into the requested style and mood. The image MUST have a white background and be in PNG format. This is the very first frame of an animation sequence.`;
          promptPayload = [
            {media: {url: input.uploadedImageDataUri}},
            {text: textPromptContent}
          ];
        } else {
          textPromptContent = `Generate the FIRST image frame. ${baseStyleInstruction} ${baseMoodInstruction} The frame should be based on the following detailed prompt: "${input.refinedPrompt}". The image MUST have a white background and be in PNG format. This is the very first frame of an animation sequence.`;
          promptPayload = textPromptContent;
        }
      } else { // Subsequent frames
        textPromptContent = `Generate the NEXT frame in an animation sequence. ${baseStyleInstruction} ${baseMoodInstruction} The overall animation is based on the detailed prompt: "${input.refinedPrompt}". ${input.uploadedImageDataUri ? "The very first frame was based on an image uploaded by the user, which set the appearance of the main subject." : ""} This frame MUST maintain consistency with the PREVIOUS frame provided (style, subject details, colors, and overall scene composition, fitting the requested style and mood). The image MUST have a white background and be in PNG format.`;
        if (!previousFrameUrl) {
             throw new Error(`Cannot generate frame ${i+1} without a previous frame. This should not happen.`);
        }
        promptPayload = [
          {media: {url: previousFrameUrl}}, 
          {text: textPromptContent}
        ];
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
        previousFrameUrl = media.url; 
      } else {
        const errorContext = `Frame ${i+1} generation failed. Style: ${input.selectedStyle || 'doodle'}, Mood: ${input.selectedMood || 'default'}. Refined Prompt: "${input.refinedPrompt}". Image Uploaded: ${!!input.uploadedImageDataUri}`;
        console.warn(errorContext);
        
        if (i === 0) {
          throw new Error(`Không thể tạo khung hình đầu tiên. AI có thể gặp sự cố với lời nhắc, hình ảnh, phong cách hoặc tâm trạng được cung cấp. ${errorContext}`);
        }
        throw new Error(`Không thể tạo khung hình ${i+1} sau khi đã bắt đầu thành công. Điều này có thể do sự cố duy trì tính nhất quán hoặc sự cố AI tạm thời. ${errorContext}`);
      }
    }
    
    if (frameUrls.length < numberOfFrames) {
        throw new Error(`Không thể tạo đủ ${numberOfFrames} khung hình theo yêu cầu. Chỉ có ${frameUrls.length} được tạo.`);
    }

    return {frameUrls};
  }
);

    