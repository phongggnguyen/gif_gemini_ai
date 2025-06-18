
'use server';

import { refinePrompt, type RefinePromptInput as RefinePromptInputType, type RefinePromptOutput } from '@/ai/flows/prompt-refinement';
import { generateFrames, type GenerateFramesInput as GenerateFramesInputType, type GenerateFramesOutput } from '@/ai/flows/frame-generation';

// Extended types for story mode
export type RefinePromptInput = RefinePromptInputType & {
  isContinuation?: boolean;
  previousSegmentRefinedPrompt?: string;
  newImageProvidedForCurrentSegment?: boolean; 
};

export type GenerateFramesInput = GenerateFramesInputType & {
  initialFrameReferenceDataUri?: string; 
  isFirstSegment?: boolean;
  newImageProvidedForCurrentSegment?: boolean; 
  lastFrameOfPreviousSegmentDataUri?: string; 
};


// Helper function to safely get a string message from an unknown error type
function getErrorMessage(error: unknown, defaultMessage: string): string {
  let rawMessage = '';
  if (typeof error === 'string') {
    rawMessage = error;
  } else if (error instanceof Error && typeof error.message === 'string') {
    rawMessage = error.message;
  } else if (typeof error === 'object' && error !== null && 'message' in error) {
    const messageValue = (error as { message: unknown }).message;
    if (typeof messageValue === 'string') {
      rawMessage = messageValue;
    }
  }

  if (rawMessage.includes('503 Service Unavailable') || rawMessage.toLowerCase().includes('model is overloaded')) {
    return 'Máy chủ AI hiện đang quá tải. Vui lòng thử lại sau ít phút.';
  }
  
  return rawMessage || defaultMessage;
}

function getErrorStack(error: unknown): string | undefined {
  if (error instanceof Error) {
    return error.stack;
  }
  return undefined;
}

export async function refineUserPrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  try {
    const validatedInput = {
      ...input,
      uploadedImageDataUri: input.uploadedImageDataUri === null ? undefined : input.uploadedImageDataUri,
      newImageProvidedForCurrentSegment: input.newImageProvidedForCurrentSegment ?? false,
    };
    const result = await refinePrompt(validatedInput);
    return result;
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Không thể tinh chỉnh lời nhắc. Vui lòng thử lại.");
    const stack = getErrorStack(error);
    
    console.error(`[refineUserPrompt Action] Error: ${message}`);
    if (stack) {
      console.error(`[refineUserPrompt Action] Stack: ${stack}`);
    }
    if (typeof error === 'object' && error !== null) {
        console.error("[refineUserPrompt Action] Raw error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } else {
        console.error("[refineUserPrompt Action] Raw error:", error);
    }
    
    throw new Error(message);
  }
}

export async function generateImageFrames(input: GenerateFramesInput): Promise<GenerateFramesOutput> {
  try {
     const validatedInput = {
      ...input,
      initialFrameReferenceDataUri: input.initialFrameReferenceDataUri === null ? undefined : input.initialFrameReferenceDataUri,
      lastFrameOfPreviousSegmentDataUri: input.lastFrameOfPreviousSegmentDataUri === null ? undefined : input.lastFrameOfPreviousSegmentDataUri,
      newImageProvidedForCurrentSegment: input.newImageProvidedForCurrentSegment ?? false,
      isFirstSegment: input.isFirstSegment ?? true,
    };
    const result = await generateFrames(validatedInput);
    return result;
  } catch (error: unknown) {
    const message = getErrorMessage(error, "Không thể tạo khung hình. Hãy đảm bảo lời nhắc của bạn mang tính mô tả và thử lại.");
    const stack = getErrorStack(error);

    console.error(`[generateImageFrames Action] Error: ${message}`);
    if (stack) {
      console.error(`[generateImageFrames Action] Stack: ${stack}`);
    }
    if (typeof error === 'object' && error !== null) {
        console.error("[generateImageFrames Action] Raw error object:", JSON.stringify(error, Object.getOwnPropertyNames(error), 2));
    } else {
        console.error("[generateImageFrames Action] Raw error:", error);
    }
    
    throw new Error(message);
  }
}
