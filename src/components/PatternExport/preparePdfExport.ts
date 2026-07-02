// preparePdfExport.ts
// Shared preamble for both PDF producers (the advanced Print panel's own
// "Download PDF" button, and the Quick Export wizard's Printing/Saving-for-
// later flows): resolves the author line, size labels, XMP metadata, and the
// rendered legend SVG, then filters hidden layers out of the source SVG.
// Callers pass the result straight into buildSinglePdf/buildTiledPdf
// (exported from ExportPatternForPrintV3.tsx).

import type { QueryClient } from '@tanstack/react-query';
import { buildLegend } from './render-legend';
import { applyHiddenLayers } from '@/functions/utilities/sanitize-svg';
import { buildPatternXmpMeta, type PatternXmpMeta } from '@/functions/utilities/xmp/buildXmp';
import { formatMeasurement } from '@/functions/utilities/format-measurement';
import type { TypePatternResponse } from '@/functions/database/patterns';

// Must match render-legend.ts's WIDTH and ExportPatternForPrintV3.tsx's own copies -
// kept as a small local duplicate rather than a shared import to avoid a circular
// dependency between this module and the component that also defines them.
const LEGEND_W_IN = 2.5;
const LEGEND_SVG_PX = 320;

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fromIn(valIn: number, unit: 'in' | 'cm' | 'mm'): number {
  if (unit === 'cm') return valIn * 2.54;
  if (unit === 'mm') return valIn * 25.4;
  return valIn;
}

export interface PreparePdfExportInputsOptions {
  viewData: TypePatternResponse;
  unit: 'in' | 'cm' | 'mm';
  patternWIn: number;
  patternHIn: number;
  lineWidthLabel?: string; // defaults to viewData.line_width/line_width_unit if omitted
  includeLegend: boolean;
  hiddenLayers: Set<string>;
  svgString: string;
  queryClient: QueryClient;
}

export interface PreparePdfExportInputsResult {
  filteredSvgString: string;
  xmpMeta: PatternXmpMeta;
  legendSvg: string;
  legendHIn: number;
  fileSizeLabel: string;
}

export async function preparePdfExportInputs(
  opts: PreparePdfExportInputsOptions,
): Promise<PreparePdfExportInputsResult> {
  const { viewData, unit, patternWIn, patternHIn, includeLegend, hiddenLayers, svgString, queryClient } = opts;

  const authorLine =
    viewData.expand?.authors?.map((a) => a.name).join(', ') || viewData.author_manual?.join(', ') || '';

  // Plain decimal - kept for the XMP metadata and the filename (never a fraction there).
  const projectSizeLabel = `${r2(fromIn(patternWIn, unit))}${unit} × ${r2(fromIn(patternHIn, unit))}${unit}`;
  const fileSizeLabel = `${r2(fromIn(patternWIn, unit))}x${r2(fromIn(patternHIn, unit))}${unit}`;
  // Crafter-friendly - fraction inches for the printed legend only.
  const projectSizeDisplayLabel = `${formatMeasurement(fromIn(patternWIn, unit), unit)} × ${formatMeasurement(fromIn(patternHIn, unit), unit)}`;
  const lineWidthLabel = opts.lineWidthLabel ?? formatMeasurement(viewData.line_width, viewData.line_width_unit);
  const xmpMeta = buildPatternXmpMeta(viewData, { sizeLabel: projectSizeLabel });

  const legendOutput = includeLegend
    ? await buildLegend({
        patternName: viewData.name,
        authorLine,
        projectSizeLabel: projectSizeDisplayLabel,
        pieces: viewData.pieces,
        lineWidthLabel,
        designDate: viewData.design_date as Date | null,
        keys: viewData.pattern_key_reference_list ?? [],
        queryClient,
      })
    : null;

  const legendHIn = legendOutput ? legendOutput.height * (LEGEND_W_IN / LEGEND_SVG_PX) : 0;
  const filteredSvgString = applyHiddenLayers(svgString, hiddenLayers);

  return {
    filteredSvgString,
    xmpMeta,
    legendSvg: legendOutput?.svg ?? '',
    legendHIn,
    fileSizeLabel,
  };
}
