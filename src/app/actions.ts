
'use server';

import { refinePrompt, type RefinePromptInput as RefinePromptInputType, type RefinePromptOutput } from '@/ai/flows/prompt-refinement';
import { generateFrames, type GenerateFramesInput as GenerateFramesInputType, type GenerateFramesOutput } from '@/ai/flows/frame-generation';

// Re-exporting with potentially extended types if needed in the future,
// but for now, they match the flow types.
export type RefinePromptInput = RefinePromptInputType;
export type GenerateFramesInput = GenerateFramesInputType;

// Helper function to safely get a string message from an unknown error type
function getErrorMessage(error: unknown, defaultMessage: string): string {
  if (typeof error === 'string') {
    return error;
  }
  if (error instanceof Error && typeof error.message === 'string') {
    return error.message;
  }
  // Check for error objects that might have a message property (like Genkit errors)
  if (typeof error === 'object' && error !== null && 'message' in error && typeof (error as { message: unknown }).message === 'string') {
    return (error as { message: string }).message;
  }
  // Fallback to default message
  return defaultMessage;
}

export async function refineUserPrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  try {
    const result = await refinePrompt(input);
    return result;
  } catch (error) {
    console.error("[refineUserPrompt Action] Original error details:", JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2));
    const message = getErrorMessage(error, "Không thể tinh chỉnh lời nhắc. Vui lòng thử lại.");
    console.error("[refineUserPrompt Action] Throwing error with message:", message);
    throw new Error(message);
  }
}

export async function generateImageFrames(input: GenerateFramesInput): Promise<GenerateFramesOutput> {
  try {
    const result = await generateFrames(input);
    return result;
  } catch (error) {
    console.error("[generateImageFrames Action] Original error details:", JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2));
    const message = getErrorMessage(error, "Không thể tạo khung hình. Hãy đảm bảo lời nhắc của bạn mang tính mô tả và thử lại.");
    console.error("[generateImageFrames Action] Throwing error with message:", message);
    throw new Error(message);
  }
}
