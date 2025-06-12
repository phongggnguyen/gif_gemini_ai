
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
      "Optional. For the FIRST segment, this is the user's initial upload. For CONTINUATION segments, this is the NEW image uploaded by the user for THIS specific segment, IF ANY. If no new image for a continuation segment, this might be undefined or could be the last frame of previous (though lastFrameOfPreviousSegmentDataUri is more specific for that)."
    ),
  lastFrameOfPreviousSegmentDataUri: z
    .string()
    .optional()
    .describe(
      "Optional. Only used for continuation segments. This is the data URI of the last frame from the IMMEDIATELY PRECEDING segment. Used to maintain consistency of existing subjects."
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
      let promptPayload: any;
      let textPromptContent: string;

      if (i === 0) { // First frame of the CURRENT segment
        if (input.isFirstSegment) { // Very first segment of the entire story
            if (input.initialFrameReferenceDataUri) { // User uploaded an initial image for the story
                textPromptContent = `Generate the FIRST image frame for the VERY START of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The user's detailed prompt for the animation is: "${input.refinedPrompt}". CRITICALLY, the main subject of THIS FRAME MUST be based on the provided image. Adapt the subject from the image into the requested style and mood. ${backgroundInstruction} This is the very first frame of an animation sequence.`;
                promptPayload = [ {media: {url: input.initialFrameReferenceDataUri}}, {text: textPromptContent} ];
            } else { // No initial image uploaded for the story
                textPromptContent = `Generate the FIRST image frame for the VERY START of an animation. ${baseStyleInstruction} ${baseMoodInstruction} The frame should be based on the following detailed prompt: "${input.refinedPrompt}". ${backgroundInstruction} This is the very first frame of an animation sequence.`;
                promptPayload = textPromptContent;
            }
        } else { // First frame of a CONTINUING segment (not the very first segment of the story)
            textPromptContent = `You are generating the FIRST image frame of a CONTINUING animation segment.
The detailed refined story for THIS segment is: "${input.refinedPrompt}".
${baseStyleInstruction} ${baseMoodInstruction} ${backgroundInstruction}

The PREVIOUS animation segment ended with this scene: {{media url="${input.lastFrameOfPreviousSegmentDataUri}"}}

{{#if newImageProvidedForCurrentSegment}}
The user ALSO uploaded a NEW image specifically for THIS current segment: {{media url="${input.initialFrameReferenceDataUri}"}}.
The refined story ("${input.refinedPrompt}") may describe a new subject appearing or a significant change.
Task for THIS FRAME:
1. Re-draw the scene from the PREVIOUS segment's last frame (using its media input) as the base. Maintain existing subjects from it as faithfully as possible in terms of appearance and position.
2. If "${input.refinedPrompt}" introduces a NEW subject, draw that NEW subject based on the NEWLY UPLOADED image (using its media input), incorporating it into the scene with the existing subjects.
3. If the new image and refined prompt imply a replacement or major overhaul of an existing subject with the new image's content, prioritize that.
4. The overall action and composition should follow "${input.refinedPrompt}".
Ensure the new frame logically continues the story, maintaining the established style and mood.
{{else}}
{{! No new image uploaded for THIS segment. initialFrameReferenceDataUri might be the same as lastFrameOfPreviousSegmentDataUri or undefined if logic upstream differs. We primarily rely on lastFrameOfPreviousSegmentDataUri for visual continuity of existing scene. }}
The refined story for THIS segment is "${input.refinedPrompt}".
Task for THIS FRAME:
1. Directly CONTINUE the scene from the PREVIOUS segment's last frame (using its media input).
2. Evolve this scene according to "${input.refinedPrompt}". Maintain existing subjects from the previous frame as faithfully as possible in appearance and position.
Ensure the new frame logically continues the story, maintaining the established style and mood.
{{/if}}
This is the first frame of this new segment. Subsequent frames in this segment will build upon this one.`;
            
            // Constructing promptPayload for continuation
            const mediaParts = [];
            if (input.lastFrameOfPreviousSegmentDataUri) { // Always include if available for continuation
                mediaParts.push({media: {url: input.lastFrameOfPreviousSegmentDataUri}});
            }
            if (input.newImageProvidedForCurrentSegment && input.initialFrameReferenceDataUri && input.initialFrameReferenceDataUri !== input.lastFrameOfPreviousSegmentDataUri) {
                 // Add the new image only if it's distinct and provided
                mediaParts.push({media: {url: input.initialFrameReferenceDataUri}});
            }
            mediaParts.push({text: textPromptContent});
            promptPayload = mediaParts;

            if (!input.lastFrameOfPreviousSegmentDataUri) {
                console.warn("Continuations segment's first frame generating without lastFrameOfPreviousSegmentDataUri. This might lead to inconsistencies with prior subjects.");
            }
        }
      } else { // Subsequent frames (2nd to Nth) WITHIN the current segment
        textPromptContent = `Generate the NEXT frame in an animation sequence for the CURRENT segment. ${baseStyleInstruction} ${baseMoodInstruction} The overall story for THIS CURRENT segment is described by: "${input.refinedPrompt}". This frame MUST maintain strong visual consistency with the PREVIOUS frame provided (style, all subject details, colors, and overall scene composition, fitting the requested style and mood for this segment). ${backgroundInstruction} Ensure subtle, smooth animation progression.`;
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
