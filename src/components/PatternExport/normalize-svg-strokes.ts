// normalize-svg-strokes.ts
// Single source of truth for locking a pattern SVG's stroke width to a target
// physical thickness, shared by every export path (raster PNG/JPG/WebP, PDF,
// and composite SVG).
//
// WHY this approach (and NOT vector-effect: non-scaling-stroke)
// ------------------------------------------------------------
// We express the stroke width in the SVG's OWN user-unit coordinate space and
// let it scale naturally with the viewBox. Two reasons:
//
//   1. `non-scaling-stroke` is resolved against DEVICE pixels when an SVG is
//      rasterized through <img> → canvas.drawImage(), so the browser multiplies
//      the stroke by window.devicePixelRatio (2× on a 200% display, 3× at 300%).
//      Geometry stays correct but strokes blow up. Scaling the stroke with the
//      viewBox instead has no such device-pixel dependency and matches how design
//      tools (Affinity, Illustrator, Inkscape) render the same file.
//
//   2. Setting stroke-width via setAttribute() only writes a presentation
//      attribute, which SVGs carrying inline `style="stroke-width:…"` or a
//      <style> block silently override (higher CSS specificity). Replacing BOTH
//      the CSS and attribute forms textually is the only reliable way to win.

// Match any viewBox and capture its width (the 3rd number).
const VIEWBOX_WIDTH_RE = /viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+[\d.]+/i;

// Replace every stroke-width declaration (CSS `stroke-width:X` and attribute
// `stroke-width="X"`) with an explicit value in the SVG's user-unit space, and
// guarantee an xmlns so the result renders standalone.
//
// NOTE: this only rewrites EXISTING stroke-width declarations - it does not
// inject one onto elements that rely on the SVG default (1 user unit). Patterns
// exported from design tools always emit explicit stroke widths, and this keeps
// behavior consistent across all export formats.
export function applyStrokeWidthUserUnits(svgString: string, strokeUserUnits: number): string {
  let result = svgString;

  if (!result.includes('xmlns=')) {
    result = result.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const strokeUU = strokeUserUnits.toFixed(5);
  result = result.replace(/stroke-width\s*:\s*[\d.]+/g, `stroke-width:${strokeUU}`);
  result = result.replace(/stroke-width=["'][\d.]+["']/g, `stroke-width="${strokeUU}"`);

  return result;
}

// Derive the user-unit stroke from a physical inch measurement using the SVG's
// own viewBox width, then apply it. Returns the SVG unchanged when there's no
// viewBox (nothing to anchor the conversion to) or the inputs are non-positive.
//   strokeUU = lineWidthIn × (viewBoxWidth / patternWIn)
export function normalizeSvgStrokes(svgString: string, patternWIn: number, lineWidthIn: number): string {
  const m = svgString.match(VIEWBOX_WIDTH_RE);
  if (!m) return svgString;
  const viewBoxWidth = parseFloat(m[1]);
  if (viewBoxWidth <= 0 || patternWIn <= 0) return svgString;

  const userUnitsPerInch = viewBoxWidth / patternWIn;
  return applyStrokeWidthUserUnits(svgString, lineWidthIn * userUnitsPerInch);
}
