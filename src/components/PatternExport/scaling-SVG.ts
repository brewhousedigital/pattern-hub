// scaleSVG.ts
// Take an SVG string + target pixel dimensions + desired absolute stroke width in px.
// Returns a new SVG string sized exactly to the target with strokes locked to the
// requested px value (independent of how much the geometry was scaled up).
//
// HOW STROKE PRESERVATION WORKS
// -----------------------------
// SVG strokes scale with the viewBox. If we render the same viewBox at 2× the size,
// strokes also double. To keep the final stroke at exactly `strokeWidthPx` output
// pixels, we express the stroke in the SVG's OWN user-unit space and let it scale
// with the geometry:
//
//   scale             = targetWidthPx / viewBoxWidth   (applied by the viewBox)
//   strokeUserUnits   = strokeWidthPx / scale = strokeWidthPx × viewBoxWidth / targetWidthPx
//   rendered stroke   = strokeUserUnits × scale = strokeWidthPx px   ✓
//
// This deliberately avoids `vector-effect: non-scaling-stroke`, which is resolved
// against DEVICE pixels when the SVG is rasterized via <img> → canvas and gets
// multiplied by window.devicePixelRatio (2×/3× on HiDPI displays). See
// normalize-svg-strokes.ts for the full rationale. The actual stroke rewriting is
// shared with the PDF and composite-SVG paths.

import { applyStrokeWidthUserUnits } from './normalize-svg-strokes';

export interface TypeScaleSVGOpts {
  svgText: string;
  targetWidthPx: number;
  targetHeightPx: number;
  strokeWidthPx: number; // absolute output pixels for every stroke
}

export function scaleSVG({ svgText, targetWidthPx, targetHeightPx, strokeWidthPx }: TypeScaleSVGOpts): string {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgText, 'image/svg+xml');
  const svg = doc.documentElement as unknown as SVGSVGElement;

  // Ensure a viewBox exists. If the source only has width/height attrs, synthesize
  // a viewBox from them so scaling is well-defined.
  if (!svg.getAttribute('viewBox')) {
    const w = parseFloat(svg.getAttribute('width') || '0');
    const h = parseFloat(svg.getAttribute('height') || '0');
    if (w > 0 && h > 0) svg.setAttribute('viewBox', `0 0 ${w} ${h}`);
  }

  svg.setAttribute('width', String(targetWidthPx));
  svg.setAttribute('height', String(targetHeightPx));
  svg.setAttribute('preserveAspectRatio', 'xMidYMid meet');

  const serialized = new XMLSerializer().serializeToString(svg);

  // Convert the requested output-px stroke into the SVG's user-unit space so it
  // scales with the viewBox to exactly strokeWidthPx in the final raster.
  const vb = svg.getAttribute('viewBox');
  const viewBoxWidth = vb ? parseFloat(vb.trim().split(/\s+/)[2]) : NaN;
  if (viewBoxWidth > 0 && targetWidthPx > 0) {
    const strokeUserUnits = strokeWidthPx * (viewBoxWidth / targetWidthPx);
    return applyStrokeWidthUserUnits(serialized, strokeUserUnits);
  }

  return serialized;
}
