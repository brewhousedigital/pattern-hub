import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import jsPDF from 'jspdf';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { buildLegend } from './render-legend';
import { renderInstructions } from './render-instructions';
import { applyHiddenLayers } from '@/functions/utilities/sanitize-svg';
import {
  buildPatternXmpMeta,
  buildPdfDocumentProperties,
  type PatternXmpMeta,
} from '@/functions/utilities/xmp/buildXmp';
import { formatMeasurement } from '@/functions/utilities/format-measurement';
import { SectionLabel } from '@/components/ViewHelpers';
import { CollapsibleCard } from '@/components/cards/CollapsibleCard';
import type { TypeViewData } from '@/functions/types/types';

import { alpha } from '@mui/material/styles';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import DownloadIcon from '@mui/icons-material/Download';
import GridOnIcon from '@mui/icons-material/GridOn';
import CropFreeIcon from '@mui/icons-material/CropFree';
import LockIcon from '@mui/icons-material/Lock';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';
import WarningAmberIcon from '@mui/icons-material/WarningAmber';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Collapse,
  Divider,
  FormControlLabel,
  MenuItem,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Stack,
} from '@mui/material';

// ─── Constants ────────────────────────────────────────────────────────────────

const PAGE_MARGIN_IN = 0.25;
const LEGEND_W_IN = 2.5; // physical width of the legend stamp on paper
const LEGEND_SVG_PX = 320; // legend SVG pixel width (must match render-legend.ts WIDTH)
const LEGEND_GAP_IN = 0.2; // vertical gap between pattern bottom and legend top

const TILE_SHEET_W = 8.5;
const TILE_SHEET_H = 11;
const TILE_MARGIN = 0.5;

const DPI_SINGLE = 300;
const DPI_TILED = 150;

// ─── Types ────────────────────────────────────────────────────────────────────

type PrintMode = 'single' | 'tiled';
type Orientation = 'portrait' | 'landscape';
type PrintUnit = 'in' | 'cm' | 'mm';
type PaperPreset = 'Letter' | 'Legal' | 'Tabloid' | 'A5' | 'A4' | 'A3' | 'B5' | 'B4' | 'C4';

// ─── Paper presets ────────────────────────────────────────────────────────────

const PAPER_PRESETS: { name: PaperPreset; wIn: number; hIn: number }[] = [
  { name: 'Letter', wIn: 8.5, hIn: 11 },
  { name: 'Legal', wIn: 8.5, hIn: 14 },
  { name: 'Tabloid', wIn: 11, hIn: 17 },
  { name: 'A5', wIn: 5.827, hIn: 8.268 },
  { name: 'A4', wIn: 8.268, hIn: 11.693 },
  { name: 'A3', wIn: 11.693, hIn: 16.535 },
  { name: 'B5', wIn: 6.929, hIn: 9.843 },
  { name: 'B4', wIn: 9.843, hIn: 13.898 },
  { name: 'C4', wIn: 9.016, hIn: 12.795 },
];

// ─── Unit helpers ─────────────────────────────────────────────────────────────

function toIn(val: number, unit: PrintUnit): number {
  if (unit === 'cm') return val / 2.54;
  if (unit === 'mm') return val / 25.4;
  return val;
}

function fromIn(valIn: number, unit: PrintUnit): number {
  if (unit === 'cm') return valIn * 2.54;
  if (unit === 'mm') return valIn * 25.4;
  return valIn;
}

function dbToIn(value: number, unitStr: string): number {
  const u = unitStr.toLowerCase().trim();
  if (u.startsWith('in')) return value;
  if (u === 'cm') return value / 2.54;
  if (u === 'mm') return value / 25.4;
  if (u === 'px') return value / 96;
  return value;
}

function r2(n: number): number {
  return Math.round(n * 100) / 100;
}

function r3(n: number): number {
  return Math.round(n * 1000) / 1000;
}

// ─── Legend geometry helper ───────────────────────────────────────────────────

// Mirrors the height formula in render-legend.ts exactly.
function legendPhysicalHeightIn(keyCount: number): number {
  const PAD = 20,
    HEADER_H = 32,
    SUB_H = 22,
    STAT_H = 20,
    STATS = 4,
    DIV_H = 16,
    KEY_H = 32;
  const px = PAD + HEADER_H + SUB_H + 6 + STATS * STAT_H + DIV_H + keyCount * KEY_H + PAD;
  return px * (LEGEND_W_IN / LEGEND_SVG_PX);
}

// ─── Misc helpers ─────────────────────────────────────────────────────────────

function slugify(s: string) {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

async function svgToPng(svgStr: string, wPx: number, hPx: number): Promise<string> {
  const blob = new Blob([svgStr], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const c = document.createElement('canvas');
      c.width = wPx;
      c.height = hPx;
      c.getContext('2d')!.drawImage(img, 0, 0, wPx, hPx);
      URL.revokeObjectURL(url);
      resolve(c.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG rasterize failed'));
    };
    img.src = url;
  });
}

// Prepare an SVG string for print rasterization at `targetWPx × targetHPx`.
//
// WHY this exists (not scaleSVG):
//   scaleSVG sets stroke-width via setAttribute(), which is a CSS "presentation
//   attribute". SVGs exported from Affinity Designer, Inkscape, etc. store
//   stroke widths inside inline style="" or <style> blocks, which have higher
//   CSS specificity and silently override the attribute. The result is that the
//   original thin stroke from the file wins.
//
//   Fix: use regex to replace ALL stroke-width occurrences (both CSS and
//   attribute) with the correct user-unit value derived from the viewBox.
//   Formula: strokeUserUnits = lineWidthIn × (viewBoxWidth / patternWIn)
//   This is unit-system-agnostic - works for mm, pt, px, or any other
//   coordinate space the SVG uses.
function prepareSvgForPrint(
  svgString: string,
  targetWPx: number,
  targetHPx: number,
  patternWIn: number,
  lineWidthIn: number,
): string {
  let result = svgString;

  // Ensure SVG namespace for canvas rendering
  if (!result.includes('xmlns=')) {
    result = result.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }

  // Compute stroke width in SVG user units from the viewBox coordinate system
  const vbMatch = result.match(/viewBox=["']\s*[\d.-]+\s+[\d.-]+\s+([\d.]+)\s+[\d.]+/i);
  if (vbMatch) {
    const viewBoxWidth = parseFloat(vbMatch[1]);
    if (viewBoxWidth > 0 && patternWIn > 0) {
      const userUnitsPerInch = viewBoxWidth / patternWIn;
      const strokeUserUnits = (lineWidthIn * userUnitsPerInch).toFixed(5);
      // Replace inline CSS  (style="...stroke-width:X...")
      result = result.replace(/stroke-width\s*:\s*[\d.]+/g, `stroke-width:${strokeUserUnits}`);
      // Replace presentation attribute  (stroke-width="X")
      result = result.replace(/stroke-width=["'][\d.]+["']/g, `stroke-width="${strokeUserUnits}"`);
    }
  }

  // Set the output pixel dimensions on the root <svg> element
  result = result.replace(/(<svg\b[^>]*?)\s+width=["'][^"']*["']/i, `$1 width="${targetWPx}"`);
  result = result.replace(/(<svg\b[^>]*?)\s+height=["'][^"']*["']/i, `$1 height="${targetHPx}"`);
  // Inject width/height if the element had neither
  if (!/\bwidth=["']\d/.test(result)) {
    result = result.replace(/(<svg\b[^>]*)>/i, `$1 width="${targetWPx}" height="${targetHPx}">`);
  }

  return result;
}

function drawCropMarks(pdf: jsPDF, x: number, y: number, w: number, h: number) {
  const CL = 0.15,
    G = 0.05;
  pdf.setDrawColor(180, 160, 110);
  pdf.setLineWidth(0.005);
  // top-left
  pdf.line(x - G - CL, y, x - G, y);
  pdf.line(x, y - G - CL, x, y - G);
  // top-right
  pdf.line(x + w + G, y, x + w + G + CL, y);
  pdf.line(x + w, y - G - CL, x + w, y - G);
  // bottom-left
  pdf.line(x - G - CL, y + h, x - G, y + h);
  pdf.line(x, y + h + G, x, y + h + G + CL);
  // bottom-right
  pdf.line(x + w + G, y + h, x + w + G + CL, y + h);
  pdf.line(x + w, y + h + G, x + w, y + h + G + CL);
}

// ─── PDF builder: single page ─────────────────────────────────────────────────

interface SinglePdfArgs {
  svgString: string;
  patternName: string;
  sizeLabel: string;
  xmpMeta: PatternXmpMeta;
  patternWIn: number;
  patternHIn: number;
  lineWidthIn: number;
  pageWIn: number;
  pageHIn: number;
  orientation: Orientation;
  includeLegend: boolean;
  legendSvg: string;
  legendHIn: number;
  includeInstructions: boolean;
  instructionsMarkdown: string;
}

async function buildSinglePdf(a: SinglePdfArgs): Promise<void> {
  const fw = a.orientation === 'landscape' ? Math.max(a.pageWIn, a.pageHIn) : Math.min(a.pageWIn, a.pageHIn);
  const fh = a.orientation === 'landscape' ? Math.min(a.pageWIn, a.pageHIn) : Math.max(a.pageWIn, a.pageHIn);

  const pdf = new jsPDF({ orientation: a.orientation, unit: 'in', format: [fw, fh] });
  pdf.setDocumentProperties(buildPdfDocumentProperties(a.xmpMeta));

  const M = PAGE_MARGIN_IN;
  const availW = fw - 2 * M;

  // Rasterize pattern at exact requested size
  const wPx = Math.round(a.patternWIn * DPI_SINGLE);
  const hPx = Math.round(a.patternHIn * DPI_SINGLE);
  const preparedSvg = prepareSvgForPrint(a.svgString, wPx, hPx, a.patternWIn, a.lineWidthIn);
  const patPng = await svgToPng(preparedSvg, wPx, hPx);

  // Center pattern horizontally on the page
  const patX = M + (availW - a.patternWIn) / 2;
  pdf.addImage(patPng, 'PNG', patX, M, a.patternWIn, a.patternHIn);

  // Legend below the pattern, left-aligned to margin
  if (a.includeLegend) {
    const legendY = M + a.patternHIn + LEGEND_GAP_IN;
    const legendPng = await svgToPng(
      a.legendSvg,
      Math.round(LEGEND_W_IN * DPI_SINGLE),
      Math.round(a.legendHIn * DPI_SINGLE),
    );
    pdf.addImage(legendPng, 'PNG', M, legendY, LEGEND_W_IN, a.legendHIn);
  }

  if (a.includeInstructions && a.instructionsMarkdown) {
    await addInstructionPages(pdf, a.instructionsMarkdown, fw, fh, M);
  }

  pdf.save(`${slugify(a.patternName)}-${a.sizeLabel}-print.pdf`);
}

// ─── PDF builder: tiled ───────────────────────────────────────────────────────

interface TiledPdfArgs {
  svgString: string;
  patternName: string;
  sizeLabel: string;
  xmpMeta: PatternXmpMeta;
  patternWIn: number;
  patternHIn: number;
  lineWidthIn: number;
  includeLegend: boolean;
  legendSvg: string;
  legendHIn: number;
  includeInstructions: boolean;
  instructionsMarkdown: string;
}

async function buildTiledPdf(a: TiledPdfArgs): Promise<void> {
  // Each sheet: top + bottom margin, then pattern tile area, then optional gap + legend
  const tileW = TILE_SHEET_W - 2 * TILE_MARGIN;
  const reservedForLegend = a.includeLegend ? LEGEND_GAP_IN + a.legendHIn : 0;
  const tileH = TILE_SHEET_H - 2 * TILE_MARGIN - reservedForLegend;

  const cols = Math.ceil(a.patternWIn / tileW);
  const rows = Math.ceil(a.patternHIn / tileH);

  // Rasterize the full pattern at DPI_TILED. We draw it offset per tile so
  // the correct region falls within the printable area (jsPDF clips to page).
  const fullWPx = Math.round(a.patternWIn * DPI_TILED);
  const fullHPx = Math.round(a.patternHIn * DPI_TILED);
  const preparedSvg = prepareSvgForPrint(a.svgString, fullWPx, fullHPx, a.patternWIn, a.lineWidthIn);
  const fullPng = await svgToPng(preparedSvg, fullWPx, fullHPx);

  // Rasterize legend once; reuse across all pages (only when included)
  const legendPng = a.includeLegend
    ? await svgToPng(a.legendSvg, Math.round(LEGEND_W_IN * DPI_TILED), Math.round(a.legendHIn * DPI_TILED))
    : null;

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [TILE_SHEET_W, TILE_SHEET_H] });
  pdf.setDocumentProperties(buildPdfDocumentProperties(a.xmpMeta));
  let first = true;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!first) pdf.addPage([TILE_SHEET_W, TILE_SHEET_H], 'portrait');
      first = false;

      const srcX = col * tileW;
      const srcY = row * tileH;

      // Offset the full image so this tile's region lands at (TILE_MARGIN, TILE_MARGIN)
      pdf.addImage(fullPng, 'PNG', TILE_MARGIN - srcX, TILE_MARGIN - srcY, a.patternWIn, a.patternHIn);

      // Crop marks around the tile's content area
      const contentW = Math.min(tileW, a.patternWIn - srcX);
      const contentH = Math.min(tileH, a.patternHIn - srcY);
      drawCropMarks(pdf, TILE_MARGIN, TILE_MARGIN, contentW, contentH);

      const legendY = TILE_MARGIN + tileH + LEGEND_GAP_IN;

      const colLabel = String.fromCharCode(65 + col);
      const labelText = `${colLabel}${row + 1}  ·  ${a.patternName}`;
      //const hintText = `${cols} × ${rows} sheets (${cols * rows} pages total)  ·  align crop marks and tape together`;

      pdf.setFont('helvetica', 'normal');

      // Measure label + hint widths at their respective sizes
      pdf.setFontSize(7);
      const labelWidth = pdf.getTextWidth(labelText);
      const labelHeight = 7 / 72;

      pdf.setFontSize(6);
      //const hintWidth = pdf.getTextWidth(hintText);
      //const hintHeight = 6 / 72;

      const padX = 0.05;
      const padY = 0.03;
      const BOTTOM_MARGIN = 1; // 1 inch reserved at bottom

      const labelY = TILE_SHEET_H - BOTTOM_MARGIN - 0.08; // label baseline
      const hintY = TILE_SHEET_H - BOTTOM_MARGIN; // hint baseline below label

      // Assembly hint on the last row of the first column only
      if (row === rows - 1 && col === 0) {
        const bgX = TILE_MARGIN - padX;
        const bgY = legendY - padY;
        const bgW = Math.max(LEGEND_W_IN, labelWidth) + padX * 2;
        const bgH = hintY - legendY + padY * 2;

        pdf.setFillColor(255, 255, 255);
        pdf.rect(bgX, bgY, bgW, bgH, 'F');

        if (a.includeLegend && legendPng) {
          pdf.addImage(legendPng, 'PNG', TILE_MARGIN, legendY - BOTTOM_MARGIN, LEGEND_W_IN, a.legendHIn);
        }

        pdf.setFontSize(7);
        pdf.setTextColor(150, 130, 90);
        pdf.text(labelText, TILE_MARGIN, labelY);
      } else {
        // White bg behind label only
        const bgX = TILE_MARGIN - padX;
        const bgY = labelY - labelHeight;
        const bgW = labelWidth + padX * 2;
        const bgH = labelHeight + padY * 2;

        pdf.setFillColor(255, 255, 255);
        pdf.rect(bgX, bgY, bgW, bgH, 'F');

        pdf.setFontSize(7);
        pdf.setTextColor(150, 130, 90);
        pdf.text(labelText, TILE_MARGIN, labelY);
      }
    }
  }

  if (a.includeInstructions && a.instructionsMarkdown) {
    await addInstructionPages(pdf, a.instructionsMarkdown, TILE_SHEET_W, TILE_SHEET_H, 0.25);
  }

  pdf.save(`${slugify(a.patternName)}-${a.sizeLabel}-tiled.pdf`);
}

// ─── Instructions pages ───────────────────────────────────────────────────────

async function addInstructionPages(
  pdf: jsPDF,
  markdown: string,
  pageW: number,
  pageH: number,
  margin: number,
): Promise<void> {
  const { canvas, width: logicW, height: logicH } = await renderInstructions(markdown);

  const printW = pageW - 2 * margin;
  const printH = pageH - 2 * margin;
  const scale = printW / logicW; // inches per logical pixel
  const pxPerPage = printH / scale; // logical pixels that fit per page
  // html2canvas renders at 2× so canvas dimensions are 2× logical
  const hiDpiScale = canvas.width / logicW;

  let yOffset = 0;
  while (yOffset < logicH) {
    pdf.addPage([pageW, pageH], 'portrait');

    const sliceLogicH = Math.min(pxPerPage, logicH - yOffset);
    const srcY = Math.round(yOffset * hiDpiScale);
    const srcH = Math.round(sliceLogicH * hiDpiScale);

    const slice = document.createElement('canvas');
    slice.width = canvas.width;
    slice.height = srcH;
    slice.getContext('2d')!.drawImage(canvas, 0, srcY, canvas.width, srcH, 0, 0, canvas.width, srcH);

    pdf.addImage(slice.toDataURL('image/png'), 'PNG', margin, margin, printW, sliceLogicH * scale);

    yOffset += pxPerPage;
  }
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportPatternForPrintV3 = ({
  viewData,
  hiddenLayers = new Set<string>(),
}: TypeViewData & { hiddenLayers?: Set<string> }) => {
  const queryClient = useQueryClient();

  const baseWIn = viewData ? dbToIn(viewData.design_width, viewData.design_width_unit) : 1;
  const baseHIn = viewData ? dbToIn(viewData.design_height, viewData.design_height_unit) : 1;
  const aspectRatio = baseWIn > 0 && baseHIn > 0 ? baseHIn / baseWIn : 1; // H per W
  const lineWidthIn = viewData ? Math.max(dbToIn(viewData.line_width, viewData.line_width_unit), 0.005) : 0.039;

  const [mode, setMode] = useState<PrintMode>('single');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [unit, setUnit] = useState<PrintUnit>('in');
  const [patternWidthInput, setPatternWidthInput] = useState(() => String(r3(baseWIn)));
  const [patternHeightInput, setPatternHeightInput] = useState(() => String(r3(baseHIn)));
  const [paperPreset, setPaperPreset] = useState<PaperPreset | ''>('');
  const [customPageW, setCustomPageW] = useState('');
  const [customPageH, setCustomPageH] = useState('');
  const [paperUnit, setPaperUnit] = useState<PrintUnit>('in');
  const [includeInstructions, setIncludeInstructions] = useState(!!viewData?.instructions);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgString, setSvgString] = useState('');

  // Sync both inputs when viewData loads
  useEffect(() => {
    if (viewData) {
      const wIn = dbToIn(viewData.design_width, viewData.design_width_unit);
      const hIn = dbToIn(viewData.design_height, viewData.design_height_unit);
      setPatternWidthInput(String(r3(fromIn(wIn, unit))));
      setPatternHeightInput(String(r3(fromIn(hIn, unit))));
    }
  }, [viewData?.id]);

  // Convert both displayed values when unit selector changes
  const handleUnitChange = (newUnit: PrintUnit) => {
    const w = parseFloat(patternWidthInput);
    if (!isNaN(w) && w > 0) {
      const wIn = toIn(w, unit);
      setPatternWidthInput(String(r3(fromIn(wIn, newUnit))));
      setPatternHeightInput(String(r3(fromIn(wIn * aspectRatio, newUnit))));
    }
    setUnit(newUnit);
  };

  // Changing width → recalculate height
  const handleWidthChange = (raw: string) => {
    setPatternWidthInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      setPatternHeightInput(String(r3(fromIn(toIn(n, unit) * aspectRatio, unit))));
    }
  };

  // Changing height → recalculate width
  const handleHeightChange = (raw: string) => {
    setPatternHeightInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      setPatternWidthInput(String(r3(fromIn(toIn(n, unit) / aspectRatio, unit))));
    }
  };

  // Fetch SVG source
  useEffect(() => {
    if (!viewData?.pattern_file) return;
    fetch(generatePbImage(viewData))
      .then((r) => r.text())
      .then(setSvgString)
      .catch(console.error);
  }, [viewData?.id]);

  // Derived pattern dimensions (width drives the ratio-locked height)
  const patternWIn = (() => {
    const n = parseFloat(patternWidthInput);
    return !isNaN(n) && n > 0 ? toIn(n, unit) : 0;
  })();
  const patternHIn = patternWIn * aspectRatio;

  // Paper dimensions (always stored in inches; presets are inch-native)
  const paperWIn: number | null = React.useMemo(() => {
    if (paperPreset) return PAPER_PRESETS.find((p) => p.name === paperPreset)?.wIn ?? null;
    const n = parseFloat(customPageW);
    return !isNaN(n) && n > 0 ? toIn(n, paperUnit) : null;
  }, [paperPreset, customPageW, paperUnit]);

  const paperHIn: number | null = React.useMemo(() => {
    if (paperPreset) return PAPER_PRESETS.find((p) => p.name === paperPreset)?.hIn ?? null;
    const n = parseFloat(customPageH);
    return !isNaN(n) && n > 0 ? toIn(n, paperUnit) : null;
  }, [paperPreset, customPageH, paperUnit]);

  // Apply orientation to get final page dimensions
  const finalPageW =
    paperWIn !== null && paperHIn !== null
      ? orientation === 'landscape'
        ? Math.max(paperWIn, paperHIn)
        : Math.min(paperWIn, paperHIn)
      : 0;
  const finalPageH =
    paperWIn !== null && paperHIn !== null
      ? orientation === 'landscape'
        ? Math.min(paperWIn, paperHIn)
        : Math.max(paperWIn, paperHIn)
      : 0;

  // Legend dimensions
  const keyCount = viewData?.pattern_key_reference_list?.length ?? 0;
  const legendHIn = legendPhysicalHeightIn(keyCount);
  const effectiveLegendHIn = includeLegend ? legendHIn : 0;
  const effectiveLegendGapIn = includeLegend ? LEGEND_GAP_IN : 0;

  // Fits check for single page
  const availW = finalPageW - 2 * PAGE_MARGIN_IN;
  const availH = finalPageH - 2 * PAGE_MARGIN_IN;
  const requiredH = patternHIn + effectiveLegendGapIn + effectiveLegendHIn;
  const fitsCheck: 'ok' | 'warn' | null =
    finalPageW > 0 && patternWIn > 0 ? (patternWIn <= availW && requiredH <= availH ? 'ok' : 'warn') : null;

  // Tile info
  const tileW = TILE_SHEET_W - 2 * TILE_MARGIN;
  const tileH = TILE_SHEET_H - 2 * TILE_MARGIN - effectiveLegendGapIn - effectiveLegendHIn;
  const tileCols = patternWIn > 0 ? Math.ceil(patternWIn / tileW) : 0;
  const tileRows = patternHIn > 0 ? Math.ceil(patternHIn / tileH) : 0;
  const tilePages = tileCols * tileRows;

  const canExport = !!svgString && patternWIn > 0 && (mode === 'tiled' || (paperWIn !== null && paperHIn !== null));

  const handleExport = useCallback(async () => {
    if (!canExport || !viewData) return;
    setError(null);
    setLoading(true);

    try {
      const authorLine =
        viewData.expand?.authors?.map((a) => a.name).join(', ') || viewData.author_manual?.join(', ') || '';

      // Plain decimal - kept for the XMP metadata and the filename (never a fraction there).
      const projectSizeLabel = `${r2(fromIn(patternWIn, unit))}${unit} × ${r2(fromIn(patternHIn, unit))}${unit}`;
      const fileSizeLabel = `${r2(fromIn(patternWIn, unit))}x${r2(fromIn(patternHIn, unit))}${unit}`;
      // Crafter-friendly - fraction inches for the printed legend only.
      const projectSizeDisplayLabel = `${formatMeasurement(fromIn(patternWIn, unit), unit)} × ${formatMeasurement(fromIn(patternHIn, unit), unit)}`;
      const lineWidthLabel = formatMeasurement(viewData.line_width, viewData.line_width_unit);
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

      const resolvedLegendHIn = legendOutput ? legendOutput.height * (LEGEND_W_IN / LEGEND_SVG_PX) : 0;

      const filteredSvgString = applyHiddenLayers(svgString, hiddenLayers);

      if (mode === 'tiled') {
        await buildTiledPdf({
          svgString: filteredSvgString,
          patternName: viewData.name,
          sizeLabel: fileSizeLabel,
          xmpMeta,
          patternWIn,
          patternHIn,
          lineWidthIn,
          includeLegend,
          legendSvg: legendOutput?.svg ?? '',
          legendHIn: resolvedLegendHIn,
          includeInstructions,
          instructionsMarkdown: viewData.instructions ?? '',
        });
      } else {
        await buildSinglePdf({
          svgString: filteredSvgString,
          patternName: viewData.name,
          sizeLabel: fileSizeLabel,
          xmpMeta,
          patternWIn,
          patternHIn,
          lineWidthIn,
          pageWIn: paperWIn!,
          pageHIn: paperHIn!,
          orientation,
          includeLegend,
          legendSvg: legendOutput?.svg ?? '',
          legendHIn: resolvedLegendHIn,
          includeInstructions,
          instructionsMarkdown: viewData.instructions ?? '',
        });
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [
    canExport,
    viewData,
    svgString,
    hiddenLayers,
    mode,
    orientation,
    paperWIn,
    paperHIn,
    patternWIn,
    patternHIn,
    lineWidthIn,
    legendHIn,
    includeLegend,
    includeInstructions,
    queryClient,
    unit,
  ]);

  return (
    <Box>
      {/* Print mode */}
      <Box sx={{ mb: 2.5 }}>
        <SectionLabel>Print Mode</SectionLabel>

        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, v) => v && setMode(v as PrintMode)}
          sx={toggleGroupSx}
        >
          <ToggleButton value="single">
            <CropFreeIcon fontSize="small" />
            Single Page
          </ToggleButton>

          <ToggleButton value="tiled">
            <GridOnIcon fontSize="small" />
            Tiled (8.5 × 11)
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          {mode === 'single'
            ? 'Fits the pattern onto one page - ideal for large-format printers or any custom size.'
            : 'Splits the pattern across standard 8.5 × 11 sheets. Print and tape together to assemble.'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2.5 }} />

      {/* Pattern size - ratio-locked */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <SectionLabel>Pattern Size</SectionLabel>
          <Tooltip
            title="Width and height are linked - changing either one updates the other to preserve the original aspect ratio."
            arrow
          >
            <LockIcon sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: '2px', cursor: 'help' }} />
          </Tooltip>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 1.5, alignItems: 'flex-start' }}>
          <TextField
            label={`Width (${unit})`}
            size="small"
            variant="filled"
            fullWidth
            value={patternWidthInput}
            onChange={(e) => handleWidthChange(e.target.value)}
          />

          <TextField
            label={`Height (${unit})`}
            size="small"
            variant="filled"
            fullWidth
            value={patternHeightInput}
            onChange={(e) => handleHeightChange(e.target.value)}
          />

          <TextField
            select
            size="small"
            variant="filled"
            label="Unit"
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as PrintUnit)}
          >
            {(['in', 'cm', 'mm'] as PrintUnit[]).map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {/* Single page: paper options */}
      <Collapse in={mode === 'single'}>
        <Box sx={{ mb: 2.5 }}>
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr auto' },
              gap: 2,
              mb: 1.5,
              alignItems: 'center',
            }}
          >
            <Box>
              <SectionLabel>Paper Size</SectionLabel>

              <TextField
                select
                size="small"
                variant="filled"
                label="Common Sizes"
                fullWidth
                value={paperPreset}
                onChange={(e) => {
                  setPaperPreset(e.target.value as PaperPreset);
                  setCustomPageW('');
                  setCustomPageH('');
                }}
              >
                <MenuItem value="">Custom Size</MenuItem>

                {PAPER_PRESETS.map((p) => (
                  <MenuItem key={p.name} value={p.name}>
                    {`${p.name} - ${p.wIn}" × ${p.hIn}"`}
                  </MenuItem>
                ))}
              </TextField>
            </Box>

            <Box>
              <SectionLabel>Orientation</SectionLabel>

              <ToggleButtonGroup
                value={orientation}
                exclusive
                size="small"
                onChange={(_, v) => v && setOrientation(v as Orientation)}
                sx={toggleGroupSx}
              >
                <ToggleButton value="portrait">
                  <Tooltip title="Portrait">
                    <CropPortraitIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
                <ToggleButton value="landscape">
                  <Tooltip title="Landscape">
                    <CropLandscapeIcon fontSize="small" />
                  </Tooltip>
                </ToggleButton>
              </ToggleButtonGroup>
            </Box>
          </Box>

          {/* Custom paper dimensions */}
          <Collapse in={!paperPreset}>
            <Box
              sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 1.5, mb: 1.5, alignItems: 'flex-start' }}
            >
              <TextField
                label={`Width (${paperUnit})`}
                size="small"
                variant="filled"
                fullWidth
                placeholder={paperUnit === 'in' ? 'e.g. 24' : paperUnit === 'cm' ? 'e.g. 61' : 'e.g. 610'}
                value={customPageW}
                onChange={(e) => setCustomPageW(e.target.value)}
              />
              <TextField
                label={`Height (${paperUnit})`}
                size="small"
                variant="filled"
                fullWidth
                placeholder={paperUnit === 'in' ? 'e.g. 36' : paperUnit === 'cm' ? 'e.g. 91' : 'e.g. 914'}
                value={customPageH}
                onChange={(e) => setCustomPageH(e.target.value)}
              />
              <TextField
                select
                size="small"
                variant="filled"
                label="Unit"
                value={paperUnit}
                onChange={(e) => setPaperUnit(e.target.value as PrintUnit)}
              >
                {(['in', 'cm', 'mm'] as PrintUnit[]).map((u) => (
                  <MenuItem key={u} value={u}>
                    {u}
                  </MenuItem>
                ))}
              </TextField>
            </Box>
          </Collapse>

          {/* Fits indicator */}
          {fitsCheck !== null && (
            <Box
              sx={{
                display: 'flex',
                alignItems: 'center',
                gap: 0.75,
                mt: 1,
                color: fitsCheck === 'ok' ? 'success.main' : 'warning.main',
              }}
            >
              {fitsCheck === 'ok' ? (
                <CheckCircleOutlineIcon fontSize="small" sx={{ mt: '1px', flexShrink: 0 }} />
              ) : (
                <WarningAmberIcon fontSize="small" sx={{ mt: '1px', flexShrink: 0 }} />
              )}

              <Typography variant="caption" sx={{ lineHeight: 1.5 }}>
                {fitsCheck === 'ok'
                  ? `Pattern${includeLegend ? ' + legend' : ''} fits on ${paperPreset || 'custom paper'} (${orientation}).`
                  : includeLegend
                    ? `The pattern (${r2(patternWIn)}" × ${r2(patternHIn)}") and legend (${r2(legendHIn)}" tall) need ${r2(requiredH + 2 * PAGE_MARGIN_IN)}" of height but the ${orientation} page provides only ${r2(availH)}". Try a larger paper size or a different orientation.`
                    : `The pattern (${r2(patternWIn)}" × ${r2(patternHIn)}") needs ${r2(requiredH + 2 * PAGE_MARGIN_IN)}" of height but the ${orientation} page provides only ${r2(availH)}". Try a larger paper size or a different orientation.`}
              </Typography>
            </Box>
          )}
        </Box>
      </Collapse>

      {/* Tiled info */}
      <Collapse in={mode === 'tiled' && tilePages > 0}>
        <Box
          sx={{
            mb: 2.5,
            px: 2,
            py: 1.5,
            backgroundColor: alpha('#C8A96E', 0.06),
            border: `1px solid ${alpha('#C8A96E', 0.18)}`,
            borderRadius: 1,
          }}
        >
          <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
            <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
              {tilePages} sheet{tilePages !== 1 ? 's' : ''}
            </Box>{' '}
            - {tileCols} column{tileCols !== 1 ? 's' : ''} × {tileRows} row{tileRows !== 1 ? 's' : ''} of 8.5 × 11
            paper. Each sheet has crop marks and a legend stamp. Align the crop marks and tape the sheets together to
            assemble the full-size pattern.
          </Typography>
        </Box>
      </Collapse>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2 }} />

      <Stack>
        {/* Include legend / instructions toggles */}
        <FormControlLabel
          control={
            <Checkbox checked={includeLegend} onChange={(e) => setIncludeLegend(e.target.checked)} size="small" />
          }
          label={
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Include legend
            </Typography>
          }
          sx={{ mb: 1, ml: 0 }}
        />

        {viewData?.instructions && (
          <FormControlLabel
            control={
              <Checkbox
                checked={includeInstructions}
                onChange={(e) => setIncludeInstructions(e.target.checked)}
                size="small"
              />
            }
            label={
              <Typography variant="body2" sx={{ color: 'text.secondary' }}>
                Append pattern instructions as a separate page
              </Typography>
            }
            sx={{ mb: 2, ml: 0 }}
          />
        )}
      </Stack>

      {/* Error */}
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
          {error}
        </Alert>
      </Collapse>

      <Button
        variant="contained"
        fullWidth
        disabled={!canExport || loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        onClick={handleExport}
        sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
      >
        {loading
          ? 'Generating PDF…'
          : mode === 'tiled'
            ? `Download Tiled PDF${tilePages > 0 ? ` (${tilePages} pages)` : ''}`
            : 'Download PDF'}
      </Button>
    </Box>
  );
};

// ─── Shared styles ────────────────────────────────────────────────────────────

const toggleGroupSx = {
  '& .MuiToggleButton-root': {
    borderColor: alpha('#C8A96E', 0.3),
    color: 'text.secondary',
    px: 2,
    gap: 0.75,
    fontSize: '0.8rem',
    textTransform: 'none' as const,
    '&.Mui-selected': {
      backgroundColor: alpha('#C8A96E', 0.15),
      color: 'primary.main',
      borderColor: alpha('#C8A96E', 0.5),
      '&:hover': { backgroundColor: alpha('#C8A96E', 0.2) },
    },
    '&:hover': { backgroundColor: alpha('#C8A96E', 0.07) },
  },
};
