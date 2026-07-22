// Renders the first page of a PDF to a PNG File entirely in the browser, so the
// Netlify function never has to deal with PDF parsing/rasterization.

const MAX_DIMENSION = 3000; // cap the rendered canvas so huge PDFs don't produce enormous PNGs

export class MultiPagePdfError extends Error {
  pageCount: number;

  constructor(pageCount: number) {
    super(`PDF has ${pageCount} pages`);
    this.name = 'MultiPagePdfError';
    this.pageCount = pageCount;
  }
}

export async function convertPdfFirstPageToImageFile(file: File): Promise<File> {
  const pdfjsLib = await import('pdfjs-dist');
  pdfjsLib.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

  const buffer = await file.arrayBuffer();
  const loadingTask = pdfjsLib.getDocument({ data: buffer });
  const doc = await loadingTask.promise;

  try {
    if (doc.numPages > 1) {
      throw new MultiPagePdfError(doc.numPages);
    }

    const page = await doc.getPage(1);
    const baseViewport = page.getViewport({ scale: 1 });
    const scale = Math.min(MAX_DIMENSION / baseViewport.width, MAX_DIMENSION / baseViewport.height, 3);
    const viewport = page.getViewport({ scale: Math.max(scale, 1) });

    const canvas = document.createElement('canvas');
    canvas.width = Math.round(viewport.width);
    canvas.height = Math.round(viewport.height);
    const context = canvas.getContext('2d');
    if (!context) throw new Error('Could not create canvas context to render PDF.');

    // White background - PDFs with transparency would otherwise render on a black canvas
    context.fillStyle = '#ffffff';
    context.fillRect(0, 0, canvas.width, canvas.height);

    await page.render({ canvasContext: context, viewport, canvas }).promise;

    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'));
    if (!blob) throw new Error('Failed to convert rendered PDF page to an image.');

    const newName = file.name.replace(/\.[^.]+$/, '') + '.png';
    return new File([blob], newName, { type: 'image/png' });
  } finally {
    await loadingTask.destroy();
  }
}
