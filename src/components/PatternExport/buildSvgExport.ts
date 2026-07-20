// buildSvgExport.ts
// Composite-SVG-building logic extracted from ExportPatternForSVG.tsx so it
// has exactly one implementation, shared by the advanced SVG panel and the
// Quick Export wizard's Editing/Saving-for-later(SVG) flows.
//
// `svgString` is expected to already be hidden-layer-filtered (callers run it
// through applyHiddenLayers() themselves before calling this).

import type { QueryClient } from '@tanstack/react-query';
import { buildLegend } from './render-legend';
import { renderInstructions } from './render-instructions';
import { normalizeSvgStrokes } from './normalize-svg-strokes';
import { buildPatternXmpMeta, buildXmpPacket, insertSvgMetadata } from '@/functions/utilities/xmp/buildXmp';
import { formatInchesAsFraction, formatMeasurement } from '@/functions/utilities/format-measurement';
import type { TypePatternResponse } from '@/functions/database/patterns';

const LEGEND_W_IN = 2.5;
const LEGEND_SVG_PX = 320;
const LEGEND_GAP_IN = 0.2;

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}
function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

interface SvgViewBox {
  vbX: number;
  vbY: number;
  vbW: number;
  vbH: number;
}

function parseSvgViewBox(svgStr: string): SvgViewBox | null {
  const m = svgStr.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.]+)\s+([\d.]+)/i);
  if (!m) return null;
  return { vbX: parseFloat(m[1]), vbY: parseFloat(m[2]), vbW: parseFloat(m[3]), vbH: parseFloat(m[4]) };
}

// Strips the outer <svg ...> and </svg> wrapper, leaving inner content only.
function extractSvgInner(svgStr: string): string {
  return svgStr.replace(/<svg\b[^>]*>/i, '').replace(/<\/svg>\s*$/i, '');
}

export interface BuildSvgExportOptions {
  svgString: string; // already hidden-layer-filtered
  viewData: TypePatternResponse;
  mode: 'original' | 'custom';
  patternWIn: number;
  patternHIn: number;
  lineWidthIn: number;
  includeLegend: boolean;
  includeInstructions: boolean;
  queryClient: QueryClient;
}

export async function buildSvgExportBlob(opts: BuildSvgExportOptions): Promise<Blob> {
  const {
    svgString,
    viewData,
    mode,
    patternWIn,
    patternHIn,
    lineWidthIn,
    includeLegend,
    includeInstructions,
    queryClient,
  } = opts;

  const authorLine =
    viewData.expand?.authors?.map((a) => a.name).join(', ') || viewData.author_manual?.join(', ') || '';
  const projectSizeLabel = `${formatInchesAsFraction(patternWIn)} in × ${formatInchesAsFraction(patternHIn)} in`;
  const lineWidthLabel = formatMeasurement(viewData.line_width, viewData.line_width_unit);

  const legendOutput = includeLegend
    ? await buildLegend({
        patternName: viewData.name,
        authorLine,
        projectSizeLabel,
        pieces: viewData.pieces,
        lineWidthLabel,
        designDate: viewData.design_date as Date | null,
        keys: viewData.pattern_key_reference_list ?? [],
        queryClient,
      })
    : null;

  const resolvedLegendHIn = legendOutput ? legendOutput.height * (LEGEND_W_IN / LEGEND_SVG_PX) : 0;

  // Rasterize the legend SVG to a PNG so it renders consistently across all
  // SVG tools (Inkscape, Illustrator, Adobe XD, etc.), not just Chrome.
  const legendPngDataUri = legendOutput
    ? await new Promise<string>((resolve, reject) => {
        const scale = 2; // 2× oversample for crisp output
        const canvasW = Math.ceil(LEGEND_SVG_PX * scale);
        const canvasH = Math.ceil(legendOutput.height * scale);
        const canvas = document.createElement('canvas');
        canvas.width = canvasW;
        canvas.height = canvasH;
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          reject(new Error('Canvas 2D context unavailable'));
          return;
        }
        const svgBlob = new Blob([legendOutput.svg], { type: 'image/svg+xml;charset=utf-8' });
        const svgUrl = URL.createObjectURL(svgBlob);
        const img = new Image();
        img.onload = () => {
          ctx.drawImage(img, 0, 0, canvasW, canvasH);
          URL.revokeObjectURL(svgUrl);
          resolve(canvas.toDataURL('image/png'));
        };
        img.onerror = () => {
          URL.revokeObjectURL(svgUrl);
          reject(new Error('Failed to rasterize legend SVG to PNG'));
        };
        img.src = svgUrl;
      })
    : null;

  const vb = parseSvgViewBox(svgString);
  if (!vb) throw new Error('Pattern SVG is missing a viewBox - cannot composite.');

  // Convert legend physical dimensions into pattern SVG user-unit space.
  // If the pattern is narrower than the legend, expand the output canvas so
  // the legend is never clipped.
  const userUnitsPerInch = vb.vbW / patternWIn;
  const gapUU = LEGEND_GAP_IN * userUnitsPerInch;
  const legendWUU = LEGEND_W_IN * userUnitsPerInch;
  const legendHUU = resolvedLegendHIn * userUnitsPerInch;
  const effectiveVbW = legendOutput ? Math.max(vb.vbW, legendWUU) : vb.vbW;
  const effectiveWIn = legendOutput ? Math.max(patternWIn, LEGEND_W_IN) : patternWIn;

  // Instructions: rendered as a rasterized PNG image block below the legend.
  // Width matches the pattern's full width; height scales from the canvas ratio.
  let instrImageElement = '';
  let instrExtraVbH = 0;
  let instrExtraHIn = 0;
  if (includeInstructions && viewData.instructions) {
    const { canvas, width: logicW, height: logicH } = await renderInstructions(viewData.instructions);
    const instrDataUri = canvas.toDataURL('image/png');
    const instrPhysHIn = patternWIn * (logicH / logicW);
    const instrWUU = vb.vbW; // span the full pattern width in user units
    const instrHUU = instrPhysHIn * userUnitsPerInch;
    // instrY accounts for whether the legend is present
    const instrY = vb.vbY + vb.vbH + gapUU + (legendOutput ? legendHUU + gapUU : 0);
    instrImageElement = `<image x="${vb.vbX}" y="${instrY}" width="${instrWUU}" height="${instrHUU.toFixed(3)}" href="${instrDataUri}"/>`;
    instrExtraVbH = gapUU + instrHUU;
    instrExtraHIn = LEGEND_GAP_IN + instrPhysHIn;
  }

  const totalVbH = vb.vbH + (legendOutput ? gapUU + legendHUU : 0) + instrExtraVbH;
  const totalHIn = patternHIn + (legendOutput ? LEGEND_GAP_IN + resolvedLegendHIn : 0) + instrExtraHIn;

  // Custom mode: normalize stroke widths to the target physical size
  let processedSvg = svgString;
  if (mode === 'custom') {
    processedSvg = normalizeSvgStrokes(svgString, patternWIn, lineWidthIn);
  }

  // Ensure SVG namespace so the composite is well-formed
  if (!processedSvg.includes('xmlns=')) {
    processedSvg = processedSvg.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  const patternInner = extractSvgInner(processedSvg);

  // Build composite: pattern inner content + optional legend PNG image + optional instructions PNG image.
  // Both legend and instructions are embedded as flat <image> elements so the output renders
  // consistently in all SVG tools, not just Chrome (no nested <svg> coordinate systems needed).
  const legendImageElement =
    legendOutput && legendPngDataUri
      ? `<image x="${vb.vbX}" y="${vb.vbY + vb.vbH + gapUU}" width="${legendWUU}" height="${legendHUU}" href="${legendPngDataUri}"/>`
      : '';

  const composite = [
    `<svg xmlns="http://www.w3.org/2000/svg"`,
    ` viewBox="${vb.vbX} ${vb.vbY} ${r3(effectiveVbW)} ${totalVbH}"`,
    ` width="${r3(effectiveWIn)}in"`,
    ` height="${r3(totalHIn)}in"`,
    `>`,
    patternInner,
    legendImageElement,
    instrImageElement,
    `</svg>`,
  ].join('');

  // Embed pattern/site/author metadata as an XMP packet inside <metadata>.
  const xmpPacket = buildXmpPacket(
    buildPatternXmpMeta(viewData, { sizeLabel: `${r2(patternWIn)}×${r2(patternHIn)}in` }),
  );
  const compositeWithMeta = insertSvgMetadata(composite, xmpPacket, {
    title: viewData.name,
    desc: viewData.description,
  });

  return new Blob([compositeWithMeta], { type: 'image/svg+xml;charset=utf-8' });
}
