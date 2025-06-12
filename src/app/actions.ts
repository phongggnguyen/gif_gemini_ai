
'use server';

import { refinePrompt, type RefinePromptInput as RefinePromptInputType, type RefinePromptOutput } from '@/ai/flows/prompt-refinement';
import { generateFrames, type GenerateFramesInput as GenerateFramesInputType, type GenerateFramesOutput } from '@/ai/flows/frame-generation';

// Re-exporting with potentially extended types if needed in the future,
// but for now, they match the flow types.
export type RefinePromptInput = RefinePromptInputType;
export type GenerateFramesInput = GenerateFramesInputType;

export async function refineUserPrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  try {
    const result = await refinePrompt(input);
    return result;
  } catch (error) {
    console.error("Error refining prompt:", error);
    const message = error instanceof Error ? error.message : "Không thể tinh chỉnh lời nhắc. Vui lòng thử lại.";
    throw new Error(message);
  }
}

export async function generateImageFrames(input: GenerateFramesInput): Promise<GenerateFramesOutput> {
  try {
    const result = await generateFrames(input);
    return result;
  } catch (error) {
    console.error("Error generating frames:", error);
    const message = error instanceof Error ? error.message : "Không thể tạo khung hình. Hãy đảm bảo lời nhắc của bạn mang tính mô tả và thử lại.";
    throw new Error(message);
  }
}

    