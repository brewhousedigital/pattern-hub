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
import AddPhotoAlternateOutlinedIcon from '@mui/icons-material/AddPhotoAlternateOutlined';
import ChevronLeftRoundedIcon from '@mui/icons-material/ChevronLeftRounded';
import ChevronRightRoundedIcon from '@mui/icons-material/ChevronRightRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import ShareRoundedIcon from '@mui/icons-material/ShareRounded';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';

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

  const galleryItems = galleryData?.items ?? [];
  const galleryTotal = galleryData?.totalItems ?? 0;

  const [uploadOpen, setUploadOpen] = useState(false);
  const [selectedPhoto, setSelectedPhoto] = useState<TypeGalleryResponse | null>(null);
  const [tab, setTab] = useState(0);

  const tabConfig = [
    { label: 'Favorites', icon: <FavoriteBorderOutlinedIcon fontSize="small" /> },
    { label: 'Completed', icon: <TaskAltOutlinedIcon fontSize="small" /> },
    { label: 'Rated', icon: <StarOutlinedIcon fontSize="small" /> },
    { label: 'Gallery', icon: <PhotoLibraryOutlinedIcon fontSize="small" /> },
    { label: 'Collections', icon: <BookmarksOutlinedIcon fontSize="small" />, disabled: true, soon: true },
  ] as const;

  async function handleShare() {
    const shareUrl = `https://patternarchive.net/profile?id=${thisAuthData?.id}`;
    const isMobile = navigator.maxTouchPoints > 0;

    if (isMobile && navigator.share) {
      try {
        await navigator.share({
          title: `${thisAuthData?.name || 'Profile'} on Pattern Archive`,
          url: shareUrl,
        });
      } catch {
        // User cancelled — silent
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      enqueueSnackbar('Profile link copied to clipboard!', { variant: 'success' });
    } catch {
      enqueueSnackbar('Unable to copy — please copy the URL manually', { variant: 'error' });
    }
  }

  if (!thisAuthData) return <ProfileSkeleton />;

  const displayName = thisAuthData?.name || 'New User';
  const initial = displayName[0].toUpperCase();

  const stats = [
    {
      icon: <FavoriteIcon sx={{ fontSize: 18, color: 'error.light' }} />,
      value: dataFavorite?.totalItems ?? 0,
      label: 'Saved',
    },
    {
      icon: <CheckCircleIcon sx={{ fontSize: 18, color: 'success.light' }} />,
      value: dataMarkedDone?.totalItems ?? 0,
      label: 'Completed',
    },
    {
      icon: <StarOutlinedIcon sx={{ fontSize: 18, color: 'warning.main' }} />,
      value: dataRatings?.totalItems ?? 0,
      label: 'Rated',
    },
    {
      icon: <PhotoLibraryOutlinedIcon sx={{ fontSize: 18, color: 'primary.main' }} />,
      value: galleryTotal,
      label: 'Photos',
    },
  ];

  return (
    <PageWrapper>
      <HeroBanner />

      <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
        {/* ─── Profile header card ─── */}
        <ProfileCard elevation={0} sx={{ mb: 2.5 }}>
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
            {/* Initials avatar */}
            <InitialsAvatar>
              <Typography variant="h4" fontWeight={700} color="white" lineHeight={1}>
                {initial}
              </Typography>
            </InitialsAvatar>

            {/* Name + join date */}
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.4px' }} noWrap>
                {displayName}
              </Typography>

              <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.5, mt: 0.25 }}>
                <CalendarTodayOutlinedIcon sx={{ fontSize: 12, color: 'text.disabled' }} />
                <Typography variant="caption" color="text.disabled">
                  Member since {createPrettyDate(thisAuthData?.created || '')}
                </Typography>
              </Box>
            </Box>

            {/* Action buttons */}
            <Box sx={{ display: 'flex', gap: 0.75, flexShrink: 0 }}>
              <Tooltip title="Share profile" placement="bottom">
                <IconButton
                  onClick={handleShare}
                  size="small"
                  sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                >
                  <ShareRoundedIcon fontSize="small" />
                </IconButton>
              </Tooltip>

              {!isPublicView && (
                <Tooltip title="Edit profile" placement="bottom">
                  <IconButton
                    component={Link}
                    to="/profile/edit"
                    size="small"
                    sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1.5 }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              )}
            </Box>
          </Box>

          {/* Stats strip */}
          <Box
            sx={{
              display: 'flex',
              mt: 3,
              pt: 2.5,
              borderTop: '1px solid',
              borderColor: 'divider',
              mx: { xs: -1, sm: 0 },
            }}
          >
            {stats.map((stat, i) => (
              <Box
                key={stat.label}
                sx={{
                  flex: 1,
                  display: 'flex',
                  flexDirection: 'column',
                  alignItems: 'center',
                  gap: 0.5,
                  borderRight: i < stats.length - 1 ? '1px solid' : 'none',
                  borderColor: 'divider',
                  py: 0.5,
                }}
              >
                {stat.icon}
                <Typography variant="subtitle1" fontWeight={700} lineHeight={1}>
                  {stat.value}
                </Typography>
                <Typography variant="caption" color="text.disabled" lineHeight={1}>
                  {stat.label}
                </Typography>
              </Box>
            ))}
          </Box>
        </ProfileCard>

        {/* ─── Body ─── */}
        <Grid container spacing={3}>
          {/* Sidebar — appears below tabs on mobile, left on desktop */}
          <Grid size={{ xs: 12, md: 3 }} sx={{ order: { xs: 2, md: 1 } }}>
            <SidebarSection elevation={0}>
              {thisAuthData?.about ? (
                <>
                  <SectionLabel>About</SectionLabel>
                  <MarkdownWrapper>{thisAuthData.about}</MarkdownWrapper>
                </>
              ) : !isPublicView ? (
                <Box sx={{ textAlign: 'center', py: 1 }}>
                  <Typography variant="body2" color="text.disabled" sx={{ fontSize: '0.8rem' }}>
                    <Box
                      component={Link}
                      to="/profile/edit"
                      sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
                    >
                      Add a bio
                    </Box>{' '}
                    to tell others about yourself
                  </Typography>
                </Box>
              ) : null}

              {thisAuthData?.interests && thisAuthData.interests.length > 0 && (
                <Box sx={{ mt: thisAuthData?.about ? 2.5 : 0 }}>
                  <SectionLabel>Interests</SectionLabel>
                  <Box sx={{ display: 'flex', flexWrap: 'wrap', gap: 0.75 }}>
                    {thisAuthData.interests.split(',').map((interest, index) => {
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

              {!thisAuthData?.about && !thisAuthData?.interests && isPublicView && (
                <Typography
                  variant="body2"
                  color="text.disabled"
                  sx={{ fontSize: '0.8rem', textAlign: 'center', py: 1 }}
                >
                  No bio yet
                </Typography>
              )}
            </SidebarSection>
          </Grid>

          {/* Main content */}
          <Grid size={{ xs: 12, md: 9 }} sx={{ order: { xs: 1, md: 2 } }}>
            <StyledTabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
              {tabConfig.map((t) => (
                <Tab
                  key={t.label}
                  disabled={'disabled' in t && !!t.disabled}
                  icon={t.icon}
                  iconPosition="start"
                  label={
                    <Box sx={{ display: 'flex', alignItems: 'center', gap: 0.75 }}>
                      {t.label}
                      {'soon' in t && t.soon && (
                        <Chip
                          label="Soon"
                          size="small"
                          sx={{
                            height: 16,
                            fontSize: '0.6rem',
                            '& .MuiChip-label': { px: 0.75 },
                            opacity: 0.65,
                          }}
                        />
                      )}
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
                {dataFavorite && dataFavorite.totalItems > 0 && (
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
                {dataMarkedDone && dataMarkedDone.totalItems > 0 && (
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
                {dataRatings && dataRatings.totalItems > 0 && (
                  <PaginationBox data={dataRatings} value={ratingsPagination} setter={setRatingsPagination} />
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

                {isPendingGallery ? (
                  <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
                    <CircularProgress />
                  </Box>
                ) : isErrorGallery ? (
                  <Alert severity="error" sx={{ mb: 2 }}>
                    Unable to load gallery photos.
                  </Alert>
                ) : galleryItems.length === 0 ? (
                  <EmptyState icon={<PhotoLibraryOutlinedIcon />} message="No gallery photos yet." />
                ) : (
                  <>
                    <GalleryTab photos={galleryItems} onPhotoClick={setSelectedPhoto} />

                    <PaginationBox data={galleryData} value={galleryPagination} setter={setGalleryPagination} />
                  </>
                )}
              </Box>
            )}
          </Grid>
        </Grid>
      </Container>

      {/* ─── Dialogs ─── */}
      <GalleryLightbox
        photo={selectedPhoto}
        photos={galleryItems}
        onClose={() => setSelectedPhoto(null)}
        onNavigate={setSelectedPhoto}
        onDeleteSuccess={() => {
          void refetchGallery();
          setSelectedPhoto(null);
        }}
        isOwner={!isPublicView}
      />

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

  React.useEffect(() => {
    setDeleteError('');
  }, [photo?.id]);

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
    <Dialog open={!!photo} onClose={onClose} maxWidth="lg" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: 6 } }}>
      <DialogContent sx={{ p: 0, display: 'flex', flexDirection: { xs: 'column', md: 'row' }, minHeight: 400 }}>
        {/* Image */}
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
              sx={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
                borderRadius: 5,
              }}
            />
          )}

          {hasPrev && (
            <IconButton
              onClick={() => onNavigate(photos[currentIndex - 1])}
              sx={{
                position: 'absolute',
                left: -3,
                bgcolor: 'rgba(0,0,0,0.45)',
                color: 'white',
                '&:hover': { bgcolor: 'rgba(0,0,0,0.65)' },
              }}
            >
              <ChevronLeftRoundedIcon />
            </IconButton>
          )}

          {hasNext && (
            <IconButton
              onClick={() => onNavigate(photos[currentIndex + 1])}
              sx={{
                position: 'absolute',
                right: -3,
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
        <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', minWidth: 0 }}>
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
  <Grid container spacing={1.5} sx={{ mb: 2 }}>
    {photos.map((photo) => (
      <Grid size={{ xs: 6, sm: 4 }} key={photo.id}>
        <Box
          onClick={() => onPhotoClick(photo)}
          sx={{
            position: 'relative',
            aspectRatio: '1 / 1',
            borderRadius: 2,
            overflow: 'hidden',
            cursor: 'pointer',
            bgcolor: 'grey.100',
            '&:hover img': { transform: 'scale(1.05)' },
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
              background: 'linear-gradient(to top, rgba(0,0,0,0.65) 0%, transparent 50%)',
              opacity: 0,
              transition: 'opacity 0.2s ease',
              display: 'flex',
              alignItems: 'flex-end',
              p: 1.5,
            }}
          >
            <Box sx={{ minWidth: 0 }}>
              <Typography variant="caption" fontWeight={600} color="white" noWrap display="block">
                {photo.title}
              </Typography>

              {photo.expand?.pattern_id?.name && (
                <Typography variant="caption" sx={{ color: 'rgba(255,255,255,0.7)' }} noWrap display="block">
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

// ─── Pattern Grid ─────────────────────────────────────────────────────────────

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
  if (props.isPending)
    return (
      <Box sx={{ display: 'flex', justifyContent: 'center', py: 6 }}>
        <CircularProgress />
      </Box>
    );
  if (props.isError) return <Alert severity="error">Unable to load your list 😔</Alert>;
  if (props?.patterns?.length === 0) return <EmptyState icon={props.icon} message={props.isEmptyMessage} />;

  return (
    <Grid container spacing={2} sx={{ mb: 2.5 }}>
      {props.patterns?.map((pattern) => (
        <Grid size={{ xs: 12, sm: 6, md: 4 }} key={pattern.id}>
          <Link
            to="/"
            search={{ id: [pattern?.pattern_id], patternId: pattern?.pattern_id }}
            style={{ textDecoration: 'none' }}
          >
            <PatternTile elevation={0}>
              <Box sx={{ position: 'relative', p: 2 }}>
                <Box
                  component="img"
                  loading="lazy"
                  src={generatePbImage(pattern.expand.pattern_id)}
                  alt={pattern?.expand?.pattern_id?.name}
                  style={{ width: '100%', height: 'auto', aspectRatio: '1/1' }}
                />
              </Box>

              <Box sx={{ px: 2, pb: 2 }}>
                <Typography variant="subtitle2" fontWeight={700} noWrap>
                  {pattern?.expand?.pattern_id?.name}
                </Typography>

                {props.showCompleted && (
                  <Typography variant="caption" color="text.disabled">
                    Completed {createPrettyDate(pattern.created!)}
                  </Typography>
                )}

                {props.showRating && <Rating value={pattern?.rating} readOnly />}
              </Box>
            </PatternTile>
          </Link>
        </Grid>
      ))}
    </Grid>
  );
};

// ─── Empty State ──────────────────────────────────────────────────────────────

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
    <Box sx={{ fontSize: 48, lineHeight: 1, opacity: 0.35 }}>{icon}</Box>
    <Typography variant="body2">{message}</Typography>
  </Box>
);

// ─── Styled components ────────────────────────────────────────────────────────

const PageWrapper = styled(Box)(({ theme }) => ({
  paddingBottom: theme.spacing(12),
}));

const HeroBanner = styled(Box)(({ theme }) => ({
  height: 160,
  position: 'relative',
  overflow: 'hidden',
  background: `linear-gradient(135deg,
    ${theme.palette.primary.dark} 0%,
    ${theme.palette.primary.main} 40%,
    ${alpha(theme.palette.secondary.main, 0.7)} 100%)`,
  '&::after': {
    content: '""',
    position: 'absolute',
    inset: 0,
    backgroundImage: `radial-gradient(${alpha('#fff', 0.06)} 1px, transparent 1px)`,
    backgroundSize: '24px 24px',
  },
}));

const ProfileCard = styled(Paper)(({ theme }) => ({
  borderRadius: 20,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(3),
  marginTop: -56,
  position: 'relative',
  zIndex: 1,
  boxShadow: `0 4px 24px ${alpha(theme.palette.common.black, 0.07)}`,
}));

const InitialsAvatar = styled(Box)(({ theme }) => ({
  width: 72,
  height: 72,
  borderRadius: '50%',
  background: `linear-gradient(135deg, ${theme.palette.primary.main}, ${theme.palette.primary.dark})`,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
  boxShadow: `0 4px 16px ${alpha(theme.palette.primary.main, 0.35)}`,
  border: `3px solid ${theme.palette.background.paper}`,
}));

const SidebarSection = styled(Paper)(({ theme }) => ({
  borderRadius: 16,
  border: `1px solid ${theme.palette.divider}`,
  padding: theme.spacing(2.5),
  boxShadow: 'none',
  position: 'sticky',
  top: theme.spacing(2),
}));

const SectionLabel = ({ children }: { children: React.ReactNode }) => (
  <Typography
    variant="overline"
    sx={{
      fontSize: '0.65rem',
      fontWeight: 700,
      letterSpacing: '0.1em',
      color: 'text.disabled',
      display: 'block',
      mb: 1,
    }}
  >
    {children}
  </Typography>
);

const StyledTabs = styled(Tabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  marginBottom: theme.spacing(3),
  '& .MuiTab-root': {
    textTransform: 'none',
    fontWeight: 600,
    minHeight: 48,
    fontSize: '0.875rem',
    '&.Mui-disabled': {
      opacity: 0.45,
    },
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
    boxShadow: `0 8px 24px ${alpha(theme.palette.common.black, 0.1)}`,
  },
}));

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const ProfileSkeleton = () => (
  <PageWrapper>
    <HeroBanner />

    <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
      <ProfileCard elevation={0} sx={{ mb: 2.5 }}>
        <Box sx={{ display: 'flex', alignItems: 'center', gap: 2.5 }}>
          <Skeleton variant="circular" width={72} height={72} />

          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width={180} height={32} />
            <Skeleton variant="text" width={140} height={18} sx={{ mt: 0.5 }} />
          </Box>

          <Skeleton variant="rounded" width={36} height={36} sx={{ borderRadius: 1.5 }} />
        </Box>

        <Divider sx={{ my: 2.5 }} />

        <Box sx={{ display: 'flex', gap: 2 }}>
          {[1, 2, 3, 4].map((i) => (
            <Box key={i} sx={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 0.5 }}>
              <Skeleton variant="circular" width={20} height={20} />
              <Skeleton variant="text" width={28} height={24} />
              <Skeleton variant="text" width={40} height={16} />
            </Box>
          ))}
        </Box>
      </ProfileCard>

      <Grid container spacing={3} sx={{ mt: 0.5 }}>
        <Grid size={{ xs: 12, md: 3 }}>
          <Skeleton variant="rounded" height={180} sx={{ borderRadius: 4 }} />
        </Grid>

        <Grid size={{ xs: 12, md: 9 }}>
          <Skeleton variant="rounded" width="100%" height={48} sx={{ mb: 3, borderRadius: 2 }} />
          <Grid container spacing={2}>
            {[1, 2, 3, 4, 5, 6].map((i) => (
              <Grid size={{ xs: 12, sm: 6, md: 4 }} key={i}>
                <Skeleton variant="rounded" width="100%" sx={{ aspectRatio: '1/1', borderRadius: '14px' }} />
                <Skeleton variant="text" width="70%" sx={{ mt: 1 }} />
              </Grid>
            ))}
          </Grid>
        </Grid>
      </Grid>
    </Container>
  </PageWrapper>
);

// ─── Error state ──────────────────────────────────────────────────────────────

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
