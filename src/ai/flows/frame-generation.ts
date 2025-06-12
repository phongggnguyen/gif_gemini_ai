
'use server';

/**
 * @fileOverview Frame generation flow.
 * For the first segment: uses refined prompt, optional uploaded image, style/mood.
 * For continuation segments: uses refined prompt (which includes story context),
 * a reference image (which could be a new user upload for this segment OR the last frame of the previous segment), style/mood.
 * Crucially, for continuations, it also considers the `lastFrameOfPreviousSegmentDataUri` to maintain existing subjects.
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
  initialFrameReferenceDataUri: z
    .string()
    .optional()
    .describe(
      "Optional. For the FIRST segment, this is the user's initial upload. For CONTINUATION segments, this is THE primary visual reference for THIS segment. It could be a NEW image uploaded by the user for THIS specific segment, OR if no new image, it will be the last frame of the previous segment."
    ),
  lastFrameOfPreviousSegmentDataUri: z
    .string()
    .optional()
    .describe(
      "Optional. Only used for continuation segments for contextual reference in the refinedPrompt. This is the data URI of the last frame from the IMMEDIATELY PRECEDING segment."
    ),
  newImageProvidedForCurrentSegment: z.boolean().optional().default(false)
    .describe('Whether the initialFrameReferenceDataUri for this segment is a new user upload specific to this current segment.'),
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
  async (input) => {
    const frameUrls: string[] = [];
    let previousFrameInternalUrl: string | null = null;
    const numberOfFrames = 10;

    const baseStyleInstruction = input.selectedStyle && input.selectedStyle !== 'default' ? `The desired art style is "${input.selectedStyle}".` : 'The desired art style is a simple "doodle" or "cartoonish" style.';
    const baseMoodInstruction = input.selectedMood && input.selectedMood !== 'default' ? `The overall mood should be "${input.selectedMood}".` : 'The overall mood should be neutral or as implied by the refined prompt.';
    const backgroundInstruction = "The image MUST have a white background and be in PNG format."

    for (let i = 0; i < numberOfFrames; i++) {
      let textPromptContent: string;
      let promptPayload: any;

      if (i === 0) { // First frame of the CURRENT segment
        if (input.isFirstSegment) { // Very first segment of the entire story
            if (input.initialFrameReferenceDataUri) {
                textPromptContent = `Generate the FIRST image frame for the VERY START of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The user's detailed prompt for the animation is: "${input.refinedPrompt}". CRITICALLY, the main subject of THIS FRAME MUST be based on the provided image (see media input). Adapt the subject from the image into the requested style and mood. ${backgroundInstruction} This is the very first frame of an animation sequence.`;
                promptPayload = [ {media: {url: input.initialFrameReferenceDataUri}}, {text: textPromptContent} ];
            } else { // No initial image uploaded for the story
                textPromptContent = `Generate the FIRST image frame for the VERY START of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The frame should be based on the following detailed prompt: "${input.refinedPrompt}". ${backgroundInstruction} This is the very first frame of an animation sequence.`;
                promptPayload = textPromptContent;
            }
        } else { // First frame of a CONTINUING segment (not the very first segment of the story)
            if (input.newImageProvidedForCurrentSegment && input.initialFrameReferenceDataUri) {
                // New image uploaded for THIS segment. initialFrameReferenceDataUri IS the new image.
                // The refinedPrompt was already created with knowledge of lastFrameOfPreviousSegmentDataUri for context.
                textPromptContent = `You are generating the FIRST image frame of a CONTINUING animation segment.
The detailed refined story for THIS segment is: "${input.refinedPrompt}".
${baseStyleInstruction} ${baseMoodInstruction} ${backgroundInstruction}
A NEW image has been uploaded by the user for THIS specific segment (see media input). This image is the PRIMARY VISUAL REFERENCE for any NEW subjects or significant changes described in "${input.refinedPrompt}".
The refined prompt was created considering the previous scene's context. Now, render THIS frame:
1. If "${input.refinedPrompt}" describes a NEW subject, draw that NEW subject based on the NEWLY UPLOADED image (media input).
2. Any existing subjects (implied by the continuity in "${input.refinedPrompt}") should be drawn consistently with the style and mood, based on their description in the refined prompt.
3. If the new image and refined prompt imply a replacement or major overhaul of an existing subject *with the content from the new image*, prioritize that.
Ensure the new frame logically continues the story. This is the first frame of this new segment.`;
                promptPayload = [{media: {url: input.initialFrameReferenceDataUri}}, {text: textPromptContent}];

            } else if (input.initialFrameReferenceDataUri) {
                // No new image for THIS segment. initialFrameReferenceDataUri IS the last frame of the previous segment.
                 textPromptContent = `You are generating the FIRST image frame of a CONTINUING animation segment.
The detailed refined story for THIS segment is: "${input.refinedPrompt}".
${baseStyleInstruction} ${baseMoodInstruction} ${backgroundInstruction}
The image provided (see media input) is the LAST FRAME from the PREVIOUS animation segment.
Task for THIS FRAME:
1. Directly CONTINUE the scene from this provided image (media input).
2. Evolve this scene according to "${input.refinedPrompt}". Maintain existing subjects from the previous frame as faithfully as possible.
Ensure the new frame logically continues the story. This is the first frame of this new segment.`;
                promptPayload = [{media: {url: input.initialFrameReferenceDataUri}}, {text: textPromptContent}];
            } else {
                 // Fallback: Should ideally not be reached if page.tsx sends initialFrameReferenceDataUri for continuations
                textPromptContent = `You are generating the FIRST frame of a CONTINUING animation segment.
The detailed refined story for THIS segment is: "${input.refinedPrompt}".
${baseStyleInstruction} ${baseMoodInstruction} ${backgroundInstruction}
No direct preceding image was explicitly provided for this specific frame generation step, so rely heavily on the refined prompt (which may have been informed by a previous image) to ensure continuity.
This is the first frame of this new segment.`;
                promptPayload = textPromptContent;
                console.warn("Frame Generation: Continuation segment's first frame generating without initialFrameReferenceDataUri. This might lead to inconsistencies.");
            }
        }
      } else { // Subsequent frames (2nd to Nth) WITHIN the current segment
        textPromptContent = `Generate the NEXT frame in an animation sequence for the CURRENT segment. ${baseStyleInstruction} ${baseMoodInstruction} The overall story for THIS CURRENT segment is described by: "${input.refinedPrompt}". This frame MUST maintain strong visual consistency with the PREVIOUS frame provided (see media input: style, all subject details, colors, and overall scene composition, fitting the requested style and mood for this segment). ${backgroundInstruction} Ensure subtle, smooth animation progression.`;
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
           safetySettings: [
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
        const errorContext = `Segment (isFirst: ${input.isFirstSegment}, newImgForSegment: ${input.newImageProvidedForCurrentSegment}), Frame ${i+1} generation failed. Style: ${input.selectedStyle || 'doodle'}, Mood: ${input.selectedMood || 'default'}. Refined Prompt: "${input.refinedPrompt.substring(0,100)}...". Initial Ref Img For Segment: ${!!input.initialFrameReferenceDataUri}, Prev Seg Last Frame: ${!!input.lastFrameOfPreviousSegmentDataUri}`;
        console.warn(errorContext);

        let userMessage = `Không thể tạo khung hình ${i+1} của phân đoạn này.`;
        if (i === 0) {
          userMessage = `Không thể tạo khung hình đầu tiên của phân đoạn này. AI có thể gặp sự cố với lời nhắc, hình ảnh, phong cách hoặc tâm trạng được cung cấp.`;
        } else {
          userMessage = `Không thể tạo khung hình ${i+1} của phân đoạn này sau khi đã bắt đầu thành công. Điều này có thể do sự cố duy trì tính nhất quán hoặc sự cố AI tạm thời.`;
        }
        throw new Error(userMessage);
      }
    }

    if (frameUrls.length < numberOfFrames) {
        throw new Error(`Không thể tạo đủ ${numberOfFrames} khung hình theo yêu cầu cho phân đoạn này. Chỉ có ${frameUrls.length} được tạo.`);
    }

    return {frameUrls};
  }
);
