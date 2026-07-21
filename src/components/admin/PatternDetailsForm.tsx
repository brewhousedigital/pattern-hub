import React from 'react';
import dayjs, { type Dayjs } from 'dayjs';
import { PatternEditFields } from '@/components/admin/PatternEditFields';
import type { TypePatternLayersMapItem, TypePatternKeyReferenceObject } from '@/functions/database/patterns';
import { extractSvgLayerIds } from '@/functions/utilities/sanitize-svg';

import { Alert, Box, Checkbox, FormControlLabel, Stack, Typography } from '@mui/material';

// ─── Layers helpers ───────────────────────────────────────────────────────────
// Moved here from AdminEditPatternModal - layersMap state now lives exclusively
// inside this component, so these are its only remaining call sites.

function mergeLayerIds(existing: TypePatternLayersMapItem[], newIds: string[]): TypePatternLayersMapItem[] {
  const existingNames = new Set(existing.map((e) => e.layerName));
  const appended = newIds
    .filter((id) => !existingNames.has(id))
    .map((id) => ({ layerName: id, mappedName: '', isVisible: true }));
  return [...existing, ...appended];
}

// When a new SVG is uploaded, the new file's layer list is authoritative.
// Existing customizations (mappedName, isVisible) are preserved where layer IDs match.
function replaceLayerIds(existing: TypePatternLayersMapItem[], newIds: string[]): TypePatternLayersMapItem[] {
  const existingByName = new Map(existing.map((e) => [e.layerName, e]));
  return newIds.map((id) => existingByName.get(id) ?? { layerName: id, mappedName: '', isVisible: true });
}

// ─── Types ────────────────────────────────────────────────────────────────────

export type TypePatternDetailsFormValues = {
  name: string;
  description: string;
  instructions: string;
  sourceUrl: string;
  designDate: Dayjs | null;
  pieces: string;
  designWidth: string;
  designWidthUnit: string;
  designHeight: string;
  designHeightUnit: string;
  lineWidth: string;
  lineWidthUnit: string;
  tags: string[];
  authors: string[];
  authorManual: string[];
  hasLayers: boolean;
  layersMap: TypePatternLayersMapItem[];
  patternKeys: TypePatternKeyReferenceObject[];
  isDraft: boolean;
};

type PatternDetailsFormProps = {
  /** Seeds internal state on mount only - later prop changes do not re-sync already-mounted state. */
  initialValues: TypePatternDetailsFormValues;
  /** Resolved by the caller, since only the caller knows which file (existing vs freshly picked) should win. */
  previewImageUrl: string | null;
  /** 'sidebar' = sticky desktop-only column (admin edit modal). 'inline' = always-visible, non-sticky, stacks on mobile (review page). */
  previewLayout?: 'sidebar' | 'inline';
  /** Matches whichever TextField style the surrounding form already uses. Forwarded to PatternEditFields. */
  variant?: 'outlined' | 'filled';
  /** Identifies the record being edited - forwarded to PatternEditFields. */
  resetKey?: string;
  showPatternKeyBuilder?: boolean;
  /** Default true. The review page passes false since it hardcodes is_draft: false on publish - an inert checkbox there would be misleading. */
  showDraftToggle?: boolean;
  /** Powers "Has Layers" auto-seeding from whichever file is currently active. Only the admin edit modal (which owns file state) provides this. */
  resolveSvgTextForLayerSeed?: () => Promise<string | null>;
  /** Caller-owned content rendered between the Draft toggle and PatternEditFields (e.g. file-upload tabs, or review-page alerts). */
  children?: React.ReactNode;
};

export type PatternDetailsFormHandle = {
  getPayload: () => TypePatternDetailsFormValues;
  applyDetectedDimensions: (dims: { width: number; widthUnit: string; height: number; heightUnit: string }) => void;
  applyNewFileLayerIds: (layerIds: string[]) => void;
  reset: () => void;
};

const previewImageSx = {
  width: '100%',
  aspectRatio: '1/1',
  objectFit: 'contain' as const,
  borderRadius: 1.5,
  border: '1px solid',
  borderColor: 'divider',
  backgroundColor: 'grey.50',
  p: 1,
};

// ─── Component ────────────────────────────────────────────────────────────────

// The preview panel, Draft Mode toggle, and full pattern metadata form
// (via PatternEditFields), shared between AdminEditPatternModal (Space
// Command Patterns) and the user-submission review page so the two editing
// surfaces can't drift out of sync. File upload stays with each caller: the
// review page's file replacement is intentionally gated behind its own
// pre-code-review re-upload step, so letting this component offer a free-form
// file picker would bypass that review gate.
export const PatternDetailsForm = React.forwardRef<PatternDetailsFormHandle, PatternDetailsFormProps>((props, ref) => {
  const previewLayout = props.previewLayout ?? 'sidebar';
  const variant = props.variant ?? 'outlined';
  const showPatternKeyBuilder = props.showPatternKeyBuilder ?? true;
  const showDraftToggle = props.showDraftToggle ?? true;

  const [name, setName] = React.useState(props.initialValues.name);
  const [description, setDescription] = React.useState(props.initialValues.description);
  const [sourceUrl, setSourceUrl] = React.useState(props.initialValues.sourceUrl);
  const [pieces, setPieces] = React.useState(props.initialValues.pieces);
  const [lineWidth, setLineWidth] = React.useState(props.initialValues.lineWidth);
  const [lineWidthUnit, setLineWidthUnit] = React.useState(props.initialValues.lineWidthUnit);
  const [designWidth, setDesignWidth] = React.useState(props.initialValues.designWidth);
  const [designWidthUnit, setDesignWidthUnit] = React.useState(props.initialValues.designWidthUnit);
  const [designHeight, setDesignHeight] = React.useState(props.initialValues.designHeight);
  const [designHeightUnit, setDesignHeightUnit] = React.useState(props.initialValues.designHeightUnit);
  const [designDate, setDesignDate] = React.useState<Dayjs | null>(props.initialValues.designDate);
  const [instructions, setInstructions] = React.useState(props.initialValues.instructions);
  const [tags, setTags] = React.useState<string[]>(props.initialValues.tags);
  const [authors, setAuthors] = React.useState<string[]>(props.initialValues.authors);
  const [authorManual, setAuthorManual] = React.useState<string[]>(props.initialValues.authorManual);
  const [hasLayers, setHasLayers] = React.useState(props.initialValues.hasLayers);
  const [layersMap, setLayersMap] = React.useState<TypePatternLayersMapItem[]>(props.initialValues.layersMap);
  const [patternKeys, setPatternKeys] = React.useState<TypePatternKeyReferenceObject[]>(
    props.initialValues.patternKeys,
  );
  const [isDraft, setIsDraft] = React.useState(props.initialValues.isDraft);

  const handleHasLayersChange = async (checked: boolean) => {
    setHasLayers(checked);
    if (!checked || !props.resolveSvgTextForLayerSeed) return;
    const text = await props.resolveSvgTextForLayerSeed();
    if (text) setLayersMap((prev) => mergeLayerIds(prev, extractSvgLayerIds(text)));
  };

  React.useImperativeHandle(ref, () => ({
    getPayload: () => ({
      name,
      description,
      instructions,
      sourceUrl,
      designDate,
      pieces,
      designWidth,
      designWidthUnit,
      designHeight,
      designHeightUnit,
      lineWidth,
      lineWidthUnit,
      tags,
      authors,
      authorManual,
      hasLayers,
      layersMap,
      patternKeys,
      isDraft,
    }),
    applyDetectedDimensions(dims) {
      setDesignWidth(String(dims.width));
      setDesignWidthUnit(dims.widthUnit);
      setDesignHeight(String(dims.height));
      setDesignHeightUnit(dims.heightUnit);
    },
    applyNewFileLayerIds(layerIds) {
      if (!hasLayers) return;
      setLayersMap((prev) => replaceLayerIds(prev, layerIds));
    },
    reset() {
      setName('');
      setDescription('');
      setSourceUrl('');
      setPieces('1');
      setLineWidth('0');
      setLineWidthUnit('in');
      setDesignWidth('0');
      setDesignWidthUnit('in');
      setDesignHeight('0');
      setDesignHeightUnit('in');
      setInstructions('');
      setTags([]);
      setAuthors([]);
      setAuthorManual([]);
      setPatternKeys([]);
      setDesignDate(dayjs());
      setHasLayers(false);
      setLayersMap([]);
      setIsDraft(false);
    },
  }));

  const outerSx =
    previewLayout === 'sidebar'
      ? { display: 'flex', alignItems: 'flex-start' }
      : { display: 'flex', gap: 4, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } };

  const previewColumnSx =
    previewLayout === 'sidebar'
      ? {
          display: { xs: 'none', lg: 'flex' },
          flexDirection: 'column' as const,
          gap: 1.5,
          position: 'sticky' as const,
          top: 0,
          alignSelf: 'flex-start',
          width: 600,
          flexShrink: 0,
          p: 3,
          borderRight: '1px solid',
          borderColor: 'divider',
        }
      : {
          width: { xs: '100%', md: 600 },
          flexShrink: 0,
          display: 'flex',
          flexDirection: 'column' as const,
          gap: 1.5,
          // Sticky on desktop only - on mobile the layout stacks (preview above
          // fields), where a pinned preview would just block the form as you scroll.
          position: { xs: 'static', md: 'sticky' } as const,
          top: 68,
        };

  const rightColumnSx = previewLayout === 'sidebar' ? { flex: 1, minWidth: 0, p: 3 } : { flex: 1, minWidth: 0 };

  return (
    <Box sx={outerSx}>
      <Box sx={previewColumnSx}>
        <Typography
          variant="caption"
          color="text.secondary"
          sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
        >
          Preview
        </Typography>

        {props.previewImageUrl ? (
          <Box component="img" src={props.previewImageUrl} alt={name || 'Pattern preview'} sx={previewImageSx} />
        ) : (
          <Box
            sx={{
              border: '1px dashed',
              borderColor: 'divider',
              borderRadius: 1.5,
              aspectRatio: '1/1',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              backgroundColor: 'grey.50',
            }}
          >
            <Typography variant="body2" color="text.disabled">
              No pattern yet
            </Typography>
          </Box>
        )}

        {name && (
          <Typography variant="body2" sx={{ wordBreak: 'break-word', fontWeight: 600 }}>
            {name}
          </Typography>
        )}

        {isDraft && (
          <Typography variant="caption" color="warning.main" sx={{ fontWeight: 600 }}>
            Draft — hidden from public
          </Typography>
        )}
      </Box>

      <Box sx={rightColumnSx}>
        <Stack spacing={2.5} sx={previewLayout === 'sidebar' ? { py: 1 } : undefined}>
          {showDraftToggle && isDraft && (
            <Alert severity="warning" sx={{ borderRadius: 2 }}>
              This pattern is in <strong>Draft Mode</strong> and is not visible to the public.
            </Alert>
          )}

          {showDraftToggle && (
            <FormControlLabel
              control={<Checkbox checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} />}
              label="Draft Mode (hidden from public)"
            />
          )}

          {props.children}

          <PatternEditFields
            variant={variant}
            resetKey={props.resetKey}
            name={name}
            onNameChange={setName}
            description={description}
            onDescriptionChange={setDescription}
            designDate={designDate}
            onDesignDateChange={setDesignDate}
            sourceUrl={sourceUrl}
            onSourceUrlChange={setSourceUrl}
            pieces={pieces}
            onPiecesChange={setPieces}
            designWidth={designWidth}
            designWidthUnit={designWidthUnit}
            onDesignWidthChange={setDesignWidth}
            onDesignWidthUnitChange={setDesignWidthUnit}
            designHeight={designHeight}
            designHeightUnit={designHeightUnit}
            onDesignHeightChange={setDesignHeight}
            onDesignHeightUnitChange={setDesignHeightUnit}
            lineWidth={lineWidth}
            lineWidthUnit={lineWidthUnit}
            onLineWidthChange={setLineWidth}
            onLineWidthUnitChange={setLineWidthUnit}
            instructions={instructions}
            onInstructionsChange={setInstructions}
            tags={tags}
            onTagsChange={setTags}
            authors={authors}
            onAuthorsChange={setAuthors}
            authorManual={authorManual}
            onAuthorManualChange={setAuthorManual}
            hasLayers={hasLayers}
            onHasLayersChange={handleHasLayersChange}
            layersMap={layersMap}
            onLayersMapChange={setLayersMap}
            patternKeys={patternKeys}
            onPatternKeysChange={setPatternKeys}
            showPatternKeyBuilder={showPatternKeyBuilder}
          />
        </Stack>
      </Box>
    </Box>
  );
});

PatternDetailsForm.displayName = 'PatternDetailsForm';
