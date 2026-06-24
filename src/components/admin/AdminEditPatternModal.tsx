import React from 'react';
import { enqueueSnackbar } from 'notistack';
import {
  generatePbImage,
  generatePbImageExternalFile,
  generatePbImagePatternKeyRef,
  generatePbImageSVG,
} from '@/functions/utilities/generate-pb-image';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  useQueryAdminTagStats,
  useQueryAdminTagStatsPaginated,
  useQueryGetTagHierarchy,
  getAncestors,
} from '@/functions/database/tags';
import { useQuerySearchLinkedAuthors, useQuerySearchManualAuthors } from '@/functions/database/authors';
import { useAdminLogger, diffAdminChanges } from '@/functions/database/admin-logs';
import { useGlobalAdminFilter, useGlobalAdminPagination } from '@/data/admin-global-state';
import { FancyAutocomplete, FancyAutocompleteAuthors } from '@/components/FancyAutocomplete';
import { generateOpengraphImage } from '@/functions/utilities/generate-opengraph-image';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import dayjs, { Dayjs } from 'dayjs';
import {
  type TypePatternResponse,
  type TypePatternCreatePayload,
  type TypePatternKeyReferenceObject,
  type TypePatternLayersMapItem,
  useQueryGetAllPatternsByPaginationAdmin,
  useMutationEditPattern,
  useMutationSoftDeletePattern,
  useQueryGetAllPatternKeys,
  useQueryGetAllPatternKeyCollections,
} from '@/functions/database/patterns';
import { sanitizeSvgFile, extractSvgLayerIds, extractSvgDimensions } from '@/functions/utilities/sanitize-svg';
import { pocketbase } from '@/functions/database/authentication-setup';
import { SvgDropZone } from '@/components/admin/SvgDropZone';

import AddRoundedIcon from '@mui/icons-material/AddRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';

import { DatePicker } from '@mui/x-date-pickers/DatePicker';

import {
  Box,
  Button,
  Checkbox,
  Dialog,
  Divider,
  FormControlLabel,
  MenuItem,
  IconButton,
  DialogActions,
  DialogContent,
  ListItemText,
  DialogTitle,
  TextField,
  Stack,
  List,
  ListItem,
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
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';

// ─── Types ────────────────────────────────────────────────────────────────────

type TypeModalMode = 'edit' | 'add';

type TypeEditModalProps = TypePatternResponse & {
  mode?: TypeModalMode;
  callback?: () => void;
};

// ─── Section label helper ─────────────────────────────────────────────────────

const FormSection = ({ label }: { label: string }) => (
  <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5, my: 0.5 }}>
    <Typography
      sx={{
        whiteSpace: 'nowrap',
        fontSize: '0.67rem',
        fontWeight: 700,
        letterSpacing: '0.09em',
        textTransform: 'uppercase',
        color: 'text.disabled',
      }}
    >
      {label}
    </Typography>
    <Divider sx={{ flex: 1 }} />
  </Box>
);

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

  // Tag autocomplete input - declared here so the debounced value can drive the
  // server-side search query below (hook call order must stay consistent).
  const [autoCompleteInputValue, setAutoCompleteInputValue] = React.useState('');
  const debouncedTagSearch = useDebounce(autoCompleteInputValue, 400);

  const { data: tagSearchData, isFetching: tagSearchFetching } = useQueryAdminTagStatsPaginated({
    page: 0,
    pageSize: 50,
    search: debouncedTagSearch,
    sortField: 'count',
    sortDir: 'desc',
  });

  const { refetch: refetchTagManagementStats } = useQueryAdminTagStats();

  const { data: hierarchyData = [] } = useQueryGetTagHierarchy();

  const { searchResult } = useGlobalAdminFilter();
  const { paginationModel } = useGlobalAdminPagination();

  const savePattern = useMutationEditPattern();
  const deletePattern = useMutationSoftDeletePattern();
  const { log } = useAdminLogger();

  const { refetch: refetchPatterns } = useQueryGetAllPatternsByPaginationAdmin(searchResult, paginationModel.page);

  const {
    isPending: isPendingPatternKeys,
    isError: isErrorPatternKeys,
    data: patternKeys,
  } = useQueryGetAllPatternKeys();

  const { data: patternKeyCollections } = useQueryGetAllPatternKeyCollections();

  const [quickAddKeyCollection, setQuickAddKeyCollection] = React.useState('');

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

  /**
   * Set of tag names that were auto-added as ancestors of a primary tag.
   * Used to render inherited chips differently and to clean them up when their
   * primary tag is removed.
   */
  const [inheritedTags, setInheritedTags] = React.useState<Set<string>>(new Set());

  // Once the hierarchy loads, mark which existing pattern tags are ancestors of
  // other tags already in the set so they render as inherited chips.
  React.useEffect(() => {
    const current = props?.tags ?? [];
    if (current.length === 0) return;
    const inherited = new Set<string>();
    for (const tag of current) {
      for (const ancestor of getAncestors(tag, hierarchyData)) {
        if (current.includes(ancestor)) inherited.add(ancestor);
      }
    }
    setInheritedTags(inherited);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [hierarchyData.length]);

  /**
   * Smart tag change handler.
   * When a new tag is added, its full ancestor chain is auto-added as inherited tags.
   * When a primary tag is removed, its orphaned ancestors are cleaned up.
   */
  const handleTagChange = React.useCallback(
    (newValue: string[]) => {
      const added = newValue.filter((t) => !tagValue.includes(t));
      const removed = tagValue.filter((t) => !newValue.includes(t));

      let result = [...newValue];
      const newInherited = new Set(inheritedTags);

      // Auto-add ancestors for any newly added tags
      for (const tag of added) {
        newInherited.delete(tag); // Explicitly added → promote to primary
        for (const ancestor of getAncestors(tag, hierarchyData)) {
          if (!result.includes(ancestor)) {
            result.push(ancestor);
            newInherited.add(ancestor);
          }
        }
      }

      // When a primary tag is removed, clean up orphaned inherited ancestors
      for (const tag of removed) {
        if (!newInherited.has(tag)) {
          // It was primary - check each of its ancestors
          for (const ancestor of getAncestors(tag, hierarchyData)) {
            const stillNeeded = result
              .filter((t) => !newInherited.has(t) && t !== tag)
              .some((primary) => getAncestors(primary, hierarchyData).includes(ancestor));
            if (!stillNeeded) {
              result = result.filter((t) => t !== ancestor);
              newInherited.delete(ancestor);
            }
          }
        }
        newInherited.delete(tag);
      }

      setTagValue(result);
      setInheritedTags(newInherited);
    },
    [tagValue, inheritedTags, hierarchyData],
  );

  // Authors
  const [authorValue, setAuthorValue] = React.useState<string[] | undefined>(props?.authors || []);
  const [authorAutoCompleteInputValue, setAuthorAutoCompleteInputValue] = React.useState('');

  const debouncedAuthorSearch = useDebounce(authorAutoCompleteInputValue, 600);

  // Manual Authors
  const [manualAuthorValue, setManualAuthorValue] = React.useState<string[] | undefined>(props?.author_manual || []);
  const [manualAuthorAutoCompleteInputValue, setManualAuthorAutoCompleteInputValue] = React.useState('');
  const debouncedManualAuthorSearch = useDebounce(manualAuthorAutoCompleteInputValue, 600);

  // Design Date
  const now = props?.design_date ? dayjs(props?.design_date) : dayjs();
  const [designDate, setDesignDate] = React.useState<Dayjs | null>(now);

  const { data: authorData, isFetching: authorFetching } = useQuerySearchLinkedAuthors(debouncedAuthorSearch);
  const { data: manualAuthorData, isFetching: manualAuthorFetching } =
    useQuerySearchManualAuthors(debouncedManualAuthorSearch);

  const isLoading = false;
  const isError = false;

  // Instructions
  const [instructions, setInstructions] = React.useState(props?.instructions || '');

  // SVG Upload
  const [file, setFile] = React.useState<File | undefined>();
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);

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
  const [newPatternKey, setNewPatternKey] = React.useState<TypePatternKeyReferenceObject>({
    image: '',
    name: '',
    fullPath: '',
  });

  const [patternKeyObject, setPatternKeyObject] = React.useState<TypePatternKeyReferenceObject[]>(
    props?.pattern_key_reference_list || [],
  );

  const handleNewChangePatternKey = (newData: any) => {
    setNewPatternKey((prev) => ({ ...prev, ...newData }));
  };

  const handleResetChangePatternKey = () => {
    setNewPatternKey({ image: '', name: '', fullPath: '' });
  };

  const handleAddPatternKey = (newData: TypePatternKeyReferenceObject) => {
    setPatternKeyObject((prev) => [...prev, { ...newData }]);
    setTimeout(() => handleResetChangePatternKey(), 100);
  };

  const [openKeySelectWindow, setOpenKeySelectWindow] = React.useState(false);

  const handleOpenKeySelect = () => {
    const promises =
      patternKeys?.map(
        (item) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = generatePbImagePatternKeyRef(item);
          }),
      ) || [];
    Promise.all(promises).then(() => setOpenKeySelectWindow(true));
  };

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
    setAutoCompleteInputValue('');
    setAuthorValue([]);
    setAuthorAutoCompleteInputValue('');
    setManualAuthorValue([]);
    setManualAuthorAutoCompleteInputValue('');
    handleFileDelete();
    handleExternalFileDelete();
    setExternalFileLink('');
    handleResetChangePatternKey();
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

  const handleDeletePatternKey = async (fullPath: string) => {
    setPatternKeyObject((prev) => prev.filter((item) => item.fullPath !== fullPath));
  };

  const handleClickQuickAddKeyCollection = () => {
    const quickAdd = JSON.parse(quickAddKeyCollection);
    setPatternKeyObject(quickAdd);
    setQuickAddKeyCollection('');
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

                  {/* ── Info ── */}
                  <FormSection label="Pattern Info" />

                  <TextField
                    fullWidth
                    variant="filled"
                    label="Name"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    helperText={name?.length > 100 ? `Name is too long: ${name?.length}/100` : `${name?.length}/100`}
                    error={name?.length > 100}
                  />

                  <GenericMarkdownEditor
                    content={description}
                    setContent={setDescription}
                    characterLimit={2000}
                    minRows={2}
                    label="Description"
                  />

                  <DatePicker label="Design Date" value={designDate} onChange={(newValue) => setDesignDate(newValue)} />

                  <TextField
                    fullWidth
                    variant="filled"
                    label="Source URL"
                    value={sourceURL}
                    onChange={(e) => setSourceURL(e.target.value)}
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
                                setPreviewUrl(URL.createObjectURL(f));
                                setFile(f);

                                const text = await f.text();

                                const dims = extractSvgDimensions(text);
                                if (dims) {
                                  setDesignWidth(String(dims.width));
                                  setDesignWidthUnit(dims.widthUnit);
                                  setDesignHeight(String(dims.height));
                                  setDesignHeightUnit(dims.heightUnit);
                                }

                                if (hasLayers) {
                                  setLayersMap((prev) => replaceLayerIds(prev, extractSvgLayerIds(text)));
                                }
                              }}
                            />
                          </>
                        )}

                        {/* ── Has Layers ── */}
                        <FormControlLabel
                          control={
                            <Checkbox checked={hasLayers} onChange={(e) => handleHasLayersChange(e.target.checked)} />
                          }
                          label="Has Layers"
                          sx={{ mt: 1 }}
                        />

                        {hasLayers && layersMap.length > 0 && (
                          <Box sx={{ mt: 1 }}>
                            <Typography
                              variant="caption"
                              color="text.secondary"
                              sx={{ fontWeight: 600, display: 'block', mb: 1 }}
                            >
                              Layer Map
                            </Typography>
                            <Stack spacing={1}>
                              {layersMap.map((item, index) => (
                                <Grid container spacing={1} key={item.layerName} sx={{ alignItems: 'center' }}>
                                  <Grid size={{ xs: 5 }}>
                                    <TextField
                                      size="small"
                                      fullWidth
                                      variant="filled"
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
                                          setLayersMap((prev) =>
                                            prev.map((e, i) => (i === index ? { ...e, mappedName: e.layerName } : e)),
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
                                      variant="filled"
                                      label="Display Name"
                                      value={item.mappedName}
                                      onChange={(e) =>
                                        setLayersMap((prev) =>
                                          prev.map((entry, i) =>
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
                                          ? 'Users can toggle this layer,  click to lock'
                                          : 'Required layer - users cannot hide this'
                                      }
                                      arrow
                                    >
                                      <IconButton
                                        size="small"
                                        onClick={() =>
                                          setLayersMap((prev) =>
                                            prev.map((e, i) =>
                                              i === index
                                                ? { ...e, isVisible: e.isVisible === false ? true : false }
                                                : e,
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

                  {/* ── Measurements ── */}
                  <FormSection label="Measurements" />

                  <TextField
                    fullWidth
                    variant="filled"
                    label="Pieces"
                    type="number"
                    value={pieces}
                    onChange={(e) => setPieces(e.target.value)}
                  />

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        variant="filled"
                        label="Line Width"
                        type="number"
                        value={lineWidth}
                        onChange={(e) => setLineWidth(e.target.value)}
                      />
                    </Grid>
                    <UnitOfMeasurementSelect
                      label="Line Width Unit"
                      value={lineWidthUnit}
                      onChange={setLineWidthUnit}
                    />
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        variant="filled"
                        label="Design Width"
                        type="number"
                        value={designWidth}
                        onChange={(e) => setDesignWidth(e.target.value)}
                      />
                    </Grid>
                    <UnitOfMeasurementSelect
                      label="Design Width Unit"
                      value={designWidthUnit}
                      onChange={setDesignWidthUnit}
                    />
                  </Grid>

                  <Grid container spacing={2}>
                    <Grid size={{ xs: 12, md: 6 }}>
                      <TextField
                        fullWidth
                        variant="filled"
                        label="Design Height"
                        type="number"
                        value={designHeight}
                        onChange={(e) => setDesignHeight(e.target.value)}
                      />
                    </Grid>
                    <UnitOfMeasurementSelect
                      label="Design Height Unit"
                      value={designHeightUnit}
                      onChange={setDesignHeightUnit}
                    />
                  </Grid>

                  {/* ── Instructions ── */}
                  <FormSection label="Instructions" />
                  <GenericMarkdownEditor
                    content={instructions}
                    setContent={setInstructions}
                    characterLimit={10000}
                    minRows={2}
                  />

                  {/* ── Metadata ── */}
                  <FormSection label="Metadata" />

                  <FancyAutocomplete
                    label="Tags"
                    freeSolo
                    serverSide
                    data={tagSearchData?.items ?? []}
                    value={tagValue}
                    onChange={handleTagChange}
                    inputValue={autoCompleteInputValue}
                    onInputChange={setAutoCompleteInputValue}
                    inheritedValues={inheritedTags}
                    loading={tagSearchFetching}
                  />

                  {/*<Typography variant="body2" color="text.secondary">
                Total Tags Used: {allTagsData?.length}/500
              </Typography>*/}

                  <FancyAutocompleteAuthors
                    label="Author"
                    serverSide
                    freeSolo
                    loading={authorFetching}
                    data={authorData ?? []}
                    value={authorValue}
                    onChange={setAuthorValue}
                    inputValue={authorAutoCompleteInputValue}
                    onInputChange={setAuthorAutoCompleteInputValue}
                  />

                  <FancyAutocomplete
                    label="Manual Author"
                    serverSide
                    loading={manualAuthorFetching}
                    data={manualAuthorData ?? []}
                    value={manualAuthorValue}
                    freeSolo
                    onChange={setManualAuthorValue}
                    inputValue={manualAuthorAutoCompleteInputValue}
                    onInputChange={setManualAuthorAutoCompleteInputValue}
                  />

                  {/* ── Pattern Key Builder ── */}
                  {!props.pattern_file_external_link && (
                    <>
                      <FormSection label="Pattern Key" />

                      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
                        <Box sx={{ mr: 'auto' }}>
                          <Typography variant="body2" sx={{ fontWeight: 600 }}>
                            Pattern Key Builder
                          </Typography>
                          <Typography variant="caption" color="text.secondary">
                            Add key images to the legend
                          </Typography>
                        </Box>

                        <TextField
                          select
                          size="small"
                          label="Quick-add collection"
                          sx={{ minWidth: 200 }}
                          value={quickAddKeyCollection}
                          onChange={(e) => setQuickAddKeyCollection(e.target.value)}
                        >
                          {patternKeyCollections?.map((item, index) => (
                            <MenuItem key={`key-collection-quick-add-${index}`} value={JSON.stringify(item.collection)}>
                              {item.name}
                            </MenuItem>
                          ))}
                        </TextField>

                        <Button
                          size="small"
                          variant="outlined"
                          onClick={handleClickQuickAddKeyCollection}
                          disabled={!quickAddKeyCollection}
                        >
                          Apply
                        </Button>
                      </Stack>

                      {isPendingPatternKeys && <CircularProgress size={20} />}

                      {isErrorPatternKeys && (
                        <Alert severity="error">
                          Unable to load the pattern keys… that's probably not good. Try refreshing.
                        </Alert>
                      )}

                      {patternKeys && (
                        <Grid container spacing={2}>
                          <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                              fullWidth
                              select
                              variant="filled"
                              label="Key Image"
                              value={newPatternKey.fullPath}
                              slotProps={{
                                select: {
                                  open: openKeySelectWindow,
                                  onOpen: handleOpenKeySelect,
                                  onClose: () => setOpenKeySelectWindow(false),
                                },
                              }}
                              onChange={(e) => handleNewChangePatternKey({ fullPath: e.target.value })}
                            >
                              {patternKeys.map((item) => (
                                <MenuItem key={item.id} value={generatePbImagePatternKeyRef(item)}>
                                  <Box
                                    component="img"
                                    loading="lazy"
                                    src={generatePbImagePatternKeyRef(item)}
                                    alt={`pattern-key-img-${item.id}`}
                                    sx={{ width: '100%', height: 'auto', maxHeight: 100 }}
                                  />
                                </MenuItem>
                              ))}
                            </TextField>
                          </Grid>

                          <Grid size={{ xs: 12, md: 6 }}>
                            <TextField
                              fullWidth
                              variant="filled"
                              label="Key Name"
                              value={newPatternKey.name}
                              onChange={(e) => handleNewChangePatternKey({ name: e.target.value })}
                              sx={{ mb: 2 }}
                            />
                            <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
                              <Button variant="outlined" color="error" onClick={handleResetChangePatternKey}>
                                Reset
                              </Button>
                              <Button
                                variant="outlined"
                                color="success"
                                onClick={() => handleAddPatternKey(newPatternKey)}
                              >
                                Add key
                              </Button>
                            </Stack>
                          </Grid>
                        </Grid>
                      )}

                      <Box>
                        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
                          Assigned Keys
                        </Typography>

                        {!patternKeyObject?.length ? (
                          <Alert severity="warning" variant="outlined">
                            No keys have been assigned to this pattern yet.
                          </Alert>
                        ) : (
                          <List disablePadding>
                            {patternKeyObject.map((item) => (
                              <ListItem
                                key={item.fullPath}
                                disableGutters
                                divider
                                secondaryAction={
                                  <IconButton
                                    aria-label="remove this pattern key"
                                    size="small"
                                    onClick={() => handleDeletePatternKey(item?.fullPath || '')}
                                  >
                                    <DeleteRoundedIcon fontSize="small" />
                                  </IconButton>
                                }
                              >
                                <ListItemText
                                  primary={
                                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                                      {item.name}
                                    </Typography>
                                  }
                                  secondary={
                                    <Box
                                      component="img"
                                      loading="lazy"
                                      src={item.fullPath}
                                      alt={`pattern-key-img-added-${item.name}`}
                                      sx={{ width: '100%', maxWidth: 200, height: 'auto', mt: 0.5 }}
                                    />
                                  }
                                />
                              </ListItem>
                            ))}
                          </List>
                        )}
                      </Box>
                    </>
                  )}
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
    </>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const unitOfMeasurementOptions = ['in', 'cm', 'mm'];

type TypeUnitOfMeasurementSelectProps = {
  value: string;
  onChange: (newValue: string) => void;
  label: string;
};

const UnitOfMeasurementSelect = (props: TypeUnitOfMeasurementSelectProps) => {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <TextField
        fullWidth
        select
        variant="filled"
        label={props.label}
        value={props.value && props.value !== 'undefined' ? props.value : 'in'}
        onChange={(e) => props.onChange(e.target.value)}
      >
        {unitOfMeasurementOptions.map((option) => (
          <MenuItem key={option} value={option}>
            {option}
          </MenuItem>
        ))}
      </TextField>
    </Grid>
  );
};
