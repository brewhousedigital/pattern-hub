import React, { useState } from 'react';
import { createFileRoute, Link, useNavigate } from '@tanstack/react-router';
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
import { GalleryEditDialog } from '@/components/GalleryEditDialog';
import { useQueryGetUserCollections, useQueryGetUserFollowedCollections } from '@/functions/database/collections';
import { CollectionCard } from '@/components/collections/CollectionCard';
import { CreateCollectionDialog } from '@/components/collections/CreateCollectionDialog';
import { pocketbase } from '@/functions/database/authentication-setup';
import { enqueueSnackbar } from 'notistack';
import { useQueryGetPatternsByAuthor, type TypePatternResponse } from '@/functions/database/patterns';
import { generateSEO } from '@/functions/utilities/seo.ts';
import { generateUserAvatarUrl, generateUserHeaderUrl } from '@/functions/utilities/generate-pb-image';

import { styled, alpha } from '@mui/material/styles';
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
} from '@mui/material';

// ─── Types ────────────────────────────────────────────────────────────────────

type UserSearch = {
  id?: string;
  tab?: number;
};

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/profile/')({
  component: RouteComponent,
  validateSearch: (search: Record<string, unknown>): UserSearch => {
    const tab = Number(search.tab);
    return {
      id: search.id as string | undefined,
      tab: Number.isFinite(tab) && tab >= 0 && tab <= 4 ? tab : 0,
    };
  },
  head: ({ match }) => ({
    meta: generateSEO('Profile', '', match.pathname),
  }),
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
    if (isError) return <ProfileError onRetry={refetch} />;
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
  const [galleryPage, setGalleryPage] = React.useState(1);
  const [collectionsPage, setCollectionsPage] = React.useState(1);
  const [artistPage, setArtistPage] = React.useState(1);

  const {
    isPending: isPendingFav,
    isError: isErrFav,
    data: dataFav,
    refetch: refetchFav,
  } = useQueryGetUserFavoritesByPagination(thisAuthData?.id ?? '', favoritePage);

  const {
    isPending: isPendingDone,
    isError: isErrDone,
    data: dataDone,
    refetch: refetchDone,
  } = useQueryGetUserMarkedDoneByPagination(thisAuthData?.id ?? '', donePage);

  const {
    isPending: isPendingRatings,
    isError: isErrRatings,
    data: dataRatings,
    refetch: refetchRatings,
  } = useQueryGetUserRatingsByPagination(thisAuthData?.id ?? '', ratingsPage);

  const {
    isPending: isPendingGallery,
    isError: isErrGallery,
    data: dataGallery,
    refetch: refetchGallery,
  } = useQueryGetUserGallery(thisAuthData?.id ?? '', galleryPage);

  const {
    isPending: isPendingCols,
    isError: isErrCols,
    data: dataCols,
    refetch: refetchCols,
  } = useQueryGetUserCollections(thisAuthData?.id ?? '', collectionsPage);

  const { data: followedCols = [], refetch: refetchFollowed } = useQueryGetUserFollowedCollections(
    !isPublicView ? (thisAuthData?.id ?? '') : '',
  );

  const {
    data: artistPatterns,
    isPending: isPendingArtist,
    isError: isErrArtist,
  } = useQueryGetPatternsByAuthor(isArtist ? (thisAuthData?.id ?? '') : '', artistPage);

  const [uploadOpen, setUploadOpen] = useState(false);
  const [lightboxPhoto, setLightboxPhoto] = useState<TypeGalleryResponse | null>(null);
  const [createColOpen, setCreateColOpen] = useState(false);

  const { tab } = Route.useSearch();
  const navigate = useNavigate({ from: '/profile/' });
  const setTab = (v: number) => void navigate({ search: (p) => ({ ...p, tab: v }), resetScroll: false });

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

  if (!thisAuthData) return <ProfileSkeleton />;

  const rawName = thisAuthData?.name ?? '';
  const displayName = (rawName.startsWith('NewUser_') ? 'New User' : rawName) || 'New User';
  const initial = displayName[0].toUpperCase();
  const galleryItems = dataGallery?.items ?? [];

  const avatarUrl = generateUserAvatarUrl(thisAuthData);
  const headerUrl = generateUserHeaderUrl(thisAuthData);

  const stats = [
    { Icon: FavoriteIcon, value: dataFav?.totalItems ?? 0, label: 'Saved', color: '#ef5350' },
    { Icon: CheckCircleIcon, value: dataDone?.totalItems ?? 0, label: 'Completed', color: '#66bb6a' },
    { Icon: StarOutlinedIcon, value: dataRatings?.totalItems ?? 0, label: 'Rated', color: '#ffa726' },
    { Icon: PhotoLibraryOutlinedIcon, value: dataGallery?.totalItems ?? 0, label: 'Photos', color: '#42a5f5' },
    { Icon: BookmarksOutlinedIcon, value: dataCols?.totalItems ?? 0, label: 'Collections', color: '#ab47bc' },
  ];

  const tabConfig = [
    { label: 'Favorites', Icon: FavoriteBorderOutlinedIcon, count: dataFav?.totalItems },
    { label: 'Completed', Icon: TaskAltOutlinedIcon, count: dataDone?.totalItems },
    { label: 'Rated', Icon: StarOutlinedIcon, count: dataRatings?.totalItems },
    { label: 'Gallery', Icon: PhotoLibraryOutlinedIcon, count: dataGallery?.totalItems },
    { label: 'Collections', Icon: BookmarksOutlinedIcon, count: dataCols?.totalItems },
  ];

  const shouldShowAbout = !!(thisAuthData.about || thisAuthData.interests || !isPublicView);

  return (
    <PageRoot>
      {/* ─── HERO ─────────────────────────────────────────────────────────── */}
      <HeroSection
        sx={
          headerUrl
            ? {
                backgroundImage: `
            linear-gradient(to top, rgba(0,0,0,0.72) 0%, rgba(0,0,0,0.35) 45%, rgba(0,0,0,0.08) 75%, transparent 100%),
            url(${headerUrl})
          `,
                backgroundSize: 'cover',
                backgroundPosition: 'center',
                '&::before': { display: 'none' },
                '&::after': { display: 'none' },
              }
            : {}
        }
      >
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
            <IconButton onClick={handleShare} sx={heroBtn}>
              <ShareRoundedIcon />
            </IconButton>
          </Tooltip>
          {!isPublicView && (
            <Tooltip title="Edit profile">
              <IconButton component={Link} to="/profile/edit" sx={heroBtn}>
                <EditRoundedIcon />
              </IconButton>
            </Tooltip>
          )}
        </Box>

        {/* Identity anchored to hero bottom */}
        <Box sx={{ flex: 1 }} />
        <Container
          maxWidth="lg"
          sx={{ px: { xs: 2, md: 4 }, pb: { xs: 3.5, md: 4.5 }, position: 'relative', zIndex: 1 }}
        >
          <Box sx={{ display: 'flex', alignItems: 'center', gap: { xs: 2, sm: 3 } }}>
            <HeroAvatar isArtist={isArtist}>
              {avatarUrl ? (
                <Box
                  component="img"
                  src={avatarUrl}
                  alt={displayName}
                  sx={{ width: '100%', height: '100%', objectFit: 'cover', borderRadius: '50%' }}
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
                }}
              >
                {displayName}
              </Typography>

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
      <Box sx={{ borderBottom: '1px solid', borderColor: 'divider', backgroundColor: 'background.paper' }}>
        <Container maxWidth="lg" sx={{ px: { xs: 0, md: 4 } }}>
          <Grid container sx={{ justifyContent: 'center' }}>
            {stats.map((stat, i) => (
              <Grid size={{ xs: 4, md: 2.4 }} key={stat.label}>
                <Box
                  sx={{
                    flex: 1,
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    py: { xs: 2.5, md: 3 },
                    borderRight: i < stats.length - 1 ? '1px solid' : 'none',
                    borderColor: 'divider',
                    gap: 0.75,
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
                    <Typography sx={{ fontSize: '0.7rem', color: 'text.disabled', fontWeight: 500 }}>
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
                  <MarkdownWrapper>{thisAuthData.about}</MarkdownWrapper>
                </AboutBody>
              ) : !isPublicView ? (
                <Typography color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '1rem' }}>
                  <Box
                    component={Link}
                    to="/profile/edit"
                    sx={{ color: 'primary.main', textDecoration: 'none', '&:hover': { textDecoration: 'underline' } }}
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
                        color="primary"
                        sx={{ borderRadius: 2, fontWeight: 500 }}
                      />
                    );
                  })}
                </Box>
              </Box>
            )}
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
                    {displayName}'s work
                  </Typography>
                </Box>
                {artistPatterns?.totalItems != null && artistPatterns.totalItems > 0 && (
                  <Chip
                    label={`${artistPatterns.totalItems} pattern${artistPatterns.totalItems !== 1 ? 's' : ''}`}
                    size="small"
                    color="secondary"
                    sx={{ fontWeight: 700, mt: 0.5, flexShrink: 0 }}
                  />
                )}
              </Box>

              <ArtistPatternGrid
                patterns={artistPatterns?.items}
                isPending={isPendingArtist}
                isError={isErrArtist}
                displayName={displayName}
              />

              {artistPatterns && artistPatterns.totalItems > 0 && (
                <PaginationBox data={artistPatterns} value={artistPage} setter={setArtistPage} />
              )}
            </Box>
          </Container>
        </>
      )}

      {/* ─── ACTIVITY ─────────────────────────────────────────────────────── */}
      <Box sx={{ borderTop: '1px solid', borderColor: 'divider' }}>
        <Container maxWidth="lg" sx={{ px: { xs: 2, md: 4 } }}>
          <Box sx={{ pt: 4, pb: 10 }}>
            <OverlineLabel sx={{ mb: 3 }}>Activity</OverlineLabel>

            <Tabs
              value={tab}
              onChange={(_, v) => setTab(v)}
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
                  borderColor: 'divider',
                  minHeight: 38,
                  px: 2,
                  py: 0,
                  textTransform: 'none',
                  fontWeight: 600,
                  fontSize: '0.875rem',
                  color: 'text.secondary',
                  transition: 'all 0.15s ease',
                  '&.Mui-selected': {
                    backgroundColor: 'primary.main',
                    color: 'primary.contrastText',
                    borderColor: 'primary.main',
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
                      {(t.count ?? 0) > 0 && <TabCount>{t.count}</TabCount>}
                    </Box>
                  }
                />
              ))}
            </Tabs>

            {/* Favorites */}
            {tab === 0 && (
              <>
                <ActivityPatternGrid
                  patterns={dataFav?.items}
                  isPending={isPendingFav}
                  isError={isErrFav}
                  emptyMessage="No favorited patterns yet."
                  emptyIcon={<FavoriteBorderOutlinedIcon />}
                />
                {dataFav && dataFav.totalItems > 0 && (
                  <PaginationBox data={dataFav} value={favoritePage} setter={setFavoritePage} />
                )}
              </>
            )}

            {/* Completed */}
            {tab === 1 && (
              <>
                <ActivityPatternGrid
                  patterns={dataDone?.items}
                  isPending={isPendingDone}
                  isError={isErrDone}
                  emptyMessage="No completed patterns yet."
                  emptyIcon={<TaskAltOutlinedIcon />}
                  showCompleted
                />
                {dataDone && dataDone.totalItems > 0 && (
                  <PaginationBox data={dataDone} value={donePage} setter={setDonePage} />
                )}
              </>
            )}

            {/* Rated */}
            {tab === 2 && (
              <>
                <ActivityPatternGrid
                  patterns={dataRatings?.items}
                  isPending={isPendingRatings}
                  isError={isErrRatings}
                  emptyMessage="No rated patterns yet."
                  emptyIcon={<StarOutlinedIcon />}
                  showRating
                />
                {dataRatings && dataRatings.totalItems > 0 && (
                  <PaginationBox data={dataRatings} value={ratingsPage} setter={setRatingsPage} />
                )}
              </>
            )}

            {/* Gallery */}
            {tab === 3 && (
              <Box>
                {!isPublicView && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
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
                  <Centered>
                    <CircularProgress />
                  </Centered>
                ) : isErrGallery ? (
                  <Alert severity="error">Unable to load gallery photos.</Alert>
                ) : galleryItems.length === 0 ? (
                  <EmptyState icon={<PhotoLibraryOutlinedIcon />} message="No gallery photos yet." />
                ) : (
                  <>
                    <GalleryGrid photos={galleryItems} onPhotoClick={setLightboxPhoto} />
                    <PaginationBox data={dataGallery} value={galleryPage} setter={setGalleryPage} />
                  </>
                )}
              </Box>
            )}

            {/* Collections */}
            {tab === 4 && (
              <Box>
                {!isPublicView && (
                  <Box sx={{ display: 'flex', justifyContent: 'flex-end', mb: 3 }}>
                    <Button
                      startIcon={<BookmarksOutlinedIcon />}
                      variant="contained"
                      onClick={() => setCreateColOpen(true)}
                    >
                      New Collection
                    </Button>
                  </Box>
                )}
                {isPendingCols ? (
                  <Centered>
                    <CircularProgress />
                  </Centered>
                ) : isErrCols ? (
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
                            onDeleted={() => void refetchCols()}
                            onEdited={() => void refetchCols()}
                          />
                        </Grid>
                      ))}
                    </Grid>
                    {dataCols.totalItems > 0 && (
                      <PaginationBox data={dataCols} value={collectionsPage} setter={setCollectionsPage} />
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
                            <CollectionCard collection={col} isOwner={false} hasUpdate={hasUpdate} />
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
          void refetchCols();
          setCreateColOpen(false);
        }}
      />
      <GalleryLightbox
        photo={lightboxPhoto}
        photos={galleryItems}
        onClose={() => setLightboxPhoto(null)}
        onNavigate={setLightboxPhoto}
        onDeleteSuccess={() => {
          void refetchGallery();
          setLightboxPhoto(null);
        }}
        onEditSuccess={() => {
          void refetchGallery();
          setLightboxPhoto(null);
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
    </PageRoot>
  );
};

// ─── Artist Pattern Grid ──────────────────────────────────────────────────────

type ArtistPatternGridProps = {
  patterns?: TypePatternResponse[];
  isPending: boolean;
  isError: boolean;
  displayName: string;
};

const ArtistPatternGrid = ({ patterns, isPending, isError, displayName }: ArtistPatternGridProps) => {
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

  return (
    <Grid container spacing={2} sx={{ mb: 3 }}>
      {patterns.map((pattern) => (
        <Grid size={{ xs: 6, sm: 4, md: 3 }} key={pattern.id}>
          <Link
            to="/"
            search={{ patternId: pattern.id, authors: [displayName] }}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <PatternCard>
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

  return (
    <Grid container spacing={2} sx={{ mb: 2.5 }}>
      {props.patterns.map((item) => (
        <Grid size={{ xs: 6, sm: 6, md: 3 }} key={item.id}>
          <Link
            to="/"
            search={{ id: [item.pattern_id], patternId: item.pattern_id }}
            style={{ textDecoration: 'none', display: 'block' }}
          >
            <PatternCard>
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
};

const GalleryLightbox = ({ photo, photos, onClose, onNavigate, onDeleteSuccess, onEditSuccess, isOwner }: GalleryLightboxProps) => {
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
    <Dialog open={!!photo} onClose={onClose} maxWidth="lg" fullWidth sx={{ '& .MuiDialog-paper': { borderRadius: 6 } }}>
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
                left: -3,
                backgroundColor: 'rgba(0,0,0,0.45)',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.65)' },
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
                right: -3,
                backgroundColor: 'rgba(0,0,0,0.45)',
                color: 'white',
                '&:hover': { backgroundColor: 'rgba(0,0,0,0.65)' },
              }}
            >
              <ChevronRightRoundedIcon />
            </IconButton>
          )}
        </Box>

        <Box sx={{ flex: 1, p: 3, display: 'flex', flexDirection: 'column', gap: 2, overflowY: 'auto', minWidth: 0 }}>
          <Box sx={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 1 }}>
            <Typography variant="h6" sx={{ fontWeight: 600, wordBreak: 'break-word' }}>
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
                    borderColor: 'divider',
                    borderRadius: 2,
                    transition: 'border-color 0.15s, background-color 0.15s',
                    '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
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
            <Box sx={{ display: 'flex', gap: 1, flexWrap: 'wrap' }}>
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

const TabCount = styled(Box)(({ theme }) => ({
  fontSize: '0.68rem',
  fontWeight: 700,
  lineHeight: '18px',
  minWidth: 18,
  padding: '0 5px',
  borderRadius: 9,
  backgroundColor: alpha(theme.palette.primary.main, 0.12),
  color: theme.palette.primary.main,
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

const ProfileError = ({ onRetry }: { onRetry: () => void }) => (
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
          <Button variant="outlined" onClick={onRetry} sx={{ mt: 1 }}>
            Try again
          </Button>
        </Box>
      </Container>
    </PageRoot>
  </GeneralLayout>
);
