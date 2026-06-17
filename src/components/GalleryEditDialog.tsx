import React from 'react';
import { pocketbase } from '@/functions/database/authentication-setup';
import {
  useMutationUpdateGallery,
  useQuerySearchPatternsByName,
  type TypeGalleryResponse,
  type TypePatternSearchResult,
} from '@/functions/database/gallery';
import { Turnstile } from '@marsidev/react-turnstile';
import { useDebounce } from '@/functions/hooks/useDebounce';
import { enqueueSnackbar } from 'notistack';

import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import CloseIcon from '@mui/icons-material/Close';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  IconButton,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { alpha } from '@mui/material/styles';

type GalleryEditDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
  photo: TypeGalleryResponse;
};

type SaveState = 'idle' | 'loading' | 'error';

export const GalleryEditDialog = (props: GalleryEditDialogProps) => {
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [newFile, setNewFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [fileError, setFileError] = React.useState('');
  const [saveState, setSaveState] = React.useState<SaveState>('idle');
  const [saveError, setSaveError] = React.useState('');

  // Pattern search
  const [patternSearch, setPatternSearch] = React.useState('');
  const [selectedPattern, setSelectedPattern] = React.useState<TypePatternSearchResult | null>(null);
  const [patternDropdownOpen, setPatternDropdownOpen] = React.useState(false);
  const debouncedSearch = useDebounce(patternSearch, 300);
  const { data: patternResults, isFetching: searchingPatterns } = useQuerySearchPatternsByName(debouncedSearch);

  // Bot prevention (needed only for image replacement path)
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const [honeypot, setHoneypot] = React.useState('');
  const formOpenTime = React.useRef(Date.now());

  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const updateGallery = useMutationUpdateGallery();

  // Seed form from photo when dialog opens
  React.useEffect(() => {
    if (props.open) {
      setTitle(props.photo.title ?? '');
      setDescription(props.photo.description ?? '');
      setNewFile(null);
      setPreview(null);
      setFileError('');
      setSaveState('idle');
      setSaveError('');
      setTurnstileToken(null);
      setHoneypot('');
      formOpenTime.current = Date.now();

      const expand = props.photo.expand?.pattern_id;
      if (expand) {
        setSelectedPattern({ id: expand.id, name: expand.name });
      } else {
        setSelectedPattern(null);
      }
      setPatternSearch('');
      setPatternDropdownOpen(false);
    }
  }, [props.open]);

  // Revoke preview object URL when it changes or component unmounts
  React.useEffect(() => {
    return () => {
      if (preview) URL.revokeObjectURL(preview);
    };
  }, [preview]);

  function handleFileSelect(file: File) {
    setFileError('');
    if (!file.type.startsWith('image/')) {
      setFileError('Only image files are supported (JPEG, PNG, WebP, etc.)');
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      setFileError('File is too large - maximum 10 MB');
      return;
    }
    if (preview) URL.revokeObjectURL(preview);
    setNewFile(file);
    setPreview(URL.createObjectURL(file));
    setTurnstileToken(null);
  }

  function handleDrop(e: React.DragEvent<HTMLDivElement>) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) handleFileSelect(file);
  }

  function handleInputChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) handleFileSelect(file);
  }

  function clearNewFile() {
    if (preview) URL.revokeObjectURL(preview);
    setNewFile(null);
    setPreview(null);
    setFileError('');
    setTurnstileToken(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  }

  async function handleSubmit() {
    if (honeypot) return;

    if (!title.trim()) {
      enqueueSnackbar('Please add a title.', { variant: 'warning' });
      return;
    }

    setSaveState('loading');
    setSaveError('');

    try {
      if (!newFile) {
        // Metadata-only update — go directly to PocketBase
        await updateGallery.mutateAsync({
          id: props.photo.id,
          title: title.trim(),
          description: description.trim(),
          pattern_id: selectedPattern?.id ?? '',
        });
      } else {
        // Image replacement — go through Netlify function
        const elapsed = Date.now() - formOpenTime.current;
        if (elapsed < 2000) {
          setSaveState('error');
          setSaveError('Please wait a moment before submitting.');
          return;
        }
        if (!turnstileToken) {
          setSaveState('error');
          setSaveError('Security check not complete - wait a moment and try again.');
          return;
        }

        const authToken = pocketbase.authStore.token;
        if (!authToken) {
          setSaveState('error');
          setSaveError('You must be logged in to update photos.');
          return;
        }

        const fd = new FormData();
        fd.append('file', newFile, newFile.name);
        fd.append('title', title.trim());
        fd.append('description', description.trim());
        fd.append('pattern_id', selectedPattern?.id ?? '');
        fd.append('recordId', props.photo.id);
        fd.append('authToken', authToken);
        fd.append('token', turnstileToken);
        fd.append('hp', honeypot);
        fd.append('ts', String(formOpenTime.current));

        const res = await fetch('/api/update-gallery', { method: 'POST', body: fd });
        const data = (await res.json()) as { success?: boolean; error?: string };

        if (!res.ok) {
          setSaveState('error');
          setSaveError(data.error ?? 'Update failed - please try again.');
          return;
        }
      }

      enqueueSnackbar('Photo updated successfully!', { variant: 'success' });
      props.onSuccess();
    } catch {
      setSaveState('error');
      setSaveError('Something went wrong - please try again.');
    } finally {
      if (saveState === 'loading') setSaveState('idle');
    }
  }

  const isLoading = saveState === 'loading' || updateGallery.isPending;
  const canSubmit = !!title.trim() && !isLoading && (!newFile || !!turnstileToken);

  const currentImageSrc = `${props.photo.src}?tr=w-600,h-400,f-auto,q-80`;

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 500 }}>
          Edit photo
        </Typography>
        <IconButton onClick={props.onClose} size="small" disabled={isLoading}>
          <CloseIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
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

        {/* Photo section */}
        {preview ? (
          <Box sx={{ position: 'relative' }}>
            <Box
              component="img"
              loading="lazy"
              src={preview}
              alt="New photo preview"
              sx={{
                width: '100%',
                maxHeight: 260,
                objectFit: 'contain',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'primary.main',
                backgroundColor: 'grey.50',
              }}
            />
            <Box sx={{ display: 'flex', gap: 1, mt: 1 }}>
              <Button size="small" variant="outlined" onClick={() => fileInputRef.current?.click()}>
                Choose different photo
              </Button>
              <Button size="small" variant="text" color="inherit" onClick={clearNewFile}>
                Keep original
              </Button>
            </Box>
          </Box>
        ) : (
          <Box>
            <Box
              component="img"
              loading="lazy"
              src={currentImageSrc}
              alt={props.photo.title}
              sx={{
                width: '100%',
                maxHeight: 260,
                objectFit: 'contain',
                borderRadius: 2,
                border: '1px solid',
                borderColor: 'divider',
                backgroundColor: 'grey.50',
              }}
            />
            <Box
              onDrop={handleDrop}
              onDragOver={(e) => e.preventDefault()}
              onClick={() => fileInputRef.current?.click()}
              sx={{
                mt: 1,
                border: '2px dashed',
                borderColor: fileError ? 'error.main' : alpha('#C8A96E', 0.4),
                borderRadius: 2,
                py: 2.5,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 0.5,
                cursor: 'pointer',
                backgroundColor: alpha('#C8A96E', 0.02),
                transition: 'border-color 0.2s, background-color 0.2s',
                '&:hover': {
                  borderColor: 'primary.main',
                  backgroundColor: alpha('#C8A96E', 0.06),
                },
              }}
            >
              <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 28, color: 'text.disabled', opacity: 0.6 }} />
              <Typography variant="body2" color="text.secondary" sx={{ fontSize: '0.8rem' }}>
                Drop a new image here, or <strong>click to browse</strong>
              </Typography>
              <Typography variant="caption" color="text.disabled">
                JPEG, PNG, WebP - max 10 MB
              </Typography>
            </Box>
          </Box>
        )}

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handleInputChange}
          style={{ display: 'none' }}
        />

        {fileError && (
          <Alert severity="error" sx={{ py: 0.5 }}>
            {fileError}
          </Alert>
        )}

        <TextField
          label="Title"
          variant="filled"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          fullWidth
          size="small"
          required
        />

        <TextField
          label="Description"
          variant="filled"
          value={description}
          onChange={(e) => setDescription(e.target.value)}
          fullWidth
          size="small"
          multiline
          minRows={2}
          maxRows={4}
        />

        {/* Pattern search */}
        <Box sx={{ position: 'relative' }}>
          {selectedPattern ? (
            <Box sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
              <Typography variant="caption" color="text.secondary">
                Tagged pattern:
              </Typography>
              <Chip
                label={selectedPattern.name}
                size="small"
                onDelete={() => {
                  setSelectedPattern(null);
                  setPatternSearch('');
                }}
                color="primary"
                variant="outlined"
              />
            </Box>
          ) : (
            <>
              <TextField
                label="Tag a pattern by its name (optional)"
                variant="filled"
                value={patternSearch}
                onChange={(e) => {
                  setPatternSearch(e.target.value);
                  setPatternDropdownOpen(true);
                }}
                onFocus={() => patternSearch.length >= 2 && setPatternDropdownOpen(true)}
                onBlur={() => setTimeout(() => setPatternDropdownOpen(false), 150)}
                fullWidth
                size="small"
                slotProps={{
                  input: {
                    endAdornment: searchingPatterns ? <CircularProgress size={14} /> : null,
                  },
                }}
              />

              {patternDropdownOpen && patternResults && patternResults.items.length > 0 && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    bottom: 52,
                    left: 0,
                    right: 0,
                    zIndex: 10,
                    maxHeight: 200,
                    overflowY: 'auto',
                    mt: 0.5,
                    borderRadius: 1,
                  }}
                >
                  <List dense disablePadding>
                    {patternResults.items.map((p) => (
                      <ListItemButton
                        key={p.id}
                        onMouseDown={() => {
                          setSelectedPattern(p);
                          setPatternSearch('');
                          setPatternDropdownOpen(false);
                        }}
                      >
                        <ListItemText primary={p.name} />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              )}
            </>
          )}
        </Box>

        {saveError && <Alert severity="error">{saveError}</Alert>}

        {/* Turnstile — only shown when replacing the photo */}
        {newFile && (
          <Turnstile
            siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
            onSuccess={(token) => setTurnstileToken(token)}
            onError={() => setTurnstileToken(null)}
            onExpire={() => setTurnstileToken(null)}
          />
        )}
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit" disabled={isLoading}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={!canSubmit}
          startIcon={isLoading ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {isLoading ? (newFile ? 'Checking content…' : 'Saving…') : 'Save changes'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
