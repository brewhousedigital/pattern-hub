import React, { useState } from 'react';
import { DecorativeTitle, SectionLabel } from '@/components/ViewHelpers';
import { useGlobalViewData } from '@/data/view';

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
import { pocketbaseDomain } from '@/functions/database/authentication-setup.ts';

type ExportFormat = 'png' | 'jpg' | 'webp' | 'svg';
type DpiOption = 72 | 96 | 150 | 300 | 600;

const FORMAT_OPTIONS: { value: ExportFormat; label: string; mime: string }[] = [
  { value: 'png', label: 'PNG  — best for Cricut / vinyl cutters', mime: 'image/png' },
  { value: 'jpg', label: 'JPG  — smaller file, no transparency', mime: 'image/jpeg' },
  { value: 'webp', label: 'WebP — modern web format', mime: 'image/webp' },
  { value: 'svg', label: 'SVG  — vector, resolution-independent', mime: 'image/svg+xml' },
];

const DPI_OPTIONS: DpiOption[] = [72, 96, 150, 300, 600];

const UNIT_OPTIONS = ['in', 'cm', 'mm', 'px'] as const;
type Unit = (typeof UNIT_OPTIONS)[number];

function parseToInches(value: string, unit: Unit): number | null {
  const n = parseFloat(value);
  if (isNaN(n) || n <= 0) return null;
  switch (unit) {
    case 'in':
      return n;
    case 'cm':
      return n / 2.54;
    case 'mm':
      return n / 25.4;
    case 'px':
      return n / 96; // treat px as 96 DPI screen pixels → inches
  }
}

function toPx(inches: number, dpi: DpiOption): number {
  return Math.round(inches * dpi);
}

function sanitizeSvg(raw: string): string {
  // Ensure the SVG has an XML namespace so canvas can render it
  if (!raw.includes('xmlns=')) {
    return raw.replace('<svg', '<svg xmlns="http://www.w3.org/2000/svg"');
  }
  return raw;
}

async function svgToBitmap(
  svgString: string,
  widthPx: number,
  heightPx: number,
  format: ExportFormat,
  bgColor: string | null,
): Promise<Blob> {
  const clean = sanitizeSvg(svgString);
  const svgBlob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
  const url = URL.createObjectURL(svgBlob);

  return new Promise((resolve, reject) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement('canvas');
      canvas.width = widthPx;
      canvas.height = heightPx;
      const ctx = canvas.getContext('2d')!;

      // Fill background for JPG (no alpha channel)
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

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportPatternToDownload = () => {
  const { viewData } = useGlobalViewData();

  const svgImageUrl = `${pocketbaseDomain}/api/files/${viewData?.collectionId}/${viewData?.id}/${viewData?.pattern_file}`;

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

  const widthInches = parseToInches(widthVal, unit);
  const heightInches = parseToInches(heightVal, unit);

  const widthPx = widthInches ? toPx(widthInches, dpi) : null;
  const heightPx = heightInches ? toPx(heightInches, dpi) : null;

  const canExport = isSvgExport
    ? true // SVG doesn't need dimensions
    : widthPx !== null && heightPx !== null;

  const outputSummary = (() => {
    if (isSvgExport) return 'Vector — scales to any size losslessly.';
    if (!widthPx || !heightPx) return null;
    const mp = ((widthPx * heightPx) / 1_000_000).toFixed(1);
    return `Output: ${widthPx} × ${heightPx} px  (${mp} MP) — ready for Cricut / vinyl cutters at ${dpi} DPI.`;
  })();

  const handleExport = async () => {
    setError(null);
    setSuccess(false);
    setLoading(true);

    try {
      // Fetch the SVG data directly from Pocketbase
      const response = await fetch(svgImageUrl);
      const svgString = await response.text();

      const slug = slugify(viewData?.name || 'new pattern');
      const filename = `${slug}.${format}`;

      if (isSvgExport) {
        const clean = sanitizeSvg(svgString);
        const blob = new Blob([clean], { type: 'image/svg+xml;charset=utf-8' });
        downloadBlob(blob, filename);
      } else {
        if (!widthPx || !heightPx) throw new Error('Invalid dimensions.');
        const bg = isJpg ? (jpgBg === 'white' ? '#FFFFFF' : '#000000') : null;
        const blob = await svgToBitmap(svgString, widthPx, heightPx, format, bg);
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
      <DecorativeTitle>Download Pattern</DecorativeTitle>

      {/* ── Format selector ── */}
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

      {/* ── Raster options (hidden for SVG) ── */}
      <Collapse in={isBitmapRasterExport}>
        <Box
          sx={{
            display: 'grid',
            gridTemplateColumns: { xs: '1fr', md: '1fr 1fr 146px 1fr' },
            gap: 2,
            alignItems: 'flex-end',
            mb: 2,
          }}
        >
          {/* Width */}
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
              onChange={(e) => setWidthVal(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Box>

          {/* Height */}
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
              onChange={(e) => setHeightVal(e.target.value)}
              slotProps={{ htmlInput: { inputMode: 'decimal' } }}
            />
          </Box>

          {/* Unit */}
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
                  fontFamily: "'Lato', sans-serif",
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
              {UNIT_OPTIONS.map((u) => (
                <ToggleButton key={u} value={u}>
                  {u}
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
          </Box>

          {/* DPI */}
          <Box>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.5 }}>
              <SectionLabel>DPI / PPI</SectionLabel>
              <Tooltip
                title="Higher DPI = sharper image, larger file. 300 DPI is standard for Cricut and most vinyl cutters. 600 DPI for fine detail work."
                placement="top"
                arrow
              >
                <InfoOutlinedIcon sx={{ fontSize: '0.85rem', color: 'text.secondary', mb: '2px', cursor: 'help' }} />
              </Tooltip>
            </Box>
            <FormControl size="small" variant="filled" fullWidth>
              <Select
                value={dpi}
                onChange={(e) => setDpi(e.target.value as DpiOption)}
                sx={{ fontFamily: "'Lato', sans-serif", fontSize: '0.875rem' }}
              >
                {DPI_OPTIONS.map((d) => (
                  <MenuItem key={d} value={d} sx={{ fontFamily: "'Lato', sans-serif", fontSize: '0.875rem' }}>
                    {d} DPI{d === 300 ? ' — recommended' : d === 96 ? ' — screen' : ''}
                  </MenuItem>
                ))}
              </Select>
            </FormControl>
          </Box>
        </Box>

        {/* JPG background color */}
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
                  fontFamily: "'Lato', sans-serif",
                  '&.Mui-selected': {
                    bgcolor: alpha('#C8A96E', 0.15),
                    color: 'primary.main',
                    borderColor: alpha('#C8A96E', 0.5),
                  },
                  '&:hover': { bgcolor: alpha('#C8A96E', 0.07) },
                },
              }}
            >
              <ToggleButton value="white">White</ToggleButton>
              <ToggleButton value="black">Black</ToggleButton>
            </ToggleButtonGroup>
          </Box>
        </Collapse>

        {/* Output summary */}
        <Collapse in={!!outputSummary}>
          <Typography
            variant="caption"
            sx={{ color: 'text.secondary', display: 'block', mb: 1.5, fontStyle: 'italic' }}
          >
            {outputSummary}
          </Typography>
        </Collapse>

        {/* Prompt to fill in dimensions */}
        <Collapse in={!canExport}>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1.5 }}>
            Enter dimensions above to enable export.
          </Typography>
        </Collapse>
      </Collapse>

      {/* SVG note */}
      <Collapse in={isSvgExport}>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2, fontStyle: 'italic' }}>
          SVG exports the original vector file — no size needed. Scale it to any dimension in your software.
        </Typography>
      </Collapse>

      {/* Feedback */}
      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1.5, fontFamily: "'Lato', sans-serif", fontSize: '0.82rem' }}>
          {error}
        </Alert>
      </Collapse>
      <Collapse in={success}>
        <Alert severity="success" sx={{ mb: 1.5, fontFamily: "'Lato', sans-serif", fontSize: '0.82rem' }}>
          Download started!
        </Alert>
      </Collapse>

      {/* CTA */}
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
          fontFamily: "'Lato', sans-serif",
          letterSpacing: '0.06em',
          py: 1.1,
          '&:hover': { bgcolor: '#DDB97E' },
          '&.Mui-disabled': {
            bgcolor: alpha('#C8A96E', 0.12),
            color: alpha('#C8A96E', 0.3),
          },
        }}
      >
        {loading ? 'Exporting…' : `Download ${format.toUpperCase()}`}
      </Button>
    </Box>
  );
};
