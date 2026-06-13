import React, { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAuth } from '@/data/auth-data';
import { PRIMARY_COLOR, SECONDARY_COLOR } from '@/data/constants';
import { useMutationUpdateUserWithFiles, useMutationAuthUpdateUser } from '@/functions/database/authentication';
import { enqueueSnackbar } from 'notistack';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useMutationValidateUsername } from '@/functions/database/users';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { resizeAndConvertToWebP } from '@/functions/utilities/image-processing';
import { generateUserAvatarUrl, generateUserHeaderUrl } from '@/functions/utilities/generate-pb-image';

import { styled, alpha } from '@mui/material/styles';
import ReportRoundedIcon from '@mui/icons-material/ReportRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';

import {
  Box,
  Button,
  Chip,
  CircularProgress,
  Alert,
  Container,
  FormControlLabel,
  Grid,
  IconButton,
  InputAdornment,
  Paper,
  Skeleton,
  Stack,
  Switch,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

export const Route = createFileRoute('/profile/edit')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Edit Profile', '', match.pathname),
  }),
});

// ─── Types ────────────────────────────────────────────────────────────────────

interface ProfileFormData {
  username: string;
  about: string;
  interests: string;
  is_artist: boolean;
}

interface ProfileFormErrors {
  username?: string;
}

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { authData } = useGlobalAuthData();
  const navigate = useNavigate();
  const { handleRefresh } = useRefreshAuth();

  const verifyUsername = useMutationValidateUsername();
  const updateUser = useMutationUpdateUserWithFiles();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileFormData>({
    username: '',
    about: '',
    interests: '',
    is_artist: false,
  });
  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | undefined>(undefined);

  // Pending image files (processed, ready to upload on save)
  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [avatarCleared, setAvatarCleared] = useState(false);

  const [pendingHeader, setPendingHeader] = useState<File | null>(null);
  const [pendingHeaderPreview, setPendingHeaderPreview] = useState<string | null>(null);
  const [headerCleared, setHeaderCleared] = useState(false);

  const [imageError, setImageError] = useState('');
  const [processingImage, setProcessingImage] = useState<'avatar' | 'header' | null>(null);

  useEffect(() => {
    if (!authData) return;
    setForm({
      username: authData.name ?? '',
      about: authData.about ?? '',
      interests: authData.interests ?? '',
      is_artist: authData.is_artist ?? false,
    });
    setLoading(false);
  }, [authData]);

  // Revoke object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
    };
  }, [pendingAvatarPreview, pendingHeaderPreview]);

  // ─── Image handlers ──────────────────────────────────────────────────────

  async function handleImageSelect(
    file: File,
    type: 'avatar' | 'header',
  ) {
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('Only image files are supported.');
      return;
    }
    const maxMB = type === 'avatar' ? 5 : 10;
    if (file.size > maxMB * 1024 * 1024) {
      setImageError(`File is too large — maximum ${maxMB} MB.`);
      return;
    }

    setProcessingImage(type);
    try {
      const [maxW, maxH, quality] = type === 'avatar' ? [400, 400, 0.87] : [1920, 500, 0.82];
      const blob = await resizeAndConvertToWebP(file, maxW, maxH, quality);
      const processed = new File([blob], `${type}.webp`, { type: 'image/webp' });
      const preview = URL.createObjectURL(processed);

      if (type === 'avatar') {
        if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
        setPendingAvatar(processed);
        setPendingAvatarPreview(preview);
        setAvatarCleared(false);
      } else {
        if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
        setPendingHeader(processed);
        setPendingHeaderPreview(preview);
        setHeaderCleared(false);
      }
    } catch {
      setImageError('Could not process this image — please try another file.');
    } finally {
      setProcessingImage(null);
    }
  }

  function clearImage(type: 'avatar' | 'header') {
    if (type === 'avatar') {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      setPendingAvatar(null);
      setPendingAvatarPreview(null);
      setAvatarCleared(true);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    } else {
      if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
      setPendingHeader(null);
      setPendingHeaderPreview(null);
      setHeaderCleared(true);
      if (headerInputRef.current) headerInputRef.current.value = '';
    }
  }

  // ─── Username verification ────────────────────────────────────────────────

  async function handleUsernameVerification() {
    if (form.username.trim() === authData?.name) return true;
    try {
      const results = await verifyUsername.mutateAsync(form.username);
      const taken = results.find(
        (item) => item.name?.trim().toLowerCase() === form.username.trim().toLowerCase(),
      );
      setUsernameAvailable(!taken);
      return !taken;
    } catch {
      setUsernameAvailable(true);
      return true;
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    const usernameOk = await handleUsernameVerification();
    if (!usernameOk) { setSaving(false); return; }

    const fd = new FormData();
    fd.append('name', form.username.trim());
    fd.append('about', form.about.trim());
    fd.append('interests', form.interests.trim());
    fd.append('is_artist', String(form.is_artist));

    if (pendingAvatar) fd.append('avatar', pendingAvatar, 'avatar.webp');
    else if (avatarCleared) fd.append('avatar', '');

    if (pendingHeader) fd.append('header_image', pendingHeader, 'header_image.webp');
    else if (headerCleared) fd.append('header_image', '');

    try {
      await updateUser.mutateAsync({ id: authData?.id ?? '', formData: fd });
      await handleRefresh();
      enqueueSnackbar('Profile updated!', { variant: 'success' });
      void navigate({ to: '/profile' });
    } catch {
      setSaveError('Failed to save changes. Please try again.');
    } finally {
      setSaving(false);
    }
  }

  // ─── Derived values ───────────────────────────────────────────────────────

  const interestChips = form.interests
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean);

  const existingAvatarUrl = generateUserAvatarUrl(authData ?? undefined);
  const existingHeaderUrl = generateUserHeaderUrl(authData ?? undefined);

  const activeAvatarSrc = avatarCleared ? null : (pendingAvatarPreview ?? existingAvatarUrl);
  const activeHeaderSrc = headerCleared ? null : (pendingHeaderPreview ?? existingHeaderUrl);

  const displayName = (authData?.name?.startsWith('NewUser_') ? '' : authData?.name) || '';
  const initial = (displayName[0] ?? '?').toUpperCase();

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="sm">
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.3px' }}>
              Edit Profile
            </Typography>
          </Box>

          {loading ? (
            <EditSkeleton />
          ) : (
            <Box component="form" onSubmit={handleSubmit}>

              {/* ─── PHOTOS ─────────────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Profile Photos</SectionTitle>

                {imageError && (
                  <Alert severity="error" sx={{ mb: 2, py: 0.5 }} onClose={() => setImageError('')}>
                    {imageError}
                  </Alert>
                )}

                {/* Mini hero preview */}
                <HeroPreview sx={{ backgroundImage: activeHeaderSrc ? `linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 100%), url(${activeHeaderSrc})` : undefined }}>
                  {!activeHeaderSrc && <WallpaperPlaceholder />}

                  {/* Avatar preview inside hero */}
                  <Box sx={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', alignItems: 'center', gap: 1.5 }}>
                    <AvatarPreview hasPhoto={!!activeAvatarSrc}>
                      {activeAvatarSrc ? (
                        <Box component="img" src={activeAvatarSrc} alt="Avatar" sx={{ width: '100%', height: '100%', objectFit: 'cover' }} />
                      ) : (
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                          {initial}
                        </Typography>
                      )}
                    </AvatarPreview>
                    <Box>
                      <Typography sx={{ fontSize: '0.85rem', fontWeight: 700, color: activeHeaderSrc ? 'white' : 'text.primary', lineHeight: 1, mb: 0.25 }}>
                        {displayName || 'Your Name'}
                      </Typography>
                      <Typography sx={{ fontSize: '0.65rem', color: activeHeaderSrc ? 'rgba(255,255,255,0.6)' : 'text.disabled' }}>
                        Preview
                      </Typography>
                    </Box>
                  </Box>
                </HeroPreview>

                <Grid container spacing={2} sx={{ mt: 2 }}>
                  {/* Avatar upload */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <input
                      ref={avatarInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImageSelect(f, 'avatar');
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <PersonRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        Profile Photo
                      </Typography>
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => avatarInputRef.current?.click()}
                      disabled={processingImage === 'avatar'}
                      startIcon={
                        processingImage === 'avatar'
                          ? <CircularProgress size={14} color="inherit" />
                          : <AddPhotoAlternateOutlinedIcon fontSize="small" />
                      }
                      sx={{ borderStyle: 'dashed' }}
                    >
                      {processingImage === 'avatar' ? 'Processing…' : activeAvatarSrc ? 'Replace' : 'Upload'}
                    </Button>
                    {(activeAvatarSrc && !avatarCleared) && (
                      <Button
                        fullWidth
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                        onClick={() => clearImage('avatar')}
                        sx={{ mt: 0.75 }}
                      >
                        Remove photo
                      </Button>
                    )}
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.75 }}>
                      Square crop recommended · max 5 MB · resized to 400×400 px
                    </Typography>
                  </Grid>

                  {/* Header upload */}
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <input
                      ref={headerInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImageSelect(f, 'header');
                      }}
                    />
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1, mb: 1 }}>
                      <WallpaperRoundedIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      <Typography variant="caption" fontWeight={600} color="text.secondary">
                        Header Image
                      </Typography>
                    </Box>
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => headerInputRef.current?.click()}
                      disabled={processingImage === 'header'}
                      startIcon={
                        processingImage === 'header'
                          ? <CircularProgress size={14} color="inherit" />
                          : <AddPhotoAlternateOutlinedIcon fontSize="small" />
                      }
                      sx={{ borderStyle: 'dashed' }}
                    >
                      {processingImage === 'header' ? 'Processing…' : activeHeaderSrc ? 'Replace' : 'Upload'}
                    </Button>
                    {(activeHeaderSrc && !headerCleared) && (
                      <Button
                        fullWidth
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                        onClick={() => clearImage('header')}
                        sx={{ mt: 0.75 }}
                      >
                        Remove image
                      </Button>
                    )}
                    <Typography variant="caption" color="text.disabled" display="block" sx={{ mt: 0.75 }}>
                      Wide landscape image · max 10 MB · resized to 1920×500 px
                    </Typography>
                  </Grid>
                </Grid>
              </SectionCard>

              {/* ─── USERNAME ────────────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Username</SectionTitle>
                <TextField
                  fullWidth
                  required
                  variant="filled"
                  label="Username"
                  value={form.username}
                  onChange={(e) => {
                    setUsernameAvailable(undefined);
                    setForm((p) => ({ ...p, username: e.target.value }));
                    if (errors.username) setErrors((p) => ({ ...p, username: undefined }));
                  }}
                  error={!!errors.username}
                  helperText="Letters, numbers, and underscores only. Minimum 4 characters."
                  slotProps={{
                    input: {
                      endAdornment: (
                        <InputAdornment position="end">
                          <Typography variant="caption" color="text.disabled">
                            {form.username.length}/32
                          </Typography>
                        </InputAdornment>
                      ),
                    },
                    htmlInput: { maxLength: 32, minLength: 4, pattern: '^[a-zA-Z0-9_]+$' },
                  }}
                />

                <Grid container sx={{ alignItems: 'center', pt: 2 }}>
                  <Grid size={{ xs: 7 }}>
                    {usernameAvailable === true && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <CheckCircleOutlineRoundedIcon color="success" fontSize="small" />
                        <Typography variant="body2" color="success.main">Available</Typography>
                      </Stack>
                    )}
                    {usernameAvailable === false && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <ReportRoundedIcon color="error" fontSize="small" />
                        <Typography variant="body2" color="error">Name taken</Typography>
                      </Stack>
                    )}
                  </Grid>
                  <Grid size={{ xs: 5 }} sx={{ textAlign: 'right' }}>
                    <Button
                      disabled={form.username.length < 4}
                      variant="outlined"
                      size="small"
                      loading={verifyUsername.isPending}
                      onClick={handleUsernameVerification}
                      type="button"
                    >
                      Check availability
                    </Button>
                  </Grid>
                </Grid>
              </SectionCard>

              {/* ─── ABOUT ───────────────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>About</SectionTitle>
                <MarkdownEditor
                  value={form.about}
                  onChange={(v) => setForm((p) => ({ ...p, about: v }))}
                  placeholder="Tell the community about yourself and your stained glass journey…"
                  maxLength={3000}
                  minRows={8}
                  helperText={
                    <>
                      Supports{' '}
                      <a href="https://www.markdownguide.org/cheat-sheet/" target="_blank" rel="noreferrer">
                        Markdown
                      </a>
                      . Switch to Preview to see how it will look.
                    </>
                  }
                />
              </SectionCard>

              {/* ─── INTERESTS ───────────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Interests</SectionTitle>
                <TextField
                  label="Interests"
                  variant="filled"
                  fullWidth
                  placeholder="Geometric, Floral, Art Nouveau, Mosaics…"
                  value={form.interests}
                  onChange={(e) => setForm((p) => ({ ...p, interests: e.target.value }))}
                  helperText="Comma-separated. Each entry becomes a chip on your profile."
                  slotProps={{ htmlInput: { maxLength: 1000 } }}
                />
                {interestChips.length > 0 && (
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 2 }}>
                    {interestChips.map((chip, i) => (
                      <Chip
                        key={chip + i}
                        label={chip}
                        size="small"
                        variant="outlined"
                        color="primary"
                        sx={{ borderRadius: 2, fontWeight: 500 }}
                      />
                    ))}
                  </Box>
                )}
              </SectionCard>

              {/* ─── ARTIST TOGGLE ───────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <Box sx={{ display: 'flex', alignItems: 'flex-start', gap: 1.5 }}>
                  <Box
                    sx={{
                      width: 36, height: 36, borderRadius: 2, flexShrink: 0, mt: 0.25,
                      backgroundColor: form.is_artist ? 'secondary.main' : 'action.disabledBackground',
                      display: 'flex', alignItems: 'center', justifyContent: 'center',
                      transition: 'background-color 0.2s ease',
                    }}
                  >
                    <BrushRoundedIcon sx={{ fontSize: 18, color: form.is_artist ? 'white' : 'text.disabled' }} />
                  </Box>
                  <Box sx={{ flex: 1 }}>
                    <FormControlLabel
                      control={
                        <Switch
                          checked={form.is_artist}
                          onChange={(e) => setForm((p) => ({ ...p, is_artist: e.target.checked }))}
                          color="secondary"
                        />
                      }
                      label={<Typography fontWeight={600} variant="body2">I'm a pattern artist</Typography>}
                      sx={{ m: 0 }}
                    />
                    <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: 0.5 }}>
                      Adds an Artist badge to your profile and shows a showcase of patterns you've contributed to the archive.
                    </Typography>
                  </Box>
                </Box>
              </SectionCard>

              {/* ─── ACTIONS ─────────────────────────────────────────────── */}
              {saveError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {saveError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button component={Link} variant="outlined" to="/profile" sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 600 }}>
                  Cancel
                </Button>
                <Button disableElevation type="submit" variant="contained" loading={saving}>
                  {saving ? <CircularProgress size={20} color="inherit" /> : 'Save changes'}
                </Button>
              </Box>
            </Box>
          )}
        </Container>
      </PageWrapper>
    </GeneralLayout>
  );
}

// ─── Styled components ────────────────────────────────────────────────────────

const PageWrapper = styled(Box)(({ theme }) => ({
  minHeight: '100vh',
  paddingTop: theme.spacing(6),
  paddingBottom: theme.spacing(12),
}));

const SectionCard = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3.5, 4),
  marginBottom: theme.spacing(3),
  boxShadow: 'none',
}));

const SectionTitle = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="overline"
    sx={{ fontSize: '0.65rem', fontWeight: 700, letterSpacing: '0.12em', color: 'text.disabled', display: 'block', mb: 2 }}
  >
    {children}
  </Typography>
);

const HeroPreview = styled(Box)(({ theme }) => ({
  width: '100%',
  height: 120,
  borderRadius: 12,
  position: 'relative',
  overflow: 'hidden',
  backgroundColor: theme.palette.primary.dark,
  backgroundSize: 'cover',
  backgroundPosition: 'center',
  border: `1px solid ${theme.palette.divider}`,
  // Decorative circles when no image
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -30,
    right: -30,
    width: 120,
    height: 120,
    borderRadius: '50%',
    background: alpha(theme.palette.primary.main, 0.5),
    pointerEvents: 'none',
  },
}));

const WallpaperPlaceholder = () => (
  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.25 }}>
    <WallpaperRoundedIcon sx={{ fontSize: 32, color: 'white' }} />
  </Box>
);

const AvatarPreview = styled(Box, {
  shouldForwardProp: (p) => p !== 'hasPhoto',
})<{ hasPhoto?: boolean }>(({ theme, hasPhoto }) => ({
  width: 44,
  height: 44,
  borderRadius: '50%',
  border: '2px solid rgba(255,255,255,0.4)',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  overflow: hasPhoto ? 'hidden' : 'visible',
}));

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const EditSkeleton = () => (
  <Box sx={{ display: 'flex', flexDirection: 'column', gap: 3 }}>
    {[140, 110, 260, 100, 80].map((h, i) => (
      <Paper key={i} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 4, boxShadow: 'none' }}>
        <Skeleton variant="text" width={80} height={14} sx={{ mb: 2 }} />
        <Skeleton variant="rounded" height={h} sx={{ borderRadius: 1 }} />
      </Paper>
    ))}
  </Box>
);
