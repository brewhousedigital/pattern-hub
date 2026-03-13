import React, { useState, useEffect, useCallback } from 'react';
import { pocketbaseDomain } from '@/functions/database/authentication-setup';
import { DecorativeTitle, SectionLabel } from '@/components/ViewHelpers';
import { useGlobalViewData } from '@/data/view';
import { alpha } from '@mui/material/styles';
import CropPortraitIcon from '@mui/icons-material/CropPortrait';
import CropLandscapeIcon from '@mui/icons-material/CropLandscape';
import DownloadIcon from '@mui/icons-material/Download';
import GridOnIcon from '@mui/icons-material/GridOn';
import CropFreeIcon from '@mui/icons-material/CropFree';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';
import {
  Box,
  Button,
  Collapse,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Tooltip,
  Typography,
  Alert,
  CircularProgress,
  Divider,
  FormControl,
  Select,
  MenuItem,
} from '@mui/material';
import jsPDF from 'jspdf';

type PrintMode = 'single' | 'tiled';
type Orientation = 'portrait' | 'landscape';

// ─── Constants ────────────────────────────────────────────────────────────────

// Standard tiling sheet: 8.5 × 11 in with 0.5 in margins on each side
const TILE_SHEET_W_IN = 8.5;
const TILE_SHEET_H_IN = 11;
const TILE_MARGIN_IN = 0.5;
const TILE_PRINTABLE_W = TILE_SHEET_W_IN - TILE_MARGIN_IN * 2; // 7.5 in
const TILE_PRINTABLE_H = TILE_SHEET_H_IN - TILE_MARGIN_IN * 2; // 10 in

const PT_PER_IN = 72; // jsPDF uses points internally

// ─── Helpers ──────────────────────────────────────────────────────────────────

/** Normalize any common unit string to inches */
function toInches(value: number, unit: string): number {
  switch (unit.toLowerCase().trim()) {
    case 'in':
    case 'inch':
    case 'inches':
      return value;
    case 'cm':
      return value / 2.54;
    case 'mm':
      return value / 25.4;
    case 'ft':
      return value * 12;
    case 'px':
      return value / 96;
    default:
      return value; // fallback: assume inches
  }
}

function parseInches(raw: string): number | null {
  // Accept "12", "12in", "12 in", "30cm", "300mm"
  const match = raw.trim().match(/^([\d.]+)\s*(in|inch|inches|cm|mm|ft|px)?$/i);
  if (!match) return null;
  const n = parseFloat(match[1]);
  if (isNaN(n) || n <= 0) return null;
  return toInches(n, match[2] ?? 'in');
}

function slugify(str: string) {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

/** Rasterise an SVG string to a base64 PNG via an offscreen canvas */
async function svgToBase64Png(svgString: string, widthPx: number, heightPx: number): Promise<string> {
  // Ensure namespace present
  const cleaned = svgString.includes('xmlns=')
    ? svgString
    : svgString.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');

  const blob = new Blob([cleaned], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext('2d')!;
      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      URL.revokeObjectURL(url);
      resolve(canvas.toDataURL('image/png'));
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('SVG render failed'));
    };
    img.src = url;
  });
}

// ─── Tiling preview helper ────────────────────────────────────────────────────

interface TileInfo {
  cols: number;
  rows: number;
  pages: number;
}

function calcTileInfo(svgWIn: number, svgHIn: number): TileInfo {
  const cols = Math.ceil(svgWIn / TILE_PRINTABLE_W);
  const rows = Math.ceil(svgHIn / TILE_PRINTABLE_H);
  return { cols, rows, pages: cols * rows };
}

// ─── PDF builders ─────────────────────────────────────────────────────────────

/**
 * Single-page PDF: the SVG is scaled to fit (or fill) the user-defined page,
 * centred, with the specified orientation.
 */
async function buildSinglePdf(
  svgString: string,
  patternName: string,
  pageWIn: number,
  pageHIn: number,
  orientation: Orientation,
  svgWIn: number,
  svgHIn: number,
): Promise<void> {
  // Apply orientation swap
  const finalPageW = orientation === 'landscape' ? Math.max(pageWIn, pageHIn) : Math.min(pageWIn, pageHIn);
  const finalPageH = orientation === 'landscape' ? Math.min(pageWIn, pageHIn) : Math.max(pageWIn, pageHIn);

  const pdf = new jsPDF({
    orientation,
    unit: 'in',
    format: [finalPageW, finalPageH],
  });

  // Scale SVG to fit within the page (with 0.25 in margin)
  const margin = 0.25;
  const availW = finalPageW - margin * 2;
  const availH = finalPageH - margin * 2;
  const scaleX = availW / svgWIn;
  const scaleY = availH / svgHIn;
  const scale = Math.min(scaleX, scaleY, 1); // never upscale beyond natural size
  const drawW = svgWIn * scale;
  const drawH = svgHIn * scale;
  const offsetX = margin + (availW - drawW) / 2;
  const offsetY = margin + (availH - drawH) / 2;

  // Rasterize at 300 DPI
  const normalizedSvg = normalizeStrokeWidths(svgString, svgWIn);
  const pngData = await svgToBase64Png(normalizedSvg, Math.round(drawW * 300), Math.round(drawH * 300));
  pdf.addImage(pngData, 'PNG', offsetX, offsetY, drawW, drawH);

  pdf.save(`${slugify(patternName)}-print.pdf`);
}

/**
 * Tiled PDF: splits the SVG across multiple 8.5 × 11 sheets.
 * Each page shows one tile with crop-mark guides and a tile label (e.g. A1, A2).
 * Overlap of 0.25 in on each edge helps with alignment when taping sheets together.
 */
async function buildTiledPdf(svgString: string, patternName: string, svgWIn: number, svgHIn: number): Promise<void> {
  const OVERLAP = 0.25; // in — bleed/overlap for alignment
  const { cols, rows } = calcTileInfo(svgWIn, svgHIn);

  // Rasterise the full SVG at 150 DPI (enough for tiled assembly guides)
  const fullPx = 150;
  const fullWPx = Math.round(svgWIn * fullPx);
  const fullHPx = Math.round(svgHIn * fullPx);
  const normalizedSvg = normalizeStrokeWidths(svgString, svgWIn);
  const fullPng = await svgToBase64Png(normalizedSvg, fullWPx, fullHPx);

  const pdf = new jsPDF({ orientation: 'portrait', unit: 'in', format: [TILE_SHEET_W_IN, TILE_SHEET_H_IN] });

  let firstPage = true;

  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      if (!firstPage) pdf.addPage([TILE_SHEET_W_IN, TILE_SHEET_H_IN], 'portrait');
      firstPage = false;

      // The slice of the SVG this tile covers (in inches, in SVG space)
      const srcX = col * TILE_PRINTABLE_W;
      const srcY = row * TILE_PRINTABLE_H;
      const srcW = Math.min(TILE_PRINTABLE_W, svgWIn - srcX);
      const srcH = Math.min(TILE_PRINTABLE_H, svgHIn - srcY);

      // Where on the sheet it lands (after margin)
      const dstX = TILE_MARGIN_IN;
      const dstY = TILE_MARGIN_IN;

      // Draw the SVG slice using jsPDF's ability to crop via addImage x/y offset trick:
      // We position the full image so only the tile region falls within the page bounds.
      const imgX = dstX - srcX; // shift left so the right section lines up
      const imgY = dstY - srcY;

      pdf.addImage(fullPng, 'PNG', imgX, imgY, svgWIn, svgHIn);

      // ── Margin / crop marks ──
      const cropLen = 0.15;
      const cropGap = 0.05;
      pdf.setDrawColor(180, 160, 110);
      pdf.setLineWidth(0.005);

      // Top-left
      pdf.line(TILE_MARGIN_IN - cropGap - cropLen, TILE_MARGIN_IN, TILE_MARGIN_IN - cropGap, TILE_MARGIN_IN);
      pdf.line(TILE_MARGIN_IN, TILE_MARGIN_IN - cropGap - cropLen, TILE_MARGIN_IN, TILE_MARGIN_IN - cropGap);
      // Top-right
      const trX = TILE_MARGIN_IN + srcW;
      pdf.line(trX + cropGap, TILE_MARGIN_IN, trX + cropGap + cropLen, TILE_MARGIN_IN);
      pdf.line(trX, TILE_MARGIN_IN - cropGap - cropLen, trX, TILE_MARGIN_IN - cropGap);
      // Bottom-left
      const blY = TILE_MARGIN_IN + srcH;
      pdf.line(TILE_MARGIN_IN - cropGap - cropLen, blY, TILE_MARGIN_IN - cropGap, blY);
      pdf.line(TILE_MARGIN_IN, blY + cropGap, TILE_MARGIN_IN, blY + cropGap + cropLen);
      // Bottom-right
      pdf.line(trX + cropGap, blY, trX + cropGap + cropLen, blY);
      pdf.line(trX, blY + cropGap, trX, blY + cropGap + cropLen);

      // ── Tile label  e.g. "Row 1 / Col 2  (A2)" ──
      const colLabel = String.fromCharCode(65 + col); // A, B, C…
      const label = `${colLabel}${row + 1}  ·  ${patternName}`;
      pdf.setFont('helvetica', 'normal');
      pdf.setFontSize(7);
      pdf.setTextColor(150, 130, 90);
      pdf.text(label, TILE_MARGIN_IN, TILE_SHEET_H_IN - 0.2);

      // Assembly hint on first page
      if (row === 0 && col === 0) {
        pdf.setFontSize(6);
        pdf.text(
          `Tiled ${cols} × ${rows} sheets (${cols * rows} pages) · printable area ${TILE_PRINTABLE_W}" × ${TILE_PRINTABLE_H}" per sheet · align crop marks and tape together`,
          TILE_MARGIN_IN,
          TILE_SHEET_H_IN - 0.12,
        );
      }
    }
  }

  pdf.save(`${slugify(patternName)}-tiled.pdf`);
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportPatternForPrintV2 = () => {
  const { viewData } = useGlobalViewData();

  // Derive default SVG size from viewData
  const defaultSvgW = viewData ? `${viewData.design_width}${viewData.design_width_unit}` : '';
  const defaultSvgH = viewData ? `${viewData.design_height}${viewData.design_height_unit}` : '';

  const [mode, setMode] = useState<PrintMode>('single');
  const [orientation, setOrientation] = useState<Orientation>('portrait');
  const [pageWidth, setPageWidth] = useState('');
  const [pageHeight, setPageHeight] = useState('');
  const [svgWidth, setSvgWidth] = useState(defaultSvgW);
  const [svgHeight, setSvgHeight] = useState(defaultSvgH);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgString, setSvgString] = useState('');

  const [paperSelectionSize, setPaperSelectionSize] = useState<TypePaperSize>();

  React.useEffect(() => {
    if (paperSelectionSize) {
      const thisPaper = PAPER_OPTIONS.find((paper) => paper.name === paperSelectionSize);

      if (thisPaper) {
        setPageWidth(thisPaper.width);
        setPageHeight(thisPaper.height);
      }
    }
  }, [paperSelectionSize]);

  // Keep SVG defaults in sync if viewData loads after mount
  useEffect(() => {
    if (viewData) {
      setSvgWidth(`${viewData.design_width}${viewData.design_width_unit}`);
      setSvgHeight(`${viewData.design_height}${viewData.design_height_unit}`);
    }
  }, [viewData?.id]);

  // Fetch raw SVG
  useEffect(() => {
    if (!viewData) return;

    const url = `${pocketbaseDomain}/api/files/${viewData.collectionId}/${viewData.id}/${viewData.pattern_file}`;

    fetch(url)
      .then((r) => r.text())
      .then(setSvgString)
      .catch(console.error);
  }, [viewData?.id]);

  const svgWIn = svgWidth ? parseInches(svgWidth) : null;
  const svgHIn = svgHeight ? parseInches(svgHeight) : null;
  const pageWIn = pageWidth ? parseInches(pageWidth) : null;
  const pageHIn = pageHeight ? parseInches(pageHeight) : null;

  const tileInfo = svgWIn && svgHIn ? calcTileInfo(svgWIn, svgHIn) : null;

  const canExport =
    !!svgString && svgWIn !== null && svgHIn !== null && (mode === 'tiled' || (pageWIn !== null && pageHIn !== null));

  const handleOrientationChange = (_: React.MouseEvent<HTMLElement>, val: Orientation | null) => {
    if (val) setOrientation(val);
  };

  const handleExport = useCallback(async () => {
    if (!canExport || !svgWIn || !svgHIn) return;

    if (svgWIn && pageWIn && svgWIn > pageWIn) {
      alert(`Your page width of ${pageWidth} is too small for your pattern size ${svgWidth}`);
      return;
    }

    if (svgHIn && pageHIn && svgHIn > pageHIn) {
      alert(`Your page height of ${pageHeight} is too small for your pattern size ${svgHeight}`);
      return;
    }

    setError(null);
    setLoading(true);

    const baseName = viewData?.name ?? 'pattern';
    const name = `${baseName}-${svgWIn}x${svgHIn}`;

    try {
      if (mode === 'tiled') {
        await buildTiledPdf(svgString, name, svgWIn, svgHIn);
      } else {
        await buildSinglePdf(svgString, name, pageWIn!, pageHIn!, orientation, svgWIn, svgHIn);
      }
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [canExport, svgString, mode, orientation, pageWIn, pageHIn, svgWIn, svgHIn, viewData?.name]);

  return (
    <Box
      sx={{
        bgcolor: 'background.paper',
        border: `1px solid ${alpha('#C8A96E', 0.18)}`,
        borderRadius: 1,
        p: 3,
        mb: 3,
      }}
    >
      <DecorativeTitle>Export Pattern for Print</DecorativeTitle>

      <Box sx={{ mb: 2.5 }}>
        <SectionLabel>Print Mode</SectionLabel>

        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, v) => v && setMode(v as PrintMode)}
          sx={{
            '& .MuiToggleButton-root': {
              borderColor: alpha('#C8A96E', 0.3),
              color: 'text.secondary',
              px: 2,
              gap: 0.75,
              fontSize: '0.8rem',
              textTransform: 'none',
              '&.Mui-selected': {
                bgcolor: alpha('#C8A96E', 0.15),
                color: 'primary.main',
                borderColor: alpha('#C8A96E', 0.5),
                '&:hover': { bgcolor: alpha('#C8A96E', 0.2) },
              },
              '&:hover': { bgcolor: alpha('#C8A96E', 0.07) },
            },
          }}
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
            ? 'Fits the pattern onto one page — great for standard and large-format printers.'
            : 'Splits the pattern across standard 8.5 × 11 sheets. Tape them together to assemble full size.'}
        </Typography>
      </Box>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2.5 }} />

      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <SectionLabel>Pattern Size on Paper</SectionLabel>

          <Tooltip
            title="How large the pattern should be when printed. Defaults to the design's original size. You can override this — e.g. enter '24in' to print a 24-inch pattern."
            placement="top"
            arrow
          >
            <InfoOutlinedIcon sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: '2px', cursor: 'help' }} />
          </Tooltip>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 2 }}>
          <TextField
            label="Pattern Width (in/cm/mm)"
            size="small"
            variant="filled"
            fullWidth
            placeholder="e.g. 18in or 45cm"
            value={svgWidth}
            onChange={(e) => setSvgWidth(e.target.value)}
          />

          <TextField
            label="Pattern Height (in/cm/mm)"
            size="small"
            variant="filled"
            fullWidth
            placeholder="e.g. 24in or 60cm"
            value={svgHeight}
            onChange={(e) => setSvgHeight(e.target.value)}
          />
        </Box>
      </Box>

      <Collapse in={mode === 'single'}>
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Paper Size</SectionLabel>

          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 1fr auto' },
              gap: 2,
              alignItems: 'flex-end',
            }}
          >
            <TextField
              variant="filled"
              label="Common Paper Sizes"
              select
              fullWidth
              size="small"
              value={paperSelectionSize}
              onChange={(e) => setPaperSelectionSize(e.target.value as TypePaperSize)}
              sx={{ fontSize: '0.875rem' }}
            >
              {PAPER_OPTIONS.map((size) => (
                <MenuItem key={size.name} value={size.name} sx={{ fontSize: '0.875rem' }}>
                  {`${size.name} - ${size.width} x ${size.height}`}
                </MenuItem>
              ))}
            </TextField>

            <TextField
              label="Paper Width (in/cm/mm)"
              size="small"
              variant="filled"
              fullWidth
              placeholder="e.g. 24in or 61cm"
              value={pageWidth}
              onChange={(e) => setPageWidth(e.target.value)}
            />
            <TextField
              label="Paper Height (in/cm/mm)"
              size="small"
              variant="filled"
              fullWidth
              placeholder="e.g. 36in or 91cm"
              value={pageHeight}
              onChange={(e) => setPageHeight(e.target.value)}
            />

            <Box>
              <SectionLabel>Orientation</SectionLabel>

              <ToggleButtonGroup
                value={orientation}
                exclusive
                onChange={handleOrientationChange}
                size="small"
                sx={{
                  '& .MuiToggleButton-root': {
                    borderColor: alpha('#C8A96E', 0.3),
                    color: 'text.secondary',
                    px: 1.5,
                    '&.Mui-selected': {
                      bgcolor: alpha('#C8A96E', 0.15),
                      color: 'primary.main',
                      borderColor: alpha('#C8A96E', 0.5),
                      '&:hover': { bgcolor: alpha('#C8A96E', 0.2) },
                    },
                    '&:hover': { bgcolor: alpha('#C8A96E', 0.07) },
                  },
                }}
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

          <Collapse in={!pageWidth.trim() || !pageHeight.trim()}>
            <Typography variant="caption" sx={{ color: 'text.secondary', mt: 1, display: 'block' }}>
              Enter paper dimensions. Use any unit: <em>24in</em>, <em>60cm</em>, <em>594mm</em> (A1), etc.
            </Typography>
          </Collapse>
        </Box>
      </Collapse>

      <Collapse in={mode === 'tiled' && tileInfo !== null}>
        {tileInfo && (
          <Box
            sx={{
              mb: 2.5,
              px: 2,
              py: 1.5,
              bgcolor: alpha('#C8A96E', 0.06),
              border: `1px solid ${alpha('#C8A96E', 0.18)}`,
              borderRadius: 1,
            }}
          >
            <Typography variant="body2" sx={{ color: 'text.secondary', lineHeight: 1.8 }}>
              <Box component="span" sx={{ color: 'primary.main', fontWeight: 700 }}>
                {tileInfo.pages} sheet{tileInfo.pages !== 1 ? 's' : ''}
              </Box>{' '}
              — {tileInfo.cols} column{tileInfo.cols !== 1 ? 's' : ''} × {tileInfo.rows} row
              {tileInfo.rows !== 1 ? 's' : ''} of 8.5 × 11 paper. Each sheet has a {TILE_MARGIN_IN}" margin and crop
              marks to guide assembly. Tape pages together along the crop marks to assemble the full pattern.
            </Typography>
          </Box>
        )}
        {svgWIn === null || svgHIn === null ? (
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
            Enter a valid pattern size above to see tiling info.
          </Typography>
        ) : null}
      </Collapse>

      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
          {error}
        </Alert>
      </Collapse>

      <Button
        variant="contained"
        disabled={!canExport || loading}
        startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        onClick={handleExport}
        fullWidth
        sx={{
          bgcolor: canExport && !loading ? 'primary.main' : undefined,
          color: canExport && !loading ? '#0F0D0B' : undefined,
          fontWeight: 700,
          letterSpacing: '0.06em',
          py: 1.1,
          textTransform: 'none',
          '&:hover': { bgcolor: '#DDB97E' },
          '&.Mui-disabled': {
            bgcolor: alpha('#C8A96E', 0.12),
            color: alpha('#C8A96E', 0.3),
          },
        }}
      >
        {loading
          ? 'Generating PDF…'
          : mode === 'tiled'
            ? `Download Tiled PDF${tileInfo ? ` (${tileInfo.pages} pages)` : ''}`
            : 'Download PDF'}
      </Button>
    </Box>
  );
};

type TypePaperSize = 'Letter' | 'Legal' | 'Tabloid' | 'A4' | 'A5' | 'A3' | 'B5' | 'B4' | 'C4';

type TypePaperSizeObject = {
  name: TypePaperSize;
  width: string;
  height: string;
};

const PAPER_OPTIONS: TypePaperSizeObject[] = [
  { name: 'Letter', width: '8.5in', height: '11in' },
  { name: 'Legal', width: '8.5in', height: '14in' },
  { name: 'Tabloid', width: '11in', height: '17in' },
  { name: 'A5', width: '5.8in', height: '8.3in' },
  { name: 'A4', width: '8.3in', height: '11.7in' },
  { name: 'A3', width: '11.7in', height: '16.5in' },
  { name: 'B5', width: '6.9in', height: '9.8in' },
  { name: 'B4', width: '9.8in', height: '13.9in' },
  { name: 'C4', width: '9in', height: '12.8in' },
];

/**
 * Rewrites all stroke-width values in an SVG string so that strokes
 * render at exactly `targetStrokeCm` centimetres at the given print size.
 */
function normalizeStrokeWidths(svgString: string, svgWIn: number, targetStrokeCm: number = 0.1): string {
  const vbMatch = svgString.match(/viewBox=["']\s*([\d.-]+)\s+([\d.-]+)\s+([\d.]+)\s+([\d.]+)/);
  if (!vbMatch) return svgString;

  const viewBoxWidth = parseFloat(vbMatch[3]); // 107.724 user units

  // User units per inch at the intended print size
  // svgWIn is the print width in inches — viewBoxWidth spans that whole width
  const userUnitsPerInch = viewBoxWidth / svgWIn;

  const targetStrokeIn = targetStrokeCm / 2.54;
  const strokeInUserUnits = targetStrokeIn * userUnitsPerInch;

  //console.log({ viewBoxWidth, svgWIn, userUnitsPerInch, targetStrokeIn, strokeInUserUnits });

  let result = svgString.replace(/stroke-width\s*:\s*[\d.]+/g, `stroke-width:${strokeInUserUnits.toFixed(4)}`);
  result = result.replace(/stroke-width=["'][\d.]+["']/g, `stroke-width="${strokeInUserUnits.toFixed(4)}"`);

  return result;
}
