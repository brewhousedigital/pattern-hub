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
  generateUserMobileHeaderUrl,
} from '@/functions/utilities/generate-pb-image';
import { sanitizeHex, extractYouTubeId } from '@/constants/profile-customization';
import {
  type CustomizationForm,
  DEFAULT_CUSTOMIZATION,
  SectionCard,
  SectionTitle,
} from '../../components/profile/_shared';
import { ColorsSection } from '../../components/profile/ColorsSection';
import { TypographySection } from '../../components/profile/TypographySection';
import { MoodSection } from '../../components/profile/MoodSection';
import { VisibilitySection } from '../../components/profile/VisibilitySection';
import { SocialSection } from '../../components/profile/SocialSection';
import { BlockedTagsSection } from '../../components/profile/BlockedTagsSection';
import { PreferredUnitsSection } from '../../components/profile/PreferredUnitsSection';

import { styled, alpha, useTheme } from '@mui/material/styles';
import ReportRoundedIcon from '@mui/icons-material/ReportRounded';
import CheckCircleOutlineRoundedIcon from '@mui/icons-material/CheckCircleOutlineRounded';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import DeleteOutlineRoundedIcon from '@mui/icons-material/DeleteOutlineRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import WallpaperRoundedIcon from '@mui/icons-material/WallpaperRounded';
import PhotoLibraryRoundedIcon from '@mui/icons-material/PhotoLibraryRounded';
import PaletteRoundedIcon from '@mui/icons-material/PaletteRounded';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import ShieldRoundedIcon from '@mui/icons-material/ShieldRounded';

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
  Tab,
  Tabs,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
} from '@mui/material';

// ─── Navigation ─────────────────────────────────────────────────────────────--

// Each tab is a self-contained group of settings. Add a new feature by adding
// a tab here and a matching panel below.
const TABS = [
  { key: 'basics', label: 'Profile', icon: <PersonRoundedIcon fontSize="small" /> },
  { key: 'photos', label: 'Photos', icon: <PhotoLibraryRoundedIcon fontSize="small" /> },
  { key: 'appearance', label: 'Appearance', icon: <PaletteRoundedIcon fontSize="small" /> },
  { key: 'social', label: 'Status & Social', icon: <ShareRoundedIcon fontSize="small" /> },
  { key: 'general', label: 'General', icon: <ShieldRoundedIcon fontSize="small" /> },
] as const;

type TabKey = (typeof TABS)[number]['key'];

export const Route = createFileRoute('/profile/edit')({
  component: RouteComponent,
  // Optional ?tab=general deep link (used by the blocked-tags banner on the homepage).
  validateSearch: (search: Record<string, unknown>) => ({
    tab: TABS.some((t) => t.key === search.tab) ? (search.tab as TabKey) : undefined,
  }),
  head: ({ match }) => generateSEO('Edit Profile', '', match.pathname),
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
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('md'));

  const verifyUsername = useMutationValidateUsername();
  const updateUser = useMutationUpdateUserWithFiles();

  const avatarInputRef = useRef<HTMLInputElement>(null);
  const headerInputRef = useRef<HTMLInputElement>(null);
  const mobileHeaderInputRef = useRef<HTMLInputElement>(null);
  const bgImageInputRef = useRef<HTMLInputElement>(null);

  const { tab: initialTab } = Route.useSearch();
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab ?? 'basics');

  const [form, setForm] = useState<ProfileFormData>({
    username: '',
    about: '',
    interests: '',
    is_artist: false,
  });
  const [customization, setCustomization] = useState<CustomizationForm>(DEFAULT_CUSTOMIZATION);

  const setCust = <K extends keyof CustomizationForm>(key: K, value: CustomizationForm[K]) =>
    setCustomization((p) => ({ ...p, [key]: value }));

  const resetSection = (keys: (keyof CustomizationForm)[]) =>
    setCustomization((p) => {
      const patch = Object.fromEntries(keys.map((k) => [k, DEFAULT_CUSTOMIZATION[k]]));
      return { ...p, ...patch } as CustomizationForm;
    });

  const [errors, setErrors] = useState<ProfileFormErrors>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [usernameAvailable, setUsernameAvailable] = useState<boolean | undefined>(undefined);

  const [pendingAvatar, setPendingAvatar] = useState<File | null>(null);
  const [pendingAvatarPreview, setPendingAvatarPreview] = useState<string | null>(null);
  const [avatarCleared, setAvatarCleared] = useState(false);

  const [pendingHeader, setPendingHeader] = useState<File | null>(null);
  const [pendingHeaderPreview, setPendingHeaderPreview] = useState<string | null>(null);
  const [headerCleared, setHeaderCleared] = useState(false);

  const [pendingMobileHeader, setPendingMobileHeader] = useState<File | null>(null);
  const [pendingMobileHeaderPreview, setPendingMobileHeaderPreview] = useState<string | null>(null);
  const [mobileHeaderCleared, setMobileHeaderCleared] = useState(false);

  const [pendingBgImage, setPendingBgImage] = useState<File | null>(null);
  const [pendingBgImagePreview, setPendingBgImagePreview] = useState<string | null>(null);
  const [bgImageCleared, setBgImageCleared] = useState(false);

  const [imageError, setImageError] = useState('');
  const [processingImage, setProcessingImage] = useState<'avatar' | 'header' | 'mobileheader' | 'bgimage' | null>(null);

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
      profile_bg_image_size: authData.profile_bg_image_size ?? 'cover',
      profile_bg_image_position: authData.profile_bg_image_position ?? 'center center',
      profile_bg_image_fixed: authData.profile_bg_image_fixed ?? false,
      profile_card_bg: authData.profile_card_bg ?? '',
      profile_header_text_color: authData.profile_header_text_color ?? '',
      profile_font: authData.profile_font ?? '',
      profile_font_size: authData.profile_font_size ?? 'medium',
      profile_name_effect: authData.profile_name_effect ?? 'none',
      profile_avatar_shape: authData.profile_avatar_shape ?? 'circle',
      profile_cursor: authData.profile_cursor ?? 'default',
      profile_sparkles: authData.profile_sparkles ?? false,
      profile_dark_mode: authData.profile_dark_mode ?? false,
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
      header_gradient: authData.header_gradient ?? true,
      blocked_tags: authData.blocked_tags ?? [],
      preferred_measurement_unit: authData.preferred_measurement_unit ?? 'original',
    });
    setLoading(false);
  }, [authData]);

  useEffect(() => {
    return () => {
      if (pendingAvatarPreview) URL.revokeObjectURL(pendingAvatarPreview);
      if (pendingHeaderPreview) URL.revokeObjectURL(pendingHeaderPreview);
      if (pendingMobileHeaderPreview) URL.revokeObjectURL(pendingMobileHeaderPreview);
      if (pendingBgImagePreview) URL.revokeObjectURL(pendingBgImagePreview);
    };
  }, [pendingAvatarPreview, pendingHeaderPreview, pendingMobileHeaderPreview, pendingBgImagePreview]);

  // ─── Image handlers ──────────────────────────────────────────────────────

  async function handleImageSelect(file: File, type: 'avatar' | 'header' | 'mobileheader' | 'bgimage') {
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
        type === 'avatar'
          ? [400, 400, 0.87]
          : type === 'header'
            ? [1920, 500, 0.82]
            : type === 'mobileheader'
              ? [900, 500, 0.82]
              : [1920, 1080, 0.82];
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
      } else if (type === 'mobileheader') {
        if (pendingMobileHeaderPreview) URL.revokeObjectURL(pendingMobileHeaderPreview);
        setPendingMobileHeader(processed);
        setPendingMobileHeaderPreview(preview);
        setMobileHeaderCleared(false);
      } else {
        if (pendingBgImagePreview) URL.revokeObjectURL(pendingBgImagePreview);
        setPendingBgImage(processed);
        setPendingBgImagePreview(preview);
        setBgImageCleared(false);
      }
    } catch {
      setImageError('Could not process this image, please try another file.');
    } finally {
      setProcessingImage(null);
    }
  }

  function clearImage(type: 'avatar' | 'header' | 'mobileheader' | 'bgimage') {
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
    } else if (type === 'mobileheader') {
      if (pendingMobileHeaderPreview) URL.revokeObjectURL(pendingMobileHeaderPreview);
      setPendingMobileHeader(null);
      setPendingMobileHeaderPreview(null);
      setMobileHeaderCleared(true);
      if (mobileHeaderInputRef.current) mobileHeaderInputRef.current.value = '';
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
      setActiveTab('basics');
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

    if (pendingMobileHeader) fd.append('mobile_header_image', pendingMobileHeader, 'mobile_header_image.webp');
    else if (mobileHeaderCleared) fd.append('mobile_header_image', '');

    if (pendingBgImage) fd.append('profile_bg_image', pendingBgImage, 'bg_image.webp');
    else if (bgImageCleared) fd.append('profile_bg_image', '');

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
    fd.append('profile_bg_image_size', customization.profile_bg_image_size);
    fd.append('profile_bg_image_position', customization.profile_bg_image_position);
    fd.append('profile_bg_image_fixed', String(customization.profile_bg_image_fixed));
    fd.append('profile_card_bg', customization.profile_card_bg ? sanitizeHex(customization.profile_card_bg, '') : '');
    fd.append(
      'profile_header_text_color',
      customization.profile_header_text_color ? sanitizeHex(customization.profile_header_text_color, '') : '',
    );
    fd.append('profile_font', customization.profile_font);
    fd.append('profile_font_size', customization.profile_font_size);
    fd.append('profile_name_effect', customization.profile_name_effect);
    fd.append('profile_avatar_shape', customization.profile_avatar_shape);
    fd.append('profile_cursor', customization.profile_cursor);
    fd.append('profile_sparkles', String(customization.profile_sparkles));
    fd.append('profile_dark_mode', String(customization.profile_dark_mode));
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
    fd.append('header_gradient', String(customization.header_gradient));
    fd.append('blocked_tags', JSON.stringify(customization.blocked_tags));
    fd.append('preferred_measurement_unit', customization.preferred_measurement_unit);

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
  const existingMobileHeaderUrl = generateUserMobileHeaderUrl(authData ?? undefined);
  const existingBgImageUrl = generateUserBgImageUrl(authData ?? undefined);

  const activeAvatarSrc = avatarCleared ? null : (pendingAvatarPreview ?? existingAvatarUrl);
  const activeHeaderSrc = headerCleared ? null : (pendingHeaderPreview ?? existingHeaderUrl);
  const activeMobileHeaderSrc = mobileHeaderCleared ? null : (pendingMobileHeaderPreview ?? existingMobileHeaderUrl);
  const activeBgImageSrc = bgImageCleared ? null : (pendingBgImagePreview ?? existingBgImageUrl);

  const displayName = (authData?.name?.startsWith('NewUser_') ? '' : authData?.name) || '';
  const initial = (displayName[0] ?? '?').toUpperCase();

  return (
    <GeneralLayout>
      <PageWrapper>
        <Container maxWidth="md">
          <Box sx={{ mb: 4 }}>
            <Typography variant="h5" sx={{ fontWeight: 700, letterSpacing: '-0.3px' }}>
              Edit Profile
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5 }}>
              Manage your details, appearance, and privacy. All sections save together with one button.
            </Typography>
          </Box>

          {loading ? (
            <EditSkeleton />
          ) : (
            <Box
              component="form"
              onSubmit={handleSubmit}
              sx={{
                display: 'flex',
                flexDirection: { xs: 'column', md: 'row' },
                gap: { xs: 2, md: 4 },
                alignItems: 'flex-start',
              }}
            >
              {/* ─── Section navigation ─────────────────────────────────── */}
              <Box
                sx={{
                  width: { xs: '100%', md: 220 },
                  flexShrink: 0,
                  position: { md: 'sticky' },
                  top: { md: 24 },
                }}
              >
                <Tabs
                  value={activeTab}
                  onChange={(_, v: TabKey) => setActiveTab(v)}
                  orientation={isMobile ? 'horizontal' : 'vertical'}
                  variant={isMobile ? 'scrollable' : 'standard'}
                  scrollButtons={isMobile ? 'auto' : false}
                  allowScrollButtonsMobile
                  sx={{
                    border: '1px solid',
                    borderColor: 'divider',
                    borderRadius: 3,
                    p: 0.5,
                    minHeight: 0,
                    '& .MuiTabs-indicator': { display: 'none' },
                    '& .MuiTab-root': {
                      minHeight: 44,
                      borderRadius: 2,
                      justifyContent: 'flex-start',
                      textTransform: 'none',
                      fontWeight: 600,
                      fontSize: '0.85rem',
                      color: 'text.secondary',
                      minWidth: { xs: 'auto', md: '100%' },
                      transition: 'background-color 0.15s, color 0.15s',
                      '&:hover': { backgroundColor: 'action.hover', color: 'text.primary' },
                    },
                    '& .MuiTab-root.Mui-selected': {
                      backgroundColor: alpha(theme.palette.primary.main, 0.1),
                      color: 'primary.main',
                    },
                  }}
                >
                  {TABS.map((t) => (
                    <Tab key={t.key} value={t.key} icon={t.icon} iconPosition="start" label={t.label} />
                  ))}
                </Tabs>
              </Box>

              {/* ─── Active panel ───────────────────────────────────────── */}
              <Box sx={{ flex: 1, minWidth: 0, width: '100%' }}>
                {/* ── PROFILE ── */}
                {activeTab === 'basics' && (
                  <>
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
                            Adds an Artist badge to your profile and shows a showcase of patterns you've contributed to
                            the archive.
                          </Typography>
                        </Box>
                      </Box>
                    </SectionCard>
                  </>
                )}

                {/* ── PHOTOS ── */}
                {activeTab === 'photos' && (
                  <SectionCard elevation={0}>
                    <SectionTitle>Profile Photos</SectionTitle>

                    {imageError && (
                      <Alert severity="error" sx={{ mb: 2, py: 0.5 }} onClose={() => setImageError('')}>
                        {imageError}
                      </Alert>
                    )}

                    {/* Hidden file inputs */}
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
                    <input
                      ref={mobileHeaderInputRef}
                      type="file"
                      accept="image/*"
                      style={{ display: 'none' }}
                      onChange={(e) => {
                        const f = e.target.files?.[0];
                        if (f) void handleImageSelect(f, 'mobileheader');
                      }}
                    />

                    {/* Live preview of the profile card */}
                    <HeroPreview
                      sx={{
                        backgroundImage: activeHeaderSrc
                          ? `${customization.header_gradient ? 'linear-gradient(to top, rgba(0,0,0,0.6) 0%, rgba(0,0,0,0.2) 50%, transparent 100%), ' : ''}url(${activeHeaderSrc})`
                          : undefined,
                      }}
                    >
                      {!activeHeaderSrc && <WallpaperPlaceholder />}
                      <Box
                        sx={{
                          position: 'absolute',
                          bottom: 12,
                          left: 16,
                          display: 'flex',
                          alignItems: 'center',
                          gap: 1.5,
                        }}
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
                            sx={{
                              fontSize: '0.65rem',
                              color: activeHeaderSrc ? 'rgba(255,255,255,0.6)' : 'text.disabled',
                            }}
                          >
                            Preview
                          </Typography>
                        </Box>
                      </Box>
                    </HeroPreview>

                    {/* Uniform photo cards */}
                    <Stack spacing={1.5} sx={{ mt: 2 }}>
                      <PhotoRow
                        title="Profile photo"
                        description="Square crop · max 5 MB · resized to 400×400"
                        circular
                        placeholder={<PersonRoundedIcon sx={{ fontSize: 22, color: 'text.disabled' }} />}
                        src={activeAvatarSrc}
                        processing={processingImage === 'avatar'}
                        removable={!!activeAvatarSrc && !avatarCleared}
                        onUpload={() => avatarInputRef.current?.click()}
                        onRemove={() => clearImage('avatar')}
                      />
                      <PhotoRow
                        title="Header image"
                        description="Wide landscape · max 10 MB · resized to 1920×500"
                        placeholder={<WallpaperRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                        src={activeHeaderSrc}
                        processing={processingImage === 'header'}
                        removable={!!activeHeaderSrc && !headerCleared}
                        onUpload={() => headerInputRef.current?.click()}
                        onRemove={() => clearImage('header')}
                      />
                      <PhotoRow
                        title="Mobile header"
                        description="Optional · shown on small screens · defaults to your header · 900×500"
                        placeholder={<WallpaperRoundedIcon sx={{ fontSize: 18, color: 'text.disabled' }} />}
                        src={activeMobileHeaderSrc}
                        processing={processingImage === 'mobileheader'}
                        removable={!!activeMobileHeaderSrc && !mobileHeaderCleared}
                        onUpload={() => mobileHeaderInputRef.current?.click()}
                        onRemove={() => clearImage('mobileheader')}
                      />
                    </Stack>

                    {/* Gradient overlay toggle */}
                    <FormControlLabel
                      sx={{ m: 0, mt: 2, alignItems: 'flex-start', gap: 1 }}
                      control={
                        <Switch
                          checked={customization.header_gradient}
                          onChange={(e) => setCust('header_gradient', e.target.checked)}
                          size="small"
                        />
                      }
                      label={
                        <Box>
                          <Typography variant="caption" sx={{ fontWeight: 600, display: 'block' }}>
                            Show gradient overlay on header image
                          </Typography>
                          <Typography variant="caption" color="text.disabled">
                            Adds a dark fade at the bottom of the header to keep text readable
                          </Typography>
                        </Box>
                      }
                    />
                  </SectionCard>
                )}

                {/* ── APPEARANCE ── */}
                {activeTab === 'appearance' && (
                  <>
                    <ColorsSection
                      customization={customization}
                      setCust={setCust}
                      onReset={() =>
                        resetSection([
                          'site_color',
                          'site_color_secondary',
                          'profile_dark_mode',
                          'profile_bg_type',
                          'profile_bg_color',
                          'profile_bg_gradient_end',
                          'profile_bg_gradient_angle',
                          'profile_bg_pattern',
                          'profile_bg_image_size',
                          'profile_bg_image_position',
                          'profile_bg_image_fixed',
                          'profile_card_bg',
                          'profile_header_text_color',
                        ])
                      }
                      bgImageInputRef={bgImageInputRef}
                      processingImage={processingImage}
                      activeBgImageSrc={activeBgImageSrc}
                      bgImageCleared={bgImageCleared}
                      onImageSelect={(f, type) => void handleImageSelect(f, type)}
                      onClearImage={clearImage}
                    />
                    <TypographySection
                      customization={customization}
                      setCust={setCust}
                      onReset={() =>
                        resetSection([
                          'profile_font',
                          'profile_name_effect',
                          'profile_avatar_shape',
                          'profile_cursor',
                          'profile_sparkles',
                        ])
                      }
                    />
                  </>
                )}

                {/* ── STATUS & SOCIAL ── */}
                {activeTab === 'social' && (
                  <>
                    <MoodSection
                      customization={customization}
                      setCust={setCust}
                      onReset={() => resetSection(['profile_mood_emoji', 'profile_mood_text'])}
                    />
                    <SocialSection
                      customization={customization}
                      setCust={setCust}
                      onReset={() => resetSection(['profile_youtube_url', 'social_links'])}
                    />
                  </>
                )}

                {/* ── GENERAL ── */}
                {activeTab === 'general' && (
                  <>
                    <VisibilitySection
                      customization={customization}
                      setCust={setCust}
                      onReset={() =>
                        resetSection([
                          'tab_show_favorites',
                          'tab_show_done',
                          'tab_show_ratings',
                          'tab_show_difficulty',
                          'tab_show_gallery',
                          'tab_show_collections',
                        ])
                      }
                    />
                    <BlockedTagsSection
                      customization={customization}
                      setCust={setCust}
                      onReset={() => resetSection(['blocked_tags'])}
                    />
                    <PreferredUnitsSection
                      customization={customization}
                      setCust={setCust}
                      onReset={() => resetSection(['preferred_measurement_unit'])}
                    />
                  </>
                )}

                {/* ─── Actions ─────────────────────────────────────────── */}
                {saveError && (
                  <Alert severity="error" sx={{ mb: 2, borderRadius: 2 }}>
                    {saveError}
                  </Alert>
                )}
                <Box
                  sx={{
                    position: 'sticky',
                    bottom: 16,
                    zIndex: 2,
                    mt: 1,
                    display: 'flex',
                    justifyContent: 'flex-end',
                    gap: 2,
                    p: 1.5,
                    borderRadius: 3,
                    border: '1px solid',
                    borderColor: 'divider',
                    backgroundColor: alpha(theme.palette.background.paper, 0.85),
                    backdropFilter: 'blur(8px)',
                  }}
                >
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
}));

const WallpaperPlaceholder = () => (
  <Box sx={{ position: 'absolute', top: '50%', left: '50%', transform: 'translate(-50%, -50%)', opacity: 0.25 }}>
    <WallpaperRoundedIcon sx={{ fontSize: 32, color: 'white' }} />
  </Box>
);

// ─── Photo card row ─────────────────────────────────────────────────────────--

type PhotoRowProps = {
  title: string;
  description: string;
  src: string | null;
  processing: boolean;
  removable: boolean;
  placeholder: React.ReactNode;
  onUpload: () => void;
  onRemove: () => void;
  circular?: boolean;
};

const PhotoRow = ({
  title,
  description,
  src,
  processing,
  removable,
  placeholder,
  onUpload,
  onRemove,
  circular = false,
}: PhotoRowProps) => (
  <Box
    sx={{
      display: 'flex',
      alignItems: 'center',
      gap: 2,
      p: 1.5,
      border: '1px solid',
      borderColor: 'divider',
      borderRadius: 2,
    }}
  >
    <Box
      sx={{
        width: circular ? 48 : 72,
        height: circular ? 48 : 44,
        flexShrink: 0,
        borderRadius: circular ? '50%' : 1,
        overflow: 'hidden',
        border: '1px solid',
        borderColor: 'divider',
        backgroundColor: 'action.hover',
        backgroundImage: src ? `url(${src})` : undefined,
        backgroundSize: 'cover',
        backgroundPosition: 'center',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
      }}
    >
      {!src && placeholder}
    </Box>
    <Box sx={{ flex: 1, minWidth: 0 }}>
      <Typography variant="body2" sx={{ fontWeight: 600 }}>
        {title}
      </Typography>
      <Typography variant="caption" color="text.disabled">
        {description}
      </Typography>
    </Box>
    <Button
      size="small"
      variant="outlined"
      onClick={onUpload}
      disabled={processing}
      startIcon={
        processing ? <CircularProgress size={14} color="inherit" /> : <AddPhotoAlternateOutlinedIcon fontSize="small" />
      }
    >
      {processing ? 'Processing…' : src ? 'Replace' : 'Upload'}
    </Button>
    {removable && (
      <Tooltip title={`Remove ${title.toLowerCase()}`}>
        <IconButton size="small" color="error" onClick={onRemove}>
          <DeleteOutlineRoundedIcon fontSize="small" />
        </IconButton>
      </Tooltip>
    )}
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

const EditSkeleton = () => (
  <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 4, alignItems: 'flex-start' }}>
    <Skeleton variant="rounded" sx={{ width: { xs: '100%', md: 220 }, height: 260, borderRadius: 3, flexShrink: 0 }} />
    <Box sx={{ flex: 1, width: '100%', display: 'flex', flexDirection: 'column', gap: 3 }}>
      {[140, 110, 260].map((h, i) => (
        <Paper key={i} sx={{ borderRadius: 2, border: '1px solid', borderColor: 'divider', p: 4, boxShadow: 'none' }}>
          <Skeleton variant="text" width={80} height={14} sx={{ mb: 2 }} />
          <Skeleton variant="rounded" height={h} sx={{ borderRadius: 1 }} />
        </Paper>
      ))}
    </Box>
  </Box>
);
