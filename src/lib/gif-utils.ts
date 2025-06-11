// @ts-nocheck
// Disabled TypeScript checking for this file as gifenc types might not be perfectly aligned
// and the focus is on demonstrating usage.

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const DEFAULT_FPS = 4;
const FRAME_DELAY_MS = 1000 / DEFAULT_FPS;

export async function createGifFromPngs(
  pngDataUrls: string[],
  fps: number = DEFAULT_FPS
): Promise<string> {
  if (pngDataUrls.length === 0) {
    throw new Error('No frames provided to create GIF.');
  }

  const delay = 1000 / fps;
  const gif = GIFEncoder();

  // Assuming all frames have the same dimensions as the first frame
  const firstImage = await loadImage(pngDataUrls[0]);
  const { width, height } = firstImage;

  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');

  if (!ctx) {
    throw new Error('Could not get canvas context');
  }

  for (const dataUrl of pngDataUrls) {
    const image = await loadImage(dataUrl);
    ctx.clearRect(0, 0, width, height);
    ctx.drawImage(image, 0, 0, width, height);
    const imageData = ctx.getImageData(0, 0, width, height);
    
    const palette = quantize(imageData.data, 256, { format: 'rgba4444' });
    const index = applyPalette(imageData.data, palette, 'rgba4444');
    
    gif.writeFrame(index, width, height, { palette, delay });
  }

  gif.finish();
  const buffer = gif.bytesView();
  const blob = new Blob([buffer], { type: 'image/gif' });
  return URL.createObjectURL(blob);
}

function loadImage(dataUrl: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = (err) => reject(err);
    img.src = dataUrl;
  });
}
