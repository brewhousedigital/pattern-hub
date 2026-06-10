type ImageSource = { type: 'svg'; url: string } | { type: 'webp'; url: string };

export const generateOpengraphImage = async (
  source: ImageSource,
  patternName: string,
  siteName = 'Pattern Archive',
): Promise<File> => {
  const WIDTH = 1200;
  const HEIGHT = 630;

  // Load the preview image - SVG needs to be fetched and re-blobbed so it
  // renders correctly cross-origin; WebP (and other bitmaps) can be loaded
  // directly via a regular Image with crossOrigin set.
  const previewBitmap = await (source.type === 'svg' ? loadSvgAsImage(source.url) : loadBitmapImage(source.url));

  const canvas = document.createElement('canvas');
  canvas.width = WIDTH;
  canvas.height = HEIGHT;
  const ctx = canvas.getContext('2d')!;

  // Background
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, WIDTH, HEIGHT);

  // Green accent bar on the left
  ctx.fillStyle = '#2e7d32';
  ctx.fillRect(0, 0, 8, HEIGHT);

  // Draw the preview image centered in the right portion
  const previewSize = 420;
  const imgX = WIDTH - previewSize - 80;
  const imgY = (HEIGHT - previewSize) / 2;

  // Subtle background tile for the preview
  ctx.fillStyle = '#f1f8e9';
  ctx.roundRect(imgX - 24, imgY - 24, previewSize + 48, previewSize + 48, 16);
  ctx.fill();

  const scale = Math.min(previewSize / previewBitmap.naturalWidth, previewSize / previewBitmap.naturalHeight);
  const scaledWidth = previewBitmap.naturalWidth * scale;
  const scaledHeight = previewBitmap.naturalHeight * scale;
  const centeredX = imgX + (previewSize - scaledWidth) / 2;
  const centeredY = imgY + (previewSize - scaledHeight) / 2;

  ctx.drawImage(previewBitmap, centeredX, centeredY, scaledWidth, scaledHeight);

  // Site name
  ctx.fillStyle = '#2e7d32';
  ctx.font = '500 32px system-ui, sans-serif';
  ctx.fillText(siteName, 60, 80);

  // Pattern name - wrap if long
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '600 52px system-ui, sans-serif';
  const maxWidth = imgX - 100;
  wrapText(ctx, patternName, 60, HEIGHT / 2 - 20, maxWidth, 64);

  // Bottom label
  ctx.fillStyle = '#888';
  ctx.font = '400 30px system-ui, sans-serif';
  ctx.fillText('View pattern →', 60, HEIGHT - 60);

  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => {
      if (!blob) return reject(new Error('Canvas toBlob failed'));
      resolve(new File([blob], 'og-image.png', { type: 'image/png' }));
    }, 'image/png');
  });
};

// SVG must be fetched and converted to a blob URL so the browser renders it
// correctly - direct cross-origin SVG URLs are often blocked by canvas tainting.
async function loadSvgAsImage(url: string): Promise<HTMLImageElement> {
  const svgText = await fetch(url).then((r) => r.text());
  const blob = new Blob([svgText], { type: 'image/svg+xml' });
  const objectUrl = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(objectUrl);
      resolve(img);
    };
    img.onerror = () => {
      URL.revokeObjectURL(objectUrl);
      reject(new Error('Failed to load SVG'));
    };
    img.src = objectUrl;
  });
}

// Bitmaps (WebP, PNG, JPEG …) load directly. crossOrigin is required if the
// file is served from a different origin (e.g. a PocketBase storage URL),
// otherwise canvas.toBlob() will throw a tainted-canvas security error.
async function loadBitmapImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load bitmap image'));
    img.src = url;
  });
}

function wrapText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeight: number,
) {
  const words = text.split(' ');
  let line = '';
  let currentY = y;

  for (const word of words) {
    const testLine = line ? `${line} ${word}` : word;
    if (ctx.measureText(testLine).width > maxWidth && line) {
      ctx.fillText(line, x, currentY);
      line = word;
      currentY += lineHeight;
    } else {
      line = testLine;
    }
  }
  ctx.fillText(line, x, currentY);
}
