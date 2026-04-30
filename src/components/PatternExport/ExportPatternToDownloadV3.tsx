// This component is driving the export flow. Pure UI + form state — all heavy lifting is in useExportPattern.
//
// PROPS
//   pattern                 — the TypePatternResponse row
//   patternFileUrl          — resolved absolute URL of the SVG (caller computes
//                              from PocketBase file token)
//   authorLine              — pre-joined "by X, Y" string
//   patternKeys             — { fullPath, name }[] for the legend

import { useMemo, useState } from 'react';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { DecorativeTitle } from '@/components/ViewHelpers';
import {
  downloadBlob,
  type TypeExportFormState,
  type TypeExportPatternContext,
  useExportPattern,
} from './useExportPattern';
import { type ExportFormat, type JpgBackground, type SvgVariant } from './composite';
import { type TypePatternExportUnit } from './units';

import DownloadIcon from '@mui/icons-material/Download';

import {
  Box,
  Button,
  CircularProgress,
  FormControl,
  FormControlLabel,
  InputLabel,
  MenuItem,
  Select,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
  Typography,
} from '@mui/material';

const FORMAT_OPTIONS: { value: ExportFormat; label: string; mime: string }[] = [
  { value: 'png', label: 'PNG  — best for Cricut / vinyl cutters', mime: 'image/png' },
  { value: 'jpg', label: 'JPG  — smaller file, no transparency', mime: 'image/jpeg' },
  { value: 'webp', label: 'WebP — modern web format', mime: 'image/webp' },
  { value: 'svg', label: 'SVG  — vector', mime: 'image/svg+xml' },
];

const UNIT_OPTIONS: TypePatternExportUnit[] = ['in', 'cm', 'mm', 'px'];
const DPI_OPTIONS = [72, 96, 150, 300, 600] as const;

export interface ExportPatternToDownloadV3Props {
  ctx: TypeExportPatternContext;
}

export function ExportPatternToDownloadV3({ ctx }: ExportPatternToDownloadV3Props) {
  if (!ctx?.patternName) {
    return (
      <BorderedCard>
        <DecorativeTitle>Download Pattern</DecorativeTitle>
        <Box sx={{ textAlign: 'center' }}>
          <CircularProgress />
        </Box>
      </BorderedCard>
    );
  }

  const aspectRatio = ctx.designWidth && ctx.designHeight ? ctx.designHeight / ctx.designWidth : 1;

  // Sensible defaults: pre-fill the size with the pattern's own design size.
  const [form, setForm] = useState<TypeExportFormState>(() => ({
    format: 'png',
    svgVariant: 'scaled',
    width: ctx.designWidth,
    height: ctx.designHeight,
    unit: (ctx.designWidthUnit as TypePatternExportUnit) || 'in',
    dpi: 300,
    jpgBackground: 'white',
    includeInstructions: true,
  }));

  const { runExport, isExporting, error } = useExportPattern();

  // DPI picker is irrelevant when the user is working in pixels — pixels are
  // already an absolute output unit.
  const showDpi = form.unit !== 'px';

  // File extension for download name follows the chosen format.
  const filename = useMemo(() => {
    const safe = ctx.patternName.toLowerCase().replace(/[^a-z0-9]+/g, '-');

    const ext = form.format === 'jpg' ? 'jpg' : form.format;

    return `${safe || 'pattern'}.${ext}`;
  }, [ctx.patternName, form.format]);

  // Generic param `FieldName`: must be one of the keys in TypeExportFormState
  //   (i.e. 'format' | 'svgVariant' | 'width' | 'height' | ...)
  // Param `fieldName`: the specific key being updated this call
  // Param `fieldValue`: must match the type of THAT field
  //   (e.g. if fieldName='width', fieldValue must be number;
  //         if fieldName='format', fieldValue must be ExportFormat)
  const update = <FieldName extends keyof TypeExportFormState>(
    fieldName: FieldName,
    fieldValue: TypeExportFormState[FieldName],
  ) => {
    // If width or height is passed, make sure that the other is updated with the correct aspect ratio
    if (fieldName === 'width') {
      const newHeight = Math.round(Number(fieldValue) * aspectRatio * 100) / 100;

      setForm((previousForm) => {
        // Spread old form, overwrite the one field
        return {
          ...previousForm,
          width: Number(fieldValue),
          height: newHeight,
        };
      });

      return;
    }

    if (fieldName === 'height') {
      const newWidth = Math.round((Number(fieldValue) / aspectRatio) * 100) / 100;

      setForm((previousForm) => {
        // Spread old form, overwrite the one field
        return {
          ...previousForm,
          height: Number(fieldValue),
          width: newWidth,
        };
      });

      return;
    }

    setForm((previousForm) => {
      // Spread old form, overwrite the one field
      return {
        ...previousForm,
        [fieldName]: fieldValue,
      };
    });
  };

  async function handleDownload() {
    const blob = await runExport(ctx, form);
    downloadBlob(blob, filename);
  }

  return (
    <BorderedCard>
      <DecorativeTitle>Download Pattern V3</DecorativeTitle>

      <Box sx={{ mb: 3 }}>
        <Stack spacing={2.5} sx={{ pt: 1 }}>
          {/* ── Format ───────────────────────────────────────────────────── */}
          <FormControl fullWidth size="small">
            <InputLabel>Format</InputLabel>
            <Select
              label="Format"
              value={form.format}
              onChange={(e) => update('format', e.target.value as ExportFormat)}
            >
              {FORMAT_OPTIONS.map((o) => (
                <MenuItem key={o.value} value={o.value}>
                  {o.label}
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* ── SVG sub-options (only for svg) ───────────────────────────── */}
          {form.format === 'svg' && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={form.svgVariant}
              onChange={(_, v: SvgVariant | null) => v && update('svgVariant', v)}
            >
              <ToggleButton value="scaled">Scaled to target size</ToggleButton>
              <ToggleButton value="original">Original file</ToggleButton>
            </ToggleButtonGroup>
          )}

          {/* ── JPG background (only for jpg) ────────────────────────────── */}
          {form.format === 'jpg' && (
            <ToggleButtonGroup
              exclusive
              size="small"
              value={form.jpgBackground}
              onChange={(_, v: JpgBackground | null) => v && update('jpgBackground', v)}
            >
              <ToggleButton value="white">White background</ToggleButton>
              <ToggleButton value="black">Black background</ToggleButton>
            </ToggleButtonGroup>
          )}

          {/* ── Target size (hidden when exporting the original SVG) ─────── */}
          {!(form.format === 'svg' && form.svgVariant === 'original') && (
            <>
              <Stack direction="row" spacing={1.5}>
                <TextField
                  label="Width"
                  type="number"
                  size="small"
                  value={form.width}
                  onChange={(e) => update('width', Number(e.target.value))}
                  fullWidth
                />
                <TextField
                  label="Height"
                  type="number"
                  size="small"
                  value={form.height}
                  onChange={(e) => update('height', Number(e.target.value))}
                  fullWidth
                />
                <FormControl size="small" sx={{ minWidth: 90 }}>
                  <InputLabel>Unit</InputLabel>
                  <Select
                    label="Unit"
                    value={form.unit}
                    onChange={(e) => update('unit', e.target.value as TypePatternExportUnit)}
                  >
                    {UNIT_OPTIONS.map((u) => (
                      <MenuItem key={u} value={u}>
                        {u}
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              </Stack>

              {showDpi && (
                <FormControl size="small" fullWidth>
                  <InputLabel>DPI</InputLabel>
                  <Select label="DPI" value={form.dpi} onChange={(e) => update('dpi', Number(e.target.value))}>
                    {DPI_OPTIONS.map((d) => (
                      <MenuItem key={d} value={d}>
                        {d} DPI
                      </MenuItem>
                    ))}
                  </Select>
                </FormControl>
              )}
            </>
          )}

          {/* ── Instructions toggle ──────────────────────────────────────── */}
          <FormControlLabel
            control={
              <Switch
                checked={form.includeInstructions}
                onChange={(e) => update('includeInstructions', e.target.checked)}
              />
            }
            label="Include pattern instructions"
          />

          {error && <span style={{ color: '#c62828', fontSize: 13 }}>{error.message}</span>}
        </Stack>
      </Box>

      <Box>
        <Button
          onClick={handleDownload}
          startIcon={<DownloadIcon />}
          fullWidth
          variant="contained"
          color="primary"
          disabled={isExporting}
        >
          {isExporting ? 'Generating…' : 'Download'}
        </Button>
      </Box>
    </BorderedCard>
  );
}
