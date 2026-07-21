import React from 'react';
import { pocketbase } from '@/functions/database/authentication-setup';
import { useQuerySearchPatternsByName, type TypePatternSearchResult } from '@/functions/database/gallery';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { Turnstile, type TurnstileInstance } from '@marsidev/react-turnstile';
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

type GalleryUploadDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: () => void;
};

type UploadState = 'idle' | 'loading' | 'error';

export const GalleryUploadDialog = (props: GalleryUploadDialogProps) => {
  const [selectedFile, setSelectedFile] = React.useState<File | null>(null);
  const [preview, setPreview] = React.useState<string | null>(null);
  const [title, setTitle] = React.useState('');
  const [description, setDescription] = React.useState('');
  const [fileError, setFileError] = React.useState('');
  const [uploadState, setUploadState] = React.useState<UploadState>('idle');
  const [uploadError, setUploadError] = React.useState('');

  // Pattern search
  const [patternSearch, setPatternSearch] = React.useState('');
  const [selectedPattern, setSelectedPattern] = React.useState<TypePatternSearchResult | null>(null);
  const [patternDropdownOpen, setPatternDropdownOpen] = React.useState(false);
  const debouncedSearch = useDebounce(patternSearch, 300);
  const { data: patternResults, isFetching: searchingPatterns } = useQuerySearchPatternsByName(debouncedSearch);

  // Bot prevention
  const [turnstileToken, setTurnstileToken] = React.useState<string | null>(null);
  const turnstileRef = React.useRef<TurnstileInstance>(null);
  const [honeypot, setHoneypot] = React.useState('');
  const formOpenTime = React.useRef(Date.now());

  const fileInputRef = React.useRef<HTMLInputElement>(null);

  // Reset form when dialog opens
  React.useEffect(() => {
    if (props.open) {
      setSelectedFile(null);
      setPreview(null);
      setTitle('');
      setDescription('');
      setFileError('');
      setUploadState('idle');
      setUploadError('');
      setPatternSearch('');
      setSelectedPattern(null);
      setPatternDropdownOpen(false);
      setTurnstileToken(null);
      setHoneypot('');
      formOpenTime.current = Date.now();
    }
  }, [props.open]);

  // Clean up object URL on unmount / file change
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
    setSelectedFile(file);
    setPreview(URL.createObjectURL(file));
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

  async function handleSubmit() {
    // Bot guards (silent fails)
    if (honeypot) return;
    const elapsed = Date.now() - formOpenTime.current;
    if (elapsed < 2000) return;

    if (!selectedFile) return;
    if (!title.trim()) {
      enqueueSnackbar('Please add a title.', { variant: 'warning' });
      return;
    }
    // Read the widget directly rather than trusting the token captured in
    // state minutes ago - Turnstile tokens expire after ~5 minutes.
    const currentToken = turnstileRef.current?.getResponse() || turnstileToken;
    if (!currentToken) {
      enqueueSnackbar('Security check expired - please re-verify below and try again.', { variant: 'warning' });
      turnstileRef.current?.reset();
      return;
    }

    setUploadState('loading');
    setUploadError('');

    const authToken = pocketbase.authStore.token;
    if (!authToken) {
      setUploadState('error');
      setUploadError('You must be logged in to upload photos.');
      return;
    }

    const fd = new FormData();
    fd.append('file', selectedFile, selectedFile.name);
    fd.append('title', title.trim());
    fd.append('description', description.trim());
    fd.append('pattern_id', selectedPattern?.id ?? '');
    fd.append('authToken', authToken);
    fd.append('token', currentToken);
    fd.append('hp', honeypot);
    fd.append('ts', String(formOpenTime.current));

    try {
      // No Content-Type header - browser sets multipart boundary automatically
      const res = await fetch('/api/submit-gallery', { method: 'POST', body: fd });
      const data = (await res.json()) as { success?: boolean; error?: string };

      if (!res.ok) {
        setUploadState('error');
        setUploadError(data.error ?? 'Upload failed - please try again.');
        return;
      }

      enqueueSnackbar('Photo uploaded successfully!', { variant: 'success' });
      props.onSuccess();
    } catch {
      setUploadState('error');
      setUploadError('Something went wrong - please try again.');
    }
  }

  const canSubmit = !!selectedFile && !!title.trim() && !!turnstileToken && uploadState !== 'loading';

  return (
    <Dialog open={props.open} onClose={props.onClose} fullWidth maxWidth="sm">
      <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
        <Typography variant="h6" component="span" sx={{ fontWeight: 500 }}>
          Upload a photo
        </Typography>
        <IconButton onClick={props.onClose} size="small" disabled={uploadState === 'loading'}>
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

        {/* File drop zone */}
        {preview ? (
          <Box sx={{ position: 'relative' }}>
            <Box
              component="img"
              loading="lazy"
              src={preview}
              alt="Gallery photo preview"
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
            <Button
              size="small"
              variant="outlined"
              onClick={() => {
                setSelectedFile(null);
                setPreview(null);
                if (fileInputRef.current) fileInputRef.current.value = '';
              }}
              sx={{ mt: 1 }}
            >
              Change photo
            </Button>
          </Box>
        ) : (
          <Box
            onDrop={handleDrop}
            onDragOver={(e) => e.preventDefault()}
            onClick={() => fileInputRef.current?.click()}
            sx={{
              border: '2px dashed',
              borderColor: fileError ? 'error.main' : alpha('#C8A96E', 0.5),
              borderRadius: 2,
              py: 5,
              display: 'flex',
              flexDirection: 'column',
              alignItems: 'center',
              gap: 1,
              cursor: 'pointer',
              backgroundColor: alpha('#C8A96E', 0.03),
              transition: 'border-color 0.2s, background-color 0.2s',
              '&:hover': {
                borderColor: 'primary.main',
                backgroundColor: alpha('#C8A96E', 0.07),
              },
            }}
          >
            <AddPhotoAlternateOutlinedIcon sx={{ fontSize: 40, color: 'text.disabled', opacity: 0.6 }} />
            <Typography variant="body2" color="text.secondary">
              Drop an image here, or <strong>click to browse</strong>
            </Typography>
            <Typography variant="caption" color="text.disabled">
              JPEG, PNG, WebP - max 10 MB
            </Typography>
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
                label="Tag a pattern by it's name (optional)"
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

              {patternDropdownOpen && patternResults && patternResults?.items?.length > 0 && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    //top: '100%',
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
                        sx={{ gap: 1.5 }}
                      >
                        <Box
                          component="img"
                           
                          src={generatePbImage(p as any)}
                          alt=""
                          aria-hidden="true"
                          sx={{
                            display: 'block',
                            width: 100,
                            height: 100,
                            objectFit: 'contain',
                            flexShrink: 0,
                            borderRadius: 0.5,
                          }}
                        />
                        <ListItemText primary={p.name} />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              )}
            </>
          )}
        </Box>

        {uploadError && <Alert severity="error">{uploadError}</Alert>}

        <Turnstile
          ref={turnstileRef}
          siteKey={import.meta.env.VITE_TURNSTILE_SITE_KEY}
          onSuccess={(token) => setTurnstileToken(token)}
          onError={() => setTurnstileToken(null)}
          onExpire={() => {
            setTurnstileToken(null);
            enqueueSnackbar('Security check expired - please re-verify below before submitting.', {
              variant: 'warning',
            });
          }}
        />
      </DialogContent>

      <DialogActions sx={{ px: 3, py: 1.5 }}>
        <Button onClick={props.onClose} color="inherit" disabled={uploadState === 'loading'}>
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          color="success"
          disabled={!canSubmit}
          startIcon={uploadState === 'loading' ? <CircularProgress size={14} color="inherit" /> : null}
        >
          {uploadState === 'loading' ? 'Checking content…' : 'Upload photo'}
        </Button>
      </DialogActions>
    </Dialog>
  );
};
