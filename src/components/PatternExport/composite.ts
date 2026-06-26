// composite.ts
// Final pipeline: takes scaled pattern SVG + legend SVG + optional instructions
// canvas, lays them out, rasterizes (or returns SVG), produces the export blob.
//
// LAYOUT
//   ┌──────────────────────────────────────┐
//   │                                      │
//   │         pattern (target size)        │
//   │ ┌────────────┐                       │  ← legend, bottom-left, with margin
//   │ │   legend   │                       │
//   │ └────────────┘                       │
//   ├──────────────────────────────────────┤
//   │  instructions (≤700px, 16px text)    │  ← only if enabled
//   └──────────────────────────────────────┘
//
// The instructions block is appended BELOW the pattern (it widens the canvas
// only if instructions exceed pattern width, which they won't since cap=700px).

import { scaleSVG } from './scaling-SVG';
import { insertSvgMetadata } from '@/functions/utilities/xmp/buildXmp';
import { injectXmpForFormat } from '@/functions/utilities/xmp/injectRasterXmp';

export type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
export type SvgVariant = 'scaled' | 'original';
export type JpgBackground = 'white' | 'black';

const LEGEND_MARGIN = 24; // px breathing room from pattern edges
const INSTRUCTIONS_GAP = 60; // px between pattern and instructions block

export interface TypeCompositeInput {
  // Source pattern
  originalSvgText: string;
  // Output sizing in px (already converted from user units)
  targetWidthPx: number;
  targetHeightPx: number;
  // Stroke locked to this px width
  strokeWidthPx: number;
  // Legend already rendered as SVG string (from buildLegend)
  legend: { svg: string; width: number; height: number } | null;
  // Optional instructions canvas (from renderInstructions)
  instructions: { canvas: HTMLCanvasElement; width: number; height: number } | null;
  // Export config
  format: ExportFormat;
  svgVariant?: SvgVariant; // only meaningful when format === 'svg'
  jpgBackground?: JpgBackground;
  // Optional XMP packet embedded into the output (SVG <metadata> / raster binary).
  xmpPacket?: string;
}

function computeLayout(input: TypeCompositeInput) {
  const patternH = input.targetHeightPx;

  const legendY = patternH + (input.legend ? 100 + LEGEND_MARGIN : 0);
  const legendH = input.legend?.height ?? 0;

  const instructionsY = legendY + legendH + (input.instructions ? INSTRUCTIONS_GAP : 0);
  const instructionsH = input.instructions?.height ?? 0;

  const totalH = instructionsY + instructionsH + (input.legend || input.instructions ? LEGEND_MARGIN : 0);

  // Width fits the actual content: the pattern itself, widened only when a legend
  // or instructions block is included (instructions are already capped at 700px
  // by renderInstructions). Previously this was clamped to a flat 700px minimum,
  // which padded smaller patterns with blank space on the side.
  const totalW = Math.max(
    input.targetWidthPx,
    input.legend ? input.legend.width + LEGEND_MARGIN * 2 : 0,
    input.instructions ? input.instructions.width : 0,
  );

  return { legendY, instructionsY, totalH, totalW };
}

export async function compositeExport(input: TypeCompositeInput): Promise<Blob> {
  // SHORT-CIRCUIT: original SVG export - return source bytes (with metadata if present).
  if (input.format === 'svg' && input.svgVariant === 'original') {
    const svg = input.xmpPacket
      ? insertSvgMetadata(input.originalSvgText, input.xmpPacket)
      : input.originalSvgText;
    return new Blob([svg], { type: 'image/svg+xml' });
  }

  // Build the scaled pattern SVG with stroke preservation.
  const scaledPatternSvg = scaleSVG({
    svgText: input.originalSvgText,
    targetWidthPx: input.targetWidthPx,
    targetHeightPx: input.targetHeightPx,
    strokeWidthPx: input.strokeWidthPx,
  });

  // SCALED SVG export: build a single SVG document containing pattern + legend
  // + instructions (instructions inlined as <foreignObject>-free <image> using
  // the rendered canvas as a data URI to keep things portable).
  if (input.format === 'svg' && input.svgVariant === 'scaled') {
    return buildCompositeSvgBlob(scaledPatternSvg, input);
  }

  // RASTER PATH (png / jpg / webp): paint everything onto a canvas.
  return buildRasterBlob(scaledPatternSvg, input);
}

// ─────────────────────────────────────────────────────────────────────────────
// SVG composite
// ─────────────────────────────────────────────────────────────────────────────
async function buildCompositeSvgBlob(scaledPatternSvg: string, input: TypeCompositeInput): Promise<Blob> {
  const { totalH, totalW } = computeLayout(input);

  const patternW = input.targetWidthPx;
  const patternH = input.targetHeightPx;

  // Inner pattern SVG inlined with an <g> wrapper so we can position it.
  // We strip the outer <svg> open/close from the scaled pattern and re-wrap.
  const patternInner = stripSvgWrapper(scaledPatternSvg);

  // Legend placed bottom-right of pattern area
  let legendBlock = '';

  /*if (input.legend) {
    const lx = patternW - input.legend.width - LEGEND_MARGIN;
    const ly = patternH - input.legend.height - LEGEND_MARGIN;
    const legendInner = stripSvgWrapper(input.legend.svg);
    legendBlock = `<g transform="translate(${lx}, ${ly})">${legendInner}</g>`;
  }*/

  // Instructions: convert canvas to PNG data URI, embed via <image>
  let instructionsBlock = '';
  if (input.instructions) {
    const dataUri = input.instructions.canvas.toDataURL('image/png');
    instructionsBlock =
      `<image x="0" y="${patternH + INSTRUCTIONS_GAP}" ` +
      `width="${input.instructions.width}" height="${input.instructions.height}" ` +
      `href="${dataUri}"/>`;
  }

  const legendHeight = Number(input?.legend?.height || 0);
  const instructionsHeight = Number(input?.instructions?.height || 0);
  const totalHeight = totalH + legendHeight + LEGEND_MARGIN + instructionsHeight;

  const metadataBlock = input.xmpPacket ? `<metadata>${input.xmpPacket}</metadata>` : '';

  const out =
    `<svg xmlns="http://www.w3.org/2000/svg" width="${totalW}" height="${totalH}" viewBox="0 0 ${totalW} ${totalH}">` +
    metadataBlock +
    `<g>${patternInner}</g>` +
    legendBlock +
    instructionsBlock +
    `</svg>`;

  return new Blob([out], { type: 'image/svg+xml' });
}

function stripSvgWrapper(svg: string): string {
  return svg.replace(/^[\s\S]*?<svg[^>]*>/, '').replace(/<\/svg>\s*$/, '');
}

// ─────────────────────────────────────────────────────────────────────────────
// Raster composite (png / jpg / webp)
// ─────────────────────────────────────────────────────────────────────────────
async function buildRasterBlob(scaledPatternSvg: string, input: TypeCompositeInput): Promise<Blob> {
  const { legendY, instructionsY, totalH, totalW } = computeLayout(input);

  // Pick the highest SUPERSAMPLE that keeps each drawImage destination ≤ 8192px
  // per dimension. Above that, Chrome's GPU rasterizer silently produces blank
  // output. At high DPI the output is already large enough that supersampling
  // adds nothing - use 1× and paint 1:1.
  const MAX_DIM = 8192;
  const SUPERSAMPLE = Math.max(1, Math.min(3, Math.floor(MAX_DIM / Math.max(totalW, totalH))));

  const patternW = input.targetWidthPx;
  const patternH = input.targetHeightPx;

  const canvas = document.createElement('canvas');
  canvas.width = totalW * SUPERSAMPLE;
  canvas.height = totalH * SUPERSAMPLE;
  const ctx = canvas.getContext('2d')!;
  ctx.scale(SUPERSAMPLE, SUPERSAMPLE);

  if (input.format === 'jpg') {
    ctx.fillStyle = input.jpgBackground === 'black' ? '#000000' : '#ffffff';
    ctx.fillRect(0, 0, totalW, totalH);
  }

  const patternImg = await svgStringToImage(scaledPatternSvg);
  ctx.drawImage(patternImg, 0, 0, patternW, patternH);

  if (input.legend) {
    const legendImg = await svgStringToImage(input.legend.svg);
    ctx.drawImage(legendImg, 16, legendY, input.legend.width, input.legend.height);
  }

  // Draw instructions below pattern
  if (input.instructions) {
    ctx.drawImage(input.instructions.canvas, 0, instructionsY, input.instructions.width, input.instructions.height);
  }

  // Convert to blob in the chosen mime
  const mime = input.format === 'png' ? 'image/png' : input.format === 'jpg' ? 'image/jpeg' : 'image/webp';
  const quality = input.format === 'png' ? undefined : 0.92;

  const blob = await new Promise<Blob>((resolve, reject) => {
    canvas.toBlob((b) => (b ? resolve(b) : reject(new Error('Canvas toBlob failed'))), mime, quality);
  });

  // Embed the XMP packet into the raster binary. WebP needs the encoded pixel
  // dimensions (the supersampled canvas size) to synthesize a VP8X header.
  if (input.xmpPacket && input.format !== 'svg') {
    return injectXmpForFormat(blob, input.format, input.xmpPacket, {
      width: canvas.width,
      height: canvas.height,
    });
  }

  return blob;
}

// SVG string → HTMLImageElement (loaded). Uses a blob URL so large SVGs avoid
// the data-URI length limit some browsers enforce.
function svgStringToImage(svgText: string): Promise<HTMLImageElement> {
  const blob = new Blob([svgText], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      URL.revokeObjectURL(url);
      resolve(img);
    };
    img.onerror = (e) => {
      URL.revokeObjectURL(url);
      reject(e);
    };
    img.crossOrigin = 'anonymous';
    img.src = url;
  });
}
