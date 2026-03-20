import React, { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { createPrettyDate } from '@/functions/utilities/dates';

import { styled, alpha } from '@mui/material/styles';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import StarOutlinedIcon from '@mui/icons-material/StarOutlined';
import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';

import {
  Box,
  Container,
  Typography,
  Avatar,
  Chip,
  Paper,
  Grid,
  Tab,
  Tabs,
  Rating,
  Skeleton,
  ImageList,
  ImageListItem,
  ImageListItemBar,
  Tooltip,
  Divider,
  IconButton,
} from '@mui/material';

type UserSearch = {
  id?: string;
};

export const Route = createFileRoute('/profile/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): UserSearch => {
    return {};
  },
});

function RouteComponent() {
  const { id } = Route.useSearch();

  if (id) {
    return <>👋</>;
  }

  return <ProfileContent />;
}

const ProfileContent = () => {
  const { authData } = useGlobalAuthData();

  console.log('>>>authData', authData);

  const [favorites, setFavorites] = useState<PatternCard[]>([]);
  const [completed, setCompleted] = useState<PatternCard[]>([]);
  const [rated, setRated] = useState<PatternCard[]>([]);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);
  const [loading, setLoading] = useState(true);

  const [tab, setTab] = useState(0);

  //if (loading) return <ProfileSkeleton />;

  if (!authData) return null;

  const tabConfig = [
    { label: 'Favorites', icon: <FavoriteBorderOutlinedIcon fontSize="small" /> },
    { label: 'Completed', icon: <TaskAltOutlinedIcon fontSize="small" /> },
    { label: 'Rated', icon: <StarOutlinedIcon fontSize="small" /> },
    { label: 'Gallery', icon: <PhotoLibraryOutlinedIcon fontSize="small" /> },
  ];

  return (
    <PageWrapper>
      {/* Hero banner */}
      <HeroBanner />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        {/* Profile card */}
        <ProfileCard elevation={0}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center' }}>
            {/* Avatar */}
            {/*<StyledAvatar src={authData.avatarUrl}>{authData.username[0].toUpperCase()}</StyledAvatar>*/}

            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
              <Typography variant="h5" fontWeight={500} sx={{ letterSpacing: '-0.3px' }}>
                {authData.name || 'New User'}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />

                <Typography variant="caption" color="text.disabled">
                  Member since {createPrettyDate(authData.created)}
                </Typography>
              </Box>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[
                {
                  icon: <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />,
                  //value: authData.stats.favorites,
                  value: 1,
                  label: 'Saved',
                },
                {
                  icon: <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />,
                  //value: authData.stats.completed,
                  value: 1,
                  label: 'Done',
                },
                {
                  icon: <StarOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />,
                  //value: authData.stats.rated,
                  value: 1,
                  label: 'Rated',
                },
                {
                  icon: <PhotoLibraryOutlinedIcon sx={{ fontSize: 16, color: 'secondary.main' }} />,
                  //value: authData.stats.photos,
                  value: 1,
                  label: 'Photos',
                },
              ].map((stat) => (
                <StatBox key={stat.label}>
                  {stat.icon}
                  <Typography variant="subtitle2" fontWeight={700} lineHeight={1}>
                    {stat.value}
                  </Typography>

                  <Typography variant="caption" color="text.disabled" lineHeight={1}>
                    {stat.label}
                  </Typography>
                </StatBox>
              ))}
            </Box>
          </Box>

          <Divider sx={{ my: 3 }} />

          {/* Blurb */}
          {authData.about && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1}>
                About
              </Typography>

              <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, lineHeight: 1.8, maxWidth: 640 }}>
                {authData.about}
              </Typography>
            </Box>
          )}

          {/* Interests */}
          {authData.interests.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1}>
                Interests
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {authData.interests.split(',')?.map((interest, index) => {
                  const cleaned = interest.trim();

                  return (
                    <Chip
                      key={cleaned + '-' + index}
                      label={cleaned}
                      size="small"
                      variant="outlined"
                      color="primary"
                      sx={{ borderRadius: '8px', fontWeight: 500 }}
                    />
                  );
                })}
              </Box>
            </Box>
          )}
        </ProfileCard>

        {/* Tabs */}
        <Box sx={{ mt: 4 }}>
          <StyledTabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
            {tabConfig.map((t) => (
              <Tab
                key={t.label}
                icon={t.icon}
                iconPosition="start"
                label={
                  <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                    {t.label}
                    {/*<Chip
                      label={t.count}
                      size="small"
                      sx={{ height: 18, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }}
                    />*/}
                  </Box>
                }
              />
            ))}
          </StyledTabs>

          {/* Tab: Favorites */}
          {tab === 0 && (
            <Box>
              {/* ── DB CALL: getUserFavorites(userId) ─────────────────────── */}
              {favorites.length === 0 ? (
                <EmptyState icon={<FavoriteBorderOutlinedIcon />} message="No favorited patterns yet." />
              ) : (
                <PatternGrid patterns={favorites} />
              )}
            </Box>
          )}

          {/* Tab: Completed */}
          {tab === 1 && (
            <Box>
              {/* ── DB CALL: getUserCompletedPatterns(userId) ─────────────── */}
              {completed.length === 0 ? (
                <EmptyState icon={<TaskAltOutlinedIcon />} message="No completed patterns yet." />
              ) : (
                <PatternGrid patterns={completed} showCompleted />
              )}
            </Box>
          )}

          {/* Tab: Rated */}
          {tab === 2 && (
            <Box>
              {/* ── DB CALL: getUserRatedPatterns(userId) ─────────────────── */}
              {rated.length === 0 ? (
                <EmptyState icon={<StarOutlinedIcon />} message="No rated patterns yet." />
              ) : (
                <PatternGrid patterns={rated} showRating />
              )}
            </Box>
          )}

          {/* Tab: Gallery */}
          {tab === 3 && (
            <Box>
              {/* ── DB CALL: getUserGallery(userId) ───────────────────────── */}
              {gallery.length === 0 ? (
                <EmptyState icon={<PhotoLibraryOutlinedIcon />} message="No gallery photos yet." />
              ) : (
                <GalleryTab photos={gallery} />
              )}
            </Box>
          )}
        </Box>
      </Container>
    </PageWrapper>
  );
};

interface PatternCard {
  id: string;
  title: string;
  thumbnailUrl: string;
  difficulty: string;
  userRating?: number; // 1–5, present only on rated tab
  completedAt?: string; // ISO date, present only on completed tab
}

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
  patternTitle?: string;
  uploadedAt: string;
}

interface UserProfile {
  username: string;
  joinedAt: string; // ISO date
  blurb: string;
  interests: string[];
  avatarUrl?: string;
  stats: {
    favorites: number;
    completed: number;
    rated: number;
    photos: number;
  };
}

const MOCK_PROFILE: UserProfile = {
  username: 'glasscraft_mae',
  joinedAt: '2023-06-12T00:00:00Z',
  blurb:
    'Amateur stained glass artist based in Vermont. I love geometric patterns and anything with deep jewel tones. Currently obsessed with Gothic cathedral windows.',
  interests: ['Geometric', 'Art Nouveau', 'Gothic', 'Floral', 'Abstract', 'Mosaics', 'Bevels', 'Restoration'],
  avatarUrl: undefined,
  stats: { favorites: 24, completed: 11, rated: 18, photos: 7 },
};

const MOCK_FAVORITES: PatternCard[] = Array.from({ length: 6 }, (_, i) => ({
  id: `fav-${i}`,
  title: `Pattern ${i + 1}`,
  thumbnailUrl: `https://picsum.photos/seed/fav${i}/300/300`,
  difficulty: ['Beginner', 'Intermediate', 'Advanced'][i % 3],
}));

const MOCK_COMPLETED: PatternCard[] = Array.from({ length: 4 }, (_, i) => ({
  id: `done-${i}`,
  title: `Completed Pattern ${i + 1}`,
  thumbnailUrl: `https://picsum.photos/seed/done${i}/300/300`,
  difficulty: ['Beginner', 'Intermediate'][i % 2],
  completedAt: new Date(Date.now() - i * 12096e5).toISOString(),
}));

const MOCK_RATED: PatternCard[] = Array.from({ length: 5 }, (_, i) => ({
  id: `rated-${i}`,
  title: `Rated Pattern ${i + 1}`,
  thumbnailUrl: `https://picsum.photos/seed/rated${i}/300/300`,
  difficulty: 'Intermediate',
  userRating: 5 - (i % 3),
}));

const MOCK_GALLERY: GalleryPhoto[] = Array.from({ length: 7 }, (_, i) => ({
  id: `photo-${i}`,
  imageUrl: `https://picsum.photos/seed/gallery${i}/600/500`,
  caption: i % 2 === 0 ? `My finished piece #${i + 1}` : undefined,
  patternTitle: `Pattern ${i + 1}`,
  uploadedAt: new Date(Date.now() - i * 8640e6).toISOString(),
}));

const difficultyColor = (d: string): 'success' | 'warning' | 'error' | 'default' => {
  if (d === 'Beginner') return 'success';
  if (d === 'Intermediate') return 'warning';
  if (d === 'Advanced') return 'error';
  return 'default';
};

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingBottom: theme.spacing(12),
}));

const HeroBanner = styled(Box)(({ theme }) => ({
  background: `linear-gradient(135deg,
    ${alpha(theme.palette.primary.dark, 0.9)} 0%,
    ${alpha(theme.palette.primary.main, 0.7)} 50%,
    ${alpha(theme.palette.secondary.main, 0.5)} 100%)`,
  height: 200,
  position: 'relative',
}));

const ProfileCard = styled(Paper)(({ theme }) => ({
  borderRadius: 20,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(4),
  marginTop: -60,
  position: 'relative',
  zIndex: 1,
  boxShadow: `0 8px 40px ${alpha(theme.palette.common.black, 0.08)}`,
}));

const StyledAvatar = styled(Avatar)(({ theme }) => ({
  width: 96,
  height: 96,
  border: `4px solid ${theme.palette.background.paper}`,
  boxShadow: `0 4px 16px ${alpha(theme.palette.common.black, 0.15)}`,
  fontSize: '2rem',
  fontWeight: 700,
  backgroundColor: theme.palette.primary.main,
}));

const StatBox = styled(Box)(({ theme }) => ({
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  gap: theme.spacing(0.25),
  padding: theme.spacing(1.5, 2),
  borderRadius: 12,
  backgroundColor: alpha(theme.palette.primary.main, 0.05),
  border: `1px solid ${alpha(theme.palette.primary.main, 0.1)}`,
  minWidth: 72,
}));

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(3),
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 600,
    minHeight: 48,
    gap: theme.spacing(0.75),
  },
}));

const PatternTile = styled(Paper)(({ theme }) => ({
  borderRadius: 14,
  overflow: 'hidden',
  border: `1px solid ${theme.palette.divider}`,
  transition: 'transform 0.2s ease, box-shadow 0.2s ease',
  cursor: 'pointer',
  '&:hover': {
    transform: 'translateY(-3px)',
    boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.12)}`,
  },
}));

const GalleryImage = styled('img')({
  width: '100%',
  height: '100%',
  objectFit: 'cover',
  display: 'block',
});

const PatternGrid: React.FC<{ patterns: PatternCard[]; showRating?: boolean; showCompleted?: boolean }> = ({
  patterns,
  showRating,
  showCompleted,
}) => (
  <Grid container spacing={2}>
    {patterns.map((p) => (
      <Grid size={{ xs: 12, sm: 6, md: 4 }} key={p.id}>
        <PatternTile elevation={0}>
          <Box sx={{ position: 'relative' }}>
            <Box
              component="img"
              src={p.thumbnailUrl}
              alt={p.title}
              sx={{ width: '100%', height: 160, objectFit: 'cover', display: 'block' }}
            />
            {showCompleted && (
              <Tooltip title={`Completed ${createPrettyDate(p.completedAt!)}`}>
                <CheckCircleIcon
                  sx={{
                    position: 'absolute',
                    top: 8,
                    right: 8,
                    color: 'success.main',
                    backgroundColor: 'white',
                    borderRadius: '50%',
                    fontSize: 24,
                  }}
                />
              </Tooltip>
            )}
          </Box>
          <Box sx={{ p: 1.75 }}>
            <Typography variant="subtitle2" fontWeight={700} noWrap>
              {p.title}
            </Typography>
            <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 0.75 }}>
              <Chip
                label={p.difficulty}
                size="small"
                color={difficultyColor(p.difficulty)}
                variant="outlined"
                sx={{ height: 22, fontSize: '0.7rem' }}
              />
              {showRating && p.userRating !== undefined && (
                <Rating
                  value={p.userRating}
                  readOnly
                  size="small"
                  precision={1}
                  sx={{ '& .MuiRating-iconFilled': { color: 'primary.main' } }}
                />
              )}
            </Box>
          </Box>
        </PatternTile>
      </Grid>
    ))}
  </Grid>
);

const GalleryTab: React.FC<{ photos: GalleryPhoto[] }> = ({ photos }) => (
  <ImageList variant="masonry" cols={3} gap={12}>
    {photos.map((photo) => (
      <ImageListItem
        key={photo.id}
        sx={{
          borderRadius: 3,
          overflow: 'hidden',
          cursor: 'pointer',
          '& img': { transition: 'transform 0.3s ease' },
          '&:hover img': { transform: 'scale(1.04)' },
          '&:hover .overlay': { opacity: 1 },
          position: 'relative',
        }}
      >
        <GalleryImage
          src={photo.imageUrl}
          alt={photo.caption || photo.patternTitle || 'Gallery photo'}
          loading="lazy"
        />
        <Box
          className="overlay"
          sx={{
            position: 'absolute',
            inset: 0,
            backgroundColor: 'rgba(0,0,0,0.45)',
            opacity: 0,
            transition: 'opacity 0.2s ease',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
          }}
        >
          <ZoomInOutlinedIcon sx={{ color: 'white', fontSize: 32 }} />
        </Box>
        {(photo.caption || photo.patternTitle) && (
          <ImageListItemBar
            title={photo.caption || photo.patternTitle}
            subtitle={createPrettyDate(photo.uploadedAt)}
            sx={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
          />
        )}
      </ImageListItem>
    ))}
  </ImageList>
);

const ProfileSkeleton: React.FC = () => (
  <Box>
    <Skeleton variant="rectangular" height={200} />
    <Container maxWidth="lg">
      <Paper sx={{ borderRadius: 3, p: 4, mt: '-60px', position: 'relative', zIndex: 1 }}>
        <Box sx={{ display: 'flex', gap: 3, alignItems: 'flex-end', mb: 3 }}>
          <Skeleton variant="circular" width={96} height={96} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={200} height={36} />
            <Skeleton variant="text" width={140} height={24} />
          </Box>
        </Box>
        <Skeleton variant="text" width="80%" />
        <Skeleton variant="text" width="60%" />
        <Box sx={{ display: 'flex', gap: 1, mt: 2 }}>
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} variant="rounded" width={72} height={28} />
          ))}
        </Box>
      </Paper>
    </Container>
  </Box>
);

const EmptyState: React.FC<{ icon: React.ReactNode; message: string }> = ({ icon, message }) => (
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
    <Box sx={{ fontSize: 48, lineHeight: 1, opacity: 0.4 }}>{icon}</Box>
    <Typography variant="body2">{message}</Typography>
  </Box>
);
