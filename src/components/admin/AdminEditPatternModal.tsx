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
import {
  PatternDetailsForm,
  type PatternDetailsFormHandle,
  type TypePatternDetailsFormValues,
} from '@/components/admin/PatternDetailsForm';
import { FormSection } from '@/components/admin/FormSection';
import { generateOpengraphImage } from '@/functions/utilities/generate-opengraph-image';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import dayjs from 'dayjs';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
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
  Dialog,
  IconButton,
  DialogActions,
  DialogContent,
  DialogTitle,
  TextField,
  Stack,
  Typography,
  Grid,
  Tab,
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

  const formRef = React.useRef<PatternDetailsFormHandle>(null);

  const initialValues: TypePatternDetailsFormValues = {
    name: props?.name || '',
    description: props?.description || '',
    instructions: props?.instructions || '',
    sourceUrl: props?.source_url || '',
    designDate: props?.design_date ? dayjs(props?.design_date) : dayjs(),
    pieces: String(props?.pieces) || '1',
    designWidth: String(props?.design_width) || '0',
    designWidthUnit: String(props?.design_width_unit) || 'in',
    designHeight: String(props?.design_height) || '0',
    designHeightUnit: String(props?.design_height_unit) || 'in',
    lineWidth: String(props?.line_width) || '0',
    lineWidthUnit: String(props?.line_width_unit) || 'in',
    tags: props?.tags || [],
    authors: props?.authors || [],
    authorManual: props?.author_manual || [],
    hasLayers: props?.has_layers ?? false,
    layersMap: props?.layers_map ?? [],
    patternKeys: props?.pattern_key_reference_list || [],
    isDraft: props?.is_draft ?? false,
  };

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
    if (dims) formRef.current?.applyDetectedDimensions(dims);

    formRef.current?.applyNewFileLayerIds(extractSvgLayerIds(text));
  };

  // External file upload
  const [externalFile, setExternalFile] = React.useState<File | undefined>();
  const [previewExternalUrl, setPreviewExternalUrl] = React.useState<string | null>(null);
  const [externalFileLink, setExternalFileLink] = React.useState(props?.pattern_file_external_link || '');

  const handleFormReset = () => {
    formRef.current?.reset();
    handleFileDelete();
    handleExternalFileDelete();
    setExternalFileLink('');
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
    formRef.current?.applyDetectedDimensions({
      width: Number(props?.design_width) || 0,
      widthUnit: props?.design_width_unit || 'in',
      height: Number(props?.design_height) || 0,
      heightUnit: props?.design_height_unit || 'in',
    });
  };

  const handleExternalFileDelete = () => {
    if (previewExternalUrl) URL.revokeObjectURL(previewExternalUrl);
    setPreviewExternalUrl(null);
    setExternalFile(undefined);
  };

  const handleSave = async () => {
    const values = formRef.current?.getPayload();
    if (!values) return;

    setIsButtonLoading(true);

    try {
      const filteredTags =
        values.tags?.filter((item) => item !== 'undefined')?.map((item) => item?.toString()?.toLowerCase()) || [];
      const filteredAuthors = values.authors || [];
      const filteredManualAuthors =
        values.authorManual?.filter((item) => item !== 'undefined')?.map((item) => item?.toString()?.toLowerCase()) ||
        [];

      const payload: TypePatternCreatePayload = {
        name: values.name,
        description: values.description,
        instructions: values.instructions,
        source_url: values.sourceUrl,
        pieces: values.pieces && values.pieces !== 'undefined' ? values.pieces : '0',
        line_width: values.lineWidth && values.lineWidth !== 'undefined' ? values.lineWidth : '0',
        design_width: values.designWidth && values.designWidth !== 'undefined' ? values.designWidth : '0',
        design_height: values.designHeight && values.designHeight !== 'undefined' ? values.designHeight : '0',
        tags: filteredTags?.sort() || [],
        authors: filteredAuthors || [],
        author_manual: filteredManualAuthors || [],
        line_width_unit: values.lineWidthUnit && values.lineWidthUnit !== 'undefined' ? values.lineWidthUnit : 'in',
        design_width_unit:
          values.designWidthUnit && values.designWidthUnit !== 'undefined' ? values.designWidthUnit : 'in',
        design_height_unit:
          values.designHeightUnit && values.designHeightUnit !== 'undefined' ? values.designHeightUnit : 'in',
        pattern_key_reference_list: values.patternKeys || [],
        design_date: values.designDate,
      };

      if (!props?.uploaded_by) {
        payload.uploaded_by = authData?.name || 'Missing Name';
      }

      if (props?.id) {
        payload.id = props.id;
      }

      payload.has_layers = values.hasLayers;
      payload.layers_map = values.hasLayers ? values.layersMap : [];
      payload.is_draft = values.isDraft;

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
        entity_name: values.name,
        changes:
          props.mode === 'add'
            ? {}
            : diffAdminChanges(
                props as unknown as Record<string, unknown>,
                {
                  name: values.name,
                  description: values.description,
                  source_url: values.sourceUrl,
                  pieces: values.pieces,
                  tags: values.tags,
                  authors: values.authors,
                  author_manual: values.authorManual,
                  is_draft: values.isDraft,
                  has_layers: values.hasLayers,
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
          const ogImage = await generateOpengraphImage({ type: 'svg', url: svgUrl }, values.name);
          await pocketbase.collection('patterns').update(savedPattern.id, { opengraph_image: ogImage });
        } catch (err) {
          console.warn('OG image generation failed', err);
        }
      }

      if (externalFile && previewExternalUrl) {
        try {
          const fileUrl = generatePbImageExternalFile(savedPattern);
          const ogImage = await generateOpengraphImage({ type: 'webp', url: fileUrl }, values.name);
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

  // Precedence: a freshly-picked file always wins over whatever's already saved.
  const previewImageUrl =
    previewUrl ??
    (props.pattern_file ? generatePbImageSVG(props) : null) ??
    previewExternalUrl ??
    (props.pattern_file_external ? generatePbImageExternalFile(props) : null);

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
          <PatternDetailsForm
            ref={formRef}
            initialValues={initialValues}
            previewImageUrl={previewImageUrl}
            previewLayout="sidebar"
            variant="filled"
            resetKey={props.id}
            showPatternKeyBuilder={!props.pattern_file_external_link}
            resolveSvgTextForLayerSeed={async () => {
              if (file) return file.text();
              if (props.pattern_file) return fetch(generatePbImageSVG(props)).then((r) => r.text());
              return null;
            }}
          >
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
          </PatternDetailsForm>
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
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

          <Button onClick={handleClose} loading={isButtonLoading} color="inherit">
            Cancel
          </Button>

          <Button disabled={!canEdit} onClick={handleSave} loading={isButtonLoading} variant="contained">
            Save
          </Button>
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
