// @ts-nocheck
// Disabled TypeScript checking for this file as gifenc types might not be perfectly aligned
// and the focus is on demonstrating usage.

import { GIFEncoder, quantize, applyPalette } from 'gifenc';

const DEFAULT_FPS = 4;

export interface TextOverlayOptions {
  text: string;
  fontFamily: string;
  color: string;
  position: 'top-center' | 'middle-center' | 'bottom-center';
  fontSize?: number; // Optional: if not provided, will be calculated dynamically
}

export async function createGifFromPngs(
  pngDataUrls: string[],
  fps: number = DEFAULT_FPS,
  textOverlay?: TextOverlayOptions
): Promise<string> {
  if (pngDataUrls.length === 0) {
    throw new Error('No frames provided to create GIF.');
  }

  const delay = 1000 / fps;
  const gif = GIFEncoder();

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

    if (textOverlay && textOverlay.text.trim() !== '') {
      const fontSize = textOverlay.fontSize || Math.max(16, Math.min(Math.floor(width / 18), Math.floor(height / 12)));
      ctx.font = `bold ${fontSize}px ${textOverlay.fontFamily}`;
      ctx.fillStyle = textOverlay.color;
      ctx.textAlign = 'center';
      // Add a slight stroke for better visibility, especially on complex backgrounds
      ctx.strokeStyle = '#000'; // Black stroke
      ctx.lineWidth = Math.max(1, fontSize / 20);


      let x = width / 2;
      let y;

      switch (textOverlay.position) {
        case 'top-center':
          ctx.textBaseline = 'top';
          y = height * 0.05; // 5% from top
          break;
        case 'middle-center':
          ctx.textBaseline = 'middle';
          y = height / 2;
          break;
        case 'bottom-center':
        default:
          ctx.textBaseline = 'bottom';
          y = height * 0.95; // 5% from bottom
          break;
      }
      
      // Draw stroke then fill
      if (ctx.lineWidth > 0) {
        ctx.strokeText(textOverlay.text, x, y);
      }
      ctx.fillText(textOverlay.text, x, y);
    }

    const imageData = ctx.getImageData(0, 0, width, height);
    
    // It's important to use a palette that includes the text color,
    // or text might get quantized to an unexpected color.
    // For simplicity, we're still using a 256 color palette.
    // More advanced usage might involve creating a custom palette.
    const palette = quantize(imageData.data, 256, { format: 'rgba4444', oneBitAlpha: true });
    const index = applyPalette(imageData.data, palette, 'rgba4444');
    
    gif.writeFrame(index, width, height, { palette, delay, transparent: true });
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
