import React, { useState, useEffect, useMemo } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { createPrettyDate } from '@/functions/utilities/dates';
import type { TypeFavoriteDoneRatingsResponse } from '@/functions/types/types';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { PaginationBox } from '@/components/PaginationBox';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { useQueryGetUserById, getUserByIdOptions } from '@/functions/database/users';
import { queryClient } from '@/functions/database/authentication-setup';
import type { TypeAuthData } from '@/functions/database/authentication';
import type { TypeGalleryResponse } from '@/functions/database/gallery';
import { GalleryUploadDialog } from '@/components/GalleryUploadDialog';
import { GalleryEditDialog } from '@/components/GalleryEditDialog';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { CreateCollectionDialog } from '@/components/collections/CreateCollectionDialog';
import { pocketbase } from '@/functions/database/authentication-setup';
import { enqueueSnackbar } from 'notistack';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { generateSEO } from '@/functions/utilities/seo.ts';
import {
  generateUserAvatarUrl,
  generateUserHeaderUrl,
  generateUserBgImageUrl,
  generateUserMobileHeaderUrl,
} from '@/functions/utilities/generate-pb-image';
import { useQueryGetProfileData } from '@/functions/database/profile-data';
import {
  PROFILE_FONTS,
  SOCIAL_PLATFORMS,
  CURSOR_OPTIONS,
  getCssPattern,
  getBgImageCss,
  getAvatarShapeStyles,
  hexToRgba,
  extractYouTubeId,
} from '@/constants/profile-customization';

import { styled, alpha, keyframes } from '@mui/material/styles';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import StarOutlinedIcon from '@mui/icons-material/StarOutlined';
import SpeedRoundedIcon from '@mui/icons-material/SpeedRounded';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import BrushRoundedIcon from '@mui/icons-material/BrushRounded';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';

import {
  Alert,
  Button,
  CircularProgress,
  Box,
  Container,
  Typography,
  Chip,
  Paper,
  Grid,
  Tab,
  Tabs,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Skeleton,
  Tooltip,
  Rating,
  Stack,
} from '@mui/material';

// ─── Keyframes ────────────────────────────────────────────────────────────────

const nameGradientAnim = keyframes`
  from { background-position: 0% center; }
  to   { background-position: 300% center; }
`;

const shimmerAnim = keyframes`
  from { background-position: -200% center; }
  to   { background-position: 200% center; }
`;

const rainbowAnim = keyframes`
  from { filter: hue-rotate(0deg); }
  to   { filter: hue-rotate(360deg); }
`;

const sparkleAnim = keyframes`
  0%, 100% { opacity: 0; transform: scale(0.6) rotate(0deg); }
  50%       { opacity: 1; transform: scale(1.2) rotate(20deg); }
`;

// ─── Types ────────────────────────────────────────────────────────────────────

type UserSearch = {
  id?: string;
  tab: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/profile/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): UserSearch => {
    const tab = Number(search.tab);
    return {
      id: search.id as string | undefined,
      tab: Number.isFinite(tab) && tab >= 0 && tab <= 5 ? tab : 0,
    };
  },
  loaderDeps: ({ search }) => ({ id: search.id }),
  loader: ({ deps }) =>
    deps.id ? queryClient.ensureQueryData(getUserByIdOptions(deps.id)).catch(() => undefined) : undefined,
  head: ({ loaderData, match }) => {
    const rawName = loaderData?.name || '';
    const displayName = rawName.startsWith('NewUser_') ? '' : rawName;
    return generateSEO(
      displayName ? `${displayName}'s Profile` : 'Profile',
      displayName ? `See ${displayName}'s stained glass pattern collection, favorites, and activity on Pattern Archive.` : '',
      match.pathname,
    );
  },
});

function RouteComponent() {
  return (
    <GeneralLayout>
      <PageContent />
    </GeneralLayout>
  );
}

const PageContent = () => {
  const { id } = Route.useSearch();
  const { authData } = useGlobalAuthData();
  const { isPending, isError, data, refetch } = useQueryGetUserById(id);

  if (id && id !== authData?.id) {
    if (isPending) return <ProfileSkeleton />;
    if (isError) return <ProfileError />;
    return <ProfileContent userData={data} />;
  }

  return <ProfileContent />;
};

// ─── Profile Content ──────────────────────────────────────────────────────────

type ProfileContentProps = { userData?: TypeAuthData };

const ProfileContent = ({ userData }: ProfileContentProps) => {
  const { authData } = useGlobalAuthData();

  const thisAuthData = userData ?? authData;
  const isPublicView = !!userData;
  const isArtist = !!thisAuthData?.is_artist;

  const [favoritePage, setFavoritePage] = React.useState(1);
  const [donePage, setDonePage] = React.useState(1);
  const [ratingsPage, setRatingsPage] = React.useState(1);
  const [difficultyPage, setDifficultyPage] = React.useState(1);
  const [galleryPage, setGalleryPage] = React.useState(1);
  const [collectionsPage, setCollectionsPage] = React.useState(1);
  const {
    isPending,
    isError,
    data: profileData,
    refetch,
  } = useQueryGetProfileData({
    userId: thisAuthData?.id ?? '',
    favPage: favoritePage,
    donePage,
    ratingsPage,
    difficultyPage,
    galleryPage,
    collectionsPage,
    artistPage: 1,
    isOwner: !isPublicView,
    isArtist,
  });

  const dataFav = profileData?.favorites;
  const dataDone = profileData?.done;
  const dataRatings = profileData?.ratings;
  const dataDifficulty = profileData?.difficulty;
  const dataGallery = profileData?.gallery;
  const dataCols = profileData?.collections;
  const followedCols = profileData?.followedCollections ?? [];
  const artistPatterns = profileData?.artistPatterns ?? undefined;

  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<TypeGalleryResponse | null>(null);
  const [createColOpen, setCreateColOpen] = useState(false);

  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: '/profile/' });
  const setTab = (v: number) => void navigate({ search: (p) => ({ ...p, tab: v }), resetScroll: false });
  const tabSectionRef = React.useRef<HTMLDivElement>(null);

  const handleStatClick = (tabIndex: number) => {
    setTab(tabIndex);
    setTimeout(() => tabSectionRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 50);
  };

  async function handleShare() {
    const url = `https://patternarchive.net/profile?id=${thisAuthData?.id}`;
    if (navigator.maxTouchPoints > 0 && navigator.share) {
      try {
        await navigator.share({ title: `${thisAuthData?.name ?? 'Profile'} on Pattern Archive`, url });
      } catch {
        /* cancelled */
      }
      return;
    }
    try {
      await navigator.clipboard.writeText(url);
      enqueueSnackbar('Profile link copied!', { variant: 'success' });
    } catch {
      enqueueSnackbar('Unable to copy,  please copy the URL manually', { variant: 'error' });
    }
  }

  const rawName = thisAuthData?.name ?? '';
  const displayName = (rawName.startsWith('NewUser_') ? 'New User' : rawName) || 'New User';
  const initial = displayName[0]?.toUpperCase() ?? '?';
  const galleryItems = dataGallery?.items ?? [];

  const avatarUrl = generateUserAvatarUrl(thisAuthData ?? undefined);
  const headerUrl = generateUserHeaderUrl(thisAuthData ?? undefined);
  const mobileHeaderUrl = generateUserMobileHeaderUrl(thisAuthData ?? undefined);

  // ─── Customization derived values ─────────────────────────────────────────

  const siteColor = thisAuthData?.site_color || '#0b6536';
  const siteColorSecondary = thisAuthData?.site_color_secondary || '#cfe1b9';
  const bgType = thisAuthData?.profile_bg_type ?? 'solid';
  const bgColor = thisAuthData?.profile_bg_color ?? '';
  const bgGradEnd = thisAuthData?.profile_bg_gradient_end ?? '#ffffff';
  const bgAngle = thisAuthData?.profile_bg_gradient_angle ?? 135;
  const bgPattern = thisAuthData?.profile_bg_pattern ?? 'dots';
  const bgImageSize = thisAuthData?.profile_bg_image_size ?? 'cover';
  const bgImagePosition = thisAuthData?.profile_bg_image_position ?? 'center center';
  const bgImageFixed = !!thisAuthData?.profile_bg_image_fixed;
  const bgImageUrl = generateUserBgImageUrl(thisAuthData ?? undefined);
  const profileFont = PROFILE_FONTS.some((f) => f.value === thisAuthData?.profile_font)
    ? thisAuthData?.profile_font
    : null;
  const nameEffect = thisAuthData?.profile_name_effect ?? 'none';
  const avatarShape = thisAuthData?.profile_avatar_shape ?? 'circle';
  const cursorKey = thisAuthData?.profile_cursor ?? 'default';
  const sparkles = !!thisAuthData?.profile_sparkles;
  const moodEmoji = thisAuthData?.profile_mood_emoji?.slice(0, 4) ?? '';
  const moodText = thisAuthData?.profile_mood_text?.slice(0, 50) ?? '';
  const youtubeUrl = thisAuthData?.profile_youtube_url ?? '';
  const socialLinks = thisAuthData?.social_links ?? [];

  const tabVisibility = {
    0: thisAuthData?.tab_show_favorites !== false,
    1: thisAuthData?.tab_show_done !== false,
    2: thisAuthData?.tab_show_ratings !== false,
    3: thisAuthData?.tab_show_difficulty !== false,
    4: thisAuthData?.tab_show_gallery !== false,
    5: thisAuthData?.tab_show_collections !== false,
  } as Record<number, boolean>;

  const fontStack = profileFont
    ? (PROFILE_FONTS.find((f) => f.value === profileFont)?.cssStack ?? `'${profileFont}', sans-serif`)
    : undefined;

  // Apply page background
  const computedBg = useMemo((): string | undefined => {
    if (!bgType || bgType === 'solid') return bgColor || undefined;
    if (bgType === 'gradient' && bgColor) return `linear-gradient(${bgAngle}deg, ${bgColor}, ${bgGradEnd})`;
    if (bgType === 'pattern' && bgColor) return getCssPattern(bgPattern, hexToRgba(siteColor, 0.18), bgColor);
    if (bgType === 'image' && bgImageUrl) {
      const { bgSize, bgRepeat } = getBgImageCss(bgImageSize);
      const attachment = bgImageFixed ? 'fixed' : 'scroll';
      return `url(${bgImageUrl}) ${bgImagePosition} / ${bgSize} ${bgRepeat} ${attachment}`;
    }
    return undefined;
  }, [
    bgType,
    bgColor,
    bgGradEnd,
    bgAngle,
    bgPattern,
    bgImageUrl,
    bgImageSize,
    bgImagePosition,
    bgImageFixed,
    siteColor,
  ]);

  useEffect(() => {
    if (!computedBg) return;
    document.body.style.background = computedBg;
    if (bgColor) document.body.style.backgroundColor = bgColor;
    return () => {
      document.body.style.background = '';
      document.body.style.backgroundColor = '';
    };
  }, [computedBg, bgColor]);

  // Apply custom cursor
  useEffect(() => {
    const option = CURSOR_OPTIONS.find((c) => c.key === cursorKey);
    const css = option?.css ?? 'auto';
    if (css === 'auto') return;
    document.body.style.cursor = css;
    return () => {
      document.body.style.cursor = '';
    };
  }, [cursorKey]);

  // Avatar shape styles
  const avatarShapeSx = useMemo(() => getAvatarShapeStyles(avatarShape), [avatarShape]);

  // Name effect sx
  const nameEffectSx = useMemo(() => {
    switch (nameEffect) {
      case 'gradient':
        return {
          background: `linear-gradient(90deg, white 0%, ${siteColorSecondary} 40%, white 70%, ${siteColorSecondary} 100%)`,
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: `${nameGradientAnim} 5s linear infinite`,
        };
      case 'glow':
        return { textShadow: `0 0 18px ${siteColor}, 0 0 36px ${siteColor}80`, color: 'white' };
      case 'shadow':
        return { textShadow: '2px 4px 10px rgba(0,0,0,0.6)', color: 'white' };
      case 'shimmer':
        return {
          background: `linear-gradient(90deg, white 35%, ${siteColorSecondary} 50%, white 65%)`,
          backgroundSize: '300% auto',
          WebkitBackgroundClip: 'text',
          WebkitTextFillColor: 'transparent',
          backgroundClip: 'text',
          animation: `${shimmerAnim} 3s linear infinite`,
        };
      case 'rainbow':
        return { color: siteColor, animation: `${rainbowAnim} 3s linear infinite` };
      default:
        return {};
    }
  }, [nameEffect, siteColor, siteColorSecondary]);

  if (!thisAuthData) return <ProfileSkeleton />;

  const videoId = extractYouTubeId(youtubeUrl);

  const allStats = [
    { Icon: FavoriteIcon, value: dataFav?.totalItems ?? 0, label: 'Saved', color: '#ef5350', tab: 0 },
    { Icon: CheckCircleIcon, value: dataDone?.totalItems ?? 0, label: 'Completed', color: '#66bb6a', tab: 1 },
    { Icon: StarOutlinedIcon, value: dataRatings?.totalItems ?? 0, label: 'Rated', color: '#ffa726', tab: 2 },
    {
      Icon: SpeedRoundedIcon,
      value: dataDifficulty?.totalItems ?? 0,
      label: 'Difficulty Votes',
      color: '#26c6da',
      tab: 3,
    },
    { Icon: PhotoLibraryOutlinedIcon, value: dataGallery?.totalItems ?? 0, label: 'Photos', color: '#42a5f5', tab: 4 },
    { Icon: BookmarksOutlinedIcon, value: dataCols?.totalItems ?? 0, label: 'Collections', color: '#ab47bc', tab: 5 },
  ];

  // Filter stats and tabs based on visibility settings
  const stats = allStats.filter((s) => tabVisibility[s.tab]);

  const allTabConfig = [
    { label: 'Favorites', Icon: FavoriteBorderOutlinedIcon, count: dataFav?.totalItems },
    { label: 'Completed', Icon: TaskAltOutlinedIcon, count: dataDone?.totalItems },
    { label: 'Rated', Icon: StarOutlinedIcon, count: dataRatings?.totalItems },
    { label: 'Difficulty Votes', Icon: SpeedRoundedIcon, count: dataDifficulty?.totalItems },
    { label: 'Gallery', Icon: PhotoLibraryOutlinedIcon, count: dataGallery?.totalItems },
    { label: 'Collections', Icon: BookmarksOutlinedIcon, count: dataCols?.totalItems },
  ];
  const tabConfig = allTabConfig.filter((_, i) => tabVisibility[i]);

  // Map the URL tab index to visible position index
  const logicalToVisible = Object.fromEntries(
    allTabConfig
      .map((_, i) => i)
      .filter((i) => tabVisibility[i])
      .map((logicalIdx, visPos) => [logicalIdx, visPos]),
  );
  const visibleToLogical = Object.fromEntries(
    allTabConfig
      .map((_, i) => i)
      .filter((i) => tabVisibility[i])
      .map((logicalIdx, visPos) => [visPos, logicalIdx]),
  );
  const visibleTab = logicalToVisible[tab] ?? 0;
  const setVisibleTab = (visPos: number) => setTab(visibleToLogical[visPos] ?? 0);

  const shouldShowAbout = !!(thisAuthData.about || thisAuthData.interests || !isPublicView);

  // Hero background: use site_color if no header image
  const showGradient = thisAuthData?.header_gradient !== false;
  const gradientOverlay = showGradient
    ? 'linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.08) 75%, transparent 100%), '
    : '';
  const effectiveDesktopUrl = headerUrl;
  const effectiveMobileUrl = mobileHeaderUrl ?? headerUrl;
  const hasBothHeaders = !!(mobileHeaderUrl && headerUrl);

  const heroSxOverride =
    effectiveMobileUrl || effectiveDesktopUrl
      ? {
          backgroundImage: hasBothHeaders
            ? ({
                xs: `${gradientOverlay}url(${effectiveMobileUrl})`,
                md: `${gradientOverlay}url(${effectiveDesktopUrl})`,
              } as Record<string, string>)
            : `${gradientOverlay}url(${effectiveMobileUrl ?? effectiveDesktopUrl})`,
          backgroundSize: 'cover',
          backgroundPosition: 'center',
          '&::before': { display: 'none' },
          '&::after': { display: 'none' },
        }
      : {
          backgroundColor: siteColor,
          '&::before': { background: alpha(siteColor, 0.5) },
          '&::after': { background: alpha(siteColorSecondary, 0.35) },
        };

  const isDark = thisAuthData?.profile_dark_mode ?? false;
  const cardBg = thisAuthData?.profile_card_bg ?? '';

  const pageRootSx: Record<string, unknown> = {
    ...(fontStack ? { fontFamily: fontStack, '& *': { fontFamily: 'inherit !important' } } : {}),
    ...(isDark
      ? {
          color: 'rgba(255,255,255,0.92)',
          '& .MuiTypography-root': { color: 'inherit' },
          '& .MuiChip-label': { color: 'inherit' },
        }
      : {}),
  };

  return (
    <PageRoot sx={pageRootSx}>
      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <HeroSection sx={heroSxOverride}>
        {/* Top-right action buttons */}
        <Box
          sx={{
            position: 'absolute',
            top: { xs: 16, md: 24 },
            right: { xs: 16, md: 32 },
            display: 'flex',
            gap: 1,
            zIndex: 2,
          }}
        >
          <Tooltip title="Share profile">
            <Button startIcon={<ShareRoundedIcon />} onClick={handleShare} sx={heroBtn} variant="outlined">
              Share
            </Button>
          </Tooltip>

          {!isPublicView && (
            <Tooltip title="Edit profile">
              <Button
                startIcon={<EditRoundedIcon />}
                component={Link}
                to="/profile/edit"
                sx={heroBtn}
                variant="outlined"
              >
                Edit
              </Button>
            </Tooltip>
          )}
        </Box>

        {sparkles && <SparkleOverlay />}

        {/* Identity anchored to hero bottom */}
        <Box sx={{ flex: 1 }} />

        <Container
          maxWidth="lg"
          sx={{ px: { xs: 2, md: 4 }, pb: { xs: 3.5, md: 4.5 }, position: 'relative', zIndex: 1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
            <HeroAvatar
              isArtist={isArtist}
              sx={{
                ...avatarShapeSx,
                overflow: 'hidden',
                background: isArtist
                  ? `linear-gradient(135deg, ${alpha(siteColorSecondary, 0.8)}, ${siteColorSecondary})`
                  : `linear-gradient(135deg, ${alpha(siteColor, 0.7)}, ${siteColor})`,
              }}
            >
              {avatarUrl ? (
                <Box
                  component="img"
                  src={avatarUrl}
                  alt={displayName}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', ...avatarShapeSx }}
                />
              ) : (
                <Typography
                  sx={{ fontSize: { xs: '1.75rem', md: '2.25rem' }, fontWeight: 700, color: 'white', lineHeight: 1 }}
                >
                  {initial}
                </Typography>
              )}
            </HeroAvatar>

            <Box sx={{ pb: 0.5, minWidth: 0 }}>
              {isArtist && (
                <Box
                  sx={{
                    display: 'inline-flex',
                    alignItems: 'center',
                    gap: 0.5,
                    mb: 1,
                    px: 1.25,
                    py: 0.375,
                    borderRadius: 10,
                    border: '1px solid rgba(255,255,255,0.3)',
                    backgroundColor: 'rgba(255,255,255,0.12)',
                  }}
                >
                  <BrushRoundedIcon sx={{ fontSize: 13, color: 'white' }} />
                  <Typography sx={{ fontSize: '0.7rem', fontWeight: 700, color: 'white', lineHeight: 1 }}>
                    Artist
                  </Typography>
                </Box>
              )}

              <Typography
                sx={{
                  fontSize: { xs: '1.75rem', sm: '2.25rem', md: '2.875rem' },
                  fontWeight: 800,
                  color: 'white',
                  letterSpacing: '-0.5px',
                  lineHeight: 1.05,
                  mb: 0.75,
                  wordBreak: 'break-word',
                  ...nameEffectSx,
                }}
              >
                {displayName}
              </Typography>

              {(moodEmoji || moodText) && (
                <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mb: 0.75 }}>
                  {moodEmoji && <Typography sx={{ fontSize: '1rem', lineHeight: 1 }}>{moodEmoji}</Typography>}
                  {moodText && (
                    <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.75)', fontStyle: 'italic' }}>
                      {moodText}
                    </Typography>
                  )}
                </Box>
              )}

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 12, color: 'rgba(255,255,255,0.45)' }} />
                <Typography sx={{ fontSize: '0.8rem', color: 'rgba(255,255,255,0.45)' }}>
                  Member since {createPrettyDate(thisAuthData.created ?? '')}
                </Typography>
              </Box>
            </Box>
          </Box>
        </Container>
      </HeroSection>

      {/* ─── STAT BAR ─────────────────────────────────────────────────────── */}
      <Box
        sx={{
          borderBottom: '1px solid',
          borderColor: isDark ? 'rgba(255,255,255,0.08)' : 'divider',
          backgroundColor: isDark ? '#1c1c1e' : 'background.paper',
        }}
      >
        <Container maxWidth="lg" sx={{ px: { xs: 0, md: 4 } }}>
          <Grid container sx={{ justifyContent: 'center' }}>
            {stats.map((stat, i) => (
              <Grid
                size={{ xs: 4, md: 2 }}
                key={stat.label}
                sx={{ borderRight: i < stats.length - 1 ? '1px solid' : 'none', borderColor: 'divider' }}
              >
                <Box
                  component="button"
                  onClick={() => handleStatClick(stat.tab)}
                  sx={{
                    width: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: { xs: 2.5, md: 3 },
                    gap: 0.75,
                    background: 'none',
                    border: 'none',
                    cursor: 'pointer',
                    transition: 'background-color 0.15s',
                    color: isDark ? 'rgba(255,255,255,0.92)' : 'text.primary',
                    '&:hover': { backgroundColor: 'action.hover' },
                  }}
                >
                  <Typography
                    sx={{
                      fontSize: { xs: '1.375rem', sm: '1.75rem', md: '2.25rem' },
                      fontWeight: 800,
                      lineHeight: 1,
                      fontVariantNumeric: 'tabular-nums',
                    }}
                  >
                    {stat.value}
                  </Typography>

                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5 }}>
                    <stat.Icon sx={{ fontSize: 14, color: stat.color, opacity: 0.9 }} />
                    <Typography
                      sx={{
                        fontSize: '0.7rem',
                        color: isDark ? 'rgba(255,255,255,0.45)' : 'text.disabled',
                        fontWeight: 500,
                      }}
                    >
                      {stat.label}
                    </Typography>
                  </Box>
                </Box>
              </Grid>
            ))}
          </Grid>
        </Container>
      </Box>

      {/* ─── ABOUT ────────────────────────────────────────────────────────── */}
      {shouldShowAbout && (
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
          <Box sx={{ pt: 5, pb: 5 }}>
            <OverlineLabel>About</OverlineLabel>

            <Box sx={{ mt: 2 }}>
              {thisAuthData.about ? (
                <AboutBody>
                  <MarkdownWrapper
                    sx={
                      isDark
                        ? {
                            color: 'rgba(255,255,255,0.75)',
                            '& h1, & h2, & h3, & h4, & h5, & h6': { color: 'rgba(255,255,255,0.92)' },
                            '& td': { color: 'rgba(255,255,255,0.75)' },
                            '& th': { color: 'rgba(255,255,255,0.92)' },
                            '& del': { color: 'rgba(255,255,255,0.38)' },
                            '& dt': { color: 'rgba(255,255,255,0.92)' },
                          }
                        : undefined
                    }
                  >
                    {thisAuthData.about}
                  </MarkdownWrapper>
                </AboutBody>
              ) : !isPublicView ? (
                <Typography color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '1rem' }}>
                  <Box
                    component={Link}
                    to="/profile/edit"
                    sx={{ color: siteColor, textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                  >
                    Add a bio
                  </Box>{' '}
                  to tell the community about yourself and your stained glass journey.
                </Typography>
              ) : (
                <Typography color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '1rem' }}>
                  No bio yet.
                </Typography>
              )}
            </Box>

            {thisAuthData.interests && thisAuthData.interests.length > 0 && (
              <Box sx={{ mt: 4 }}>
                <OverlineLabel>Interests</OverlineLabel>
                <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75, mt: 1.5 }}>
                  {thisAuthData.interests.split(',').map((interest, idx) => {
                    const tag = interest.trim();
                    return (
                      <Chip
                        key={tag + idx}
                        label={tag}
                        size="small"
                        variant="outlined"
                        sx={{
                          borderRadius: 2,
                          fontWeight: 500,
                          borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'divider',
                          color: isDark ? 'rgba(255,255,255,0.6)' : 'text.secondary',
                        }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}

            {/* Social links */}
            {socialLinks.length > 0 && <ProfileSocialLinks links={socialLinks} />}
          </Box>
        </Container>
      )}

      {/* ─── ARTIST SHOWCASE ──────────────────────────────────────────────── */}
      {isArtist && (
        <>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />

          <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
            <Box sx={{ pt: 5, pb: 5 }}>
              <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 2, mb: 4 }}>
                <Box>
                  <OverlineLabel>Contributed Patterns</OverlineLabel>
                  <Typography variant="h5" sx={{ fontWeight: 800, mt: 0.5, letterSpacing: '-0.3px' }}>
                    {displayName}'s latest work
                  </Typography>
                </Box>

                {artistPatterns?.totalItems != null && artistPatterns.totalItems > 0 && (
                  <Chip
                    label={`${artistPatterns.totalItems} pattern${artistPatterns.totalItems !== 1 ? 's' : ''}`}
                    size="small"
                    sx={{
                      fontWeight: 700,
                      mt: 0.5,
                      flexShrink: 0,
                      backgroundColor: alpha(siteColorSecondary, 0.18),
                      color: siteColor,
                      border: `1px solid ${alpha(siteColorSecondary, 0.5)}`,
                    }}
                  />
                )}
              </Box>

              <ArtistPatternGrid
                patterns={artistPatterns?.items}
                isPending={isPending}
                isError={isError}
                displayName={displayName}
                cardBg={cardBg}
                isDark={isDark}
              />

              {(artistPatterns?.totalItems ?? 0) > 0 && (
                <Box
                  component={Link as any}
                  to="/"
                  search={{ authors: [displayName] }}
                  sx={{
                    color: isDark ? 'rgba(255,255,255,0.92)' : 'text.primary',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    textAlign: 'center',
                    mt: 3,
                    p: { xs: 3, md: 4 },
                    borderRadius: 4,
                    background: `linear-gradient(135deg, ${alpha(siteColor, 0.75)} 0%, ${siteColor} 60%, ${siteColorSecondary} 100%)`,
                    textDecoration: 'none',
                    boxShadow: `0 8px 32px ${alpha(siteColor, 0.35)}`,
                    transition: 'transform 0.18s ease, box-shadow 0.18s ease',
                    '&:hover': {
                      transform: 'translateY(-3px)',
                      boxShadow: `0 14px 40px ${alpha(siteColor, 0.45)}`,
                    },
                  }}
                >
                  <Box>
                    <Typography
                      sx={{
                        fontSize: { xs: '1.25rem', md: '1.5rem' },
                        fontWeight: 800,
                        color: 'white',
                        letterSpacing: '-0.3px',
                        lineHeight: 1.2,
                      }}
                    >
                      View all of {displayName}'s work →
                    </Typography>
                  </Box>
                </Box>
              )}
            </Box>
          </Container>
        </>
      )}

      {/* ─── YOUTUBE ──────────────────────────────────────────────────────── */}
      {videoId && (
        <>
          <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }} />
          <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
            <Box sx={{ pt: 5, pb: 5 }}>
              <OverlineLabel sx={{ mb: 2 }}>Featured Video</OverlineLabel>
              <Box sx={{ maxWidth: 560 }}>
                <Box
                  component="iframe"
                  src={`https://www.youtube-nocookie.com/embed/${videoId}`}
                  allow="accelerometer; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                  loading="lazy"
                  title={`${displayName}'s featured video`}
                  sx={{ width: '100%', aspectRatio: '16/9', border: 0, borderRadius: 3, display: 'block' }}
                />
              </Box>
            </Box>
          </Container>
        </>
      )}

      {/* ─── ACTIVITY ─────────────────────────────────────────────────────── */}
      <Box ref={tabSectionRef} sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
          <Box sx={{ pt: 4, pb: 10 }}>
            <OverlineLabel sx={{ mb: 3 }}>Activity</OverlineLabel>

            {tabConfig.length === 0 && (
              <Typography color="text.disabled" sx={{ fontStyle: 'italic', py: 6, textAlign: 'center' }}>
                No activity sections are visible on this profile.
              </Typography>
            )}
            {tabConfig.length > 0 && (
              <Tabs
                value={visibleTab}
                onChange={(_, v) => setVisibleTab(v)}
                variant="scrollable"
                scrollButtons="auto"
                sx={{
                  mb: 4,
                  minHeight: 'unset',
                  '& .MuiTabs-indicator': { display: 'none' },
                  '& .MuiTabs-list': { gap: 1 },
                  '& .MuiTab-root': {
                    borderRadius: '20px',
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.15)' : 'divider',
                    minHeight: 38,
                    px: 2,
                    py: 0,
                    textTransform: 'none',
                    fontWeight: 600,
                    fontSize: '0.875rem',
                    color: isDark ? 'rgba(255,255,255,0.6)' : 'text.secondary',
                    transition: 'all 0.15s ease',
                    '&.Mui-selected': {
                      backgroundColor: siteColor,
                      color: 'white',
                      borderColor: siteColor,
                    },
                  },
                }}
              >
                {tabConfig.map((t) => (
                  <Tab
                    key={t.label}
                    label={
                      <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                        <t.Icon sx={{ fontSize: 16 }} />
                        <span>{t.label}</span>
                        {(t.count ?? 0) > 0 && <TabCount accentColor={siteColor}>{t.count}</TabCount>}
                      </Box>
                    }
                  />
                ))}
              </Tabs>
            )}

            {/* Favorites */}
            {visibleTab === logicalToVisible[0] && tabVisibility[0] && (
              <>
                <ActivityPatternGrid
                  patterns={dataFav?.items}
                  isPending={isPending}
                  isError={isError}
                  emptyMessage="No favorited patterns yet."
                  emptyIcon={<FavoriteBorderOutlinedIcon />}
                  cardBg={cardBg}
                  isDark={isDark}
                />
                {dataFav && dataFav.totalItems > 0 && (
                  <PaginationBox data={dataFav} value={favoritePage} setter={setFavoritePage} isDark={isDark} />
                )}
              </>
            )}

            {/* Completed */}
            {visibleTab === logicalToVisible[1] && tabVisibility[1] && (
              <>
                <ActivityPatternGrid
                  patterns={dataDone?.items}
                  isPending={isPending}
                  isError={isError}
                  emptyMessage="No completed patterns yet."
                  emptyIcon={<TaskAltOutlinedIcon />}
                  showCompleted
                  cardBg={cardBg}
                  isDark={isDark}
                />
                {dataDone && dataDone.totalItems > 0 && (
                  <PaginationBox data={dataDone} value={donePage} setter={setDonePage} isDark={isDark} />
                )}
              </>
            )}

            {/* Rated */}
            {visibleTab === logicalToVisible[2] && tabVisibility[2] && (
              <>
                <ActivityPatternGrid
                  patterns={dataRatings?.items}
                  isPending={isPending}
                  isError={isError}
                  emptyMessage="No rated patterns yet."
                  emptyIcon={<StarOutlinedIcon />}
                  showRating
                  cardBg={cardBg}
                  isDark={isDark}
                />
                {dataRatings && dataRatings.totalItems > 0 && (
                  <PaginationBox data={dataRatings} value={ratingsPage} setter={setRatingsPage} isDark={isDark} />
                )}
              </>
            )}

            {/* Difficulty Votes */}
            {visibleTab === logicalToVisible[3] && tabVisibility[3] && (
              <>
                <ActivityPatternGrid
                  patterns={dataDifficulty?.items}
                  isPending={isPending}
                  isError={isError}
                  emptyMessage="No difficulty votes yet."
                  emptyIcon={<SpeedRoundedIcon />}
                  showDifficulty
                  cardBg={cardBg}
                  isDark={isDark}
                />
                {dataDifficulty && dataDifficulty.totalItems > 0 && (
                  <PaginationBox
                    data={dataDifficulty}
                    value={difficultyPage}
                    setter={setDifficultyPage}
                    isDark={isDark}
                  />
                )}
              </>
            )}

            {/* Gallery */}
            {visibleTab === logicalToVisible[4] && tabVisibility[4] && (
              <Box>
                {!isPublicView && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <Button
                      startIcon={<AddPhotoAlternateOutlinedIcon />}
                      variant="contained"
                      onClick={() => setUploadOpen(true)}
                      sx={{ backgroundColor: siteColor, '&:hover': { backgroundColor: alpha(siteColor, 0.85) } }}
                    >
                      Upload Photo
                    </Button>
                  </Box>
                )}
                {isPending ? (
                  <Centered>
                    <CircularProgress />
                  </Centered>
                ) : isError ? (
                  <Alert severity="error">Unable to load gallery photos.</Alert>
                ) : galleryItems.length === 0 ? (
                  <EmptyState icon={<PhotoLibraryOutlinedIcon />} message="No gallery photos yet." />
                ) : (
                  <>
                    <GalleryGrid photos={galleryItems} onPhotoClick={setLightboxPhoto} />
                    <PaginationBox data={dataGallery} value={galleryPage} setter={setGalleryPage} isDark={isDark} />
                  </>
                )}
              </Box>
            )}

            {/* Collections */}
            {visibleTab === logicalToVisible[5] && tabVisibility[5] && (
              <Box>
                {!isPublicView && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <Button
                      startIcon={<BookmarksOutlinedIcon />}
                      variant="contained"
                      onClick={() => setCreateColOpen(true)}
                      sx={{ backgroundColor: siteColor, '&:hover': { backgroundColor: alpha(siteColor, 0.85) } }}
                    >
                      New Collection
                    </Button>
                  </Box>
                )}
                {isPending ? (
                  <Centered>
                    <CircularProgress />
                  </Centered>
                ) : isError ? (
                  <Alert severity="error">Unable to load collections.</Alert>
                ) : !dataCols?.items.length ? (
                  <EmptyState
                    icon={<BookmarksOutlinedIcon />}
                    message={isPublicView ? 'No collections yet.' : 'No collections yet. Create one to get started!'}
                  />
                ) : (
                  <>
                    <Grid container spacing={2} sx={{ mb: 2 }}>
                      {dataCols.items.map((col) => (
                        <Grid key={col.id} size={{ xs: 12, sm: 6, md: 4 }}>
                          <CollectionCard
                            collection={col}
                            isOwner={!isPublicView}
                            onDeleted={() => void refetch()}
                            onEdited={() => void refetch()}
                            cardBg={cardBg}
                            isDark={isDark}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    {dataCols.totalItems > 0 && (
                      <PaginationBox
                        data={dataCols}
                        value={collectionsPage}
                        setter={setCollectionsPage}
                        isDark={isDark}
                      />
                    )}
                  </>
                )}

                {!isPublicView && followedCols.length > 0 && (
                  <>
                    <Divider sx={{ my: 4 }} />
                    <Typography
                      variant="subtitle2"
                      color="text.secondary"
                      sx={{
                        fontWeight: 700,
                        mb: 2,
                        textTransform: 'uppercase',
                        fontSize: '0.7rem',
                        letterSpacing: '0.08em',
                      }}
                    >
                      Collections You Follow
                    </Typography>
                    <Grid container spacing={2}>
                      {followedCols.map((followRecord) => {
                        const col = followRecord.expand?.collection_id;
                        if (!col) return null;
                        const hasUpdate = new Date(col.updated) > new Date(followRecord.last_checked_updated);
                        return (
                          <Grid key={followRecord.id} size={{ xs: 12, sm: 6, md: 4 }}>
                            <CollectionCard
                              collection={col}
                              isOwner={false}
                              hasUpdate={hasUpdate}
                              cardBg={cardBg}
                              isDark={isDark}
                            />
                          </Grid>
                        );
                      })}
                    </Grid>
                  </>
                )}
              </Box>
            )}
          </Box>
        </Container>
      </Box>

      {/* ─── Dialogs ─────────────────────────────────────────────────────── */}
      <CreateCollectionDialog
        open={createColOpen}
        onClose={() => setCreateColOpen(false)}
        onSuccess={() => {
          void refetch();
          setCreateColOpen(false);
        }}
      />
      <GalleryLightbox
        photo={lightboxPhoto}
        photos={galleryItems}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={setLightboxPhoto}
        onDeleteSuccess={() => {
          void refetch();
          setLightboxPhoto(null);
        }}
        onEditSuccess={() => {
          void refetch();
          setLightboxPhoto(null);
        }}
        isOwner={!isPublicView}
        isDark={isDark}
      />
      <GalleryUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          void refetch();
          setUploadOpen(false);
        }}
      />
    </PageRoot>
  );
};

// ─── Artist Pattern Grid ──────────────────────────────────────────────────────

type ArtistPatternGridProps = {
  patterns?: TypePatternResponse[];
  isPending: boolean;
  isError: boolean;
  displayName: string;
  cardBg?: string;
  isDark?: boolean;
};

const ArtistPatternGrid = ({ patterns, isPending, isError, displayName, cardBg, isDark }: ArtistPatternGridProps) => {
  if (isPending) {
    return (
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {Array.from({ length: 8 }).map((_, i) => (
          <Grid size={{ xs: 6, sm: 4, md: 3 }} key={i}>
            <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: 3 }} />
            <Skeleton variant="text" width="65%" sx={{ mt: 1 }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (isError)
    return (
      <Alert severity="error" sx={{ mb: 2 }}>
        Unable to load patterns.
      </Alert>
    );

  if (!patterns?.length) {
    return <EmptyState icon={<BrushRoundedIcon />} message={`${displayName} hasn't contributed any patterns yet.`} />;
  }

  const cardSx = {
    backgroundColor: cardBg || (isDark ? '#242424' : undefined),
    ...(isDark
      ? {
          borderColor: 'rgba(255,255,255,0.08)',
          '& .MuiTypography-root': { color: 'rgba(255,255,255,0.85) !important' },
        }
      : {}),
  };

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {patterns.map((pattern) => (
        <Grid size={{ xs: 6, sm: 4, md: 3 }} key={pattern.id}>
          <Link
            to="/"
            search={{ patternId: pattern.id, authors: [displayName] }}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <PatternCard sx={cardSx}>
              <Box sx={{ p: 1.5, pb: 0 }}>
                <Box
                  component="img"
                  loading="lazy"
                  src={generatePbImage(pattern)}
                  alt={pattern.name}
                  sx={{ width: '100%', aspectRatio: '1/1', display: 'block', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ p: 1.5, pt: 1 }}>
                <Typography variant="body2" noWrap sx={{ fontWeight: 700, fontSize: '0.8rem' }}>
                  {pattern.name}
                </Typography>
                {pattern.pieces > 0 && (
                  <Typography variant="caption" color="text.disabled">
                    {pattern.pieces} pcs
                  </Typography>
                )}
              </Box>
            </PatternCard>
          </Link>
        </Grid>
      ))}
    </Grid>
  );
};

// ─── Activity Pattern Grid ────────────────────────────────────────────────────

type ActivityPatternGridProps = {
  patterns?: TypeFavoriteDoneRatingsResponse[];
  emptyMessage: string;
  emptyIcon: React.ReactNode;
  isPending: boolean;
  isError: boolean;
  showRating?: boolean;
  showCompleted?: boolean;
  showDifficulty?: boolean;
  cardBg?: string;
  isDark?: boolean;
};

const ActivityPatternGrid = (props: ActivityPatternGridProps) => {
  if (props.isPending)
    return (
      <Centered>
        <CircularProgress />
      </Centered>
    );
  if (props.isError) return <Alert severity="error">Unable to load your list 😔</Alert>;
  if (!props.patterns?.length) return <EmptyState icon={props.emptyIcon} message={props.emptyMessage} />;

  const cardSx = {
    backgroundColor: props.cardBg || (props.isDark ? '#242424' : undefined),
    ...(props.isDark
      ? {
          borderColor: 'rgba(255,255,255,0.08)',
          '& .MuiTypography-root': { color: 'rgba(255,255,255,0.85) !important' },
        }
      : {}),
  };

  return (
    <Grid container spacing={2} sx={{ mb: 2.5 }}>
      {props.patterns.map((item) => (
        <Grid size={{ xs: 6, sm: 6, md: 3 }} key={item.id}>
          <Link
            to="/"
            search={{ id: [item.pattern_id], patternId: item.pattern_id }}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <PatternCard sx={cardSx}>
              <Box sx={{ p: 2, pb: 0 }}>
                <Box
                  component="img"
                  loading="lazy"
                  src={generatePbImage(item.expand.pattern_id)}
                  alt={item.expand?.pattern_id?.name}
                  sx={{ width: '100%', aspectRatio: '1/1', display: 'block', objectFit: 'contain' }}
                />
              </Box>
              <Box sx={{ px: 2, pb: 2, pt: 1 }}>
                <Typography variant="subtitle2" noWrap sx={{ fontWeight: 700 }}>
                  {item.expand?.pattern_id?.name}
                </Typography>
                {props.showCompleted && (
                  <Typography variant="caption" color="text.disabled">
                    {createPrettyDate(item.created!)}
                  </Typography>
                )}
                {props.showRating && <Rating value={item.rating} readOnly size="small" />}
                {props.showDifficulty &&
                  (() => {
                    const r = item.rating;
                    const chip =
                      r <= 1
                        ? { label: 'Beginner', color: 'success' as const }
                        : r <= 2
                          ? { label: 'Easy', color: 'success' as const }
                          : r <= 3
                            ? { label: 'Intermediate', color: 'warning' as const }
                            : r <= 4
                              ? { label: 'Hard', color: 'warning' as const }
                              : { label: 'Expert', color: 'error' as const };
                    return (
                      <Chip
                        size="small"
                        label={chip.label}
                        color={chip.color}
                        sx={{ mt: 0.5, fontSize: '0.7rem', height: 20 }}
                      />
                    );
                  })()}
              </Box>
            </PatternCard>
          </Link>
        </Grid>
      ))}
    </Grid>
  );
};

// ─── Gallery ──────────────────────────────────────────────────────────────────

type GalleryGridProps = { photos: TypeGalleryResponse[]; onPhotoClick: (p: TypeGalleryResponse) => void };

const GalleryGrid = ({ photos, onPhotoClick }: GalleryGridProps) => (
  <Grid container spacing={1.5} sx={{ mb: 2 }}>
    {photos.map((photo) => (
      <Grid size={{ xs: 6, sm: 4 }} key={photo.id}>
        <Box
          onClick={() => onPhotoClick(photo)}
          sx={{
            position: 'relative',
            aspectRatio: '1/1',
            borderRadius: 3,
            overflow: 'hidden',
            cursor: 'pointer',
            backgroundColor: 'action.hover',
            '&:hover img': { transform: 'scale(1.06)' },
            '&:hover .overlay': { opacity: 1 },
          }}
        >
          <Box
            component="img"
            src={`${photo.src}?tr=w-500,h-500,f-auto,q-80`}
            alt={photo.title}
            loading="lazy"
            sx={{
              width: '100%',
              height: '100%',
              objectFit: 'contain',
              display: 'block',
              transition: 'transform 0.3s ease',
            }}
          />
          <Box
            className="overlay"
            sx={{
              position: 'absolute',
              inset: 0,
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 55%)',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              display: 'flex',
              alignItems: 'flex-end',
              p: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" color="white" noWrap sx={{ fontWeight: 600, display: 'block' }}>
                {photo.title}
              </Typography>
              {photo.expand?.pattern_id?.name && (
                <Typography variant="caption" noWrap sx={{ color: 'rgba(255,255,255,0.7)', display: 'block' }}>
                  {photo.expand.pattern_id.name}
                </Typography>
              )}
            </Box>
          </Box>
        </Box>
      </Grid>
    ))}
  </Grid>
);

// ─── Gallery Lightbox ─────────────────────────────────────────────────────────

type GalleryLightboxProps = {
  photo: TypeGalleryResponse | null;
  photos: TypeGalleryResponse[];
  onClose: () => void;
  onNavigate: (p: TypeGalleryResponse) => void;
  onDeleteSuccess: () => void;
  onEditSuccess: () => void;
  isOwner: boolean;
  isDark?: boolean;
};

const GalleryLightbox = ({
  photo,
  photos,
  onClose,
  onNavigate,
  onDeleteSuccess,
  onEditSuccess,
  isOwner,
  isDark,
}: GalleryLightboxProps) => {
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');
  const [editOpen, setEditOpen] = useState(false);

  const idx = photo ? photos.findIndex((p) => p.id === photo.id) : -1;
  const hasPrev = idx > 0;
  const hasNext = idx >= 0 && idx < photos.length - 1;

  React.useEffect(() => {
    setDeleteError('');
  }, [photo?.id]);

  React.useEffect(() => {
    if (!photo) return;
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(photos[idx - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(photos[idx + 1]);
    };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [photo, idx, hasPrev, hasNext, onNavigate, photos]);

  async function handleDelete() {
    if (!photo) return;

    const confirmDelete = confirm('Are you sure you want to delete this photo?');

    if (!confirmDelete) return;

    setDeleting(true);
    setDeleteError('');
    try {
      const res = await fetch('/api/delete-gallery', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ recordId: photo.id, authToken: pocketbase.authStore.token }),
      });
      const data = (await res.json()) as { error?: string };
      if (!res.ok) {
        setDeleteError(data.error ?? 'Delete failed.');
        return;
      }
      enqueueSnackbar('Photo deleted.', { variant: 'success' });
      onDeleteSuccess();
    } catch {
      setDeleteError('Something went wrong - please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const patternExpand = photo?.expand?.pattern_id;

  return (
    <Dialog
      open={!!photo}
      onClose={onClose}
      maxWidth="lg"
      fullWidth
      sx={{
        '& .MuiDialog-paper': {
          borderRadius: 6,
          ...(isDark ? { backgroundColor: '#1e1e1e' } : {}),
        },
      }}
    >
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 400 }}>
        <Box
          sx={{
            position: 'relative',
            flex: '0 0 auto',
            width: { xs: '100%', md: '60%' },
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: { xs: 240, md: 400 },
            p: 1.5,
          }}
        >
          {photo && (
            <Box
              component="img"
              loading="lazy"
              src={`${photo.src}?tr=w-900,f-auto,q-80`}
              alt={photo.title}
              sx={{ width: '100%', height: '100%', objectFit: 'contain', borderRadius: 5 }}
            />
          )}
          {hasPrev && (
            <IconButton
              onClick={() => onNavigate(photos[idx - 1])}
              sx={{
                position: 'absolute',
                left: 3,
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
              }}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
          )}
          {hasNext && (
            <IconButton
              onClick={() => onNavigate(photos[idx + 1])}
              sx={{
                position: 'absolute',
                right: 3,
                backgroundColor: 'rgba(0,0,0,0.6)',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.8)' },
              }}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          )}
        </Box>

        <Box
          sx={{
            flex: 1,
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
            minWidth: 0,
            ...(isDark ? { '& .MuiTypography-root': { color: 'rgba(255,255,255,0.85) !important' } } : {}),
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
              {photo?.title}
            </Typography>
            <IconButton
              onClick={onClose}
              size="small"
              sx={{ flexShrink: 0, ...(isDark ? { color: 'rgba(255,255,255,0.6)' } : {}) }}
            >
              <CloseRoundedIcon fontSize="small" />
            </IconButton>
          </Box>
          {photo?.description && (
            <Typography variant="body2" color="text.secondary" sx={{ whiteSpace: 'pre-wrap' }}>
              {photo.description}
            </Typography>
          )}
          {patternExpand && (
            <Box>
              <Typography variant="caption" color="text.disabled" gutterBottom sx={{ display: 'block' }}>
                Tagged pattern
              </Typography>
              <Link
                to="/"
                search={{ id: [patternExpand.id], patternId: patternExpand.id }}
                onClick={onClose}
                style={{ textDecoration: 'none' }}
              >
                <Box
                  sx={{
                    display: 'flex',
                    gap: 1.5,
                    p: 1,
                    border: '1px solid',
                    borderColor: isDark ? 'rgba(255,255,255,0.1)' : 'divider',
                    borderRadius: 2,
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': {
                      borderColor: 'primary.main',
                      backgroundColor: isDark ? 'rgba(255,255,255,0.06)' : 'action.hover',
                    },
                  }}
                >
                  <Box
                    component="img"
                    src={generatePbImage(patternExpand)}
                    alt={patternExpand.name}
                    sx={{ width: 56, height: 56, objectFit: 'contain', flexShrink: 0, borderRadius: 1 }}
                  />
                  <Box sx={{ minWidth: 0 }}>
                    <Typography variant="body2" noWrap sx={{ fontWeight: 600, color: 'text.primary' }}>
                      {patternExpand.name}
                    </Typography>
                    {patternExpand.description && (
                      <Typography
                        variant="caption"
                        color="text.secondary"
                        sx={{
                          display: '-webkit-box',
                          WebkitLineClamp: 2,
                          WebkitBoxOrient: 'vertical',
                          overflow: 'hidden',
                        }}
                      >
                        {patternExpand.description}
                      </Typography>
                    )}
                  </Box>
                </Box>
              </Link>
            </Box>
          )}
          <Typography variant="caption" color="text.disabled">
            {photo ? createPrettyDate(String(photo.created)) : ''}
          </Typography>
          <Box sx={{ flex: 1 }} />
          {deleteError && (
            <Alert severity="error" sx={{ py: 0.5 }}>
              {deleteError}
            </Alert>
          )}
          {isOwner && (
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap', justifyContent: 'space-between' }}>
              <Button
                variant="outlined"
                size="small"
                onClick={() => setEditOpen(true)}
                startIcon={<EditRoundedIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                Edit photo
              </Button>

              <Button
                variant="outlined"
                color="error"
                size="small"
                onClick={handleDelete}
                disabled={deleting}
                startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlinedIcon />}
                sx={{ alignSelf: 'flex-start' }}
              >
                {deleting ? 'Deleting…' : 'Delete photo'}
              </Button>
            </Box>
          )}
        </Box>
      </DialogContent>

      {photo && (
        <GalleryEditDialog
          open={editOpen}
          onClose={() => setEditOpen(false)}
          onSuccess={() => {
            setEditOpen(false);
            onEditSuccess();
          }}
          photo={photo}
        />
      )}
    </Dialog>
  );
};

// ─── SparkleOverlay ───────────────────────────────────────────────────────────

const SPARKLE_POSITIONS = [
  { x: 8, y: 15, s: 10, d: 0 },
  { x: 20, y: 55, s: 7, d: 0.6 },
  { x: 35, y: 20, s: 12, d: 1.2 },
  { x: 55, y: 70, s: 8, d: 0.3 },
  { x: 68, y: 30, s: 11, d: 0.9 },
  { x: 80, y: 60, s: 9, d: 1.5 },
  { x: 90, y: 18, s: 7, d: 0.5 },
  { x: 45, y: 82, s: 10, d: 1.1 },
];

const SparkleOverlay = () => (
  <Box sx={{ position: 'absolute', inset: 0, overflow: 'hidden', pointerEvents: 'none', zIndex: 0 }}>
    {SPARKLE_POSITIONS.map((sp, i) => (
      <Box
        key={i}
        sx={{
          position: 'absolute',
          left: `${sp.x}%`,
          top: `${sp.y}%`,
          fontSize: sp.s,
          color: 'rgba(255,255,255,0.8)',
          animation: `${sparkleAnim} ${2 + sp.d}s ease-in-out ${sp.d}s infinite`,
          userSelect: 'none',
          lineHeight: 1,
        }}
      >
        ✦
      </Box>
    ))}
  </Box>
);

// ─── ProfileSocialLinks ───────────────────────────────────────────────────────

const ProfileSocialLinks = ({ links }: { links: Array<{ platform: string; url: string }> }) => {
  if (!links.length) return null;
  return (
    <Box sx={{ mt: 4 }}>
      <OverlineLabel>Socials</OverlineLabel>
      <Stack direction="row" sx={{ mt: 1.5, flexWrap: 'wrap', gap: 1 }}>
        {links.map((link, i) => {
          const platform = SOCIAL_PLATFORMS.find((p) => p.key === link.platform);
          if (!platform || !link.url.startsWith('https://')) return null;
          return (
            <Chip
              key={i}
              component="a"
              href={link.url}
              target="_blank"
              rel="noopener noreferrer"
              label={platform.label}
              size="small"
              clickable
              sx={{
                borderRadius: 2,
                fontWeight: 600,
                backgroundColor: platform.color + '18',
                color: platform.color,
                border: `1px solid ${platform.color}40`,
                '&:hover': { backgroundColor: platform.color + '30' },
              }}
            />
          );
        })}
      </Stack>
    </Box>
  );
};

// ─── Utility components ───────────────────────────────────────────────────────

const Centered = ({ children }: { children: React.ReactNode }) => (
  <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>{children}</Box>
);

const EmptyState = ({ icon, message }: { icon: React.ReactNode; message: string }) => (
  <Box
    sx={{
      textAlign: 'center',
      py: 10,
      color: 'text.disabled',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 1.5,
    }}
  >
    <Box sx={{ fontSize: 48, lineHeight: 1, opacity: 0.3 }}>{icon}</Box>
    <Typography variant="body2">{message}</Typography>
  </Box>
);

const OverlineLabel = styled(Typography)(({ theme }) => ({
  fontSize: '0.65rem',
  fontWeight: 700,
  letterSpacing: '0.12em',
  textTransform: 'uppercase',
  color: theme.palette.text.disabled,
}));

// ─── Styled components ────────────────────────────────────────────────────────

const PageRoot = styled(Box)({});

const HeroSection = styled(Box)(({ theme }) => ({
  minHeight: 320,
  position: 'relative',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
  backgroundColor: theme.palette.primary.dark,
  // Decorative circle - top right
  '&::before': {
    content: '""',
    position: 'absolute',
    top: -80,
    right: -80,
    width: 360,
    height: 360,
    borderRadius: '50%',
    background: alpha(theme.palette.primary.main, 0.5),
    pointerEvents: 'none',
  },
  // Decorative circle - secondary accent
  '&::after': {
    content: '""',
    position: 'absolute',
    bottom: -40,
    right: 200,
    width: 160,
    height: 160,
    borderRadius: '50%',
    background: alpha(theme.palette.secondary.main, 0.35),
    pointerEvents: 'none',
  },
  [theme.breakpoints.down('sm')]: {
    minHeight: 280,
  },
}));

const HeroAvatar = styled(Box, {
  shouldForwardProp: (prop) => prop !== 'isArtist',
})<{ isArtist?: boolean }>(({ theme, isArtist }) => ({
  width: 125,
  height: 125,
  borderRadius: '50%',
  background: isArtist
    ? `linear-gradient(135deg, ${theme.palette.secondary.dark}, ${theme.palette.secondary.main})`
    : `linear-gradient(135deg, ${alpha(theme.palette.primary.light, 0.8)}, ${theme.palette.primary.main})`,
  border: '3px solid rgba(255,255,255,0.35)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: '0 8px 32px rgba(0,0,0,0.35)',
  [theme.breakpoints.down('sm')]: {
    width: 72,
    height: 72,
  },
}));

const PatternCard = styled(Paper)(({ theme }) => ({
  borderRadius: 14,
  border: `1px solid ${theme.palette.divider}`,
  overflow: 'hidden',
  cursor: 'pointer',
  transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
  '&:hover': {
    transform: 'translateY(-4px)',
    boxShadow: `0 12px 32px ${alpha(theme.palette.common.black, 0.12)}`,
    borderColor: alpha(theme.palette.primary.main, 0.4),
  },
}));

const TabCount = styled(Box, {
  shouldForwardProp: (p) => p !== 'accentColor',
})<{ accentColor?: string }>(({ theme, accentColor }) => ({
  fontSize: '0.68rem',
  fontWeight: 700,
  lineHeight: '18px',
  minWidth: 18,
  padding: '0 5px',
  borderRadius: 9,
  backgroundColor: alpha(accentColor ?? theme.palette.primary.main, 0.12),
  color: accentColor ?? theme.palette.primary.main,
  '.Mui-selected &': {
    backgroundColor: 'rgba(255,255,255,0.25)',
    color: 'white',
  },
}));

const AboutBody = styled(Box)({
  '& p': { fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '1rem' },
  '& p:last-child': { marginBottom: 0 },
  '& h1, & h2, & h3, & h4': { fontWeight: 700, marginBottom: '0.5rem', marginTop: '1.5rem', lineHeight: 1.3 },
  '& ul, & ol': { paddingLeft: '1.5rem', marginBottom: '1rem' },
  '& li': { fontSize: '1.0625rem', lineHeight: 1.8, marginBottom: '0.25rem' },
  '& a': { color: 'inherit', textDecoration: 'underline' },
  '& code': {
    fontSize: '0.875em',
    padding: '0.15em 0.4em',
    borderRadius: 4,
    backgroundColor: 'rgba(128,128,128,0.12)',
  },
  '& blockquote': { borderLeft: '3px solid rgba(128,128,128,0.3)', paddingLeft: '1rem', marginLeft: 0, opacity: 0.8 },
});

// ─── Inline constant (avoids theme access in JSX) ─────────────────────────────

const heroBtn = {
  color: 'white',
  border: '1px solid rgba(255,255,255,0.3)',
  backgroundColor: 'rgba(255,255,255,0.1)',
  backdropFilter: 'blur(6px)',
  borderRadius: 1.5,
  '&:hover': {
    backgroundColor: 'rgba(255,255,255,0.22)',
    borderColor: 'rgba(255,255,255,0.55)',
  },
} as const;

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ProfileSkeleton = () => (
  <PageRoot>
    <Box
      sx={{
        minHeight: 320,
        backgroundColor: 'primary.dark',
        display: 'flex',
        flexDirection: 'column',
        justifyContent: 'flex-end',
      }}
    >
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, pb: { xs: 3.5, md: 4.5 } }}>
        <Box sx={{ display: 'flex', alignItems: 'flex-end', gap: 3 }}>
          <Skeleton variant="circular" width={88} height={88} sx={{ flexShrink: 0 }} />
          <Box sx={{ pb: 0.5 }}>
            <Skeleton variant="text" width={240} height={52} sx={{ mb: 0.5 }} />
            <Skeleton variant="text" width={160} height={18} />
          </Box>
        </Box>
      </Container>
    </Box>

    <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 0, md: 4 } }}>
        <Box sx={{ display: 'flex' }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Box
              key={i}
              sx={{
                flex: 1,
                py: 3,
                display: 'flex',
                flexDirection: 'column',
                alignItems: 'center',
                gap: 1,
                borderRight: i < 4 ? '1px solid' : 'none',
                borderColor: 'divider',
              }}
            >
              <Skeleton variant="text" width={40} height={36} />
              <Skeleton variant="text" width={56} height={16} />
            </Box>
          ))}
        </Box>
      </Container>
    </Box>

    <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, pt: 5, pb: 5 }}>
      <Skeleton variant="text" width={60} height={14} sx={{ mb: 2 }} />
      <Skeleton variant="text" width="80%" height={22} />
      <Skeleton variant="text" width="65%" height={22} />
      <Skeleton variant="text" width="72%" height={22} />
      <Skeleton variant="text" width="55%" height={22} />
    </Container>

    <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, pt: 4 }}>
        <Skeleton variant="text" width={60} height={14} sx={{ mb: 3 }} />
        <Box sx={{ display: 'flex', gap: 1, mb: 4 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width={110} height={38} sx={{ borderRadius: '20px' }} />
          ))}
        </Box>
        <Grid container spacing={2}>
          {Array.from({ length: 6 }).map((_, i) => (
            <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
              <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: '14px' }} />
              <Skeleton variant="text" width="60%" sx={{ mt: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Container>
    </Box>
  </PageRoot>
);

// ─── Error ────────────────────────────────────────────────────────────────────

const ProfileError = () => (
  <GeneralLayout>
    <PageRoot>
      <Box sx={{ minHeight: 320, backgroundColor: 'primary.dark' }} />
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 }, py: 6 }}>
        <Box sx={{ textAlign: 'center', display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}>
          <PersonOffOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', opacity: 0.4 }} />
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Profile not found
          </Typography>
          <Typography variant="body2" color="text.secondary">
            This user doesn't exist or their profile is unavailable.
          </Typography>
          <Box sx={{ display: 'flex', gap: 1.5, mt: 1 }}>
            <Button variant="outlined" onClick={() => window.history.back()}>
              Go back
            </Button>
            <Button variant="contained" onClick={() => window.location.reload()}>
              Try again
            </Button>
          </Box>
        </Box>
      </Container>
    </PageRoot>
  </GeneralLayout>
);
