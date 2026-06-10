/**
 * Flood-fill utilities for the PatternViewer3D color planner.
 *
 * Hit canvas is rendered with a WHITE background so non-stroke pixels are
 * opaque white (brightness 255).  Without this every transparent pixel forms
 * one connected region and the whole canvas fills at once.
 *
 * Boundary detection
 * ──────────────────
 * Average RGB brightness < 200.  The higher threshold (vs a naive 128) is
 * intentional: SVG strokes are anti-aliased, so the outermost pixels of a 1-2px
 * stroke can be as light as ~190/255.  Treating those as boundaries closes the
 * sub-pixel gaps that would otherwise let the exterior mask or fill leak through.
 *
 * Click-to-fill vs Fill All
 * ─────────────────────────
 * • floodFill (single click) - NO exterior mask.  Instead it aborts if the fill
 *   would cover > MAX_FILL_RATIO of the canvas.  Large connected regions are
 *   almost always the outer background; aborting them silently is safe UX.
 *   Using the exterior mask here caused "nothing happens" on many real patterns
 *   because anti-aliased gaps let the exterior flood leak into interior regions.
 *
 * • fillAllRegions - still uses the exterior mask so "Fill All" doesn't paint
 *   the outer background margin.
 */

/** Ratio of canvas that a single click-fill may cover before being silently aborted. */
const MAX_FILL_RATIO = 0.45;

export function hexToRgb(hex: string): [number, number, number] {
  const h = hex.replace('#', '');
  return [parseInt(h.slice(0, 2), 16), parseInt(h.slice(2, 4), 16), parseInt(h.slice(4, 6), 16)];
}

/**
 * Returns true when the pixel is a stroke boundary.
 * Threshold 200 instead of 128/150 deliberately catches lightly anti-aliased
 * stroke-edge pixels, closing the sub-pixel gaps that cause exterior leakage.
 */
export function isBoundary(data: Uint8ClampedArray, x: number, y: number, w: number): boolean {
  const i = (y * w + x) * 4;
  return (data[i] + data[i + 1] + data[i + 2]) / 3 < 200;
}

/**
 * Pre-computes every pixel reachable from the image edges without crossing a
 * stroke boundary.  Used by fillAllRegions to avoid painting the outer margin.
 */
export function buildExteriorMask(hitData: Uint8ClampedArray, w: number, h: number): Uint8Array {
  const mask = new Uint8Array(w * h);
  const stack: number[] = [];

  const push = (x: number, y: number) => {
    if (x < 0 || x >= w || y < 0 || y >= h) return;
    const idx = y * w + x;
    if (mask[idx] || isBoundary(hitData, x, y, w)) return;
    mask[idx] = 1;
    stack.push(idx);
  };

  for (let x = 0; x < w; x++) {
    push(x, 0);
    push(x, h - 1);
  }
  for (let y = 1; y < h - 1; y++) {
    push(0, y);
    push(w - 1, y);
  }

  while (stack.length > 0) {
    const idx = stack.pop()!;
    const x = idx % w;
    const y = (idx / w) | 0;
    push(x + 1, y);
    push(x - 1, y);
    push(x, y + 1);
    push(x, y - 1);
  }
  return mask;
}

/**
 * 4-connected flood fill triggered by a single click.
 *
 * Does NOT use the exterior mask - see module comment for why.
 * Aborts (returns false, no canvas change) if the fill would exceed
 * MAX_FILL_RATIO of the total canvas area.  This silently ignores clicks on
 * the outer background without needing the exterior mask.
 *
 * Returns true if the fill was applied, false if aborted.
 */
export function floodFill(
  colorCanvas: HTMLCanvasElement,
  hitData: Uint8ClampedArray,
  startX: number,
  startY: number,
  paintColor: string,
): boolean {
  const w = colorCanvas.width;
  const h = colorCanvas.height;
  if (startX < 0 || startX >= w || startY < 0 || startY >= h) return false;

  const maxPixels = Math.floor(w * h * MAX_FILL_RATIO);
  const ctx = colorCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const [r, g, b] = hexToRgb(paintColor);
  const a = Math.round(0.8 * 255);

  const visited = new Uint8Array(w * h);
  const filled: number[] = [];
  const stack: number[] = [startY * w + startX];

  while (stack.length > 0) {
    const idx = stack.pop()!;
    if (visited[idx]) continue;

    const x = idx % w;
    const y = (idx / w) | 0;

    if (isBoundary(hitData, x, y, w)) continue;

    visited[idx] = 1;
    filled.push(idx);

    // Abort early if this region is too large (it's the outer background)
    if (filled.length > maxPixels) return false;

    if (x + 1 < w) stack.push(idx + 1);
    if (x - 1 >= 0) stack.push(idx - 1);
    if (y + 1 < h) stack.push(idx + w);
    if (y - 1 >= 0) stack.push(idx - w);
  }

  // Only write to the canvas once we know the fill is within size limits
  for (const idx of filled) {
    d[idx * 4] = r;
    d[idx * 4 + 1] = g;
    d[idx * 4 + 2] = b;
    d[idx * 4 + 3] = a;
  }
  ctx.putImageData(imgData, 0, 0);
  return true;
}

/**
 * Fills every interior pixel (non-boundary, non-exterior) in one pass.
 * Used by the "Fill All" button - keeps the exterior mask so the outer
 * background margin is not painted.
 */
export function fillAllRegions(
  colorCanvas: HTMLCanvasElement,
  hitData: Uint8ClampedArray,
  exteriorMask: Uint8Array,
  paintColor: string,
): void {
  const w = colorCanvas.width;
  const h = colorCanvas.height;
  const ctx = colorCanvas.getContext('2d')!;
  const imgData = ctx.getImageData(0, 0, w, h);
  const d = imgData.data;
  const [r, g, b] = hexToRgb(paintColor);
  const a = Math.round(0.9 * 255);

  for (let i = 0; i < w * h; i++) {
    const x = i % w;
    const y = (i / w) | 0;
    if (!isBoundary(hitData, x, y, w) && !exteriorMask[i]) {
      d[i * 4] = r;
      d[i * 4 + 1] = g;
      d[i * 4 + 2] = b;
      d[i * 4 + 3] = a;
    }
  }
  ctx.putImageData(imgData, 0, 0);
}
