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
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { useQueryGetUserById } from '@/functions/database/users';
import type { TypeAuthData } from '@/functions/database/authentication';
import { useQueryGetUserGallery, type TypeGalleryResponse } from '@/functions/database/gallery';
import { GalleryUploadDialog } from '@/components/GalleryUploadDialog';
import { pocketbase } from '@/functions/database/authentication-setup';
import { enqueueSnackbar } from 'notistack';

import { styled, alpha } from '@mui/material/styles';
import PersonOffOutlinedIcon from '@mui/icons-material/PersonOffOutlined';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import FavoriteIcon from '@mui/icons-material/Favorite';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import PhotoLibraryOutlinedIcon from '@mui/icons-material/PhotoLibraryOutlined';
import FavoriteBorderOutlinedIcon from '@mui/icons-material/FavoriteBorderOutlined';
import TaskAltOutlinedIcon from '@mui/icons-material/TaskAltOutlined';
import StarOutlinedIcon from '@mui/icons-material/StarOutlined';
import ZoomInOutlinedIcon from '@mui/icons-material/ZoomInOutlined';
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';

import {
  Alert,
  Button,
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
  ImageListItemBar,
  Dialog,
  DialogContent,
  Divider,
  IconButton,
  Skeleton,
} from '@mui/material';
import { generateSEO } from '@/functions/utilities/seo.ts';

type UserSearch = {
  id?: string;
};

export const Route = createFileRoute('/profile/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): UserSearch => {
    return {
      id: search.id as string | undefined,
    };
  },
  head: ({ match }) => ({
    meta: generateSEO('Profile', '', match.pathname),
  }),
});

function RouteComponent() {
  const { id } = Route.useSearch();
  const { authData } = useGlobalAuthData();

  const { isPending, isError, data, refetch } = useQueryGetUserById(id);

  if (id && id !== authData?.id) {
    if (isPending)
      return (
        <GeneralLayout>
          <ProfileSkeleton />
        </GeneralLayout>
      );

    if (isError) return <ProfileError onRetry={refetch} />;

    return (
      <GeneralLayout>
        <ProfileContent userData={data} />
      </GeneralLayout>
    );
  }

  return (
    <GeneralLayout>
      <ProfileContent />
    </GeneralLayout>
  );
}

type ProfileContentProps = {
  userData?: TypeAuthData;
};

const ProfileContent = (props: ProfileContentProps) => {
  const { authData } = useGlobalAuthData();

  const thisAuthData = props.userData ? props.userData : authData;

  const isPublicView = !!props.userData;

  const [favoritePagination, setFavoritePagination] = React.useState(1);
  const [markedDonePagination, setMarkedDonePagination] = React.useState(1);
  const [ratingsPagination, setRatingsPagination] = React.useState(1);
  const [galleryPagination, setGalleryPagination] = React.useState(1);

  const {
    isPending: isPendingFavorite,
    isError: isErrorFavorite,
    data: dataFavorite,
    refetch: refetchFavorite,
  } = useQueryGetUserFavoritesByPagination(thisAuthData?.id || '', favoritePagination);

  const {
    isPending: isPendingMarkedDone,
    isError: isErrorMarkedDone,
    data: dataMarkedDone,
    refetch: refetchMarkedDone,
  } = useQueryGetUserMarkedDoneByPagination(thisAuthData?.id || '', markedDonePagination);

  const {
    isPending: isPendingRatings,
    isError: isErrorRatings,
    data: dataRatings,
    refetch: refetchRatings,
  } = useQueryGetUserRatingsByPagination(thisAuthData?.id || '', ratingsPagination);

  const {
    isPending: isPendingGallery,
    isError: isErrorGallery,
    data: galleryData,
    refetch: refetchGallery,
  } = useQueryGetUserGallery(thisAuthData?.id || '', galleryPagination);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TypeGalleryResponse | null>(null);

  const [tab, setTab] = useState(0);

  const tabConfig = [
    { label: 'Favorites', icon: <FavoriteBorderOutlinedIcon fontSize="small" /> },
    { label: 'Completed', icon: <TaskAltOutlinedIcon fontSize="small" /> },
    { label: 'Rated', icon: <StarOutlinedIcon fontSize="small" /> },
    { label: 'Gallery', icon: <PhotoLibraryOutlinedIcon fontSize="small" /> },
  ];

  if (!thisAuthData) return <ProfileSkeleton />;

  return (
    <PageWrapper>
      {/* Hero banner */}
      <HeroBanner />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        {/* Profile card */}
        <ProfileCard elevation={0}>
          <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center' }}>
            {/* Avatar */}
            {/*<StyledAvatar src={thisAuthData?.avatarUrl}>{thisAuthData?.username[0].toUpperCase()}</StyledAvatar>*/}

            <Box sx={{ flex: 1, textAlign: { xs: 'center', md: 'left' } }}>
              <Typography
                variant="h5"
                fontWeight={500}
                sx={{ letterSpacing: '-0.3px', display: 'flex', alignItems: 'center', gap: 2 }}
              >
                <>{thisAuthData?.name || 'New User'}</>

                {!isPublicView && (
                  <IconButton component={Link} to="/profile/edit">
                    <EditRoundedIcon fontSize="inherit" />
                  </IconButton>
                )}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75, mt: 0.5 }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled' }} />

                <Typography variant="caption" color="text.disabled">
                  Member since {createPrettyDate(thisAuthData?.created || '')}
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
                  value: dataRatings?.totalItems || 0,
                  label: 'Rated',
                },
                {
                  icon: <PhotoLibraryOutlinedIcon sx={{ fontSize: 16, color: 'secondary.main' }} />,
                  value: galleryData?.totalItems || 0,
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
          {thisAuthData?.about && (
            <Box sx={{ mb: 2.5 }}>
              <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1}>
                About
              </Typography>

              <MarkdownWrapper>{thisAuthData?.about}</MarkdownWrapper>
            </Box>
          )}

          {/* Interests */}
          {thisAuthData?.interests && thisAuthData?.interests?.length > 0 && (
            <Box>
              <Typography variant="overline" color="text.disabled" fontWeight={700} letterSpacing={1}>
                Interests
              </Typography>

              <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 1, mt: 1 }}>
                {thisAuthData?.interests.split(',')?.map((interest, index) => {
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
                label={<Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>{t.label}</Box>}
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
              {!isPublicView && (
                <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 2 }}>
                  <Button
                    startIcon={<AddPhotoAlternateOutlinedIcon />}
                    variant="contained"
                    onClick={() => setUploadOpen(true)}
                  >
                    Upload Photo
                  </Button>
                </Box>
              )}

              {galleryData && galleryData?.totalItems === 0 ? (
                <EmptyState icon={<PhotoLibraryOutlinedIcon />} message="No gallery photos yet." />
              ) : (
                <>
                  <GalleryTab photos={galleryData?.items || []} onPhotoClick={setSelectedPhoto} />

                  <PaginationBox data={galleryData} value={galleryPagination} setter={setGalleryPagination} />
                </>
              )}
            </Box>
          )}
        </Box>
      </Container>

      {/* Gallery lightbox */}
      <GalleryLightbox
        photo={selectedPhoto}
        photos={galleryData?.items || []}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
        onDeleteSuccess={() => {
          void refetchGallery();
          setSelectedPhoto(null);
        }}
        isOwner={!isPublicView}
      />

      {/* Upload dialog */}
      <GalleryUploadDialog
        open={uploadOpen}
        onClose={() => setUploadOpen(false)}
        onSuccess={() => {
          void refetchGallery();
          setUploadOpen(false);
        }}
      />
    </PageWrapper>
  );
};

// ─── Gallery Lightbox ─────────────────────────────────────────────────────────

type GalleryLightboxProps = {
  photo: TypeGalleryResponse | null;
  photos: TypeGalleryResponse[];
  onClose: () => void;
  onNavigate: (photo: TypeGalleryResponse) => void;
  onDeleteSuccess: () => void;
  isOwner: boolean;
};

const GalleryLightbox = (props: GalleryLightboxProps) => {
  const { photo, photos, onClose, onNavigate, onDeleteSuccess, isOwner } = props;
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState('');

  const currentIndex = photo ? photos.findIndex((p) => p.id === photo.id) : -1;
  const hasPrev = currentIndex > 0;
  const hasNext = currentIndex >= 0 && currentIndex < photos.length - 1;

  // Reset error state when navigating to a different photo
  React.useEffect(() => {
    setDeleteError('');
  }, [photo?.id]);

  // Keyboard navigation
  React.useEffect(() => {
    if (!photo) return;
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'ArrowLeft' && hasPrev) onNavigate(photos[currentIndex - 1]);
      if (e.key === 'ArrowRight' && hasNext) onNavigate(photos[currentIndex + 1]);
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [photo, currentIndex, hasPrev, hasNext, onNavigate, photos]);

  async function handleDelete() {
    if (!photo) return;
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
        setDeleteError(data.error ?? 'Delete failed — please try again.');
        return;
      }
      enqueueSnackbar('Photo deleted.', { variant: 'success' });
      onDeleteSuccess();
    } catch {
      setDeleteError('Something went wrong — please try again.');
    } finally {
      setDeleting(false);
    }
  }

  const patternExpand = photo?.expand?.pattern_id;

  return (
    <Dialog open={!!photo} onClose={onClose} maxWidth="md" fullWidth>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 400 }}>
        {/* Image side */}
        <Box
          sx={{
            position: 'relative',
            flex: '0 0 auto',
            width: { xs: '100%', md: '60%' },
            bgcolor: 'grey.100',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: { xs: 240, md: 400 },
          }}
        >
          {photo && (
            <Box
              component="img"
              src={`${photo.src}?tr=w-900,f-auto,q-80`}
              alt={photo.title}
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                maxHeight: { xs: 300, md: 500 },
              }}
            />
          )}

          {/* Prev arrow */}
          {hasPrev && (
            <IconButton
              onClick={() => onNavigate(photos[currentIndex - 1])}
              sx={{
                position: 'absolute',
                left: 8,
                bgcolor: 'rgba(0,0,0,0.45)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
              }}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
          )}

          {/* Next arrow */}
          {hasNext && (
            <IconButton
              onClick={() => onNavigate(photos[currentIndex + 1])}
              sx={{
                position: 'absolute',
                right: 8,
                bgcolor: 'rgba(0,0,0,0.45)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
              }}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          )}
        </Box>

        {/* Info panel */}
        <Box
          sx={{
            flex: 1,
            p: 3,
            display: 'flex',
            flexDirection: 'column',
            gap: 2,
            overflowY: 'auto',
            minWidth: 0,
          }}
        >
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h6" fontWeight={600} sx={{ wordBreak: 'break-word' }}>
              {photo?.title}
            </Typography>

            <IconButton onClick={onClose} size="small" sx={{ flexShrink: 0 }}>
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
              <Typography variant="caption" color="text.disabled" display="block" gutterBottom>
                Tagged pattern
              </Typography>

              <Link to="/" search={{ id: [patternExpand.id], patternId: patternExpand.id }} onClick={onClose}>
                <Chip label={patternExpand.name} size="small" color="primary" variant="outlined" clickable />
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
            <Button
              variant="outlined"
              color="error"
              size="small"
              startIcon={deleting ? <CircularProgress size={14} color="inherit" /> : <DeleteOutlinedIcon />}
              onClick={handleDelete}
              disabled={deleting}
              sx={{ alignSelf: 'flex-start' }}
            >
              {deleting ? 'Deleting…' : 'Delete photo'}
            </Button>
          )}
        </Box>
      </DialogContent>
    </Dialog>
  );
};

// ─── Gallery Tab ──────────────────────────────────────────────────────────────

type GalleryTabProps = {
  photos: TypeGalleryResponse[];
  onPhotoClick: (photo: TypeGalleryResponse) => void;
};

const GalleryTab = ({ photos, onPhotoClick }: GalleryTabProps) => (
  <Grid container spacing={2} sx={{ mb: 2.5 }}>
    {photos.map((photo) => (
      <Grid
        size={{ xs: 12, md: 6, lg: 4 }}
        key={photo.id}
        onClick={() => onPhotoClick(photo)}
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
        <GalleryImage src={`${photo.src}?tr=w-600,f-auto,q-80`} alt={photo.title} loading="lazy" />

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

        {photo.title && (
          <ImageListItemBar
            title={photo.title}
            subtitle={
              photo.expand?.pattern_id?.name
                ? `Pattern: ${photo.expand.pattern_id.name}`
                : createPrettyDate(String(photo.created))
            }
            sx={{ borderBottomLeftRadius: 12, borderBottomRightRadius: 12 }}
          />
        )}
      </Grid>
    ))}
  </Grid>
);

// ─── Shared sub-components ───────────────────────────────────────────────────

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
  height: 'auto',
  maxHeight: 275,
  display: 'block',
  objectFit: 'contain',
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
            to={`/`}
            search={{
              id: [pattern?.pattern_id],
              patternId: pattern?.pattern_id,
            }}
          >
            <PatternTile elevation={0}>
              <Box sx={{ position: 'relative', p: 2 }}>
                <Box
                  component="img"
                  src={generatePbImage(pattern.expand.pattern_id)}
                  alt={pattern?.expand?.pattern_id?.name}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                />
              </Box>

              <Box sx={{ p: 1.75 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  {pattern?.expand?.pattern_id?.name}
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

const ProfileSkeleton = () => (
  <PageWrapper>
    <HeroBanner />
    <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
      <ProfileCard elevation={0}>
        <Box sx={{ display: 'flex', flexDirection: { xs: 'column', md: 'row' }, gap: 3, alignItems: 'center' }}>
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={200} height={36} />
            <Skeleton variant="text" width={140} height={20} sx={{ mt: 0.5 }} />
          </Box>

          <Box sx={{ display: 'flex', gap: 1.5 }}>
            {[1, 2, 3].map((i) => (
              <Skeleton key={i} variant="rounded" width={72} height={72} sx={{ borderRadius: '12px' }} />
            ))}
          </Box>
        </Box>

        <Divider sx={{ my: 3 }} />

        <Skeleton variant="text" width={60} height={20} />
        <Skeleton variant="text" width="80%" height={20} sx={{ mt: 1 }} />
        <Skeleton variant="text" width="60%" height={20} />
      </ProfileCard>

      <Box sx={{ mt: 4 }}>
        <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 3 }} />
        <Grid container spacing={2}>
          {[1, 2, 3, 4].map((i) => (
            <Grid size={{ xs: 12, sm: 6, md: 3 }} key={i}>
              <Skeleton variant="rounded" width="100%" sx={{ aspectRatio: '1/1', borderRadius: '14px' }} />
              <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
            </Grid>
          ))}
        </Grid>
      </Box>
    </Container>
  </PageWrapper>
);

const ProfileError = ({ onRetry }: { onRetry: () => void }) => (
  <GeneralLayout>
    <PageWrapper>
      <HeroBanner />
      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        <ProfileCard elevation={0}>
          <Box
            sx={{ textAlign: 'center', py: 6, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 2 }}
          >
            <PersonOffOutlinedIcon sx={{ fontSize: 56, color: 'text.disabled', opacity: 0.4 }} />

            <Typography variant="h6" fontWeight={600}>
              Profile not found
            </Typography>

            <Typography variant="body2" color="text.secondary">
              This user doesn't exist or their profile is unavailable.
            </Typography>

            <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
              Try again
            </Button>
          </Box>
        </ProfileCard>
      </Container>
    </PageWrapper>
  </GeneralLayout>
);
