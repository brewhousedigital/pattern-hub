export const generateOpengraphImage = async (
  svgUrl: string,
  patternName: string,
  siteName = 'Pattern Archive',
): Promise<File> => {
  const WIDTH = 1200;
  const HEIGHT = 630;

  // Fetch and inline the SVG
  const svgText = await fetch(svgUrl).then((r) => r.text());

  // Convert SVG to a bitmap via an offscreen Image
  const svgBlob = new Blob([svgText], { type: 'image/svg+xml' });
  const svgObjectUrl = URL.createObjectURL(svgBlob);

  const svgBitmap = await new Promise<HTMLImageElement>((resolve, reject) => {
    const img = new Image();
    img.onload = () => resolve(img);
    img.onerror = reject;
    img.src = svgObjectUrl;
  });

  URL.revokeObjectURL(svgObjectUrl);

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

  // Draw the SVG centered in the right portion
  const previewSize = 420;
  const svgX = WIDTH - previewSize - 80;
  const svgY = (HEIGHT - previewSize) / 2;

  // Subtle background tile for the SVG
  ctx.fillStyle = '#f1f8e9';
  ctx.roundRect(svgX - 24, svgY - 24, previewSize + 48, previewSize + 48, 16);
  ctx.fill();

  //ctx.drawImage(svgBitmap, svgX, svgY, previewSize, previewSize);
  const scale = Math.min(previewSize / svgBitmap.naturalWidth, previewSize / svgBitmap.naturalHeight);
  const scaledWidth = svgBitmap.naturalWidth * scale;
  const scaledHeight = svgBitmap.naturalHeight * scale;
  const centeredX = svgX + (previewSize - scaledWidth) / 2;
  const centeredY = svgY + (previewSize - scaledHeight) / 2;

  ctx.drawImage(svgBitmap, centeredX, centeredY, scaledWidth, scaledHeight);

  // Site name
  ctx.fillStyle = '#2e7d32';
  ctx.font = '500 32px system-ui, sans-serif';
  ctx.fillText(siteName, 60, 80);

  // Pattern name — wrap if long
  ctx.fillStyle = '#1a1a1a';
  ctx.font = '600 52px system-ui, sans-serif';
  const maxWidth = svgX - 100;
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
