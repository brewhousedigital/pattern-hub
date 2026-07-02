import React, { useCallback, useEffect, useState } from 'react';
import { useQueryClient } from '@tanstack/react-query';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { applyHiddenLayers } from '@/functions/utilities/sanitize-svg';
import { useGlobalAuthData } from '@/data/auth-data';
import { resolveDefaultExportUnit } from '@/functions/utilities/format-measurement';
import { buildPatternXmpMeta, buildXmpPacket } from '@/functions/utilities/xmp/buildXmp';
import { useExportPattern, downloadBlob } from './useExportPattern';
import { buildSvgExportBlob } from './buildSvgExport';
import { preparePdfExportInputs } from './preparePdfExport';
import { buildSinglePdf, buildTiledPdf, type PrintUnit } from './ExportPatternForPrintV3';
import { printPdfBlob } from './PrintNowFrame';
import { trackExportEvent, type ExportFlow } from '@/functions/database/export-analytics';
import { SectionLabel } from '@/components/ViewHelpers';
import type { TypeViewData } from '@/functions/types/types';

import { alpha } from '@mui/material/styles';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import ContentCutRoundedIcon from '@mui/icons-material/ContentCutRounded';
import HandymanRoundedIcon from '@mui/icons-material/HandymanRounded';
import PrintRoundedIcon from '@mui/icons-material/PrintRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import SaveAltRoundedIcon from '@mui/icons-material/SaveAltRounded';
import HelpOutlineRoundedIcon from '@mui/icons-material/HelpOutlineRounded';
import DownloadIcon from '@mui/icons-material/Download';
import LocalPrintshopRoundedIcon from '@mui/icons-material/LocalPrintshopRounded';
import LockIcon from '@mui/icons-material/Lock';
import CropFreeIcon from '@mui/icons-material/CropFree';
import GridOnIcon from '@mui/icons-material/GridOn';

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

// ─── Types ────────────────────────────────────────────────────────────────────

type WizardStep = 'purpose' | 'size' | 'options';
type WizardFlow = 'cricut' | 'craft-cutter' | 'printing' | 'editing' | 'saving' | 'generic';

// Maps the wizard's kebab-case flow keys to export-analytics.ts's canonical,
// space-separated EXPORT_FLOWS strings.
const ANALYTICS_FLOW: Record<WizardFlow, ExportFlow> = {
  cricut: 'cricut',
  'craft-cutter': 'craft cutter',
  printing: 'printing',
  editing: 'editing',
  saving: 'saving for later',
  generic: 'generic',
};

const SUPPORTED_UNITS: PrintUnit[] = ['in', 'cm', 'mm'];

// ─── Unit helpers (small, deliberately duplicated - see the other 3 export panels) ─

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

// ─── Flow definitions (Step 1) ─────────────────────────────────────────────────

const WIZARD_FLOW_DEFS: { key: WizardFlow; label: string; description: string; icon: React.ReactElement }[] = [
  {
    key: 'cricut',
    label: 'Cricut',
    description: 'A ready-to-cut file, sized to fit your pattern.',
    icon: <ContentCutRoundedIcon />,
  },
  {
    key: 'craft-cutter',
    label: 'Craft Cutter',
    description: 'The same ready-to-cut file - works with Silhouette, Brother, and similar machines.',
    icon: <HandymanRoundedIcon />,
  },
  {
    key: 'printing',
    label: 'Printing',
    description: 'A print-ready PDF for printing at home or at a print shop.',
    icon: <PrintRoundedIcon />,
  },
  {
    key: 'editing',
    label: 'Editing',
    description: 'An editable file to open in Illustrator, Inkscape, or Affinity Designer.',
    icon: <EditRoundedIcon />,
  },
  {
    key: 'saving',
    label: 'Saving for later',
    description: 'A clean copy to keep for whenever you need it.',
    icon: <SaveAltRoundedIcon />,
  },
  {
    key: 'generic',
    label: 'Not sure / something else',
    description: "We'll pick a sensible default - you can always come back and choose something specific.",
    icon: <HelpOutlineRoundedIcon />,
  },
];

// ─── Component ────────────────────────────────────────────────────────────────

type ExportWizardProps = TypeViewData & {
  hiddenLayers?: Set<string>;
  onOpenAdvanced: (tab: 'svg' | 'print' | 'image') => void;
};

export const ExportWizard = ({ viewData, hiddenLayers = new Set<string>(), onOpenAdvanced }: ExportWizardProps) => {
  const queryClient = useQueryClient();
  const { authData } = useGlobalAuthData();
  const { runExport } = useExportPattern();

  const baseWIn = viewData ? dbToIn(viewData.design_width, viewData.design_width_unit) : 1;
  const baseHIn = viewData ? dbToIn(viewData.design_height, viewData.design_height_unit) : 1;
  const aspectRatio = baseWIn > 0 && baseHIn > 0 ? baseHIn / baseWIn : 1;
  const lineWidthIn = viewData ? Math.max(dbToIn(viewData.line_width, viewData.line_width_unit), 0.005) : 0.039;

  const defaultUnit = resolveDefaultExportUnit(
    authData?.preferred_measurement_unit,
    viewData?.design_width_unit,
    SUPPORTED_UNITS,
  );

  const [step, setStep] = useState<WizardStep>('purpose');
  const [flow, setFlow] = useState<WizardFlow | null>(null);

  const [sizeMode, setSizeMode] = useState<'original' | 'custom'>('original');
  const [unit, setUnit] = useState<PrintUnit>(defaultUnit);
  const [widthInput, setWidthInput] = useState(() => String(r3(baseWIn)));
  const [heightInput, setHeightInput] = useState(() => String(r3(baseHIn)));

  const [savingFormat, setSavingFormat] = useState<'svg' | 'pdf'>('pdf');
  const [includeLegend, setIncludeLegend] = useState(true);
  const [includeInstructions, setIncludeInstructions] = useState(!!viewData?.instructions);
  const [printTiled, setPrintTiled] = useState(false);

  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [svgString, setSvgString] = useState('');

  // Reset wizard state whenever the viewed pattern changes.
  useEffect(() => {
    if (!viewData) return;
    setStep('purpose');
    setFlow(null);
    setSizeMode('original');
    const resolvedUnit = resolveDefaultExportUnit(
      authData?.preferred_measurement_unit,
      viewData.design_width_unit,
      SUPPORTED_UNITS,
    );
    setUnit(resolvedUnit);
    const wIn = dbToIn(viewData.design_width, viewData.design_width_unit);
    const hIn = dbToIn(viewData.design_height, viewData.design_height_unit);
    setWidthInput(String(r3(fromIn(wIn, resolvedUnit))));
    setHeightInput(String(r3(fromIn(hIn, resolvedUnit))));
    setIncludeInstructions(!!viewData.instructions);
    setIncludeLegend(true);
    setPrintTiled(false);
    setError(null);
  }, [viewData?.id]);

  // Fetch the source SVG once - needed by the Editing/Saving/Printing flows.
  useEffect(() => {
    if (!viewData?.pattern_file) return;
    fetch(generatePbImage(viewData))
      .then((r) => r.text())
      .then(setSvgString)
      .catch(console.error);
  }, [viewData?.id]);

  const handleUnitChange = (newUnit: PrintUnit) => {
    const w = parseFloat(widthInput);
    const h = parseFloat(heightInput);
    if (!isNaN(w) && w > 0) setWidthInput(String(r3(fromIn(toIn(w, unit), newUnit))));
    if (!isNaN(h) && h > 0) setHeightInput(String(r3(fromIn(toIn(h, unit), newUnit))));
    setUnit(newUnit);
  };

  const handleWidthChange = (raw: string) => {
    setWidthInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) setHeightInput(String(r3(fromIn(toIn(n, unit) * aspectRatio, unit))));
  };

  const handleHeightChange = (raw: string) => {
    setHeightInput(raw);
    const n = parseFloat(raw);
    if (!isNaN(n) && n > 0) setWidthInput(String(r3(fromIn(toIn(n, unit) / aspectRatio, unit))));
  };

  // Resolved pattern dimensions in inches, honoring sizeMode.
  const patternWIn =
    sizeMode === 'original'
      ? baseWIn
      : (() => {
          const n = parseFloat(widthInput);
          return !isNaN(n) && n > 0 ? toIn(n, unit) : baseWIn;
        })();
  const patternHIn = patternWIn * aspectRatio;

  const canExport = !!viewData && patternWIn > 0;

  // ── Flow selection ──────────────────────────────────────────────────────────

  const selectFlow = (key: WizardFlow) => {
    setFlow(key);
    setStep(key === 'generic' ? 'options' : 'size');
  };

  const goBack = () => {
    // 'generic' jumps straight from purpose to options, skipping 'size' entirely.
    setStep(step === 'options' && flow !== 'generic' ? 'size' : 'purpose');
  };

  // ── Terminal actions ────────────────────────────────────────────────────────

  // Cricut / Craft Cutter / Generic → PNG at 300 DPI via the shared image pipeline.
  const handleDownloadPng = useCallback(async () => {
    if (!viewData || !flow) return;
    setError(null);
    setLoading(true);
    try {
      const authorLine =
        viewData.expand?.authors?.map((a) => a.name).join(', ') || viewData.author_manual?.join(', ') || '';
      const xmpPacket = buildXmpPacket(
        buildPatternXmpMeta(viewData, { sizeLabel: `${r2(patternWIn)}×${r2(patternHIn)}in` }),
      );

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
          instructionsMarkdown: '',
          patternKeys: viewData.pattern_key_reference_list ?? [],
          hiddenLayerIds: hiddenLayers.size > 0 ? Array.from(hiddenLayers) : undefined,
          xmpPacket,
        },
        {
          format: 'png',
          svgVariant: 'scaled',
          width: patternWIn,
          height: patternHIn,
          unit: 'in',
          dpi: 300,
          jpgBackground: 'white',
          includeInstructions: false,
          includeLegend: false,
        },
      );

      downloadBlob(blob, `${slugify(viewData.name)}-${flow}.png`);

      void trackExportEvent({
        pattern_id: viewData.id,
        file_type: 'png',
        flow: ANALYTICS_FLOW[flow],
        width: patternWIn,
        height: patternHIn,
        size_unit: 'in',
        dpi: 300,
        page_size: '',
        pdf_mode: '',
        legend_included: false,
        instructions_included: false,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [viewData, flow, patternWIn, patternHIn, hiddenLayers, runExport]);

  // Editing / Saving-for-later (SVG) → the shared SVG compositing pipeline.
  const handleDownloadSvg = useCallback(async () => {
    if (!viewData || !svgString || !flow) return;
    setError(null);
    setLoading(true);
    try {
      const filteredSvgString = applyHiddenLayers(svgString, hiddenLayers);
      const blob = await buildSvgExportBlob({
        svgString: filteredSvgString,
        viewData,
        mode: sizeMode,
        patternWIn,
        patternHIn,
        lineWidthIn,
        includeLegend,
        includeInstructions,
        queryClient,
      });

      downloadBlob(blob, `${slugify(viewData.name)}-${flow}.svg`);

      void trackExportEvent({
        pattern_id: viewData.id,
        file_type: 'svg',
        flow: ANALYTICS_FLOW[flow],
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
    viewData,
    svgString,
    flow,
    hiddenLayers,
    sizeMode,
    patternWIn,
    patternHIn,
    lineWidthIn,
    includeLegend,
    includeInstructions,
    unit,
    queryClient,
  ]);

  // Printing / Saving-for-later (PDF) - shared preamble + build, fixed to a
  // Letter-sized page since the wizard doesn't expose the advanced panel's
  // paper-size picker (only the pattern's own size is asked about here).
  const buildPdfForAction = useCallback(
    async (tiled: boolean) => {
      if (!viewData || !svgString) return null;
      const prepared = await preparePdfExportInputs({
        viewData,
        unit,
        patternWIn,
        patternHIn,
        includeLegend,
        hiddenLayers,
        svgString,
        queryClient,
      });

      const pdf = tiled
        ? await buildTiledPdf({
            svgString: prepared.filteredSvgString,
            patternName: viewData.name,
            xmpMeta: prepared.xmpMeta,
            patternWIn,
            patternHIn,
            lineWidthIn,
            includeLegend,
            legendSvg: prepared.legendSvg,
            legendHIn: prepared.legendHIn,
            includeInstructions,
            instructionsMarkdown: viewData.instructions ?? '',
          })
        : await buildSinglePdf({
            svgString: prepared.filteredSvgString,
            patternName: viewData.name,
            xmpMeta: prepared.xmpMeta,
            patternWIn,
            patternHIn,
            lineWidthIn,
            pageWIn: 8.5,
            pageHIn: 11,
            orientation: 'portrait',
            includeLegend,
            legendSvg: prepared.legendSvg,
            legendHIn: prepared.legendHIn,
            includeInstructions,
            instructionsMarkdown: viewData.instructions ?? '',
          });

      return { pdf, fileSizeLabel: prepared.fileSizeLabel };
    },
    [
      viewData,
      svgString,
      unit,
      patternWIn,
      patternHIn,
      lineWidthIn,
      includeLegend,
      includeInstructions,
      hiddenLayers,
      queryClient,
    ],
  );

  const handleSavePdf = useCallback(async () => {
    if (!viewData || !flow) return;
    setError(null);
    setLoading(true);
    try {
      const tiled = flow === 'printing' && printTiled;
      const result = await buildPdfForAction(tiled);
      if (!result) return;
      const suffix = tiled ? 'tiled' : flow === 'printing' ? 'print' : 'saved';
      result.pdf.save(`${slugify(viewData.name)}-${result.fileSizeLabel}-${suffix}.pdf`);

      void trackExportEvent({
        pattern_id: viewData.id,
        file_type: 'pdf',
        flow: ANALYTICS_FLOW[flow],
        width: fromIn(patternWIn, unit),
        height: fromIn(patternHIn, unit),
        size_unit: unit,
        dpi: 0,
        page_size: 'Letter',
        pdf_mode: tiled ? 'tiled' : 'single',
        legend_included: includeLegend,
        instructions_included: includeInstructions,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Export failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [viewData, flow, printTiled, buildPdfForAction, patternWIn, patternHIn, unit, includeLegend, includeInstructions]);

  const handlePrintNow = useCallback(async () => {
    if (!viewData) return;
    setError(null);
    setLoading(true);
    try {
      const result = await buildPdfForAction(false); // Print Now is single-page only
      if (!result) return;
      const blob = result.pdf.output('blob');
      await printPdfBlob(blob);

      void trackExportEvent({
        pattern_id: viewData.id,
        file_type: 'pdf',
        flow: 'printing',
        width: fromIn(patternWIn, unit),
        height: fromIn(patternHIn, unit),
        size_unit: unit,
        dpi: 0,
        page_size: 'Letter',
        pdf_mode: 'single',
        legend_included: includeLegend,
        instructions_included: includeInstructions,
      });
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Print failed. Please try again.');
    } finally {
      setLoading(false);
    }
  }, [viewData, buildPdfForAction, patternWIn, patternHIn, unit, includeLegend, includeInstructions]);

  // ── Render helpers ───────────────────────────────────────────────────────────

  const renderBreadcrumb = () => (
    <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', mb: 2 }}>
      {step !== 'purpose' && (
        <Button
          size="small"
          onClick={goBack}
          startIcon={<ArrowBackRoundedIcon fontSize="small" />}
          sx={{ textTransform: 'none', color: 'text.secondary', minWidth: 0, mr: 1 }}
        >
          Back
        </Button>
      )}
      {(['purpose', 'size', 'options'] as WizardStep[]).map((s, i) => (
        <React.Fragment key={s}>
          {i > 0 && (
            <Typography variant="caption" sx={{ color: 'text.disabled' }}>
              →
            </Typography>
          )}
          <Typography
            variant="caption"
            sx={{
              fontWeight: step === s ? 700 : 500,
              color: step === s ? 'primary.main' : 'text.disabled',
              textTransform: 'capitalize',
            }}
          >
            {s === 'purpose' ? 'What for' : s}
          </Typography>
        </React.Fragment>
      ))}
    </Stack>
  );

  const renderSizeInputs = () => (
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
        onChange={(e) => handleUnitChange(e.target.value as PrintUnit)}
      >
        {SUPPORTED_UNITS.map((u) => (
          <MenuItem key={u} value={u}>
            {u}
          </MenuItem>
        ))}
      </TextField>
    </Box>
  );

  const renderLegendInstructionsToggles = () => (
    <Stack sx={{ mb: 2 }}>
      <FormControlLabel
        control={<Checkbox checked={includeLegend} onChange={(e) => setIncludeLegend(e.target.checked)} size="small" />}
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
          sx={{ ml: 0 }}
        />
      )}
    </Stack>
  );

  const isBusy = loading;

  // ── Step 1: purpose ──────────────────────────────────────────────────────────

  const renderPurposeStep = () => (
    <Box>
      <SectionLabel>What are you doing with this file?</SectionLabel>
      <Box sx={{ display: 'grid', gridTemplateColumns: { xs: '1fr', sm: '1fr 1fr' }, gap: 1.5, mt: 1, mb: 2 }}>
        {WIZARD_FLOW_DEFS.map((def) => (
          <Box
            key={def.key}
            role="button"
            tabIndex={0}
            onClick={() => selectFlow(def.key)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') selectFlow(def.key);
            }}
            sx={{
              display: 'flex',
              alignItems: 'flex-start',
              gap: 1.25,
              p: 1.5,
              borderRadius: 1.5,
              cursor: 'pointer',
              border: '1px solid',
              borderColor: alpha('#C8A96E', 0.3),
              '&:hover': { backgroundColor: alpha('#C8A96E', 0.07), borderColor: alpha('#C8A96E', 0.5) },
              '&:focus-visible': { outline: '2px solid', outlineColor: 'primary.main' },
            }}
          >
            <Box sx={{ color: 'primary.main', mt: '2px' }}>{def.icon}</Box>
            <Box>
              <Typography variant="body2" sx={{ fontWeight: 700 }}>
                {def.label}
              </Typography>
              <Typography variant="caption" sx={{ color: 'text.secondary' }}>
                {def.description}
              </Typography>
            </Box>
          </Box>
        ))}
      </Box>

      <Divider sx={{ borderColor: alpha('#C8A96E', 0.12), mb: 1.5 }} />

      <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mb: 0.75 }}>
        Prefer to do it yourself?
      </Typography>
      <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap' }}>
        <Button size="small" onClick={() => onOpenAdvanced('image')} sx={{ textTransform: 'none' }}>
          Make a custom image
        </Button>
        <Button size="small" onClick={() => onOpenAdvanced('print')} sx={{ textTransform: 'none' }}>
          Make a custom PDF
        </Button>
        <Button size="small" onClick={() => onOpenAdvanced('svg')} sx={{ textTransform: 'none' }}>
          Make a custom SVG
        </Button>
      </Stack>
    </Box>
  );

  // ── Step 2: size ─────────────────────────────────────────────────────────────

  const renderSizeStep = () => {
    const isCutterFlow = flow === 'cricut' || flow === 'craft-cutter';

    return (
      <Box>
        <SectionLabel>What size?</SectionLabel>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 1.5 }}>
          {isCutterFlow
            ? `Uses this pattern's original size (${r2(baseWIn)}" × ${r2(baseHIn)}") unless you need something different.`
            : `Uses this pattern's original size (${r2(baseWIn)}" × ${r2(baseHIn)}"), or choose your own.`}
        </Typography>

        <FormControlLabel
          control={
            <Checkbox
              checked={sizeMode === 'custom'}
              onChange={(e) => setSizeMode(e.target.checked ? 'custom' : 'original')}
              size="small"
            />
          }
          label={
            <Typography variant="body2" sx={{ color: 'text.secondary' }}>
              Custom size
            </Typography>
          }
          sx={{ mb: 1.5, ml: 0 }}
        />

        <Collapse in={sizeMode === 'custom'}>
          <Box sx={{ mb: 2 }}>
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 1 }}>
              <Tooltip title="Editing either dimension updates the other to preserve the aspect ratio." arrow>
                <LockIcon sx={{ fontSize: '0.8rem', color: 'text.secondary', cursor: 'help' }} />
              </Tooltip>
            </Box>
            {renderSizeInputs()}
          </Box>
        </Collapse>

        {isCutterFlow ? (
          <>
            <Collapse in={!!error}>
              <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
                {error}
              </Alert>
            </Collapse>
            <Button
              variant="contained"
              fullWidth
              disabled={!canExport || isBusy}
              startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleDownloadPng}
              sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
            >
              {isBusy ? 'Generating…' : 'Download'}
            </Button>
          </>
        ) : (
          <Button
            variant="contained"
            fullWidth
            disabled={!canExport}
            onClick={() => setStep('options')}
            sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
          >
            Next
          </Button>
        )}
      </Box>
    );
  };

  // ── Step 3: options (flow-dependent) ────────────────────────────────────────

  const renderOptionsStep = () => {
    if (flow === 'generic') {
      return (
        <Box>
          <SectionLabel>Ready to go</SectionLabel>
          <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mt: 0.5, mb: 2 }}>
            We'll download a file at this pattern's original size. You can always come back and pick something more
            specific.
          </Typography>
          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
              {error}
            </Alert>
          </Collapse>
          <Button
            variant="contained"
            fullWidth
            disabled={!canExport || isBusy}
            startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            onClick={handleDownloadPng}
            sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
          >
            {isBusy ? 'Generating…' : 'Download'}
          </Button>
        </Box>
      );
    }

    if (flow === 'printing') {
      return (
        <Box>
          <SectionLabel>Options</SectionLabel>
          <Box sx={{ mt: 1.5, mb: 2 }}>
            <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 1 }}>
              Does this fit on one page, or does it need to be split across several sheets?
            </Typography>
            <ToggleButtonGroup
              value={printTiled ? 'tiled' : 'single'}
              exclusive
              size="small"
              onChange={(_, v) => v && setPrintTiled(v === 'tiled')}
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
          </Box>

          {renderLegendInstructionsToggles()}

          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
              {error}
            </Alert>
          </Collapse>

          <Stack direction="row" spacing={1.5}>
            {!printTiled && (
              <Button
                variant="contained"
                fullWidth
                disabled={!canExport || isBusy}
                startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <LocalPrintshopRoundedIcon />}
                onClick={handlePrintNow}
                sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
              >
                Print Now
              </Button>
            )}
            <Button
              variant={printTiled ? 'contained' : 'outlined'}
              fullWidth
              disabled={!canExport || isBusy}
              startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
              onClick={handleSavePdf}
              sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
            >
              Save PDF
            </Button>
          </Stack>
          {!printTiled && (
            <Typography variant="caption" sx={{ color: 'text.disabled', display: 'block', mt: 1 }}>
              When the print dialog opens, set Scale to 100% / Actual Size (not "Fit to page") so the pattern prints
              true to size.
            </Typography>
          )}
        </Box>
      );
    }

    if (flow === 'editing') {
      return (
        <Box>
          <SectionLabel>Options</SectionLabel>
          <Box sx={{ mt: 1.5 }}>{renderLegendInstructionsToggles()}</Box>
          <Collapse in={!!error}>
            <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
              {error}
            </Alert>
          </Collapse>
          <Button
            variant="contained"
            fullWidth
            disabled={!canExport || isBusy}
            startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
            onClick={handleDownloadSvg}
            sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
          >
            {isBusy ? 'Generating…' : 'Download'}
          </Button>
        </Box>
      );
    }

    // saving
    return (
      <Box>
        <SectionLabel>Options</SectionLabel>
        <Box sx={{ mt: 1.5, mb: 1 }}>
          <ToggleButtonGroup
            value={savingFormat}
            exclusive
            size="small"
            onChange={(_, v) => v && setSavingFormat(v)}
            sx={toggleGroupSx}
          >
            <ToggleButton value="svg">Editable file</ToggleButton>
            <ToggleButton value="pdf">PDF</ToggleButton>
          </ToggleButtonGroup>
        </Box>
        <Typography variant="caption" sx={{ color: 'text.secondary', display: 'block', mb: 2 }}>
          {savingFormat === 'svg'
            ? 'A flexible file you can resize or edit again later.'
            : 'A ready-to-view file that looks the same everywhere.'}
        </Typography>

        {renderLegendInstructionsToggles()}

        <Collapse in={!!error}>
          <Alert severity="error" sx={{ mb: 1.5, fontSize: '0.82rem' }}>
            {error}
          </Alert>
        </Collapse>

        <Button
          variant="contained"
          fullWidth
          disabled={!canExport || isBusy}
          startIcon={isBusy ? <CircularProgress size={16} color="inherit" /> : <DownloadIcon />}
          onClick={savingFormat === 'svg' ? handleDownloadSvg : handleSavePdf}
          sx={{ fontWeight: 700, letterSpacing: '0.06em', py: 1.1, textTransform: 'none' }}
        >
          {isBusy ? 'Generating…' : 'Download'}
        </Button>
      </Box>
    );
  };

  return (
    <Box>
      {renderBreadcrumb()}
      {step === 'purpose' && renderPurposeStep()}
      {step === 'size' && renderSizeStep()}
      {step === 'options' && renderOptionsStep()}
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
