import React, { useState, useEffect, useCallback } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { applyHiddenLayers } from '@/functions/utilities/sanitize-svg';
import { resolveDefaultExportUnit } from '@/functions/utilities/format-measurement';
import { buildSvgExportBlob } from './buildSvgExport';
import { downloadBlob } from './useExportPattern';
import { trackExportEvent } from '@/functions/database/export-analytics';
import { useGlobalAuthData } from '@/data/auth-data';
import { SectionLabel } from '@/components/ViewHelpers';
import { CollapsibleCard } from '@/components/cards/CollapsibleCard';
import type { TypeViewData } from '@/functions/types/types';

import { alpha } from '@mui/material/styles';
import AspectRatioIcon from '@mui/icons-material/AspectRatio';
import CropFreeIcon from '@mui/icons-material/CropFree';
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
  Stack,
} from '@mui/material';

// ─── Constants ────────────────────────────────────────────────────────────────

const LEGEND_W_IN = 2.5;
const LEGEND_SVG_PX = 320;
const LEGEND_GAP_IN = 0.2;

// ─── Types ────────────────────────────────────────────────────────────────────

type SvgExportMode = 'original' | 'custom';
type PrintUnit = 'in' | 'cm' | 'mm';

const SUPPORTED_UNITS: PrintUnit[] = ['in', 'cm', 'mm'];

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

function slugify(s: string): string {
  return s
    .toLowerCase()
    .replace(/\s+/g, '-')
    .replace(/[^a-z0-9-]/g, '');
}

// ─── Legend geometry - mirrors render-legend.ts height formula exactly ────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export const ExportPatternForSVG = ({
  viewData,
  hiddenLayers = new Set<string>(),
}: TypeViewData & { hiddenLayers?: Set<string> }) => {
  const queryClient = useQueryClient();
  const { authData } = useGlobalAuthData();

  const baseWIn = viewData ? dbToIn(viewData.design_width, viewData.design_width_unit) : 1;
  const baseHIn = viewData ? dbToIn(viewData.design_height, viewData.design_height_unit) : 1;
  const aspectRatio = baseWIn > 0 && baseHIn > 0 ? baseHIn / baseWIn : 1;
  const lineWidthIn = viewData ? Math.max(dbToIn(viewData.line_width, viewData.line_width_unit), 0.005) : 0.039;

  const defaultUnit = resolveDefaultExportUnit(
    authData?.preferred_measurement_unit,
    viewData?.design_width_unit,
    SUPPORTED_UNITS,
  );

  const [mode, setMode] = useState<SvgExportMode>('original');
  const [unit, setUnit] = useState<PrintUnit>(defaultUnit);
  const [patternWidthInput, setPatternWidthInput] = useState(() => String(r3(baseWIn)));
  const [patternHeightInput, setPatternHeightInput] = useState(() => String(r3(baseHIn)));
  const [includeInstructions, setIncludeInstructions] = useState(!!viewData?.instructions);
  const [includeLegend, setIncludeLegend] = useState(true);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgString, setSvgString] = useState('');

  // Fetch SVG source
  useEffect(() => {
    if (!viewData?.pattern_file) return;
    fetch(generatePbImage(viewData))
      .then((r) => r.text())
      .then(setSvgString)
      .catch(console.error);
  }, [viewData?.id]);

  // Sync inputs when viewData changes
  useEffect(() => {
    if (viewData) {
      const resolvedUnit = resolveDefaultExportUnit(
        authData?.preferred_measurement_unit,
        viewData.design_width_unit,
        SUPPORTED_UNITS,
      );
      setUnit(resolvedUnit);
      setPatternWidthInput(String(r3(fromIn(baseWIn, resolvedUnit))));
      setPatternHeightInput(String(r3(fromIn(baseHIn, resolvedUnit))));
      setIncludeInstructions(!!viewData.instructions);
    }
  }, [viewData?.id]);

  const handleUnitChange = (newUnit: PrintUnit) => {
    const w = parseFloat(patternWidthInput);
    const h = parseFloat(patternHeightInput);
    if (!isNaN(w) && w > 0) setPatternWidthInput(String(r3(fromIn(toIn(w, unit), newUnit))));
    if (!isNaN(h) && h > 0) setPatternHeightInput(String(r3(fromIn(toIn(h, unit), newUnit))));
    setUnit(newUnit);
  };

  // Bidirectional ratio-locked handlers - each updates only the OTHER field
  const handleWidthChange = (raw: string) => {
    setPatternWidthInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      setPatternHeightInput(String(r3(fromIn(toIn(n, unit) * aspectRatio, unit))));
    }
  };

  const handleHeightChange = (raw: string) => {
    setPatternHeightInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) {
      setPatternWidthInput(String(r3(fromIn(toIn(n, unit) / aspectRatio, unit))));
    }
  };

  // Derived dimensions - original mode always uses DB values
  const patternWIn = (() => {
    if (mode === 'original') return baseWIn;
    const n = parseFloat(patternWidthInput);
    return !isNaN(n) && n > 0 ? toIn(n, unit) : 0;
  })();
  const patternHIn = patternWIn * aspectRatio;

  const keyCount = viewData?.pattern_key_reference_list?.length ?? 0;
  const legendHIn = legendPhysicalHeightIn(keyCount);

  const canExport = !!svgString && patternWIn > 0;

  const handleExport = useCallback(async () => {
    if (!canExport || !viewData) return;
    setError(null);
    setLoading(true);

    try {
      const filteredSvgString = applyHiddenLayers(svgString, hiddenLayers);
      const blob = await buildSvgExportBlob({
        svgString: filteredSvgString,
        viewData,
        mode,
        patternWIn,
        patternHIn,
        lineWidthIn,
        includeLegend,
        includeInstructions,
        queryClient,
      });

      downloadBlob(blob, `${slugify(viewData.name)}${mode === 'custom' ? `-${r2(patternWIn)}in` : ''}.svg`);

      void trackExportEvent({
        pattern_id: viewData.id,
        file_type: 'svg',
        flow: '',
        width: fromIn(patternWIn, unit),
        height: fromIn(patternHIn, unit),
        size_unit: unit,
        dpi: 0,
        page_size: '',
        pdf_mode: '',
        legend_included: includeLegend,
        instructions_included: includeInstructions,
      });
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
    patternWIn,
    patternHIn,
    lineWidthIn,
    includeLegend,
    includeInstructions,
    queryClient,
    unit,
  ]);

  return (
    <Box>
      {/* Export type */}
      <Box sx={{ mb: 2.5 }}>
        <SectionLabel>Export Type</SectionLabel>

        <ToggleButtonGroup
          value={mode}
          exclusive
          size="small"
          onChange={(_, v) => v && setMode(v as SvgExportMode)}
          sx={toggleGroupSx}
        >
          <ToggleButton value="original">
            <CropFreeIcon fontSize="small" />
            Original Size
          </ToggleButton>
          <ToggleButton value="custom">
            <AspectRatioIcon fontSize="small" />
            Custom Size
          </ToggleButton>
        </ToggleButtonGroup>

        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.75 }}>
          {mode === 'original'
            ? `Downloads at the original designed size (${r2(baseWIn)}" × ${r2(baseHIn)}") with the legend embedded.`
            : 'Scale to any size while keeping line thickness consistent.'}
        </Typography>
      </Box>

      {/* Custom size inputs */}
      <Collapse in={mode === 'custom'}>
        <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2.5 }} />

        <Box sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
            <SectionLabel>Pattern Size</SectionLabel>
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
      </Collapse>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 2 }} />

      <Stack>
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
                Append pattern instructions
              </Typography>
            }
            sx={{ mb: 2, ml: 0 }}
          />
        )}
      </Stack>

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
        {loading ? 'Generating SVG…' : 'Download SVG'}
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
