// useExportPattern.ts
// Orchestrator hook. Pulls all the pieces together:
//   1. Fetch source SVG from pattern_file URL
//   2. Compute target px from user width/height/unit/dpi
//   3. Compute preserved stroke width in output px
//   4. Build legend + (optional) instructions in parallel
//   5. Composite + return a Blob the caller can download
//
// The caller (the dialog component) only needs to call `runExport(formState)`.

import { useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { compositeExport, type ExportFormat, type JpgBackground, type SvgVariant } from './composite';
import { buildLegend } from './render-legend';
import { renderInstructions } from './render-instructions';
import { normalizeUnit, toPx, type TypePatternExportUnit } from './units';
import type { TypePatternKeyReferenceObject } from '@/functions/database/patterns';
import { applyHiddenLayers } from '@/functions/utilities/sanitize-svg';
import { formatMeasurement } from '@/functions/utilities/format-measurement';

export interface TypeExportFormState {
  format: ExportFormat;
  svgVariant: SvgVariant; // used only when format==='svg'
  width: number;
  height: number;
  unit: TypePatternExportUnit;
  dpi: number;
  jpgBackground: JpgBackground;
  includeInstructions: boolean;
  includeLegend: boolean;
}

// Pulled from your pattern DTO + a couple resolved fields the caller passes in.
export interface TypeExportPatternContext {
  patternFileUrl: string; // resolved absolute URL to the SVG asset
  patternName: string;
  authorLine: string; // pre-joined "Author A, Author B"
  pieces: number;
  designDate: Date | null;
  designWidth: number;
  designWidthUnit: string;
  designHeight: number;
  designHeightUnit: string;
  lineWidth: number;
  lineWidthUnit: string;
  instructionsMarkdown: string;
  patternKeys: TypePatternKeyReferenceObject[];
  hiddenLayerIds?: string[];
  xmpPacket?: string; // embedded into the exported file's metadata
}

export function useExportPattern() {
  const queryClient = useQueryClient();

  const [isExporting, setExporting] = useState(false);
  const [error, setError] = useState<Error | null>(null);

  async function runExport(ctx: TypeExportPatternContext, form: TypeExportFormState): Promise<Blob> {
    setExporting(true);
    setError(null);
    try {
      // ── 1. Fetch source SVG ────────────────────────────────────────────────
      const rawSvgText = await queryClient.fetchQuery({
        queryKey: ['pattern-svg', ctx.patternFileUrl],
        queryFn: () =>
          fetch(ctx.patternFileUrl).then((r) => {
            if (!r.ok) throw new Error(`Failed to load pattern SVG (${r.status})`);
            return r.text();
          }),
        staleTime: Infinity,
        gcTime: 1000 * 60 * 60,
      });
      const svgText =
        ctx.hiddenLayerIds?.length
          ? applyHiddenLayers(rawSvgText, new Set(ctx.hiddenLayerIds))
          : rawSvgText;

      // ── 2. Resolve target output px ────────────────────────────────────────
      // For 'svg' + 'original' variant we skip everything else; composite handles it.
      const targetWidthPx = toPx(form.width, form.unit, form.dpi);
      const targetHeightPx = toPx(form.height, form.unit, form.dpi);

      // ── 3. Stroke preservation ─────────────────────────────────────────────
      // Convert the original line width to px in the SAME pixel space as the
      // target output. Because we use vector-effect: non-scaling-stroke, this
      // is the exact thickness the rasterized output will have.
      const lineUnit = normalizeUnit(ctx.lineWidthUnit);
      const strokeWidthPx = toPx(ctx.lineWidth, lineUnit, form.dpi);

      // ── 4. Build legend + instructions in parallel ─────────────────────────
      const projectSizeLabel = `${formatMeasurement(form.width, form.unit)} x ${formatMeasurement(form.height, form.unit)}`;
      const lineWidthLabel = formatMeasurement(ctx.lineWidth, ctx.lineWidthUnit);

      const [legend, instructions] = await Promise.all([
        form.includeLegend
          ? buildLegend({
              patternName: ctx.patternName,
              authorLine: ctx.authorLine,
              projectSizeLabel,
              pieces: ctx.pieces,
              lineWidthLabel,
              designDate: ctx.designDate,
              keys: ctx.patternKeys,
              queryClient,
            })
          : Promise.resolve(null),
        form.includeInstructions && ctx.instructionsMarkdown
          ? renderInstructions(ctx.instructionsMarkdown)
          : Promise.resolve(null),
      ]);

      // ── 5. Composite to final blob ─────────────────────────────────────────
      const blob = await compositeExport({
        originalSvgText: svgText,
        targetWidthPx,
        targetHeightPx,
        strokeWidthPx,
        legend,
        instructions,
        format: form.format,
        svgVariant: form.svgVariant,
        jpgBackground: form.jpgBackground,
        xmpPacket: ctx.xmpPacket,
      });

      return blob;
    } catch (e) {
      const err = e instanceof Error ? e : new Error(String(e));
      setError(err);
      throw err;
    } finally {
      setExporting(false);
    }
  }

  return { runExport, isExporting, error };
}

// Helper: trigger browser download of a blob with a chosen filename.
export function downloadBlob(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
