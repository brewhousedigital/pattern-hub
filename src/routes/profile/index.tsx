import React, { useState } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { useGlobalAuthData } from '@/data/auth-data';
import { createPrettyDate } from '@/functions/utilities/dates';
import { useQueryGetUserFavoritesByPagination } from '@/functions/database/favorites';
import { useQueryGetUserMarkedDoneByPagination } from '@/functions/database/marked-done';
import { useQueryGetUserRatingsByPagination } from '@/functions/database/ratings';
import type { TypeFavoriteDoneRatingsResponse } from '@/functions/types/types';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { PaginationBox } from '@/components/PaginationBox';
import { useMutationGetGalleryUploadAuth } from '@/functions/database/gallery';
import { GeneralLayout } from '@/components/layout/GeneralLayout';

import { styled, alpha } from '@mui/material/styles';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import StarOutlinedIcon from '@mui/icons-material/StarOutlined';
import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';

import {
  Alert,
  CircularProgress,
  Box,
  Container,
  Typography,
  Avatar,
  Chip,
  Paper,
  Grid,
  Tab,
  Tabs,
  ImageList,
  ImageListItem,
  ImageListItemBar,
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

  return (
    <GeneralLayout>
      <ProfileContent />
    </GeneralLayout>
  );
}

const ProfileContent = () => {
  const { authData } = useGlobalAuthData();

  const [favoritePagination, setFavoritePagination] = React.useState(1);
  const [markedDonePagination, setMarkedDonePagination] = React.useState(1);
  const [ratingsPagination, setRatingsPagination] = React.useState(1);

  const getGalleryAuth = useMutationGetGalleryUploadAuth();

  const {
    isPending: isPendingFavorite,
    isError: isErrorFavorite,
    data: dataFavorite,
    refetch: refetchFavorite,
  } = useQueryGetUserFavoritesByPagination(favoritePagination);

  const {
    isPending: isPendingMarkedDone,
    isError: isErrorMarkedDone,
    data: dataMarkedDone,
    refetch: refetchMarkedDone,
  } = useQueryGetUserMarkedDoneByPagination(markedDonePagination);

  const {
    isPending: isPendingRatings,
    isError: isErrorRatings,
    data: dataRatings,
    refetch: refetchRatings,
  } = useQueryGetUserRatingsByPagination(ratingsPagination);
  const [gallery, setGallery] = useState<GalleryPhoto[]>([]);

  const [tab, setTab] = useState(0);

  if (!authData) return null;

  const tabConfig = [
    { label: 'Favorites', icon: <FavoriteBorderOutlinedIcon fontSize="small" /> },
    { label: 'Completed', icon: <TaskAltOutlinedIcon fontSize="small" /> },
    { label: 'Rated', icon: <StarOutlinedIcon fontSize="small" /> },
    // TODO: Coming Soon
    //{ label: 'Gallery', icon: <PhotoLibraryOutlinedIcon fontSize="small" /> },
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
              <Typography
                variant="h5"
                fontWeight={500}
                sx={{ letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <>{authData.name || 'New User'}</>

                <IconButton component={Link} to="/profile/edit">
                  <EditRoundedIcon fontSize="inherit" />
                </IconButton>
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />

                <Typography variant="caption" color="text.disabled">
                  Member since {createPrettyDate(authData?.created || '')}
                </Typography>
              </Box>
            </Box>

            {/* Stats */}
            <Box sx={{ display: 'flex', gap: 1.5, flexWrap: 'wrap' }}>
              {[
                {
                  icon: <FavoriteIcon sx={{ fontSize: 16, color: 'error.main' }} />,
                  value: dataFavorite?.totalItems || 0,
                  label: 'Saved',
                },
                {
                  icon: <CheckCircleIcon sx={{ fontSize: 16, color: 'success.main' }} />,
                  value: dataMarkedDone?.totalItems || 0,
                  label: 'Done',
                },
                {
                  icon: <StarOutlinedIcon sx={{ fontSize: 16, color: 'primary.main' }} />,
                  value: dataMarkedDone?.totalItems || 0,
                  label: 'Rated',
                },
                /*{
                  icon: <PhotoLibraryOutlinedIcon sx={{ fontSize: 16, color: 'secondary.main' }} />,
                  value: dataMarkedDone?.totalItems || 0,
                  label: 'Photos',
                },*/
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
          {authData?.interests && authData?.interests?.length > 0 && (
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
            <>
              <PatternGrid
                patterns={dataFavorite?.items}
                isPending={isPendingFavorite}
                isError={isErrorFavorite}
                isEmptyMessage="No favorited patterns yet."
                icon={<FavoriteBorderOutlinedIcon />}
              />

              {dataFavorite && dataFavorite?.totalItems > 0 && (
                <PaginationBox data={dataFavorite} value={favoritePagination} setter={setFavoritePagination} />
              )}
            </>
          )}

          {/* Tab: Completed */}
          {tab === 1 && (
            <>
              <PatternGrid
                patterns={dataMarkedDone?.items}
                isPending={isPendingMarkedDone}
                isError={isErrorMarkedDone}
                isEmptyMessage="No completed patterns yet."
                icon={<TaskAltOutlinedIcon />}
                showCompleted
              />

              {dataMarkedDone && dataMarkedDone?.totalItems > 0 && (
                <PaginationBox data={dataMarkedDone} value={markedDonePagination} setter={setMarkedDonePagination} />
              )}
            </>
          )}

          {/* Tab: Rated */}
          {tab === 2 && (
            <>
              <PatternGrid
                patterns={dataRatings?.items}
                isPending={isPendingRatings}
                isError={isErrorRatings}
                isEmptyMessage="No rated patterns yet."
                icon={<StarOutlinedIcon />}
                showRating
              />

              {dataRatings && dataRatings?.totalItems > 0 && (
                <PaginationBox data={dataRatings} value={markedDonePagination} setter={setRatingsPagination} />
              )}
            </>
          )}

          {/* Tab: Gallery */}
          {tab === 3 && (
            <Box>
              {gallery.length === 0 ? (
                <EmptyState icon={<PhotoLibraryOutlinedIcon />} message="No gallery photos yet." />
              ) : (
                <>
                  <GalleryTab photos={gallery} />

                  {dataMarkedDone && dataMarkedDone?.totalItems > 0 && (
                    <PaginationBox
                      data={dataMarkedDone}
                      value={markedDonePagination}
                      setter={setMarkedDonePagination}
                    />
                  )}
                </>
              )}
            </Box>
          )}
        </Box>
      </Container>
    </PageWrapper>
  );
};

interface GalleryPhoto {
  id: string;
  imageUrl: string;
  caption?: string;
  patternTitle?: string;
  uploadedAt: string;
}

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
    ${theme.palette.primary.main} 0%,
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
  gap: theme.spacing(0.5),
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

type PatternGridProps = {
  patterns?: TypeFavoriteDoneRatingsResponse[];
  isEmptyMessage: string;
  icon: React.ReactNode;
  isPending: boolean;
  isError: boolean;
  showRating?: boolean;
  showCompleted?: boolean;
};

const PatternGrid = (props: PatternGridProps) => {
  if (props.isPending) {
    return <CircularProgress />;
  }

  if (props.isError) {
    return <Alert severity="error">Unable to load your list 😔</Alert>;
  }

  if (props?.patterns?.length === 0) {
    return <EmptyState icon={props.icon} message={props.isEmptyMessage} />;
  }

  return (
    <Grid container spacing={2} sx={{ mb: 2.5 }}>
      {props.patterns?.map((pattern) => (
        <Grid size={{ xs: 12, sm: 6, md: 3 }} key={pattern.id}>
          <Link
            to={`/pattern/$patternId`}
            params={{
              patternId: pattern?.expand?.pattern_id?.id,
            }}
          >
            <PatternTile elevation={0}>
              <Box sx={{ position: 'relative' }}>
                <Box
                  component="img"
                  src={generatePbImage(pattern.expand.pattern_id)}
                  alt={pattern.expand.pattern_id.name}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                />
              </Box>

              <Box sx={{ p: 1.75 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  {pattern.expand.pattern_id.name}
                </Typography>

                {props.showCompleted && (
                  <Typography variant="body2" sx={{ opacity: 0.7, fontSize: 12 }}>
                    Completed {createPrettyDate(pattern.created!)}
                  </Typography>
                )}
              </Box>
            </PatternTile>
          </Link>
        </Grid>
      ))}
    </Grid>
  );
};

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
