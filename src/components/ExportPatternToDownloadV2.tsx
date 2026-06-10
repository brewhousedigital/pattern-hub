import React, { useState } from 'react';
import { DecorativeTitle, SectionLabel } from '@/components/ViewHelpers';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { sanitizeSvg } from '@/functions/utilities/sanitize-svg';
import type { TypeViewData } from '@/functions/types/types';
import { BorderedCard } from '@/components/cards/BorderedCard';

import { alpha } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import InfoOutlinedIcon from '@mui/icons-material/InfoOutlined';

import {
  Box,
  Typography,
  Button,
  TextField,
  MenuItem,
  Select,
  FormControl,
  Collapse,
  Alert,
  CircularProgress,
  Tooltip,
  ToggleButton,
  ToggleButtonGroup,
} from '@mui/material';

type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
type DpiOption = 72 | 96 | 150 | 300 | 600;

const FORMAT_OPTIONS: { value: ExportFormat; label: string; mime: string }[] = [
  { value: 'png', label: 'PNG  - best for Cricut / vinyl cutters', mime: 'image/png' },
  { value: 'jpg', label: 'JPG  - smaller file, no transparency', mime: 'image/jpeg' },
  { value: 'webp', label: 'WebP - modern web format', mime: 'image/webp' },
  { value: 'svg', label: 'SVG  - vector', mime: 'image/svg+xml' },
];

const DPI_OPTIONS: DpiOption[] = [72, 96, 150, 300, 600];

const UNIT_OPTIONS = ['in', 'cm', 'mm', 'px'] as const;
type Unit = (typeof UNIT_OPTIONS)[number];

function parseToInches(value: string | number, unit: string): number | null {
  const n = typeof value === 'number' ? value : parseFloat(value);

  if (isNaN(n) || n <= 0) return null;

  switch (unit) {
    case 'in':
      return n;
    case 'cm':
      return n / 2.54;
    case 'mm':
      return n / 25.4;
    case 'px':
      return n / 96;
    default:
      return null;
  }
}

function toPx(inches: number, dpi: DpiOption): number {
  return Math.round(inches * dpi);
}

function validateSvg(raw: string): string {
  if (!raw.includes('xmlns=')) {
    return raw.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return raw;
}

/**
 * Ratio-based scale: compute scale from target-pattern / source-pattern,
 * then apply to the SVG's full viewBox. This preserves extra content
 * (rulers, labels) proportionally so the pattern area matches user's request.
 *
 * Strokes are divided by the scale so rendered thickness stays identical.
 */
function scaleSvgByRatio(
  svgString: string,
  scaleX: number,
  scaleY: number,
): { svg: string; finalCanvasW: number; finalCanvasH: number } {
  const parser = new DOMParser();
  const doc = parser.parseFromString(svgString, 'image/svg+xml');
  const svgEl = doc.documentElement;

  // Read source canvas (full SVG coord space, includes ruler/extras)
  let canvasW: number | null = null;
  let canvasH: number | null = null;

  const viewBox = svgEl.getAttribute('viewBox');
  if (viewBox) {
    const parts = viewBox
      .trim()
      .split(/[\s,]+/)
      .map(Number);
    if (parts.length === 4 && parts.every((p) => !isNaN(p))) {
      canvasW = parts[2];
      canvasH = parts[3];
    }
  }

  if (canvasW === null) {
    const wAttr = svgEl.getAttribute('width');
    const hAttr = svgEl.getAttribute('height');
    canvasW = wAttr ? parseFloat(wAttr) : null;
    canvasH = hAttr ? parseFloat(hAttr) : null;
  }

  if (!canvasW || !canvasH) {
    return {
      svg: new XMLSerializer().serializeToString(doc),
      finalCanvasW: 0,
      finalCanvasH: 0,
    };
  }

  // Apply scale to full canvas
  const finalCanvasW = canvasW * scaleX;
  const finalCanvasH = canvasH * scaleY;

  svgEl.setAttribute('width', String(finalCanvasW));
  svgEl.setAttribute('height', String(finalCanvasH));

  if (!viewBox) {
    svgEl.setAttribute('viewBox', `0 0 ${canvasW} ${canvasH}`);
  }

  // Stroke compensation: use min to avoid thinning on stretched axis
  const strokeScale = Math.min(scaleX, scaleY);

  const allElements = doc.querySelectorAll('*');
  allElements.forEach((el) => {
    const strokeWidthAttr = el.getAttribute('stroke-width');
    if (strokeWidthAttr !== null) {
      const original = parseFloat(strokeWidthAttr);
      if (!isNaN(original)) {
        el.setAttribute('stroke-width', String(original / strokeScale));
      }
    }

    const styleAttr = el.getAttribute('style');
    if (styleAttr && styleAttr.includes('stroke-width')) {
      const updated = styleAttr.replace(/stroke-width\s*:\s*([0-9.]+)(px|pt|em|rem|%)?/g, (_match, val, unit) => {
        const original = parseFloat(val);
        if (isNaN(original)) return _match;
        const scaled = original / strokeScale;
        return `stroke-width:${scaled}${unit ?? ''}`;
      });
      el.setAttribute('style', updated);
    }
  });

  return {
    svg: new XMLSerializer().serializeToString(doc),
    finalCanvasW,
    finalCanvasH,
  };
}

async function svgToBitmap(
  svgString: string,
  widthPx: number,
  heightPx: number,
  format: ExportFormat,
  bgColor: string | null,
): Promise<Blob> {
  const validSvg = validateSvg(svgString);
  const clean = sanitizeSvg(validSvg);
  const svgBlob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext('2d')!;

      if (bgColor) {
        ctx.fillStyle = bgColor;
        ctx.fillRect(0, 0, widthPx, heightPx);
      }

      ctx.drawImage(img, 0, 0, widthPx, heightPx);
      URL.revokeObjectURL(url);

      const mime = FORMAT_OPTIONS.find((f) => f.value === format)!.mime;
      const quality = format === 'jpg' ? 0.92 : undefined;

      canvas.toBlob(
        (blob) => {
          if (blob) resolve(blob);
          else reject(new Error('Canvas toBlob returned null'));
        },
        mime,
        quality,
      );
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('Failed to load SVG into Image element'));
    };
    img.src = url;
  });
}

function downloadBlob(blob: Blob, filename: string) {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
}

function slugify(str: string): string {
  return str
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

export const ExportPatternToDownloadV2 = (props: TypeViewData) => {
  const viewData = props.viewData;

  const svgImageUrl = generatePbImage(viewData);

  const [format, setFormat] = useState<ExportFormat>('png');
  const [widthVal, setWidthVal] = useState('');
  const [heightVal, setHeightVal] = useState('');
  const [unit, setUnit] = useState<Unit>('in');
  const [dpi, setDpi] = useState<DpiOption>(300);
  const [jpgBg, setJpgBg] = useState<'white' | 'black'>('white');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  const isSvgExport = format === 'svg';
  const isBitmapRasterExport = !isSvgExport;
  const isJpg = format === 'jpg';

  // Source pattern dims (from DB) in inches
  const sourcePatternWIn =
    viewData?.design_width && viewData?.design_width_unit
      ? parseToInches(viewData.design_width, viewData.design_width_unit)
      : null;
  const sourcePatternHIn =
    viewData?.design_height && viewData?.design_height_unit
      ? parseToInches(viewData.design_height, viewData.design_height_unit)
      : null;

  // Target pattern dims (from user input) in inches
  const targetPatternWIn = parseToInches(widthVal, unit);
  const targetPatternHIn = parseToInches(heightVal, unit);

  // Ratio-based scale factors
  const scaleX = sourcePatternWIn && targetPatternWIn ? targetPatternWIn / sourcePatternWIn : null;
  const scaleY = sourcePatternHIn && targetPatternHIn ? targetPatternHIn / sourcePatternHIn : null;

  const hasSourceDims = sourcePatternWIn !== null && sourcePatternHIn !== null;
  const canExport = scaleX !== null && scaleY !== null && hasSourceDims;

  // Final file canvas dims in inches (pattern + extras, scaled)
  // We don't know exact canvas inches from DB, so estimate via ratio:
  // final_file_in = source_file_in * scale, but we only display target pattern dims.
  // For bitmap export DPI, we need final pixel size → computed inside export handler.

  const SVG_EXPORT_DPI = 96 as DpiOption;

  const outputSummary = (() => {
    if (!canExport) return null;
    if (!hasSourceDims) {
      return 'Pattern source dimensions missing - cannot scale accurately.';
    }
    if (isSvgExport) {
      return `Pattern area: ${widthVal} × ${heightVal} ${unit}. File may be larger if pattern includes ruler/extras. Line thickness preserved.`;
    }
    return `Pattern area: ${widthVal} × ${heightVal} ${unit} at ${dpi} DPI. Final file scales proportionally with any ruler/extras included.`;
  })();

  const handleExport = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      if (!scaleX || !scaleY) {
        throw new Error('Cannot compute scale - missing pattern source dimensions.');
      }

      const response = await fetch(svgImageUrl);
      const svgString = await response.text();

      const baseSlug = slugify(viewData?.name || 'new pattern');

      const validSvg = validateSvg(svgString);
      const clean = sanitizeSvg(validSvg);

      // Apply ratio-based scale. Returns SVG with new width/height in source coord units.
      const { svg: scaledSvg, finalCanvasW, finalCanvasH } = scaleSvgByRatio(clean, scaleX, scaleY);

      if (isSvgExport) {
        const slug = `${baseSlug}-${widthVal}${unit}`;
        const filename = `${slug}.svg`;
        const blob = new Blob([scaledSvg], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, filename);
      } else {
        // For raster: convert scaled canvas units → pixels at target DPI.
        // scaledSvg's width/height are in source-canvas coord units * scale.
        // We need final pixel dims. Source canvas unit ≈ source px, so:
        // final_px_w = finalCanvasW (in source units, already scaled) * (dpi / assumed_source_dpi)
        // Simpler: target pattern inches * dpi gives pattern pixel size,
        // then file pixel size = pattern_px * (finalCanvasW / scaledPatternCoordW).
        // Even simpler: just render scaledSvg at its natural size * (dpi/96).
        const finalPxW = Math.round(finalCanvasW * (dpi / 96));
        const finalPxH = Math.round(finalCanvasH * (dpi / 96));

        const slug = `${baseSlug}-${finalPxW}x${finalPxH}-${dpi}dpi`;
        const filename = `${slug}.${format}`;
        const bg = isJpg ? (jpgBg === 'white' ? '#FFFFFF' : '#000000') : null;
        const blob = await svgToBitmap(scaledSvg, finalPxW, finalPxH, format, bg);
        downloadBlob(blob, filename);
      }

      setSuccess(true);
      setTimeout(() => setSuccess(false), 4000);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  const aspectRatio = sourcePatternWIn && sourcePatternHIn ? sourcePatternHIn / sourcePatternWIn : null;

  const handleWidthChange = (val: string) => {
    setWidthVal(val);
    if (!aspectRatio) return;
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) {
      setHeightVal('');
      return;
    }
    // Ratio derived in inches, but user input is in current unit.
    // Since ratio is unitless (H/W), safe to apply directly.
    const newH = n * aspectRatio;
    setHeightVal(formatNum(newH));
  };

  const handleHeightChange = (val: string) => {
    setHeightVal(val);
    if (!aspectRatio) return;
    const n = parseFloat(val);
    if (isNaN(n) || n <= 0) {
      setWidthVal('');
      return;
    }
    const newW = n / aspectRatio;
    setWidthVal(formatNum(newW));
  };

  const formatNum = (n: number): string => {
    // 2 decimal places, strip trailing zeros
    return parseFloat(n.toFixed(2)).toString();
  };

  return (
    <BorderedCard>
      <DecorativeTitle>Download Pattern</DecorativeTitle>

      {/* Warning if source dims missing */}
      <Collapse in={!hasSourceDims}>
        <Alert severity="warning" sx={{ mb: 2, fontSize: '0.82rem' }}>
          Pattern source dimensions missing from database. Export may not scale accurately.
        </Alert>
      </Collapse>

      {/* Source pattern info */}
      <Collapse in={hasSourceDims}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2, fontStyle: 'italic' }}>
          Source pattern: {viewData?.design_width} × {viewData?.design_height} {viewData?.design_width_unit}
        </Typography>
      </Collapse>

      {/* Format selector */}
      <Box sx={{ mb: 2.5 }}>
        <FormControl size="small" fullWidth variant="filled">
          <TextField
            select
            variant="filled"
            label="File Format"
            value={format}
            onChange={(e) => {
              setFormat(e.target.value as ExportFormat);
              setError(null);
            }}
            sx={{ fontSize: '0.875rem' }}
          >
            {FORMAT_OPTIONS.map((f) => (
              <MenuItem key={f.value} value={f.value} sx={{ fontSize: '0.875rem' }}>
                {f.label}
              </MenuItem>
            ))}
          </TextField>
        </FormControl>
      </Box>

      <SectionLabel>Target Pattern Size (Ratio is kept)</SectionLabel>

      <Box
        sx={{
          display: 'grid',
          gridTemplateColumns: { xs: '1fr', md: '1fr 1fr' },
          gap: 2,
          alignItems: 'flex-end',
          mb: 2,
        }}
      >
        <Box>
          <TextField
            label={`Width (${unit})`}
            size="small"
            variant="filled"
            fullWidth
            placeholder={
              unit === 'in' ? 'e.g. 12' : unit === 'cm' ? 'e.g. 30' : unit === 'mm' ? 'e.g. 300' : 'e.g. 1200'
            }
            value={widthVal}
            onChange={(e) => handleWidthChange(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Box>

        <Box>
          <TextField
            label={`Height (${unit})`}
            size="small"
            variant="filled"
            fullWidth
            placeholder={
              unit === 'in' ? 'e.g. 12' : unit === 'cm' ? 'e.g. 30' : unit === 'mm' ? 'e.g. 300' : 'e.g. 1200'
            }
            value={heightVal}
            onChange={(e) => handleHeightChange(e.target.value)}
            slotProps={{ htmlInput: { inputMode: 'decimal' } }}
          />
        </Box>

        <Box>
          <SectionLabel>Unit</SectionLabel>
          <ToggleButtonGroup
            value={unit}
            exclusive
            size="small"
            onChange={(_, v) => v && setUnit(v as Unit)}
            sx={{
              '& .MuiToggleButton-root': {
                borderColor: alpha('#C8A96E', 0.3),
                color: 'text.secondary',
                px: 1.25,
                fontSize: '0.72rem',
                '&.Mui-selected': {
                  backgroundColor: alpha('#C8A96E', 0.15),
                  color: 'primary.main',
                  borderColor: alpha('#C8A96E', 0.5),
                  '&:hover': { backgroundColor: alpha('#C8A96E', 0.2) },
                },
                '&:hover': { backgroundColor: alpha('#C8A96E', 0.07) },
              },
            }}
          >
            {UNIT_OPTIONS.map((u) => (
              <ToggleButton key={u} value={u}>
                {u}
              </ToggleButton>
            ))}
          </ToggleButtonGroup>
        </Box>

        <Collapse in={isBitmapRasterExport}>
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <SectionLabel>DPI / PPI</SectionLabel>
              <Tooltip
                title="Higher DPI = sharper image, larger file. 300 DPI standard for Cricut and vinyl cutters."
                placement="top"
                arrow
              >
                <InfoOutlinedIcon sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: '2px', cursor: 'help' }} />
              </Tooltip>
            </Box>

            <FormControl size="small" variant="filled" fullWidth>
              <Select value={dpi} onChange={(e) => setDpi(e.target.value as DpiOption)} sx={{ fontSize: '0.875rem' }}>
                {DPI_OPTIONS.map((d) => (
                  <MenuItem key={d} value={d} sx={{ fontSize: '0.875rem' }}>
                    {d} DPI{d === 300 ? ' - recommended' : d === 96 ? ' - screen' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Collapse>
      </Box>

      <Collapse in={isJpg}>
        <Box sx={{ mb: 2 }}>
          <SectionLabel>Background Color</SectionLabel>
          <ToggleButtonGroup
            value={jpgBg}
            exclusive
            size="small"
            onChange={(_, v) => v && setJpgBg(v)}
            sx={{
              '& .MuiToggleButton-root': {
                borderColor: alpha('#C8A96E', 0.3),
                color: 'text.secondary',
                px: 2,
                fontSize: '0.8rem',
                '&.Mui-selected': {
                  backgroundColor: alpha('#C8A96E', 0.15),
                  color: 'primary.main',
                  borderColor: alpha('#C8A96E', 0.5),
                },
                '&:hover': { backgroundColor: alpha('#C8A96E', 0.07) },
              },
            }}
          >
            <ToggleButton value="white">White</ToggleButton>
            <ToggleButton value="black">Black</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Collapse>

      <Collapse in={!!outputSummary}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5, fontStyle: 'italic' }}>
          {outputSummary}
        </Typography>
      </Collapse>

      <Collapse in={!canExport}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
          Enter dimensions above to enable export.
        </Typography>
      </Collapse>

      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
          {error}
        </Alert>
      </Collapse>

      <Collapse in={success}>
        <Alert severity="success" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
          Download started!
        </Alert>
      </Collapse>

      <Box sx={{ mb: 2 }}>
        <Button
          variant="contained"
          disabled={!canExport || loading}
          startIcon={loading ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={handleExport}
          fullWidth
          sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1 }}
        >
          {loading ? 'Exporting…' : `Download Custom ${format.toUpperCase()}`}
        </Button>
      </Box>

      <Collapse in={isSvgExport}>
        <Button
          component="a"
          download
          href={svgImageUrl}
          variant="contained"
          startIcon={<DownloadIcon />}
          fullWidth
          sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1 }}
        >
          Download Original SVG
        </Button>
      </Collapse>
    </BorderedCard>
  );
};
