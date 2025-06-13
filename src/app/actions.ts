
'use server';

import { refinePrompt, type RefinePromptInput as RefinePromptInputType, type RefinePromptOutput } from '@/ai/flows/prompt-refinement';
import { generateFrames, type GenerateFramesInput as GenerateFramesInputType, type GenerateFramesOutput } from '@/ai/flows/frame-generation';

// Extended types for story mode
export type RefinePromptInput = RefinePromptInputType & {
  isContinuation?: boolean;
  previousSegmentRefinedPrompt?: string;
  newImageProvidedForCurrentSegment?: boolean; // New flag
};

export type GenerateFramesInput = GenerateFramesInputType & {
  initialFrameReferenceDataUri?: string; 
  isFirstSegment?: boolean;
  newImageProvidedForCurrentSegment?: boolean; // New flag
  lastFrameOfPreviousSegmentDataUri?: string; // New flag
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
    let errorDetails = 'Could not stringify error details.';
    try {
      errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
    } catch (stringifyError) {
      errorDetails = `Failed to stringify error. Original error might have circular references. Message: ${getErrorMessage(error, '')}`;
    }
    console.error("[refineUserPrompt Action] Original error details:", errorDetails);
    
    const message = getErrorMessage(error, "Không thể tinh chỉnh lời nhắc. Vui lòng thử lại.");
    console.error("[refineUserPrompt Action] Throwing error with message:", message);
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
    let errorDetails = 'Could not stringify error details.';
    try {
      errorDetails = JSON.stringify(error, Object.getOwnPropertyNames(error || {}), 2);
    } catch (stringifyError) {
      errorDetails = `Failed to stringify error. Original error might have circular references. Message: ${getErrorMessage(error, '')}`;
    }
    console.error("[generateImageFrames Action] Original error details:", errorDetails);

    const message = getErrorMessage(error, "Không thể tạo khung hình. Hãy đảm bảo lời nhắc của bạn mang tính mô tả và thử lại.");
    console.error("[generateImageFrames Action] Throwing error with message:", message);
    throw new Error(message);
  }
}

