// convert-to-png.ts
// Strict client-side raster format conversion: fetch an image, decode it via
// the browser's native <img> support, and re-encode it as PNG at its exact
// original pixel dimensions - no resizing, no cropping, no other
// transformation. PNG encoding itself is lossless, so this doesn't touch
// image quality beyond whatever the source already had baked in.
//
// Fetches to a blob first rather than pointing <img> straight at the source
// URL, so the canvas is never cross-origin-tainted regardless of the host's
// CORS headers - same approach as PatternExport/composite.ts's svgStringToImage.
//
// Used by the admin Review Submission page to offer a PNG download for
// WebP-stored user submissions, since some admin tools don't support WebP yet.
export async function convertImageUrlToPngBlob(sourceUrl: string): Promise<Blob> {
  const sourceBlob = await fetch(sourceUrl).then((res) => {
    if (!res.ok) throw new Error(`Failed to fetch the source image (${res.status}).`);
    return res.blob();
  });

  const objectUrl = URL.createObjectURL(sourceBlob);
  try {
    const img = new Image();
    const loaded = new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Failed to decode the source image.'));
    });
    img.src = objectUrl;
    await loaded;

    const canvas = document.createElement('canvas');
    canvas.width = img.naturalWidth;
    canvas.height = img.naturalHeight;
    const ctx = canvas.getContext('2d');
    if (!ctx) throw new Error('Canvas 2D context unavailable.');
    ctx.drawImage(img, 0, 0);

    return await new Promise<Blob>((resolve, reject) => {
      canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error('PNG re-encode failed.'))), 'image/png');
    });
  } finally {
    URL.revokeObjectURL(objectUrl);
  }
}
