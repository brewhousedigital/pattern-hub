import React, { useEffect, useRef, useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData, useRefreshAuth } from '@/data/auth-data';
import { PRIMARY_COLOR } from '@/data/constants';
import { useMutationUpdateUserWithFiles } from '@/functions/database/authentication';
import { enqueueSnackbar } from 'notistack';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useMutationValidateUsername } from '@/functions/database/users';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { MarkdownEditor } from '@/components/MarkdownEditor';
import { resizeAndConvertToWebP } from '@/functions/utilities/image-processing';
import {
  generateUserAvatarUrl,
  generateUserHeaderUrl,
  generateUserBgImageUrl,
} from '@/functions/utilities/generate-pb-image';
import {
  PROFILE_FONTS,
  SOCIAL_PLATFORMS,
  BG_PATTERNS,
  AVATAR_SHAPES,
  CURSOR_OPTIONS,
  NAME_EFFECTS,
  sanitizeHex,
  extractYouTubeId,
} from '@/constants/profile-customization';

import { styled, alpha } from '@mui/material/styles';
import ReportRoundedIcon from '@mui/icons-material/ReportRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import AddRoundedIcon from '@mui/icons-material/AddRounded';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';

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
  MenuItem,
  Paper,
  Select,
  Skeleton,
  Slider,
  Stack,
  Switch,
  TextField,
  ToggleButton,
  ToggleButtonGroup,
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

interface CustomizationForm {
  site_color: string;
  site_color_secondary: string;
  profile_bg_type: 'solid' | 'gradient' | 'pattern' | 'image';
  profile_bg_color: string;
  profile_bg_gradient_end: string;
  profile_bg_gradient_angle: number;
  profile_bg_pattern: string;
  profile_card_bg: string;
  profile_font: string;
  profile_font_size: 'small' | 'medium' | 'large';
  profile_name_effect: string;
  profile_avatar_shape: 'circle' | 'squircle' | 'square' | 'hexagon';
  profile_cursor: string;
  profile_sparkles: boolean;
  profile_mood_emoji: string;
  profile_mood_text: string;
  profile_youtube_url: string;
  social_links: Array<{ platform: string; url: string }>;
  tab_show_favorites: boolean;
  tab_show_done: boolean;
  tab_show_ratings: boolean;
  tab_show_difficulty: boolean;
  tab_show_gallery: boolean;
  tab_show_collections: boolean;
}

const DEFAULT_CUSTOMIZATION: CustomizationForm = {
  site_color: PRIMARY_COLOR,
  site_color_secondary: '#cfe1b9',
  profile_bg_type: 'solid',
  profile_bg_color: '',
  profile_bg_gradient_end: '#ffffff',
  profile_bg_gradient_angle: 135,
  profile_bg_pattern: 'dots',
  profile_card_bg: '',
  profile_font: '',
  profile_font_size: 'medium',
  profile_name_effect: 'none',
  profile_avatar_shape: 'circle',
  profile_cursor: 'default',
  profile_sparkles: false,
  profile_mood_emoji: '',
  profile_mood_text: '',
  profile_youtube_url: '',
  social_links: [],
  tab_show_favorites: true,
  tab_show_done: true,
  tab_show_ratings: true,
  tab_show_difficulty: true,
  tab_show_gallery: true,
  tab_show_collections: true,
};

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { authData } = useGlobalAuthData();
  const navigate = useNavigate();
  const { handleRefresh } = useRefreshAuth();

  const verifyUsername = useMutationValidateUsername();
  const updateUser = useMutationUpdateUserWithFiles();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  const [form, setForm] = useState<ProfileFormData>({
    username: '',
    about: '',
    interests: '',
    is_artist: false,
  });
  const [customization, setCustomization] = useState<CustomizationForm>(DEFAULT_CUSTOMIZATION);
  const setCust = <K extends keyof CustomizationForm>(key: K, value: CustomizationForm[K]) =>
    setCustomization((p) => ({ ...p, [key]: value }));

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

  const [pendingBgImage, setPendingBgImage] = useState<File | null>(null);
  const [pendingBgImagePreview, setPendingBgImagePreview] = useState<string | null>(null);
  const [bgImageCleared, setBgImageCleared] = useState(false);

  const [imageError, setImageError] = useState('');
  const [processingImage, setProcessingImage] = useState<'avatar' | 'header' | 'bgimage' | null>(null);

  useEffect(() => {
    if (!authData) return;
    setForm({
      username: authData.name ?? '',
      about: authData.about ?? '',
      interests: authData.interests ?? '',
      is_artist: authData.is_artist ?? false,
    });
    setCustomization({
      site_color: authData.site_color ?? PRIMARY_COLOR,
      site_color_secondary: authData.site_color_secondary ?? '#cfe1b9',
      profile_bg_type: authData.profile_bg_type ?? 'solid',
      profile_bg_color: authData.profile_bg_color ?? '',
      profile_bg_gradient_end: authData.profile_bg_gradient_end ?? '#ffffff',
      profile_bg_gradient_angle: authData.profile_bg_gradient_angle ?? 135,
      profile_bg_pattern: authData.profile_bg_pattern ?? 'dots',
      profile_card_bg: authData.profile_card_bg ?? '',
      profile_font: authData.profile_font ?? '',
      profile_font_size: authData.profile_font_size ?? 'medium',
      profile_name_effect: authData.profile_name_effect ?? 'none',
      profile_avatar_shape: authData.profile_avatar_shape ?? 'circle',
      profile_cursor: authData.profile_cursor ?? 'default',
      profile_sparkles: authData.profile_sparkles ?? false,
      profile_mood_emoji: authData.profile_mood_emoji ?? '',
      profile_mood_text: authData.profile_mood_text ?? '',
      profile_youtube_url: authData.profile_youtube_url ?? '',
      social_links: authData.social_links ?? [],
      tab_show_favorites: authData.tab_show_favorites !== false,
      tab_show_done: authData.tab_show_done !== false,
      tab_show_ratings: authData.tab_show_ratings !== false,
      tab_show_difficulty: authData.tab_show_difficulty !== false,
      tab_show_gallery: authData.tab_show_gallery !== false,
      tab_show_collections: authData.tab_show_collections !== false,
    });
    setLoading(false);
  }, [authData]);

  // Revoke object URLs when component unmounts
  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
      if (pendingBgImagePreview) URL.revokeObjectURL(pendingBgImagePreview);
    };
  }, [pendingAvatarPreview, pendingHeaderPreview, pendingBgImagePreview]);

  // ─── Image handlers ──────────────────────────────────────────────────────

  async function handleImageSelect(file: File, type: 'avatar' | 'header' | 'bgimage') {
    setImageError('');
    if (!file.type.startsWith('image/')) {
      setImageError('Only image files are supported.');
      return;
    }
    const maxMB = type === 'header' ? 10 : 5;
    if (file.size > maxMB * 1024 * 1024) {
      setImageError(`File is too large: maximum ${maxMB} MB.`);
      return;
    }

    setProcessingImage(type);
    try {
      const [maxW, maxH, quality] =
        type === 'avatar' ? [400, 400, 0.87] : type === 'header' ? [1920, 500, 0.82] : [1920, 1080, 0.82];
      const blob = await resizeAndConvertToWebP(file, maxW, maxH, quality);
      const processed = new File([blob], `${type}.webp`, { type: 'image/webp' });
      const preview = URL.createObjectURL(processed);

      if (type === 'avatar') {
        if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
        setPendingAvatar(processed);
        setPendingAvatarPreview(preview);
        setAvatarCleared(false);
      } else if (type === 'header') {
        if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
        setPendingHeader(processed);
        setPendingHeaderPreview(preview);
        setHeaderCleared(false);
      } else {
        if (pendingBgImagePreview) URL.revokeObjectURL(pendingBgImagePreview);
        setPendingBgImage(processed);
        setPendingBgImagePreview(preview);
        setBgImageCleared(false);
      }
    } catch {
      setImageError('Could not process this image,  please try another file.');
    } finally {
      setProcessingImage(null);
    }
  }

  function clearImage(type: 'avatar' | 'header' | 'bgimage') {
    if (type === 'avatar') {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      setPendingAvatar(null);
      setPendingAvatarPreview(null);
      setAvatarCleared(true);
      if (avatarInputRef.current) avatarInputRef.current.value = '';
    } else if (type === 'header') {
      if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
      setPendingHeader(null);
      setPendingHeaderPreview(null);
      setHeaderCleared(true);
      if (headerInputRef.current) headerInputRef.current.value = '';
    } else {
      if (pendingBgImagePreview) URL.revokeObjectURL(pendingBgImagePreview);
      setPendingBgImage(null);
      setPendingBgImagePreview(null);
      setBgImageCleared(true);
      if (bgImageInputRef.current) bgImageInputRef.current.value = '';
    }
  }

  // ─── Username verification ────────────────────────────────────────────────

  async function handleUsernameVerification() {
    if (form.username.trim() === authData?.name) return true;
    try {
      const results = await verifyUsername.mutateAsync(form.username);
      const taken = results.find((item) => item.name?.trim().toLowerCase() === form.username.trim().toLowerCase());
      setUsernameAvailable(!taken);
      return !taken;
    } catch {
      setUsernameAvailable(true);
      return true;
    }
  }

  // ─── Submit ───────────────────────────────────────────────────────────────

  async function handleSubmit(e: React.SubmitEvent<HTMLFormElement>) {
    e.preventDefault();
    setSaveError(null);
    setSaving(true);

    const usernameOk = await handleUsernameVerification();
    if (!usernameOk) {
      setSaving(false);
      return;
    }

    const fd = new FormData();
    fd.append('name', form.username.trim());
    fd.append('about', form.about.trim());
    fd.append('interests', form.interests.trim());
    fd.append('is_artist', String(form.is_artist));

    if (pendingAvatar) fd.append('avatar', pendingAvatar, 'avatar.webp');
    else if (avatarCleared) fd.append('avatar', '');

    if (pendingHeader) fd.append('header_image', pendingHeader, 'header_image.webp');
    else if (headerCleared) fd.append('header_image', '');

    if (pendingBgImage) fd.append('profile_bg_image', pendingBgImage, 'bg_image.webp');
    else if (bgImageCleared) fd.append('profile_bg_image', '');

    // Customization fields
    fd.append('site_color', sanitizeHex(customization.site_color, PRIMARY_COLOR));
    fd.append('site_color_secondary', sanitizeHex(customization.site_color_secondary, '#cfe1b9'));
    fd.append('profile_bg_type', customization.profile_bg_type);
    fd.append(
      'profile_bg_color',
      customization.profile_bg_color ? sanitizeHex(customization.profile_bg_color, '') : '',
    );
    fd.append('profile_bg_gradient_end', sanitizeHex(customization.profile_bg_gradient_end, '#ffffff'));
    fd.append('profile_bg_gradient_angle', String(customization.profile_bg_gradient_angle));
    fd.append('profile_bg_pattern', customization.profile_bg_pattern);
    fd.append('profile_card_bg', customization.profile_card_bg ? sanitizeHex(customization.profile_card_bg, '') : '');
    fd.append('profile_font', customization.profile_font);
    fd.append('profile_font_size', customization.profile_font_size);
    fd.append('profile_name_effect', customization.profile_name_effect);
    fd.append('profile_avatar_shape', customization.profile_avatar_shape);
    fd.append('profile_cursor', customization.profile_cursor);
    fd.append('profile_sparkles', String(customization.profile_sparkles));
    fd.append('profile_mood_emoji', customization.profile_mood_emoji.slice(0, 4));
    fd.append('profile_mood_text', customization.profile_mood_text.slice(0, 50));
    fd.append(
      'profile_youtube_url',
      extractYouTubeId(customization.profile_youtube_url) ? customization.profile_youtube_url.trim() : '',
    );
    fd.append('social_links', JSON.stringify(customization.social_links.filter((l) => l.url.startsWith('https://'))));
    fd.append('tab_show_favorites', String(customization.tab_show_favorites));
    fd.append('tab_show_done', String(customization.tab_show_done));
    fd.append('tab_show_ratings', String(customization.tab_show_ratings));
    fd.append('tab_show_difficulty', String(customization.tab_show_difficulty));
    fd.append('tab_show_gallery', String(customization.tab_show_gallery));
    fd.append('tab_show_collections', String(customization.tab_show_collections));

    try {
      await updateUser.mutateAsync({ id: authData?.id ?? '', formData: fd });
      await handleRefresh();
      enqueueSnackbar('Profile updated!', { variant: 'success' });
      void navigate({ to: '/profile', search: { tab: 0 } });
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
  const existingBgImageUrl = generateUserBgImageUrl(authData ?? undefined);

  const activeAvatarSrc = avatarCleared ? null : (pendingAvatarPreview ?? existingAvatarUrl);
  const activeHeaderSrc = headerCleared ? null : (pendingHeaderPreview ?? existingHeaderUrl);
  const activeBgImageSrc = bgImageCleared ? null : (pendingBgImagePreview ?? existingBgImageUrl);

  const displayName = (authData?.name?.startsWith('NewUser_') ? '' : authData?.name) || '';
  const initial = (displayName[0] ?? '?').toUpperCase();

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="sm">
          <Box sx={{ mb: 5 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>
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
                <HeroPreview
                  sx={{
                    backgroundImage: activeHeaderSrc
                      ? `linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 100%), url(${activeHeaderSrc})`
                      : undefined,
                  }}
                >
                  {!activeHeaderSrc && <WallpaperPlaceholder />}

                  {/* Avatar preview inside hero */}
                  <Box
                    sx={{ position: 'absolute', bottom: 12, left: 16, display: 'flex', alignItems: 'center', gap: 1.5 }}
                  >
                    <AvatarPreview hasPhoto={!!activeAvatarSrc}>
                      {activeAvatarSrc ? (
                        <Box
                          component="img"
                          src={activeAvatarSrc}
                          alt="Avatar"
                          sx={{ width: '100%', height: '100%', objectFit: 'cover' }}
                        />
                      ) : (
                        <Typography sx={{ fontSize: '1.1rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                          {initial}
                        </Typography>
                      )}
                    </AvatarPreview>
                    <Box>
                      <Typography
                        sx={{
                          fontSize: '0.85rem',
                          fontWeight: 700,
                          color: activeHeaderSrc ? 'white' : 'text.primary',
                          lineHeight: 1,
                          mb: 0.25,
                        }}
                      >
                        {displayName || 'Your Name'}
                      </Typography>
                      <Typography
                        sx={{ fontSize: '0.65rem', color: activeHeaderSrc ? 'rgba(255,255,255,0.6)' : 'text.disabled' }}
                      >
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
                      <Typography variant="caption" sx={{ fontWeight: 600 }} color="text.secondary">
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
                        processingImage === 'avatar' ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <AddPhotoAlternateOutlinedIcon fontSize="small" />
                        )
                      }
                      sx={{ borderStyle: 'dashed' }}
                    >
                      {processingImage === 'avatar' ? 'Processing…' : activeAvatarSrc ? 'Replace' : 'Upload'}
                    </Button>
                    {activeAvatarSrc && !avatarCleared && (
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
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
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
                      <Typography variant="caption" sx={{ fontWeight: 600 }} color="text.secondary">
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
                        processingImage === 'header' ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <AddPhotoAlternateOutlinedIcon fontSize="small" />
                        )
                      }
                      sx={{ borderStyle: 'dashed' }}
                    >
                      {processingImage === 'header' ? 'Processing…' : activeHeaderSrc ? 'Replace' : 'Upload'}
                    </Button>
                    {activeHeaderSrc && !headerCleared && (
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
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
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
                        <Typography variant="body2" color="success.main">
                          Available
                        </Typography>
                      </Stack>
                    )}
                    {usernameAvailable === false && (
                      <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
                        <ReportRoundedIcon color="error" fontSize="small" />
                        <Typography variant="body2" color="error">
                          Name taken
                        </Typography>
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
                      width: 36,
                      height: 36,
                      borderRadius: 2,
                      flexShrink: 0,
                      mt: 0.25,
                      backgroundColor: form.is_artist ? 'secondary.main' : 'action.disabledBackground',
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
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
                      label={
                        <Typography variant="body2" sx={{ fontWeight: 600 }}>
                          I'm a pattern artist
                        </Typography>
                      }
                      sx={{ m: 0 }}
                    />
                    <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mt: 0.5 }}>
                      Adds an Artist badge to your profile and shows a showcase of patterns you've contributed to the
                      archive.
                    </Typography>
                  </Box>
                </Box>
              </SectionCard>

              {/* ─── COLORS & BACKGROUND ──────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Colors &amp; Background</SectionTitle>

                <Grid container spacing={2}>
                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}
                    >
                      Primary Accent
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="input"
                        type="color"
                        value={customization.site_color}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => setCust('site_color', e.target.value)}
                        sx={{
                          width: 44,
                          height: 44,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 0.25,
                          cursor: 'pointer',
                        }}
                      />
                      <TextField
                        size="small"
                        variant="filled"
                        value={customization.site_color}
                        onChange={(e) => setCust('site_color', e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 7 } }}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Grid>

                  <Grid size={{ xs: 12, sm: 6 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}
                    >
                      Secondary Accent
                    </Typography>
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                      <Box
                        component="input"
                        type="color"
                        value={customization.site_color_secondary}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                          setCust('site_color_secondary', e.target.value)
                        }
                        sx={{
                          width: 44,
                          height: 44,
                          border: '1px solid',
                          borderColor: 'divider',
                          borderRadius: 1,
                          p: 0.25,
                          cursor: 'pointer',
                        }}
                      />
                      <TextField
                        size="small"
                        variant="filled"
                        value={customization.site_color_secondary}
                        onChange={(e) => setCust('site_color_secondary', e.target.value)}
                        slotProps={{ htmlInput: { maxLength: 7 } }}
                        sx={{ flex: 1 }}
                      />
                    </Box>
                  </Grid>
                </Grid>

                <Typography
                  variant="caption"
                  color="text.secondary"
                  sx={{ fontWeight: 600, display: 'block', mt: 2.5, mb: 1 }}
                >
                  Page Background
                </Typography>
                <ToggleButtonGroup
                  exclusive
                  value={customization.profile_bg_type}
                  onChange={(_, v) => {
                    if (v) setCust('profile_bg_type', v);
                  }}
                  size="small"
                  sx={{ mb: 2 }}
                >
                  {(['solid', 'gradient', 'pattern', 'image'] as const).map((t) => (
                    <ToggleButton key={t} value={t} sx={{ textTransform: 'capitalize', fontWeight: 600 }}>
                      {t}
                    </ToggleButton>
                  ))}
                </ToggleButtonGroup>

                {(customization.profile_bg_type === 'solid' ||
                  customization.profile_bg_type === 'gradient' ||
                  customization.profile_bg_type === 'pattern') && (
                  <Grid container spacing={2} sx={{ mb: 1 }}>
                    <Grid size={{ xs: 12, sm: 6 }}>
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}
                      >
                        {customization.profile_bg_type === 'solid' ? 'Background Color' : 'Start Color'}
                      </Typography>
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                        <Box
                          component="input"
                          type="color"
                          value={customization.profile_bg_color || '#f4f7f5'}
                          onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                            setCust('profile_bg_color', e.target.value)
                          }
                          sx={{
                            width: 44,
                            height: 44,
                            border: '1px solid',
                            borderColor: 'divider',
                            borderRadius: 1,
                            p: 0.25,
                            cursor: 'pointer',
                          }}
                        />
                        <TextField
                          size="small"
                          variant="filled"
                          value={customization.profile_bg_color}
                          onChange={(e) => setCust('profile_bg_color', e.target.value)}
                          slotProps={{ htmlInput: { maxLength: 7 } }}
                          sx={{ flex: 1 }}
                        />
                      </Box>
                    </Grid>
                    {customization.profile_bg_type === 'gradient' && (
                      <Grid size={{ xs: 12, sm: 6 }}>
                        <Typography
                          variant="caption"
                          color="text.secondary"
                          sx={{ fontWeight: 600, display: 'block', mb: 0.5 }}
                        >
                          End Color
                        </Typography>
                        <Box sx={{ display: 'flex', alignItems: 'center', gap: 1.5 }}>
                          <Box
                            component="input"
                            type="color"
                            value={customization.profile_bg_gradient_end}
                            onChange={(e: React.ChangeEvent<HTMLInputElement>) =>
                              setCust('profile_bg_gradient_end', e.target.value)
                            }
                            sx={{
                              width: 44,
                              height: 44,
                              border: '1px solid',
                              borderColor: 'divider',
                              borderRadius: 1,
                              p: 0.25,
                              cursor: 'pointer',
                            }}
                          />
                          <TextField
                            size="small"
                            variant="filled"
                            value={customization.profile_bg_gradient_end}
                            onChange={(e) => setCust('profile_bg_gradient_end', e.target.value)}
                            slotProps={{ htmlInput: { maxLength: 7 } }}
                            sx={{ flex: 1 }}
                          />
                        </Box>
                      </Grid>
                    )}
                  </Grid>
                )}

                {customization.profile_bg_type === 'gradient' && (
                  <Box sx={{ mb: 2 }}>
                    <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600 }}>
                      Angle: {customization.profile_bg_gradient_angle}°
                    </Typography>
                    <Slider
                      min={0}
                      max={360}
                      value={customization.profile_bg_gradient_angle}
                      onChange={(_, v) => setCust('profile_bg_gradient_angle', v as number)}
                      size="small"
                      sx={{ mt: 1 }}
                    />
                  </Box>
                )}

                {customization.profile_bg_type === 'pattern' && (
                  <Box sx={{ mb: 1 }}>
                    <Typography
                      variant="caption"
                      color="text.secondary"
                      sx={{ fontWeight: 600, display: 'block', mb: 1 }}
                    >
                      Pattern Style
                    </Typography>
                    <Stack direction="row" sx={{ flexWrap: 'wrap', gap: 1 }}>
                      {BG_PATTERNS.map((p) => (
                        <Chip
                          key={p.key}
                          label={p.label}
                          size="small"
                          clickable
                          onClick={() => setCust('profile_bg_pattern', p.key)}
                          color={customization.profile_bg_pattern === p.key ? 'primary' : 'default'}
                          variant={customization.profile_bg_pattern === p.key ? 'filled' : 'outlined'}
                          sx={{ borderRadius: 2 }}
                        />
                      ))}
                    </Stack>
                  </Box>
                )}

                {customization.profile_bg_type === 'image' && (
                  <Box sx={{ mt: 1 }}>
                    <input
                      ref={bgImageInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImageSelect(f, 'bgimage');
                      }}
                    />
                    {activeBgImageSrc && (
                      <Box
                        component="img"
                        src={activeBgImageSrc}
                        alt="Background preview"
                        sx={{
                          width: '100%',
                          maxHeight: 120,
                          objectFit: 'cover',
                          borderRadius: 2,
                          mb: 1,
                          display: 'block',
                        }}
                      />
                    )}
                    <Button
                      fullWidth
                      variant="outlined"
                      size="small"
                      onClick={() => bgImageInputRef.current?.click()}
                      disabled={processingImage === 'bgimage'}
                      startIcon={
                        processingImage === 'bgimage' ? (
                          <CircularProgress size={14} color="inherit" />
                        ) : (
                          <AddPhotoAlternateOutlinedIcon fontSize="small" />
                        )
                      }
                      sx={{ borderStyle: 'dashed' }}
                    >
                      {processingImage === 'bgimage'
                        ? 'Processing…'
                        : activeBgImageSrc
                          ? 'Replace'
                          : 'Upload background image'}
                    </Button>
                    {activeBgImageSrc && !bgImageCleared && (
                      <Button
                        fullWidth
                        size="small"
                        color="error"
                        startIcon={<DeleteOutlineRoundedIcon fontSize="small" />}
                        onClick={() => clearImage('bgimage')}
                        sx={{ mt: 0.75 }}
                      >
                        Remove background image
                      </Button>
                    )}
                    <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
                      Landscape image · max 5 MB · resized to 1920×1080 px
                    </Typography>
                  </Box>
                )}
              </SectionCard>

              {/* ─── TYPOGRAPHY & STYLE ───────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Typography &amp; Style</SectionTitle>

                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Profile Font
                </Typography>
                <Select
                  fullWidth
                  size="small"
                  variant="filled"
                  value={customization.profile_font}
                  onChange={(e) => setCust('profile_font', e.target.value)}
                  displayEmpty
                  renderValue={(v) => v || 'Default font'}
                  sx={{ mb: 2 }}
                >
                  <MenuItem value="">
                    <em>Default font</em>
                  </MenuItem>
                  {PROFILE_FONTS.map((f) => (
                    <MenuItem key={f.value} value={f.value} sx={{ fontFamily: `'${f.value}', sans-serif` }}>
                      <Box>
                        <Typography sx={{ fontFamily: `'${f.value}', sans-serif`, fontWeight: 600 }}>
                          {f.label}
                        </Typography>
                        <Typography variant="caption" color="text.disabled">
                          {f.category}
                        </Typography>
                      </Box>
                    </MenuItem>
                  ))}
                </Select>

                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Name Effect
                </Typography>
                <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
                  {NAME_EFFECTS.map((ef) => (
                    <Chip
                      key={ef.key}
                      label={ef.label}
                      size="small"
                      clickable
                      onClick={() => setCust('profile_name_effect', ef.key)}
                      color={customization.profile_name_effect === ef.key ? 'primary' : 'default'}
                      variant={customization.profile_name_effect === ef.key ? 'filled' : 'outlined'}
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Avatar Shape
                </Typography>
                <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
                  {AVATAR_SHAPES.map((s) => (
                    <Chip
                      key={s.key}
                      label={s.label}
                      size="small"
                      clickable
                      onClick={() =>
                        setCust('profile_avatar_shape', s.key as CustomizationForm['profile_avatar_shape'])
                      }
                      color={customization.profile_avatar_shape === s.key ? 'primary' : 'default'}
                      variant={customization.profile_avatar_shape === s.key ? 'filled' : 'outlined'}
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Stack>

                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Cursor Style
                </Typography>
                <Stack direction="row" sx={{ mb: 2, gap: 1, flexWrap: 'wrap' }}>
                  {CURSOR_OPTIONS.map((c) => (
                    <Chip
                      key={c.key}
                      label={c.label}
                      size="small"
                      clickable
                      onClick={() => setCust('profile_cursor', c.key)}
                      color={customization.profile_cursor === c.key ? 'primary' : 'default'}
                      variant={customization.profile_cursor === c.key ? 'filled' : 'outlined'}
                      sx={{ borderRadius: 2 }}
                    />
                  ))}
                </Stack>

                <FormControlLabel
                  control={
                    <Switch
                      checked={customization.profile_sparkles}
                      onChange={(e) => setCust('profile_sparkles', e.target.checked)}
                      color="primary"
                    />
                  }
                  label={
                    <Box>
                      <Typography variant="body2" sx={{ fontWeight: 600 }}>
                        Sparkle effect ✦
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        Adds animated star sparkles to your hero section.
                      </Typography>
                    </Box>
                  }
                />
              </SectionCard>

              {/* ─── MOOD & STATUS ────────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Status</SectionTitle>
                <Grid container spacing={2}>
                  <Grid size={{ xs: 3, sm: 2 }}>
                    <TextField
                      label="Emoji"
                      variant="filled"
                      fullWidth
                      value={customization.profile_mood_emoji}
                      onChange={(e) => setCust('profile_mood_emoji', e.target.value)}
                      slotProps={{ htmlInput: { maxLength: 4 } }}
                      helperText="emoji"
                    />
                  </Grid>
                  <Grid size={{ xs: 9, sm: 10 }}>
                    <TextField
                      label="Status text"
                      variant="filled"
                      fullWidth
                      placeholder="Working on a new piece…"
                      value={customization.profile_mood_text}
                      onChange={(e) => setCust('profile_mood_text', e.target.value.slice(0, 50))}
                      slotProps={{ htmlInput: { maxLength: 50 } }}
                      helperText={`${customization.profile_mood_text.length}/50`}
                    />
                  </Grid>
                </Grid>
              </SectionCard>

              {/* ─── SECTION VISIBILITY ───────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Section Visibility</SectionTitle>
                <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 2 }}>
                  Toggle which activity tabs appear on your public profile.
                </Typography>
                <Grid container spacing={1.5}>
                  {(
                    [
                      { key: 'tab_show_favorites', label: 'Favorites' },
                      { key: 'tab_show_done', label: 'Completed' },
                      { key: 'tab_show_ratings', label: 'Ratings' },
                      { key: 'tab_show_difficulty', label: 'Difficulty Votes' },
                      { key: 'tab_show_gallery', label: 'Gallery' },
                      { key: 'tab_show_collections', label: 'Collections' },
                    ] as const
                  ).map(({ key, label }) => (
                    <Grid key={key} size={{ xs: 12, sm: 6 }}>
                      <FormControlLabel
                        control={
                          <Switch
                            checked={customization[key]}
                            onChange={(e) => setCust(key, e.target.checked)}
                            size="small"
                          />
                        }
                        label={<Typography variant="body2">{label}</Typography>}
                        sx={{ m: 0, width: '100%', justifyContent: 'space-between', flexDirection: 'row-reverse' }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </SectionCard>

              {/* ─── MEDIA & SOCIAL ───────────────────────────────────────── */}
              <SectionCard elevation={0}>
                <SectionTitle>Media &amp; Social Links</SectionTitle>

                <TextField
                  fullWidth
                  label="YouTube Video URL"
                  variant="filled"
                  placeholder="https://youtube.com/watch?v=… or https://youtu.be/…"
                  value={customization.profile_youtube_url}
                  onChange={(e) => setCust('profile_youtube_url', e.target.value.trim())}
                  helperText={
                    customization.profile_youtube_url
                      ? extractYouTubeId(customization.profile_youtube_url)
                        ? '✓ Valid YouTube URL'
                        : '⚠ Could not find a video ID in this URL'
                      : 'Paste a YouTube video link to embed it on your profile.'
                  }
                  sx={{ mb: 3 }}
                />

                <Typography variant="caption" color="text.secondary" sx={{ fontWeight: 600, display: 'block', mb: 1 }}>
                  Social Links (up to 8)
                </Typography>
                <Stack spacing={1.5} sx={{ mb: 1.5 }}>
                  {customization.social_links.map((link, i) => (
                    <Grid key={i} container spacing={1} sx={{ alignItems: 'center' }}>
                      <Grid size={{ xs: 4 }}>
                        <Select
                          fullWidth
                          size="small"
                          variant="filled"
                          value={link.platform}
                          onChange={(e) => {
                            const updated = [...customization.social_links];
                            updated[i] = { ...updated[i], platform: e.target.value };
                            setCust('social_links', updated);
                          }}
                        >
                          {SOCIAL_PLATFORMS.map((p) => (
                            <MenuItem key={p.key} value={p.key}>
                              {p.label}
                            </MenuItem>
                          ))}
                        </Select>
                      </Grid>
                      <Grid size="grow">
                        <TextField
                          fullWidth
                          size="small"
                          variant="filled"
                          placeholder={SOCIAL_PLATFORMS.find((p) => p.key === link.platform)?.placeholder ?? 'https://'}
                          value={link.url}
                          onChange={(e) => {
                            const updated = [...customization.social_links];
                            updated[i] = { ...updated[i], url: e.target.value.trim() };
                            setCust('social_links', updated);
                          }}
                        />
                      </Grid>
                      <Grid size="auto">
                        <Tooltip title="Remove">
                          <IconButton
                            size="small"
                            color="error"
                            onClick={() => {
                              const updated = [...customization.social_links];
                              updated.splice(i, 1);
                              setCust('social_links', updated);
                            }}
                          >
                            <RemoveCircleOutlineRoundedIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Grid>
                    </Grid>
                  ))}
                </Stack>
                {customization.social_links.length < 8 && (
                  <Button
                    size="small"
                    variant="outlined"
                    startIcon={<AddRoundedIcon />}
                    onClick={() =>
                      setCust('social_links', [...customization.social_links, { platform: 'instagram', url: '' }])
                    }
                    sx={{ borderStyle: 'dashed' }}
                  >
                    Add social link
                  </Button>
                )}
              </SectionCard>

              {/* ─── ACTIONS ─────────────────────────────────────────────── */}
              {saveError && (
                <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                  {saveError}
                </Alert>
              )}

              <Box sx={{ display: 'flex', justifyContent: 'flex-end', gap: 2 }}>
                <Button
                  component={Link}
                  variant="outlined"
                  to="/profile"
                  sx={{ borderRadius: 10, textTransform: 'none', fontWeight: 600 }}
                >
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
    sx={{
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.12em',
      color: 'text.disabled',
      display: 'block',
      mb: 2,
    }}
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
