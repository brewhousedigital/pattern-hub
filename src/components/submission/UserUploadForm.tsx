import React from 'react';
import { enqueueSnackbar } from 'notistack';
import { Turnstile } from '@marsidev/react-turnstile';
import { useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { useQuerySearchManualAuthors } from '@/functions/database/authors';
import { useQuerySearchTags, useQueryGetTagHierarchy, getAncestors } from '@/functions/database/tags';
import { FancyAutocomplete } from '@/components/FancyAutocomplete';
import { SvgDropZone } from '@/components/admin/SvgDropZone';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import {
  useQueryGetAllPatternKeys,
  type TypePatternKeyReferenceObject,
  type TypePatternLayersMapItem,
} from '@/functions/database/patterns';
import { analyzeSvgThreats, extractSvgLayerIds } from '@/functions/utilities/sanitize-svg';
import { generatePbImagePatternKeyRef } from '@/functions/utilities/generate-pb-image';
import dayjs, { type Dayjs } from 'dayjs';

import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';
import LockRoundedIcon from '@mui/icons-material/LockRounded';
import LockOpenRoundedIcon from '@mui/icons-material/LockOpenRounded';

import {
  Alert,
  Box,
  Button,
  Checkbox,
  CircularProgress,
  Divider,
  FormControlLabel,
  Grid,
  IconButton,
  Link as MuiLink,
  MenuItem,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';
import { DatePicker } from '@mui/x-date-pickers/DatePicker';
import { Link } from '@tanstack/react-router';

const MAX_FILE_SIZE = 15 * 1024 * 1024; // 15 MB
const RATE_LIMIT_MS = 10_000;
const RATE_LIMIT_STORAGE_KEY = 'pattern_submit_last';

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

type UploadState = 'idle' | 'loading';

export const UserUploadForm = () => {
  const { authData } = useGlobalAuthData();
  const navigate = useNavigate();

  const [file, setFile] = React.useState<File | null>(null);
  const [fileError, setFileError] = React.useState('');
  const [svgWarning, setSvgWarning] = React.useState('');
  const [layersMap, setLayersMap] = React.useState<TypePatternLayersMapItem[]>([]);
  const [previewUrl, setPreviewUrl] = React.useState<string | null>(null);
  const [fileKind, setFileKind] = React.useState<'svg' | 'pdf' | 'image' | null>(null);

  React.useEffect(() => {
    return () => {
      if (previewUrl) URL.revokeObjectURL(previewUrl);
    };
  }, [previewUrl]);

  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [instructions, setInstructions] = React.useState('');
  const [designDate, setDesignDate] = React.useState<Dayjs | null>(dayjs());
  const [pieces, setPieces] = React.useState('1');
  const [designWidth, setDesignWidth] = React.useState('');
  const [designWidthUnit, setDesignWidthUnit] = React.useState('in');
  const [designHeight, setDesignHeight] = React.useState('');
  const [designHeightUnit, setDesignHeightUnit] = React.useState('in');
  const [lineWidth, setLineWidth] = React.useState('');
  const [lineWidthUnit, setLineWidthUnit] = React.useState('in');

  const [isAuthor, setIsAuthor] = React.useState(true);
  const [manualAuthorValue, setManualAuthorValue] = React.useState<string[]>([]);
  const [manualAuthorInput, setManualAuthorInput] = React.useState('');
  const debouncedManualAuthorSearch = useDebounce(manualAuthorInput, 300);
  const { data: manualAuthorData, isFetching: manualAuthorFetching } =
    useQuerySearchManualAuthors(debouncedManualAuthorSearch);
  const [sourceUrl, setSourceUrl] = React.useState('');
  const [sourceNotes, setSourceNotes] = React.useState('');

  const [tagValue, setTagValue] = React.useState<string[]>([]);
  const [tagInput, setTagInput] = React.useState('');
  const debouncedTagSearch = useDebounce(tagInput, 400);
  const { data: tagSearchData, isFetching: tagSearchFetching } = useQuerySearchTags(debouncedTagSearch);
  const { data: hierarchyData = [] } = useQueryGetTagHierarchy();

  /**
   * Set of tag names that were auto-added as ancestors of a primary tag.
   * Used to render inherited chips differently and to clean them up when their
   * primary tag is removed.
   */
  const [inheritedTags, setInheritedTags] = React.useState<Set<string>>(new Set());

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

  const { data: patternKeys } = useQueryGetAllPatternKeys();
  const [selectedKeys, setSelectedKeys] = React.useState<TypePatternKeyReferenceObject[]>([]);
  const [customPatternKey, setCustomPatternKey] = React.useState(false);

  const toggleKey = (id: string, name: string, fullPath?: string) => {
    setSelectedKeys((prev) =>
      prev.some((k) => k.name === name)
        ? prev.filter((k) => k.name !== name)
        : [...prev, { image: id, name, fullPath }],
    );
  };

  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState('');
  const formOpenTime = React.useRef(0);
  const [uploadState, setUploadState] = React.useState<UploadState>('idle');
  const [cooldownRemaining, setCooldownRemaining] = React.useState(0);

  React.useEffect(() => {
    formOpenTime.current = Date.now();
  }, []);

  React.useEffect(() => {
    const tick = () => {
      const last = Number(localStorage.getItem(RATE_LIMIT_STORAGE_KEY) ?? 0);
      const remaining = Math.max(0, RATE_LIMIT_MS - (Date.now() - last));
      setCooldownRemaining(remaining);
    };
    tick();
    const interval = setInterval(tick, 500);
    return () => clearInterval(interval);
  }, []);

  const handleFileSelect = async (selected: File) => {
    setFileError('');
    setSvgWarning('');
    setLayersMap([]);

    const isSvg = selected.type === 'image/svg+xml' || selected.name.toLowerCase().endsWith('.svg');
    const isPdf = selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf');
    const isImage = !isSvg && !isPdf && selected.type.startsWith('image/');
    if (!isSvg && !isPdf && !isImage) {
      setFileError('Please upload an image file, an SVG, or a single-page PDF.');
      return;
    }

    if (selected.size > MAX_FILE_SIZE) {
      setFileError(
        'This file is larger than 15 MB. Please compress it first using https://tinypng.com/ and try again.',
      );
      return;
    }

    if (isSvg) {
      const raw = await selected.text();
      const threats = analyzeSvgThreats(raw);
      if (threats.some((t) => t.severity === 'high')) {
        setFileError(
          'This SVG looks like it may contain unsafe content and cannot be accepted. Please re-export it from your design tool.',
        );
        return;
      }
      if (threats.length > 0) {
        setSvgWarning('This SVG has some unusual content our team will double check during review.');
      }
      setLayersMap(extractSvgLayerIds(raw).map((id) => ({ layerName: id, mappedName: '', isVisible: true })));
    }

    if (previewUrl) URL.revokeObjectURL(previewUrl);
    setPreviewUrl(URL.createObjectURL(selected));
    setFileKind(isSvg ? 'svg' : isPdf ? 'pdf' : 'image');
    setFile(selected);
  };

  const canSubmit =
    !!file &&
    !fileError &&
    !!name.trim() &&
    !!turnstileToken &&
    (isAuthor || manualAuthorValue.length > 0) &&
    cooldownRemaining <= 0 &&
    uploadState !== 'loading';

  const handleSubmit = async () => {
    if (honeypot) return;
    if (!canSubmit || !file) return;

    const authToken = pocketbase.authStore.token;
    if (!authToken) {
      enqueueSnackbar('You must be logged in to submit a pattern.', { variant: 'warning' });
      return;
    }

    setUploadState('loading');

    const fd = new FormData();
    fd.append('file', file, file.name);
    fd.append('name', name.trim());
    fd.append('description', description.trim());
    fd.append('instructions', instructions.trim());
    fd.append('is_author', String(isAuthor));
    fd.append('author_manual_name', isAuthor ? '' : manualAuthorValue.join(', '));
    fd.append('source_url', isAuthor ? '' : sourceUrl.trim());
    fd.append('source_notes', isAuthor ? '' : sourceNotes.trim());
    fd.append('pieces', pieces || '1');
    fd.append('design_width', designWidth || '0');
    fd.append('design_height', designHeight || '0');
    fd.append('line_width', lineWidth || '0');
    fd.append('design_width_unit', designWidthUnit);
    fd.append('design_height_unit', designHeightUnit);
    fd.append('line_width_unit', lineWidthUnit);
    if (designDate) fd.append('design_date', designDate.startOf('day').toISOString());
    fd.append('tags', JSON.stringify(tagValue));
    fd.append('pattern_key_reference_list', JSON.stringify(selectedKeys));
    fd.append('custom_pattern_key_requested', String(customPatternKey));
    fd.append('layers_map', JSON.stringify(layersMap));
    fd.append('authToken', authToken);
    fd.append('token', turnstileToken ?? '');
    fd.append('hp', honeypot);
    fd.append('ts', String(formOpenTime.current));

    try {
      const res = await fetch('/api/submit-pattern', { method: 'POST', body: fd });
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        enqueueSnackbar(data.error ?? 'Submission failed - please try again.', { variant: 'error' });
        setUploadState('idle');
        return;
      }

      localStorage.setItem(RATE_LIMIT_STORAGE_KEY, String(Date.now()));
      navigate({ to: '/profile/submit-pattern/complete' });
    } catch {
      enqueueSnackbar('Something went wrong - please try again.', { variant: 'error' });
      setUploadState('idle');
    }
  };

  return (
    <Stack sx={{ gap: 2.5, maxWidth: 1100, mx: 'auto', py: 4, px: 2 }}>
      <Typography variant="h4" sx={{ fontWeight: 600 }}>
        Submit a Pattern
      </Typography>
      <Typography variant="body2" color="text.secondary">
        Share your stained glass pattern with the community. Every submission is reviewed by our team before it appears
        on the site.
      </Typography>

      <Alert severity="info">
        Your pattern's unique key names may be adjusted to stay consistent with the rest of the archive.
      </Alert>

      <Paper variant="outlined" sx={{ p: 2 }}>
        <Typography variant="subtitle2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Have a large number of patterns?
        </Typography>
        <Typography variant="body2" color="text.secondary">
          If you're an artist with many patterns to share, submitting them one by one can be slow. Reach out on our{' '}
          <MuiLink component={Link} to="/help/contact">
            contact page
          </MuiLink>{' '}
          and we can process them together.
        </Typography>
      </Paper>

      {/* Honeypot */}
      <input
        aria-hidden="true"
        tabIndex={-1}
        name="website"
        value={honeypot}
        onChange={(e) => setHoneypot(e.target.value)}
        autoComplete="off"
        style={{ position: 'absolute', left: '-9999px', width: 1, height: 1, opacity: 0 }}
      />

      <Box sx={{ display: 'flex', gap: 4, alignItems: 'flex-start', flexDirection: { xs: 'column', md: 'row' } }}>
        {/* ── Sticky left preview ── */}
        <Box
          sx={{
            width: { xs: '100%', md: 340 },
            flexShrink: 0,
            position: { xs: 'static', md: 'sticky' },
            top: 16,
            display: 'flex',
            flexDirection: 'column',
            gap: 1.5,
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
            fileKind === 'pdf' ? (
              <Box
                component="iframe"
                src={previewUrl}
                title="PDF preview"
                sx={{
                  width: '100%',
                  aspectRatio: '1/1',
                  borderRadius: 1.5,
                  border: '1px solid',
                  borderColor: 'divider',
                  backgroundColor: 'grey.50',
                }}
              />
            ) : (
              <Box
                component="img"
                src={previewUrl}
                alt="Pattern preview"
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
            )
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
                No file selected yet
              </Typography>
            </Box>
          )}

          {file && (
            <Typography variant="body2" sx={{ wordBreak: 'break-word', fontWeight: 600 }}>
              {file.name}
            </Typography>
          )}
        </Box>

        {/* ── Right: form fields ── */}
        <Stack sx={{ flex: 1, minWidth: 0, gap: 2.5 }}>
          <FormSection label="Pattern File" />
          <SvgDropZone
            accept="image/*,.svg,application/pdf"
            acceptLabel="Image, SVG, or single-page PDF - max 15 MB"
            onFile={handleFileSelect}
            disabled={uploadState === 'loading'}
          />
          {file && !fileError && (
            <Alert severity="success" sx={{ py: 0.5 }}>
              Selected: {file.name}
            </Alert>
          )}
          {fileError && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              {fileError}
            </Alert>
          )}
          {svgWarning && (
            <Alert severity="warning" sx={{ py: 0.5 }}>
              {svgWarning}
            </Alert>
          )}

          {fileKind === 'svg' && layersMap.length > 0 && (
            <Box>
              <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                Layer Map — name each detected layer so reviewers know what it represents
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
                            prev.map((entry, i) => (i === index ? { ...entry, mappedName: e.target.value } : entry)),
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
                            setLayersMap((prev) =>
                              prev.map((e, i) =>
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

          <FormSection label="Pattern Info" />

          <TextField label="Name" value={name} onChange={(e) => setName(e.target.value)} required fullWidth />

          <DatePicker
            label="Design Date"
            value={designDate}
            onChange={(newValue) => setDesignDate(newValue)}
            disableFuture
            slotProps={{ textField: { fullWidth: true, helperText: 'When this pattern was designed or dated.' } }}
          />

          <GenericMarkdownEditor
            label="Description of the pattern"
            content={description}
            setContent={setDescription}
            characterLimit={2000}
            minRows={2}
          />

          <GenericMarkdownEditor
            label="Instructions for how to build the pattern"
            content={instructions}
            setContent={setInstructions}
            characterLimit={10000}
            minRows={2}
          />

          <FormSection label="Measurements" />

          <TextField
            label="Pieces"
            type="number"
            value={pieces}
            onChange={(e) => setPieces(e.target.value)}
            fullWidth
          />

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Design Width"
                variant="filled"
                type="number"
                value={designWidth}
                onChange={(e) => setDesignWidth(e.target.value)}
                fullWidth
              />
            </Grid>
            <UnitOfMeasurementSelect label="Design Width Unit" value={designWidthUnit} onChange={setDesignWidthUnit} />
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Design Height"
                variant="filled"
                type="number"
                value={designHeight}
                onChange={(e) => setDesignHeight(e.target.value)}
                fullWidth
              />
            </Grid>
            <UnitOfMeasurementSelect
              label="Design Height Unit"
              value={designHeightUnit}
              onChange={setDesignHeightUnit}
            />
          </Grid>

          <Grid container spacing={2}>
            <Grid size={{ xs: 12, md: 6 }}>
              <TextField
                label="Line Width"
                variant="filled"
                type="number"
                value={lineWidth}
                onChange={(e) => setLineWidth(e.target.value)}
                fullWidth
              />
            </Grid>
            <UnitOfMeasurementSelect label="Line Width Unit" value={lineWidthUnit} onChange={setLineWidthUnit} />
          </Grid>

          <FormSection label="Authorship" />
          <FormControlLabel
            control={<Checkbox checked={!isAuthor} onChange={(e) => setIsAuthor(!e.target.checked)} />}
            label="I am not the original author of this pattern"
          />
          {!isAuthor && (
            <>
              <FancyAutocomplete
                label="Original Author"
                serverSide
                freeSolo
                loading={manualAuthorFetching}
                data={manualAuthorData ?? []}
                value={manualAuthorValue}
                onChange={setManualAuthorValue}
                inputValue={manualAuthorInput}
                onInputChange={setManualAuthorInput}
              />
              <TextField
                label="Source URL (optional)"
                value={sourceUrl}
                onChange={(e) => setSourceUrl(e.target.value)}
                fullWidth
              />
              <TextField
                label="Where did you find this pattern? (optional)"
                placeholder="e.g. Scanned from a 1987 pattern book, a magazine clipping, a friend's collection, etc."
                value={sourceNotes}
                onChange={(e) => setSourceNotes(e.target.value)}
                multiline
                minRows={2}
                fullWidth
              />
            </>
          )}
          {isAuthor && (
            <Typography variant="caption" color="text.secondary">
              You'll be credited as the author, {authData?.name || 'your account name'}.
            </Typography>
          )}

          <FormSection label="Tags" />
          <FancyAutocomplete
            label="Tags"
            freeSolo
            serverSide
            data={tagSearchData ?? []}
            value={tagValue}
            onChange={handleTagChange}
            inputValue={tagInput}
            onInputChange={setTagInput}
            inheritedValues={inheritedTags}
            loading={tagSearchFetching}
          />

          <FormSection label="Pattern Keys" />

          <Typography variant="body2" color="text.secondary">
            Select the pattern keys your design uses. Not sure which key is which? Download the reference images below.
          </Typography>

          <Grid container spacing={1}>
            {patternKeys?.map((key) => {
              const isSelected = selectedKeys.some((k) => k.name === key.name);
              return (
                <Grid size={4} key={key.id}>
                  <Paper
                    variant="outlined"
                    onClick={() => toggleKey(key.id, key.name)}
                    sx={{
                      px: 1,
                      py: 1.5,
                      position: 'relative',
                      cursor: 'pointer',
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      borderColor: isSelected ? 'primary.main' : undefined,
                      backgroundColor: isSelected ? 'action.selected' : undefined,
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      onChange={() => toggleKey(key.id, key.name)}
                      onClick={(e) => e.stopPropagation()}
                      size="small"
                      sx={{}}
                    />

                    <Stack sx={{ gap: 1 }}>
                      <Box
                        component="img"
                        src={generatePbImagePatternKeyRef(key)}
                        alt={key.name}
                        sx={{ width: '100%', height: 32, objectFit: 'contain' }}
                      />
                      {/*<Typography variant="body2" sx={{ flex: 1 }}>
                    {key.name}
                  </Typography>*/}
                      <MuiLink
                        href={generatePbImagePatternKeyRef(key)}
                        download
                        onClick={(e) => e.stopPropagation()}
                        variant="caption"
                      >
                        Download
                      </MuiLink>
                    </Stack>
                  </Paper>
                </Grid>
              );
            })}
          </Grid>
          <FormControlLabel
            control={<Checkbox checked={customPatternKey} onChange={(e) => setCustomPatternKey(e.target.checked)} />}
            label="This pattern uses a custom key not listed above"
          />

          <Turnstile
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setTurnstileToken(token)}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
          />

          {cooldownRemaining > 0 && (
            <Alert severity="info">
              Please wait {Math.ceil(cooldownRemaining / 1000)}s before submitting another pattern.
            </Alert>
          )}

          <Button
            variant="contained"
            size="large"
            disabled={!canSubmit}
            onClick={handleSubmit}
            startIcon={uploadState === 'loading' ? <CircularProgress size={16} color="inherit" /> : null}
          >
            {uploadState === 'loading' ? 'Submitting…' : 'Submit Pattern for Review'}
          </Button>
        </Stack>
      </Box>
    </Stack>
  );
};

// ─── Sub-components ───────────────────────────────────────────────────────────

const unitOfMeasurementOptions = ['in', 'cm', 'mm'];

type UnitOfMeasurementSelectProps = {
  value: string;
  onChange: (newValue: string) => void;
  label: string;
};

const UnitOfMeasurementSelect = ({ value, onChange, label }: UnitOfMeasurementSelectProps) => {
  return (
    <Grid size={{ xs: 12, md: 6 }}>
      <TextField
        fullWidth
        select
        variant="filled"
        label={label}
        value={value}
        onChange={(e) => onChange(e.target.value)}
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
