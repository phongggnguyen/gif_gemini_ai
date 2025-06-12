
'use server';

/**
 * @fileOverview Frame generation flow.
 * For the first segment: uses refined prompt, optional uploaded image, style/mood.
 * For continuation segments: uses refined prompt (which includes story context),
 * the last frame of the previous segment as visual reference, style/mood.
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
    .describe('A detailed refined prompt for the current animation segment, incorporating story context, style, and mood.'),
  initialFrameReferenceDataUri: z // For segment 1: user's initial upload. For segment 2+: last frame of prev segment.
    .string()
    .optional()
    .describe(
      "Optional. A reference image data URI. If first segment, it's the user's upload. If continuation, it's the last frame of the previous segment. Expected format: 'data:<mimetype>;base64,<encoded_data>'."
    ),
  selectedStyle: z
    .string()
    .optional()
    .describe('Optional. The selected art style for the GIF (e.g., "pixel-art", "watercolor").'),
  selectedMood: z
    .string()
    .optional()
    .describe('Optional. The selected mood for the GIF (e.g., "joyful", "mysterious").'),
  isFirstSegment: z.boolean().optional().default(true)
    .describe('Is this the very first segment of the story/animation?'),
});
export type GenerateFramesInput = z.infer<typeof GenerateFramesInputSchema>;

const GenerateFramesOutputSchema = z.object({
  frameUrls: z.array(z.string()).describe('An array of data URIs for the generated image frames for this segment.'),
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
    let previousFrameInternalUrl: string | null = null; // Stores the last frame generated *within this current segment*
    const numberOfFrames = 10; 

    const baseStyleInstruction = input.selectedStyle && input.selectedStyle !== 'default' ? `The desired art style is "${input.selectedStyle}".` : 'The desired art style is a simple "doodle" or "cartoonish" style.';
    const baseMoodInstruction = input.selectedMood && input.selectedMood !== 'default' ? `The overall mood should be "${input.selectedMood}".` : 'The overall mood should be neutral or as implied by the refined prompt.';
    const backgroundInstruction = "The image MUST have a white background and be in PNG format."

    for (let i = 0; i < numberOfFrames; i++) {
      let promptPayload: any;
      let textPromptContent: string;

      if (i === 0) { // First frame of the CURRENT segment
        if (input.isFirstSegment) {
            if (input.initialFrameReferenceDataUri) {
                textPromptContent = `Generate the FIRST image frame for the VERY START of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The user's detailed prompt for the animation is: "${input.refinedPrompt}". CRITICALLY, the main subject of THIS FRAME MUST be based on the provided image. Adapt the subject from the image into the requested style and mood. ${backgroundInstruction} This is the very first frame of an animation sequence.`;
                promptPayload = [ {media: {url: input.initialFrameReferenceDataUri}}, {text: textPromptContent} ];
            } else {
                textPromptContent = `Generate the FIRST image frame for the VERY START of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The frame should be based on the following detailed prompt: "${input.refinedPrompt}". ${backgroundInstruction} This is the very first frame of an animation sequence.`;
                promptPayload = textPromptContent;
            }
        } else { // First frame of a CONTINUING segment
            if (input.initialFrameReferenceDataUri) { // This URI is the last frame of the previous segment
                textPromptContent = `Generate the FIRST image frame for a CONTINUING segment of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The provided image is the LAST frame of the PREVIOUS story segment. Use it as the DIRECT visual starting point for THIS new segment. The overall story description for THIS CURRENT segment is: "${input.refinedPrompt}". Ensure the subject, style, and scene flow logically from the provided image, incorporating the new actions/details from the refined prompt. ${backgroundInstruction}`;
                promptPayload = [ {media: {url: input.initialFrameReferenceDataUri}}, {text: textPromptContent} ];
            } else { // Should not happen if logic is correct (continuation implies a previous segment)
                textPromptContent = `Generate the FIRST image frame for a CONTINUING segment of an animation (but no previous frame reference was found - this is unusual). ${baseStyleInstruction} ${baseMoodInstruction} The story for this segment is: "${input.refinedPrompt}". ${backgroundInstruction}`;
                promptPayload = textPromptContent;
                console.warn("Generating continuation segment's first frame without a previous frame reference.");
            }
        }
      } else { // Subsequent frames (2nd to Nth) WITHIN the current segment
        textPromptContent = `Generate the NEXT frame in an animation sequence for the CURRENT segment. ${baseStyleInstruction} ${baseMoodInstruction} The overall story for THIS CURRENT segment is described by: "${input.refinedPrompt}". ${input.isFirstSegment && input.initialFrameReferenceDataUri ? "The very first frame of the whole animation was based on an image uploaded by the user, which set the appearance of the main subject." : ""} ${!input.isFirstSegment && input.initialFrameReferenceDataUri ? "This segment started based on the last frame of the previous segment." : ""} This frame MUST maintain consistency with the PREVIOUS frame provided (style, subject details, colors, and overall scene composition, fitting the requested style and mood for this segment). ${backgroundInstruction}`;
        if (!previousFrameInternalUrl) {
             throw new Error(`Cannot generate frame ${i+1} of current segment without a previous internal frame. This should not happen.`);
        }
        promptPayload = [
          {media: {url: previousFrameInternalUrl}}, 
          {text: textPromptContent}
        ];
      }

      const {media} = await ai.generate({
        model: 'googleai/gemini-2.0-flash-exp',
        prompt: promptPayload,
        config: {
          responseModalities: ['TEXT', 'IMAGE'],
           safetySettings: [ // Added safety settings as an example, adjust as needed
            { category: 'HARM_CATEGORY_HATE_SPEECH', threshold: 'BLOCK_ONLY_HIGH' },
            { category: 'HARM_CATEGORY_DANGEROUS_CONTENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_HARASSMENT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
            { category: 'HARM_CATEGORY_SEXUALLY_EXPLICIT', threshold: 'BLOCK_MEDIUM_AND_ABOVE' },
          ]
        },
      });

      if (media && media.url) {
        frameUrls.push(media.url);
        previousFrameInternalUrl = media.url; 
      } else {
        const errorContext = `Segment (isFirst: ${input.isFirstSegment}), Frame ${i+1} generation failed. Style: ${input.selectedStyle || 'doodle'}, Mood: ${input.selectedMood || 'default'}. Refined Prompt: "${input.refinedPrompt.substring(0,100)}...". Initial Ref Image Provided: ${!!input.initialFrameReferenceDataUri}`;
        console.warn(errorContext);
        
        if (i === 0) {
          throw new Error(`Không thể tạo khung hình đầu tiên của phân đoạn này. AI có thể gặp sự cố với lời nhắc, hình ảnh, phong cách hoặc tâm trạng được cung cấp. ${errorContext}`);
        }
        throw new Error(`Không thể tạo khung hình ${i+1} của phân đoạn này sau khi đã bắt đầu thành công. Điều này có thể do sự cố duy trì tính nhất quán hoặc sự cố AI tạm thời. ${errorContext}`);
      }
    }
    
    if (frameUrls.length < numberOfFrames) {
        throw new Error(`Không thể tạo đủ ${numberOfFrames} khung hình theo yêu cầu cho phân đoạn này. Chỉ có ${frameUrls.length} được tạo.`);
    }

    return {frameUrls};
  }
);
    
    