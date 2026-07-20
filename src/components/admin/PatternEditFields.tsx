import { FancyAutocomplete, FancyAutocompleteAuthors } from '@/components/FancyAutocomplete';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { PatternTagsField } from '@/components/admin/PatternTagsField';
import { PatternMeasurementFields } from '@/components/admin/PatternMeasurementFields';
import { PatternKeyBuilder } from '@/components/admin/PatternKeyBuilder';
import { FormSection } from '@/components/admin/FormSection';
import { useQuerySearchLinkedAuthors, useQuerySearchManualAuthors } from '@/functions/database/authors';
import { useDebounce } from '@/functions/hooks/useDebounce';
import type { TypePatternLayersMapItem, TypePatternKeyReferenceObject } from '@/functions/database/patterns';
import type { Dayjs } from 'dayjs';
import React from 'react';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';

import {
  Box,
  Checkbox,
  FormControlLabel,
  Grid,
  IconButton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';

type PatternEditFieldsProps = {
  /** Matches whichever TextField style the surrounding form already uses. Defaults to 'outlined'. */
  variant?: 'outlined' | 'filled';
  /** Identifies the record being edited (pattern or submission id) - passed through to PatternTagsField. */
  resetKey?: string;

  name: string;
  onNameChange: (v: string) => void;
  description: string;
  onDescriptionChange: (v: string) => void;
  designDate: Dayjs | null;
  onDesignDateChange: (v: Dayjs | null) => void;
  sourceUrl: string;
  onSourceUrlChange: (v: string) => void;

  pieces: string;
  onPiecesChange: (v: string) => void;
  designWidth: string;
  designWidthUnit: string;
  onDesignWidthChange: (v: string) => void;
  onDesignWidthUnitChange: (v: string) => void;
  designHeight: string;
  designHeightUnit: string;
  onDesignHeightChange: (v: string) => void;
  onDesignHeightUnitChange: (v: string) => void;
  lineWidth: string;
  lineWidthUnit: string;
  onLineWidthChange: (v: string) => void;
  onLineWidthUnitChange: (v: string) => void;

  instructions: string;
  onInstructionsChange: (v: string) => void;

  tags: string[];
  onTagsChange: (v: string[]) => void;
  authors: string[] | undefined;
  onAuthorsChange: (v: string[]) => void;
  authorManual: string[] | undefined;
  onAuthorManualChange: (v: string[]) => void;

  hasLayers: boolean;
  onHasLayersChange: (checked: boolean) => void;
  layersMap: TypePatternLayersMapItem[];
  onLayersMapChange: (v: TypePatternLayersMapItem[]) => void;

  patternKeys: TypePatternKeyReferenceObject[];
  onPatternKeysChange: (v: TypePatternKeyReferenceObject[]) => void;
  /** AdminEditPatternModal hides pattern-key management for external-link-only patterns. */
  showPatternKeyBuilder?: boolean;
};

// The full pattern metadata form - name/description/dates, measurements,
// instructions, tags/authors, layers, and pattern keys - shared between
// AdminEditPatternModal (Space Command Patterns) and the user-submission
// review page so the two editing surfaces can't drift out of sync. File
// upload, draft-mode, and page-specific actions (Save/Delete vs
// Reject/Publish) stay with each caller since those genuinely differ.
export const PatternEditFields = (props: PatternEditFieldsProps) => {
  const variant = props.variant ?? 'outlined';
  const showPatternKeyBuilder = props.showPatternKeyBuilder ?? true;

  const [authorInput, setAuthorInput] = React.useState('');
  const debouncedAuthorSearch = useDebounce(authorInput, 300);
  const { data: authorData, isFetching: authorFetching } = useQuerySearchLinkedAuthors(debouncedAuthorSearch);

  const [manualAuthorInput, setManualAuthorInput] = React.useState('');
  const debouncedManualAuthorSearch = useDebounce(manualAuthorInput, 300);
  const { data: manualAuthorData, isFetching: manualAuthorFetching } =
    useQuerySearchManualAuthors(debouncedManualAuthorSearch);

  return (
    <>
      {/* ── Info ── */}
      <FormSection label="Pattern Info" />

      <TextField
        fullWidth
        variant={variant}
        label="Name"
        value={props.name}
        onChange={(e) => props.onNameChange(e.target.value)}
        helperText={
          props.name?.length > 100 ? `Name is too long: ${props.name?.length}/100` : `${props.name?.length}/100`
        }
        error={props.name?.length > 100}
      />

      <GenericMarkdownEditor
        label="Description"
        content={props.description}
        setContent={props.onDescriptionChange}
        characterLimit={2000}
        minRows={2}
      />

      <DatePicker
        label="Design Date"
        value={props.designDate}
        onChange={props.onDesignDateChange}
        disableFuture
        slotProps={{ textField: { fullWidth: true } }}
      />

      <TextField
        fullWidth
        variant={variant}
        label="Source URL"
        value={props.sourceUrl}
        onChange={(e) => props.onSourceUrlChange(e.target.value)}
      />

      {/* ── Measurements ── */}
      <FormSection label="Measurements" />

      <PatternMeasurementFields
        variant={variant}
        pieces={props.pieces}
        onPiecesChange={props.onPiecesChange}
        width={{
          value: props.designWidth,
          unit: props.designWidthUnit,
          onValueChange: props.onDesignWidthChange,
          onUnitChange: props.onDesignWidthUnitChange,
        }}
        height={{
          value: props.designHeight,
          unit: props.designHeightUnit,
          onValueChange: props.onDesignHeightChange,
          onUnitChange: props.onDesignHeightUnitChange,
        }}
        lineWidth={{
          value: props.lineWidth,
          unit: props.lineWidthUnit,
          onValueChange: props.onLineWidthChange,
          onUnitChange: props.onLineWidthUnitChange,
        }}
      />

      {/* ── Instructions ── */}
      <FormSection label="Instructions" />
      <GenericMarkdownEditor
        label="Instructions"
        content={props.instructions}
        setContent={props.onInstructionsChange}
        characterLimit={10000}
        minRows={2}
      />

      {/* ── Metadata ── */}
      <FormSection label="Metadata" />

      <PatternTagsField value={props.tags} onChange={props.onTagsChange} resetKey={props.resetKey} />

      <FancyAutocompleteAuthors
        label="Author"
        serverSide
        freeSolo
        loading={authorFetching}
        data={authorData ?? []}
        value={props.authors}
        onChange={props.onAuthorsChange}
        inputValue={authorInput}
        onInputChange={setAuthorInput}
      />

      <FancyAutocomplete
        label="Manual Author"
        serverSide
        freeSolo
        loading={manualAuthorFetching}
        data={manualAuthorData ?? []}
        value={props.authorManual}
        onChange={props.onAuthorManualChange}
        inputValue={manualAuthorInput}
        onInputChange={setManualAuthorInput}
      />

      {/* ── Layers ── */}
      <FormSection label="Layers" />

      <FormControlLabel
        control={<Checkbox checked={props.hasLayers} onChange={(e) => props.onHasLayersChange(e.target.checked)} />}
        label="Has Layers"
      />

      {props.hasLayers && props.layersMap.length > 0 && (
        <Box>
          <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
            Layer Map
          </Typography>
          <Stack spacing={1}>
            {props.layersMap.map((item, index) => (
              <Grid container spacing={1} key={item.layerName} sx={{ alignItems: 'center' }}>
                <Grid size={{ xs: 5 }}>
                  <TextField
                    size="small"
                    fullWidth
                    variant={variant}
                    label="Layer ID"
                    value={item.layerName}
                    slotProps={{ input: { readOnly: true } }}
                  />
                </Grid>
                <Grid size="auto">
                  <Tooltip title="Copy layer ID to display name" arrow>
                    <IconButton
                      size="small"
                      onClick={() =>
                        props.onLayersMapChange(
                          props.layersMap.map((e, i) => (i === index ? { ...e, mappedName: e.layerName } : e)),
                        )
                      }
                    >
                      <ArrowForwardRoundedIcon fontSize="small" />
                    </IconButton>
                  </Tooltip>
                </Grid>
                <Grid size="grow">
                  <TextField
                    size="small"
                    fullWidth
                    variant={variant}
                    label="Display Name"
                    value={item.mappedName}
                    onChange={(e) =>
                      props.onLayersMapChange(
                        props.layersMap.map((entry, i) =>
                          i === index ? { ...entry, mappedName: e.target.value } : entry,
                        ),
                      )
                    }
                  />
                </Grid>
                <Grid size="auto">
                  <Tooltip
                    title={
                      item.isVisible !== false
                        ? 'Users can toggle this layer, click to lock'
                        : 'Required layer - users cannot hide this'
                    }
                    arrow
                  >
                    <IconButton
                      size="small"
                      onClick={() =>
                        props.onLayersMapChange(
                          props.layersMap.map((e, i) =>
                            i === index ? { ...e, isVisible: e.isVisible === false ? true : false } : e,
                          ),
                        )
                      }
                      sx={{ color: item.isVisible === false ? 'error.main' : 'text.disabled' }}
                    >
                      {item.isVisible === false ? (
                        <LockRoundedIcon fontSize="small" />
                      ) : (
                        <LockOpenRoundedIcon fontSize="small" />
                      )}
                    </IconButton>
                  </Tooltip>
                </Grid>
              </Grid>
            ))}
          </Stack>
        </Box>
      )}

      {/* ── Pattern Key Builder ── */}
      {showPatternKeyBuilder && (
        <>
          <FormSection label="Pattern Key" />
          <PatternKeyBuilder value={props.patternKeys} onChange={props.onPatternKeysChange} variant={variant} />
        </>
      )}
    </>
  );
};
