import { useState, useEffect, useCallback } from 'react';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useExportPattern, downloadBlob } from './useExportPattern';
import { DecorativeTitle, SectionLabel } from '@/components/ViewHelpers';
import { BorderedCard } from '@/components/cards/BorderedCard';
import type { TypeViewData } from '@/functions/types/types';
import type { JpgBackground } from './composite';

import { alpha } from '@mui/material/styles';
import DownloadIcon from '@mui/icons-material/Download';
import LockIcon from '@mui/icons-material/Lock';

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
} from '@mui/material';

// ─── Types ────────────────────────────────────────────────────────────────────

type ImageFormat = 'png' | 'webp' | 'jpg';
type ImageUnit = 'in' | 'cm' | 'px';

// ─── Constants ────────────────────────────────────────────────────────────────

const DPI_OPTIONS = [72, 96, 150, 300, 600] as const;

const FORMAT_LABELS: Record<ImageFormat, string> = {
  png: 'PNG',
  webp: 'WebP',
  jpg: 'JPG',
};

// ─── Unit helpers ─────────────────────────────────────────────────────────────

function dbToIn(value: number, unitStr: string): number {
  const u = unitStr.toLowerCase().trim();
  if (u.startsWith('in')) return value;
  if (u === 'cm') return value / 2.54;
  if (u === 'mm') return value / 25.4;
  if (u === 'px') return value / 96;
  return value;
}

function toIn(val: number, unit: ImageUnit, dpi: number): number {
  if (unit === 'cm') return val / 2.54;
  if (unit === 'px') return val / dpi;
  return val;
}

function fromIn(valIn: number, unit: ImageUnit, dpi: number): number {
  if (unit === 'cm') return valIn * 2.54;
  if (unit === 'px') return Math.round(valIn * dpi);
  return valIn;
}

function r2(n: number): number { return Math.round(n * 100) / 100; }
function r3(n: number): number { return Math.round(n * 1000) / 1000; }

function fmt(val: number, unit: ImageUnit): string {
  if (unit === 'px') return String(Math.round(val));
  return String(r3(val));
}

function slugify(s: string): string {
  return s.toLowerCase().replace(/\s+/g, '-').replace(/[^a-z0-9-]/g, '');
}

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportPatternForImage = ({ viewData }: TypeViewData) => {
  const baseWIn = viewData ? dbToIn(viewData.design_width, viewData.design_width_unit) : 1;
  const baseHIn = viewData ? dbToIn(viewData.design_height, viewData.design_height_unit) : 1;
  const aspectRatio = baseWIn > 0 && baseHIn > 0 ? baseHIn / baseWIn : 1;

  const [format, setFormat] = useState<ImageFormat>('png');
  const [jpgBackground, setJpgBackground] = useState<JpgBackground>('white');
  const [unit, setUnit] = useState<ImageUnit>('in');
  const [dpi, setDpi] = useState(300);
  const [widthInput, setWidthInput] = useState(() => fmt(baseWIn, 'in'));
  const [heightInput, setHeightInput] = useState(() => fmt(baseHIn, 'in'));
  const [includeInstructions, setIncludeInstructions] = useState(!!viewData?.instructions);

  const { runExport, isExporting, error } = useExportPattern();

  useEffect(() => {
    if (!viewData) return;
    setWidthInput(fmt(fromIn(baseWIn, unit, dpi), unit));
    setHeightInput(fmt(fromIn(baseHIn, unit, dpi), unit));
    setIncludeInstructions(!!viewData.instructions);
  }, [viewData?.id]);

  const handleUnitChange = (newUnit: ImageUnit) => {
    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    if (!isNaN(w) && w > 0) setWidthInput(fmt(fromIn(toIn(w, unit, dpi), newUnit, dpi), newUnit));
    if (!isNaN(h) && h > 0) setHeightInput(fmt(fromIn(toIn(h, unit, dpi), newUnit, dpi), newUnit));
    setUnit(newUnit);
  };

  const handleWidthChange = (raw: string) => {
    setWidthInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      setHeightInput(fmt(fromIn(toIn(n, unit, dpi) * aspectRatio, unit, dpi), unit));
    }
  };

  const handleHeightChange = (raw: string) => {
    setHeightInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      setWidthInput(fmt(fromIn(toIn(n, unit, dpi) / aspectRatio, unit, dpi), unit));
    }
  };

  const widthIn = (() => {
    const n = parseFloat(widthInput);
    return !isNaN(n) && n > 0 ? toIn(n, unit, dpi) : 0;
  })();

  const canExport = !!viewData && widthIn > 0;

  const handleDownload = useCallback(async () => {
    if (!viewData || !canExport) return;

    const authorLine =
      viewData.expand?.authors?.map((a) => a.name).join(', ') ||
      viewData.author_manual?.join(', ') ||
      '';

    const widthVal = parseFloat(widthInput);
    const heightVal = parseFloat(heightInput);

    try {
      const blob = await runExport(
        {
          patternFileUrl: generatePbImage(viewData),
          patternName: viewData.name,
          authorLine,
          pieces: viewData.pieces,
          designDate: viewData.design_date as Date | null,
          designWidth: viewData.design_width,
          designWidthUnit: viewData.design_width_unit,
          designHeight: viewData.design_height,
          designHeightUnit: viewData.design_height_unit,
          lineWidth: viewData.line_width,
          lineWidthUnit: viewData.line_width_unit,
          instructionsMarkdown: viewData.instructions ?? '',
          patternKeys: viewData.pattern_key_reference_list ?? [],
        },
        {
          format,
          svgVariant: 'scaled',
          width: isNaN(widthVal) ? 0 : widthVal,
          height: isNaN(heightVal) ? 0 : heightVal,
          unit,
          dpi,
          jpgBackground,
          includeInstructions,
        },
      );

      const sizeLabel =
        unit === 'px'
          ? `${Math.round(widthVal)}x${Math.round(heightVal)}px`
          : `${r2(widthIn)}in-${dpi}dpi`;
      downloadBlob(blob, `${slugify(viewData.name)}-${sizeLabel}.${format}`);
    } catch {
      // error state managed by useExportPattern
    }
  }, [viewData, canExport, format, jpgBackground, unit, dpi, widthInput, heightInput, widthIn, includeInstructions, runExport]);

  return (
    <BorderedCard>
      <DecorativeTitle>Export Image</DecorativeTitle>

      {/* Format */}
      <Box sx={{ mb: 2.5 }}>
        <SectionLabel>Format</SectionLabel>
        <ToggleButtonGroup
          value={format}
          exclusive
          size="small"
          onChange={(_, v) => v && setFormat(v as ImageFormat)}
          sx={toggleGroupSx}
        >
          <ToggleButton value="png">PNG</ToggleButton>
          <ToggleButton value="webp">WebP</ToggleButton>
          <ToggleButton value="jpg">JPG</ToggleButton>
        </ToggleButtonGroup>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          {format === 'png' && 'Lossless with transparent background.'}
          {format === 'webp' && 'Modern format with transparent background.'}
          {format === 'jpg' && 'Compressed with a solid background color.'}
        </Typography>
      </Box>

      {/* JPG background */}
      <Collapse in={format === 'jpg'}>
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Background Color</SectionLabel>
          <ToggleButtonGroup
            value={jpgBackground}
            exclusive
            size="small"
            onChange={(_, v) => v && setJpgBackground(v as JpgBackground)}
            sx={toggleGroupSx}
          >
            <ToggleButton value="white">White</ToggleButton>
            <ToggleButton value="black">Black</ToggleButton>
          </ToggleButtonGroup>
        </Box>
      </Collapse>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2.5 }} />

      {/* Output size */}
      <Box sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
          <SectionLabel>Output Size</SectionLabel>
          <Tooltip title="Editing either dimension updates the other to preserve the aspect ratio." arrow>
            <LockIcon sx={{ fontSize: '0.8rem', color: 'text.secondary', mb: '2px', cursor: 'help' }} />
          </Tooltip>
        </Box>

        <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr 80px', gap: 1.5, alignItems: 'flex-start' }}>
          <TextField
            label={`Width (${unit})`}
            size="small"
            variant="filled"
            fullWidth
            value={widthInput}
            onChange={(e) => handleWidthChange(e.target.value)}
          />
          <TextField
            label={`Height (${unit})`}
            size="small"
            variant="filled"
            fullWidth
            value={heightInput}
            onChange={(e) => handleHeightChange(e.target.value)}
          />
          <TextField
            select
            size="small"
            variant="filled"
            label="Unit"
            value={unit}
            onChange={(e) => handleUnitChange(e.target.value as ImageUnit)}
          >
            {(['in', 'cm', 'px'] as ImageUnit[]).map((u) => (
              <MenuItem key={u} value={u}>
                {u}
              </MenuItem>
            ))}
          </TextField>
        </Box>
      </Box>

      {/* DPI — hidden when unit is px */}
      <Collapse in={unit !== 'px'}>
        <Box sx={{ mb: 2.5 }}>
          <SectionLabel>Resolution (DPI)</SectionLabel>
          <TextField
            select
            size="small"
            variant="filled"
            label="DPI"
            value={dpi}
            onChange={(e) => setDpi(Number(e.target.value))}
            sx={{ minWidth: 140 }}
          >
            {DPI_OPTIONS.map((d) => (
              <MenuItem key={d} value={d}>
                {d} DPI
              </MenuItem>
            ))}
          </TextField>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
            {dpi <= 96 && 'Good for screen display.'}
            {dpi === 150 && 'Good for general printing.'}
            {dpi === 300 && 'Standard print quality.'}
            {dpi >= 600 && 'High-quality print — large file size.'}
          </Typography>
        </Box>
      </Collapse>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2 }} />

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
              Append pattern instructions
            </Typography>
          }
          sx={{ mb: 2, ml: 0 }}
        />
      )}

      <Collapse in={!!error}>
        <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
          {error?.message}
        </Alert>
      </Collapse>

      <Button
        variant="contained"
        fullWidth
        disabled={!canExport || isExporting}
        startIcon={isExporting ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
        onClick={handleDownload}
        sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
      >
        {isExporting ? 'Generating image…' : `Download ${FORMAT_LABELS[format]}`}
      </Button>
    </BorderedCard>
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
      bgcolor: alpha('#C8A96E', 0.15),
      color: 'primary.main',
      borderColor: alpha('#C8A96E', 0.5),
      '&:hover': { bgcolor: alpha('#C8A96E', 0.2) },
    },
    '&:hover': { bgcolor: alpha('#C8A96E', 0.07) },
  },
};
