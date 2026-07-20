import React from 'react';
import { enqueueSnackbar } from 'notistack';
import {
  generatePbImage,
  generatePbImageExternalFile,
  generatePbImageSVG,
} from '@/functions/utilities/generate-pb-image';
import { useGlobalAuthData } from '@/data/auth-data';
import { useQueryClient } from '@tanstack/react-query';
import { ADMIN_TAG_STATS_QUERY_KEY } from '@/functions/database/tags';
import { useAdminLogger, diffAdminChanges } from '@/functions/database/admin-logs';
import { PatternEditFields } from '@/components/admin/PatternEditFields';
import { FormSection } from '@/components/admin/FormSection';
import { generateOpengraphImage } from '@/functions/utilities/generate-opengraph-image';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import dayjs, { type Dayjs } from 'dayjs';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
  type TypePatternKeyReferenceObject,
  type TypePatternLayersMapItem,
  useMutationEditPattern,
  useMutationSoftDeletePattern,
} from '@/functions/database/patterns';
import {
  sanitizeSvgFile,
  extractSvgLayerIds,
  extractSvgDimensions,
  extractSvgDimensionsFromViewBox,
  analyzeSvgThreats,
  type SvgThreat,
} from '@/functions/utilities/sanitize-svg';
import { pocketbase } from '@/functions/database/authentication-setup';
import { SvgDropZone } from '@/components/admin/SvgDropZone';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import WarningAmberRoundedIcon from '@mui/icons-material/WarningAmberRounded';

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  FormControlLabel,
  IconButton,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Typography,
  Grid,
  Tab,
  CircularProgress,
  Alert,
  Tooltip,
} from '@mui/material';

import TabContext from '@mui/lab/TabContext';
import TabList from '@mui/lab/TabList';
import TabPanel from '@mui/lab/TabPanel';

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeModalMode = 'edit' | 'add';

type TypeEditModalProps = TypePatternResponse & {
  mode?: TypeModalMode;
  callback?: () => void;
};

// ─── Layers helpers ───────────────────────────────────────────────────────────

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

// ─── Component ────────────────────────────────────────────────────────────────

export const AdminEditPatternModal = (props: TypeEditModalProps) => {
  const { authData } = useGlobalAuthData();

  const [tabValue, setTabValue] = React.useState(props?.pattern_file_external_link ? '2' : '1');

  const handleTabChange = (_event: React.SyntheticEvent, newValue: string) => {
    setTabValue(newValue);
  };

  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.PATTERN_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.PATTERN_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.PATTERN_AD);

  const savePattern = useMutationEditPattern();
  const deletePattern = useMutationSoftDeletePattern();
  const { log } = useAdminLogger();

  // Invalidate rather than subscribe-for-refetch: this modal is mounted once
  // per DataGrid row, and subscribing to useQueryAdminTagStats here made every
  // Patterns page load walk the entire patterns collection (5 requests) just
  // to keep an unused refetch handle alive. Invalidation only refetches
  // queries that are actively on screen.
  const queryClient = useQueryClient();
  const refetchPatterns = () => queryClient.invalidateQueries({ queryKey: ['GetAllPatternsByPaginationAdmin'] });
  const refetchTagManagementStats = () => queryClient.invalidateQueries({ queryKey: ADMIN_TAG_STATS_QUERY_KEY });

  const [isOpen, setIsOpen] = React.useState(false);

  const handleOpen = () => setIsOpen(true);
  const handleClose = () => setIsOpen(false);

  const [isButtonLoading, setIsButtonLoading] = React.useState(false);

  const [name, setName] = React.useState(props?.name || '');
  const [description, setDescription] = React.useState(props?.description || '');
  const [sourceURL, setSourceURL] = React.useState(props?.source_url || '');
  const [pieces, setPieces] = React.useState(String(props?.pieces) || '1');
  const [lineWidth, setLineWidth] = React.useState(String(props?.line_width) || '0');
  const [lineWidthUnit, setLineWidthUnit] = React.useState(String(props?.line_width_unit) || 'in');
  const [designWidth, setDesignWidth] = React.useState(String(props?.design_width) || '0');
  const [designWidthUnit, setDesignWidthUnit] = React.useState(String(props?.design_width_unit) || 'in');
  const [designHeight, setDesignHeight] = React.useState(String(props?.design_height) || '0');
  const [designHeightUnit, setDesignHeightUnit] = React.useState(String(props?.design_height_unit) || 'in');

  // Tags
  const [tagValue, setTagValue] = React.useState<string[]>(props?.tags || []);

  // Authors
  const [authorValue, setAuthorValue] = React.useState<string[] | undefined>(props?.authors || []);

  // Manual Authors
  const [manualAuthorValue, setManualAuthorValue] = React.useState<string[] | undefined>(props?.author_manual || []);

  // Design Date
  const now = props?.design_date ? dayjs(props?.design_date) : dayjs();
  const [designDate, setDesignDate] = React.useState<Dayjs | null>(now);

  const isLoading = false;
  const isError = false;

  // Instructions
  const [instructions, setInstructions] = React.useState(props?.instructions || '');

  // SVG Upload
  const [file, setFile] = React.useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  // Pending SVG held back for an admin safety confirmation when threats are detected.
  const [pendingSvg, setPendingSvg] = React.useState<{ file: File; text: string; threats: SvgThreat[] } | null>(null);

  // Applies a selected SVG to the form (preview, dimensions, layer map).
  const commitSvgFile = (f: File, text: string) => {
    setPreviewUrl(URL.createObjectURL(f));
    setFile(f);

    // If width/height aren't set in in/cm/mm, fall back to deriving inches
    // from the viewBox (assumed to be CSS px at 96 DPI) rather than ignoring it.
    const dims = extractSvgDimensions(text) ?? extractSvgDimensionsFromViewBox(text);
    if (dims) {
      setDesignWidth(String(dims.width));
      setDesignWidthUnit(dims.widthUnit);
      setDesignHeight(String(dims.height));
      setDesignHeightUnit(dims.heightUnit);
    }

    if (hasLayers) {
      setLayersMap((prev) => replaceLayerIds(prev, extractSvgLayerIds(text)));
    }
  };

  // External file upload
  const [externalFile, setExternalFile] = React.useState<File | undefined>();
  const [previewExternalUrl, setPreviewExternalUrl] = React.useState<string | null>(null);
  const [externalFileLink, setExternalFileLink] = React.useState(props?.pattern_file_external_link || '');

  // Draft mode
  const [isDraft, setIsDraft] = React.useState(props?.is_draft ?? false);

  // Layers
  const [hasLayers, setHasLayers] = React.useState(props?.has_layers ?? false);
  const [layersMap, setLayersMap] = React.useState<TypePatternLayersMapItem[]>(props?.layers_map ?? []);

  const handleHasLayersChange = async (checked: boolean) => {
    setHasLayers(checked);
    if (!checked) return;
    if (file) {
      const text = await file.text();
      setLayersMap((prev) => mergeLayerIds(prev, extractSvgLayerIds(text)));
    } else if (props?.pattern_file) {
      const text = await fetch(generatePbImageSVG(props)).then((r) => r.text());
      setLayersMap((prev) => mergeLayerIds(prev, extractSvgLayerIds(text)));
    }
  };

  // Pattern Key manager
  const [patternKeyObject, setPatternKeyObject] = React.useState<TypePatternKeyReferenceObject[]>(
    props?.pattern_key_reference_list || [],
  );

  const handleFormReset = () => {
    setName('');
    setDescription('');
    setSourceURL('');
    setPieces('1');
    setLineWidth('0');
    setLineWidthUnit('in');
    setDesignWidth('0');
    setDesignWidthUnit('in');
    setDesignHeight('0');
    setDesignHeightUnit('in');
    setInstructions('');
    setTagValue([]);
    setAuthorValue([]);
    setManualAuthorValue([]);
    handleFileDelete();
    handleExternalFileDelete();
    setExternalFileLink('');
    setPatternKeyObject([]);
    setDesignDate(dayjs());
    setHasLayers(false);
    setLayersMap([]);
    setIsDraft(false);
  };

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl, isOpen]);

  const handleFileDelete = () => {
    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(null);
    setFile(undefined);
    setPendingSvg(null);
    setDesignWidth(String(props?.design_width) || '0');
    setDesignWidthUnit(String(props?.design_width_unit) || 'in');
    setDesignHeight(String(props?.design_height) || '0');
    setDesignHeightUnit(String(props?.design_height_unit) || 'in');
  };

  const handleExternalFileDelete = () => {
    if (previewExternalUrl) URL.revokeObjectURL(previewExternalUrl);
    setPreviewExternalUrl(null);
    setExternalFile(undefined);
  };

  const handleSave = async () => {
    setIsButtonLoading(true);

    try {
      const filteredTags =
        tagValue?.filter((item) => item !== 'undefined')?.map((item) => item?.toString()?.toLowerCase()) || [];
      const filteredAuthors = authorValue || [];
      const filteredManualAuthors =
        manualAuthorValue?.filter((item) => item !== 'undefined')?.map((item) => item?.toString()?.toLowerCase()) || [];

      const payload: TypePatternCreatePayload = {
        name,
        description,
        instructions,
        source_url: sourceURL,
        pieces: pieces && pieces !== 'undefined' ? pieces : '0',
        line_width: lineWidth && lineWidth !== 'undefined' ? lineWidth : '0',
        design_width: designWidth && designWidth !== 'undefined' ? designWidth : '0',
        design_height: designHeight && designHeight !== 'undefined' ? designHeight : '0',
        tags: filteredTags?.sort() || [],
        authors: filteredAuthors || [],
        author_manual: filteredManualAuthors || [],
        line_width_unit: lineWidthUnit && lineWidthUnit !== 'undefined' ? lineWidthUnit : 'in',
        design_width_unit: designWidthUnit && designWidthUnit !== 'undefined' ? designWidthUnit : 'in',
        design_height_unit: designHeightUnit && designHeightUnit !== 'undefined' ? designHeightUnit : 'in',
        pattern_key_reference_list: patternKeyObject || [],
        design_date: designDate,
      };

      if (!props?.uploaded_by) {
        payload.uploaded_by = authData?.name || 'Missing Name';
      }

      if (props?.id) {
        payload.id = props.id;
      }

      payload.has_layers = hasLayers;
      payload.layers_map = hasLayers ? layersMap : [];
      payload.is_draft = isDraft;

      if (file && previewUrl) {
        const sanitizedFile = await sanitizeSvgFile(file);
        payload.pattern_file = sanitizedFile;
        payload.pattern_file_size = sanitizedFile.size;
      }

      if (externalFile && previewExternalUrl) {
        payload.pattern_file_external = externalFile;
      }

      if (externalFileLink) {
        payload.pattern_file_external_link = externalFileLink;
      }

      const savedPattern = await savePattern.mutateAsync(payload);

      log({
        action: props.mode === 'add' ? 'Pattern Created' : 'Pattern Updated',
        entity_type: 'Pattern',
        entity_id: savedPattern.id,
        entity_name: name,
        changes:
          props.mode === 'add'
            ? {}
            : diffAdminChanges(
                props as unknown as Record<string, unknown>,
                {
                  name,
                  description,
                  source_url: sourceURL,
                  pieces,
                  tags: tagValue,
                  authors: authorValue,
                  author_manual: manualAuthorValue,
                  is_draft: isDraft,
                  has_layers: hasLayers,
                } as Record<string, unknown>,
                [
                  'name',
                  'description',
                  'source_url',
                  'pieces',
                  'tags',
                  'authors',
                  'author_manual',
                  'is_draft',
                  'has_layers',
                ],
              ),
        metadata: {
          ...(file ? { pattern_file: '[file uploaded]' } : {}),
          ...(externalFile ? { pattern_file_external: '[file uploaded]' } : {}),
        },
      });

      if (file && previewUrl) {
        try {
          const svgUrl = generatePbImage(savedPattern);
          const ogImage = await generateOpengraphImage({ type: 'svg', url: svgUrl }, name);
          await pocketbase.collection('patterns').update(savedPattern.id, { opengraph_image: ogImage });
        } catch (err) {
          console.warn('OG image generation failed', err);
        }
      }

      if (externalFile && previewExternalUrl) {
        try {
          const fileUrl = generatePbImageExternalFile(savedPattern);
          const ogImage = await generateOpengraphImage({ type: 'webp', url: fileUrl }, name);
          await pocketbase.collection('patterns').update(savedPattern.id, { opengraph_image: ogImage });
        } catch (err) {
          console.warn('OG image generation failed', err);
        }
      }

      await refetchPatterns();
      await refetchTagManagementStats();
      handleClose();

      if (props.mode === 'add') {
        handleFormReset();
      } else {
        handleFileDelete();
        handleExternalFileDelete();
      }
    } catch (error: any) {
      console.warn('Error', error);
      enqueueSnackbar(`Unable to save... Refresh and try again. Error: ${error?.message}`, { variant: 'error' });
    }

    setIsButtonLoading(false);
  };

  const handleDelete = async () => {
    const confirmDelete = window.confirm('Are you sure you want to delete this pattern? This action cannot be undone.');
    if (!confirmDelete) return;

    setIsButtonLoading(true);
    try {
      await deletePattern.mutateAsync({ id: props.id, isDeleted: true });
      log({
        action: 'Pattern Deleted',
        entity_type: 'Pattern',
        entity_id: props.id,
        entity_name: props.name,
        changes: {},
        metadata: {},
      });
      await refetchPatterns();
      handleClose();
    } catch (error: any) {
      console.warn('Error', error);
      enqueueSnackbar(`Unable to delete... Refresh and try again. Error: ${error?.message}`, { variant: 'error' });
    }
    setIsButtonLoading(false);
  };

  return (
    <>
      {props.mode === 'edit' ? (
        <Box>
          <IconButton onClick={handleOpen} size="small">
            <EditRoundedIcon fontSize="inherit" />
          </IconButton>
        </Box>
      ) : (
        <Button disabled={!canAdd} onClick={handleOpen} startIcon={<AddRoundedIcon />}>
          Add Pattern
        </Button>
      )}

      <Dialog fullWidth maxWidth="xl" open={isOpen} onClose={handleClose}>
        {/* Title */}
        <DialogTitle
          sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', pb: 1, pr: 1.5 }}
        >
          <Box>
            <Typography variant="h6" sx={{ fontWeight: 600, lineHeight: 1.2 }}>
              {props.mode === 'add' ? 'Add Pattern' : 'Edit Pattern'}
            </Typography>
            {props.mode !== 'add' && props.name && (
              <Typography variant="caption" color="text.secondary">
                {props.name}
              </Typography>
            )}
          </Box>
          <IconButton onClick={handleClose} size="small" sx={{ mt: 0.25 }}>
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ p: 0 }}>
          {isLoading ? (
            <Box sx={{ display: 'flex', justifyContent: 'center', alignItems: 'center', py: 6, px: 3 }}>
              <CircularProgress />
            </Box>
          ) : isError ? (
            <Alert severity="error" sx={{ m: 3 }}>
              Couldn't load required data - please close the dialog, refresh, and try again.
            </Alert>
          ) : (
            <Box sx={{ display: 'flex', alignItems: 'flex-start' }}>
              {/* ── Sticky left preview (desktop only) ── */}
              <Box
                sx={{
                  display: { xs: 'none', lg: 'flex' },
                  flexDirection: 'column',
                  gap: 1.5,
                  position: 'sticky',
                  top: 0,
                  alignSelf: 'flex-start',
                  width: 600,
                  flexShrink: 0,
                  p: 3,
                  borderRight: '1px solid',
                  borderColor: 'divider',
                }}
              >
                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ textTransform: 'uppercase', letterSpacing: '0.08em', fontWeight: 700 }}
                >
                  Preview
                </Typography>

                {previewUrl ? (
                  <Box
                    component="img"
                    src={previewUrl}
                    alt="New pattern preview"
                    sx={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'grey.50',
                      p: 1,
                    }}
                  />
                ) : props.pattern_file ? (
                  <Box
                    component="img"
                    src={generatePbImageSVG(props)}
                    alt={props.name}
                    sx={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'grey.50',
                      p: 1,
                    }}
                  />
                ) : previewExternalUrl ? (
                  <Box
                    component="img"
                    src={previewExternalUrl}
                    alt="New external pattern preview"
                    sx={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'grey.50',
                      p: 1,
                    }}
                  />
                ) : props.pattern_file_external ? (
                  <Box
                    component="img"
                    src={generatePbImageExternalFile(props)}
                    alt={props.name}
                    sx={{
                      width: '100%',
                      aspectRatio: '1/1',
                      objectFit: 'contain',
                      borderRadius: 1.5,
                      border: '1px solid',
                      borderColor: 'divider',
                      backgroundColor: 'grey.50',
                      p: 1,
                    }}
                  />
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

              {/* ── Right: form fields ── */}
              <Box sx={{ flex: 1, minWidth: 0, p: 3 }}>
                <Stack spacing={2.5} sx={{ py: 1 }}>
                  {/* ── Status ── */}
                  {isDraft && (
                    <Alert severity="warning" sx={{ borderRadius: 2 }}>
                      This pattern is in <strong>Draft Mode</strong> and is not visible to the public.
                    </Alert>
                  )}

                  <FormControlLabel
                    control={<Checkbox checked={isDraft} onChange={(e) => setIsDraft(e.target.checked)} />}
                    label="Draft Mode (hidden from public)"
                  />

                  {/* ── Pattern File ── */}
                  <FormSection label="Pattern File" />

                  <Box sx={{ width: '100%' }}>
                    <TabContext value={tabValue}>
                      <Box sx={{ borderBottom: 1, borderColor: 'divider' }}>
                        <TabList onChange={handleTabChange} aria-label="Pattern upload type">
                          <Tab label="Upload SVG" value="1" />
                          <Tab label="External Pattern" value="2" />
                        </TabList>
                      </Box>

                      {/* SVG tab */}
                      <TabPanel value="1" sx={{ px: 0, pt: 2, pb: 0 }} key="svg-tab">
                        {file && previewUrl ? (
                          <>
                            <Grid container spacing={2} sx={{ mb: 1.5 }}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}
                                >
                                  Current
                                </Typography>

                                {props.pattern_file ? (
                                  <Tooltip title="Download" arrow>
                                    <a href={generatePbImage(props)} download style={{ display: 'inlineBlock' }}>
                                      <Box
                                        component="img"
                                        loading="lazy"
                                        src={generatePbImage(props)}
                                        alt={`current pattern for ${props.name}`}
                                        sx={{
                                          width: '100%',
                                          height: 'auto',
                                          aspectRatio: '1/1',
                                          objectFit: 'contain',
                                          borderRadius: 1.5,
                                          border: '1px solid',
                                          borderColor: 'divider',
                                          backgroundColor: 'grey.50',
                                          p: 1,
                                        }}
                                      />
                                    </a>
                                  </Tooltip>
                                ) : (
                                  <Box
                                    sx={{
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 1.5,
                                      p: 4,
                                      textAlign: 'center',
                                      backgroundColor: 'grey.50',
                                    }}
                                  >
                                    <Typography variant="body2" color="text.disabled">
                                      No current file
                                    </Typography>
                                  </Box>
                                )}
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ position: 'relative' }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}
                                  >
                                    New
                                  </Typography>

                                  <IconButton
                                    size="small"
                                    onClick={handleFileDelete}
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: 'background.paper',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      '&:hover': { color: 'error.main' },
                                    }}
                                  >
                                    <DeleteRoundedIcon fontSize="small" />
                                  </IconButton>

                                  <Box
                                    component="img"
                                    loading="lazy"
                                    src={previewUrl}
                                    alt="New pattern preview"
                                    sx={{
                                      width: '100%',
                                      height: 'auto',
                                      aspectRatio: '1/1',
                                      objectFit: 'contain',
                                      borderRadius: 1.5,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      backgroundColor: 'grey.50',
                                      p: 1,
                                    }}
                                  />
                                </Box>
                              </Grid>
                            </Grid>
                          </>
                        ) : (
                          <>
                            {props.pattern_file && (
                              <Grid container spacing={2} sx={{ mb: 1.5 }}>
                                <Grid size={{ xs: 12, md: 6 }}>
                                  <>
                                    <Typography
                                      variant="caption"
                                      color="text.secondary"
                                      sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}
                                    >
                                      Current pattern
                                    </Typography>

                                    <Tooltip title="Download" arrow>
                                      <a href={generatePbImage(props)} download style={{ display: 'inlineBlock' }}>
                                        <Box
                                          component="img"
                                          loading="lazy"
                                          src={generatePbImage(props)}
                                          alt={`current pattern for ${props.name}`}
                                          sx={{
                                            width: '100%',
                                            height: 'auto',
                                            aspectRatio: '1/1',
                                            objectFit: 'contain',
                                            borderRadius: 1.5,
                                            border: '1px solid',
                                            borderColor: 'divider',
                                            backgroundColor: 'grey.50',
                                            p: 1,
                                          }}
                                        />
                                      </a>
                                    </Tooltip>
                                  </>
                                </Grid>
                              </Grid>
                            )}

                            <SvgDropZone
                              accept=".svg,image/svg+xml"
                              acceptLabel=".svg only"
                              label={
                                props.pattern_file
                                  ? 'Drop a new SVG to replace, or click to browse'
                                  : 'Drop SVG here or click to browse'
                              }
                              onFile={async (f) => {
                                if (!f.type.includes('svg')) {
                                  alert('Please upload an SVG file');
                                  return;
                                }

                                const text = await f.text();

                                // Warn the admin before accepting a file that contains
                                // potentially unsafe constructs (external refs, recursion, etc).
                                const threats = analyzeSvgThreats(text);
                                if (threats.length > 0) {
                                  setPendingSvg({ file: f, text, threats });
                                  return;
                                }

                                commitSvgFile(f, text);
                              }}
                            />
                          </>
                        )}
                      </TabPanel>

                      {/* External pattern tab */}
                      <TabPanel value="2" sx={{ px: 0, pt: 2, pb: 0 }}>
                        {externalFile && previewExternalUrl ? (
                          <>
                            <Grid container spacing={2} sx={{ mb: 1.5 }}>
                              <Grid size={{ xs: 12, md: 6 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}
                                >
                                  Current
                                </Typography>
                                {props.pattern_file_external ? (
                                  <Box
                                    component="img"
                                    loading="lazy"
                                    src={generatePbImage(props)}
                                    alt={`current pattern for ${props.name}`}
                                    sx={{
                                      width: '100%',
                                      height: 'auto',
                                      aspectRatio: '1/1',
                                      objectFit: 'contain',
                                      borderRadius: 1.5,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      backgroundColor: 'grey.50',
                                      p: 1,
                                    }}
                                  />
                                ) : (
                                  <Box
                                    sx={{
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      borderRadius: 1.5,
                                      p: 4,
                                      textAlign: 'center',
                                      backgroundColor: 'grey.50',
                                    }}
                                  >
                                    <Typography variant="body2" color="text.disabled">
                                      No current file
                                    </Typography>
                                  </Box>
                                )}
                              </Grid>

                              <Grid size={{ xs: 12, md: 6 }}>
                                <Box sx={{ position: 'relative' }}>
                                  <Typography
                                    variant="caption"
                                    color="text.secondary"
                                    sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}
                                  >
                                    New
                                  </Typography>
                                  <IconButton
                                    size="small"
                                    onClick={handleExternalFileDelete}
                                    sx={{
                                      position: 'absolute',
                                      top: 0,
                                      right: 0,
                                      backgroundColor: 'background.paper',
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      '&:hover': { color: 'error.main' },
                                    }}
                                  >
                                    <DeleteRoundedIcon fontSize="small" />
                                  </IconButton>
                                  <Box
                                    component="img"
                                    loading="lazy"
                                    src={previewExternalUrl}
                                    alt="New external pattern preview"
                                    sx={{
                                      width: '100%',
                                      height: 'auto',
                                      aspectRatio: '1/1',
                                      objectFit: 'contain',
                                      borderRadius: 1.5,
                                      border: '1px solid',
                                      borderColor: 'divider',
                                      backgroundColor: 'grey.50',
                                      p: 1,
                                    }}
                                  />
                                </Box>
                              </Grid>
                            </Grid>
                          </>
                        ) : (
                          <>
                            {props.pattern_file_external && (
                              <Box sx={{ mb: 2 }}>
                                <Typography
                                  variant="caption"
                                  color="text.secondary"
                                  sx={{ fontWeight: 600, display: 'block', mb: 0.75 }}
                                >
                                  Current image
                                </Typography>
                                <Box
                                  component="img"
                                  loading="lazy"
                                  src={generatePbImage(props)}
                                  alt={`current external pattern for ${props.name}`}
                                  sx={{
                                    width: '100%',
                                    maxWidth: 280,
                                    height: 'auto',
                                    borderRadius: 1.5,
                                    border: '1px solid',
                                    borderColor: 'divider',
                                    backgroundColor: 'grey.50',
                                    p: 1,
                                  }}
                                />
                              </Box>
                            )}

                            <SvgDropZone
                              accept=".webp,image/webp"
                              acceptLabel=".webp only"
                              label={
                                props.pattern_file_external
                                  ? 'Drop a new WebP to replace, or click to browse'
                                  : 'Drop WebP image here or click to browse'
                              }
                              onFile={(f) => {
                                if (!f.type.includes('webp')) {
                                  alert('Please upload a WebP file');
                                  return;
                                }
                                setPreviewExternalUrl(URL.createObjectURL(f));
                                setExternalFile(f);
                              }}
                            />
                          </>
                        )}

                        <Box sx={{ mt: 2 }}>
                          <TextField
                            label="External Pattern Link"
                            variant="filled"
                            fullWidth
                            value={externalFileLink}
                            onChange={(e) => setExternalFileLink(e.target.value)}
                          />
                        </Box>
                      </TabPanel>
                    </TabContext>
                  </Box>

                  <PatternEditFields
                    variant="filled"
                    resetKey={props.id}
                    name={name}
                    onNameChange={setName}
                    description={description}
                    onDescriptionChange={setDescription}
                    designDate={designDate}
                    onDesignDateChange={setDesignDate}
                    sourceUrl={sourceURL}
                    onSourceUrlChange={setSourceURL}
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
                    tags={tagValue}
                    onTagsChange={setTagValue}
                    authors={authorValue}
                    onAuthorsChange={setAuthorValue}
                    authorManual={manualAuthorValue}
                    onAuthorManualChange={setManualAuthorValue}
                    hasLayers={hasLayers}
                    onHasLayersChange={handleHasLayersChange}
                    layersMap={layersMap}
                    onLayersMapChange={setLayersMap}
                    patternKeys={patternKeyObject}
                    onPatternKeysChange={setPatternKeyObject}
                    showPatternKeyBuilder={!props.pattern_file_external_link}
                  />
                </Stack>
              </Box>
            </Box>
          )}
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          {!isLoading && !isError && (
            <Button
              color="error"
              disabled={!canDelete}
              variant="contained"
              sx={{ mr: 'auto' }}
              loading={isButtonLoading}
              onClick={handleDelete}
            >
              Delete
            </Button>
          )}

          <Button onClick={handleClose} loading={isButtonLoading} color="inherit">
            Cancel
          </Button>

          {!isLoading && !isError && (
            <Button disabled={!canEdit} onClick={handleSave} loading={isButtonLoading} variant="contained">
              Save
            </Button>
          )}
        </DialogActions>
      </Dialog>

      {/* SVG safety warning — shown when a selected file contains risky constructs */}
      <Dialog open={!!pendingSvg} onClose={() => setPendingSvg(null)} maxWidth="sm" fullWidth>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1, color: 'warning.main' }}>
          <WarningAmberRoundedIcon /> Unsafe SVG
        </DialogTitle>
        <DialogContent>
          <Stack spacing={1.5}>
            {pendingSvg?.threats.map((t, i) => (
              <Box
                key={`${t.id}-${i}`}
                sx={{
                  borderLeft: '3px solid',
                  borderColor: t.severity === 'high' ? 'error.main' : 'warning.main',
                  pl: 1.5,
                }}
              >
                <Typography variant="subtitle2" sx={{ fontWeight: 700 }}>
                  {t.title}
                  <Typography
                    component="span"
                    variant="caption"
                    sx={{ ml: 1, color: t.severity === 'high' ? 'error.main' : 'warning.main', fontWeight: 700 }}
                  >
                    {t.severity === 'high' ? 'HIGH' : 'REVIEW'}
                  </Typography>
                </Typography>
                <Typography variant="caption" color="text.secondary">
                  {t.detail}
                </Typography>
              </Box>
            ))}
          </Stack>
        </DialogContent>
        <DialogActions>
          <Button variant="outlined" onClick={() => setPendingSvg(null)} color="inherit">
            Close and try again...
          </Button>
          {/*<Button
            color="error"
            variant="contained"
            onClick={() => {
              if (pendingSvg) commitSvgFile(pendingSvg.file, pendingSvg.text);
              setPendingSvg(null);
            }}
          >
            Upload anyway
          </Button>*/}
        </DialogActions>
      </Dialog>
    </>
  );
};
