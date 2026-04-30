// scaleSVG.ts
// Take an SVG string + target pixel dimensions + desired absolute stroke width in px.
// Returns a new SVG string sized exactly to the target with strokes locked to the
// requested px value (independent of how much the geometry was scaled up).
//
// HOW STROKE PRESERVATION WORKS
// -----------------------------
// SVG strokes scale with the viewBox. If we render the same viewBox at 2x the size,
// strokes also double. To prevent that, we set vector-effect="non-scaling-stroke"
// on every stroked element AND set an explicit stroke-width derived from the
// original line_width converted to output pixels. Result: line thickness in the
// final raster matches the original line_width regardless of target size.

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

  // Walk every element. If it can take a stroke, lock its width.
  const STROKE_TAGS = new Set(['path', 'line', 'polyline', 'polygon', 'rect', 'circle', 'ellipse']);
  const all = svg.querySelectorAll('*');
  all.forEach((el) => {
    if (STROKE_TAGS.has(el.tagName.toLowerCase())) {
      el.setAttribute('vector-effect', 'non-scaling-stroke');
      el.setAttribute('stroke-width', String(strokeWidthPx));
    }
  });

  return new XMLSerializer().serializeToString(svg);
}
