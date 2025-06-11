'use server';

import { refinePrompt, type RefinePromptInput, type RefinePromptOutput } from '@/ai/flows/prompt-refinement';
import { generateFrames, type GenerateFramesInput, type GenerateFramesOutput } from '@/ai/flows/frame-generation';

export async function refineUserPrompt(input: RefinePromptInput): Promise<RefinePromptOutput> {
  try {
    const result = await refinePrompt(input);
    return result;
  } catch (error) {
    console.error("Error refining prompt:", error);
    // Consider returning a more specific error structure if needed
    throw new Error("Failed to refine prompt. Please try again.");
  }
}

export async function generateImageFrames(input: GenerateFramesInput): Promise<GenerateFramesOutput> {
  try {
    const result = await generateFrames(input);
    return result;
  } catch (error) {
    console.error("Error generating frames:", error);
    // Consider returning a more specific error structure if needed
    throw new Error("Failed to generate frames. Please ensure your prompt is descriptive and try again.");
  }
}
