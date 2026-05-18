import React from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  useQueryGetCollectionById,
  useQueryGetUserFollowedCollections,
  useMutationFollowCollection,
  useMutationUnfollowCollection,
} from '@/functions/database/collections';
import { generatePbImage, generatePbImageSVG } from '@/functions/utilities/generate-pb-image';
import { createPrettyDate } from '@/functions/utilities/dates';
import { generateSEO } from '@/functions/utilities/seo';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { DecorativeTitle } from '@/components/ViewHelpers';
import { alpha } from '@mui/material/styles';

import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import ExpandLessRoundedIcon from '@mui/icons-material/ExpandLessRounded';
import ExpandMoreRoundedIcon from '@mui/icons-material/ExpandMoreRounded';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import PersonOutlinedIcon from '@mui/icons-material/PersonOutlined';
import ExtensionIcon from '@mui/icons-material/Extension';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import DownloadIcon from '@mui/icons-material/Download';
import OpenInNewRoundedIcon from '@mui/icons-material/OpenInNewRounded';
import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import LocalOfferOutlinedIcon from '@mui/icons-material/LocalOfferOutlined';

import {
  Alert,
  Box,
  Button,
  Collapse,
  Chip,
  CircularProgress,
  Container,
  Divider,
  Paper,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
  Grid,
} from '@mui/material';
import { ExportPatternForPrintV3 } from '@/components/PatternExport/ExportPatternForPrintV3.tsx';
import { ExportPatternForSVG } from '@/components/PatternExport/ExportPatternForSVG.tsx';

export const Route = createFileRoute('/profile/collections/$collectionId')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Collection', '', match.pathname),
  }),
});

function RouteComponent() {
  const { collectionId } = Route.useParams();
  const { authData } = useGlobalAuthData();

  const { isPending, isError, data: collection } = useQueryGetCollectionById(collectionId);

  // Follow state
  const isOwner = !!authData && !!collection && authData.id === collection.owner_id;
  const canFollow = !!authData && !isOwner;

  const { data: followedCollections = [], refetch: refetchFollowed } = useQueryGetUserFollowedCollections(
    authData?.id || '',
  );
  const followRecord = followedCollections.find((f) => f.collection_id === collectionId);
  const isFollowing = !!followRecord;

  const followMutation = useMutationFollowCollection();
  const unfollowMutation = useMutationUnfollowCollection();
  const followLoading = followMutation.isPending || unfollowMutation.isPending;

  const handleFollowToggle = async () => {
    if (!collection) return;
    try {
      if (isFollowing && followRecord) {
        await unfollowMutation.mutateAsync(followRecord.id);
      } else {
        await followMutation.mutateAsync({ collectionId, collectionUpdated: collection.updated });
      }
      await refetchFollowed();
    } catch {
      // notistack not imported here — silent; user can retry
    }
  };

  return (
    <GeneralLayout>
      <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        {isPending ? (
          <CollectionDetailSkeleton />
        ) : isError || !collection ? (
          <Alert severity="error">
            This collection could not be found. It may have been deleted or the link is incorrect.
          </Alert>
        ) : (
          <>
            {/* ─── Header ─── */}
            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, md: 4 }, mb: 3 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ alignItems: { xs: 'center', md: 'flex-start' } }}
              >
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <BookmarksOutlinedIcon color="primary" />
                </Box>

                <Box sx={{ flex: 1, minWidth: 0 }}>
                  <Grid
                    container
                    spacing={2}
                    sx={{ justifyContent: 'space-between', alignItems: 'flex-start', mb: { xs: 4, md: 0 } }}
                  >
                    <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: 'center', md: 'left' } }}>
                      <Typography variant="h5" fontWeight={700} sx={{ letterSpacing: '-0.4px', mb: 0.5 }}>
                        {collection.name}
                      </Typography>

                      {collection.description && (
                        <Typography variant="body2" color="text.secondary" sx={{ mb: 1.5 }}>
                          {collection.description}
                        </Typography>
                      )}

                      {collection.expand?.owner_id && (
                        <Typography sx={{ mb: 2 }}>
                          By:{' '}
                          <Link to="/profile" search={{ id: collection.owner_id }}>
                            {collection.expand.owner_id.name || 'Unknown'}
                          </Link>
                        </Typography>
                      )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: 'center', md: 'right' } }}>
                      {canFollow && (
                        <Button
                          size="small"
                          variant={isFollowing ? 'contained' : 'outlined'}
                          loading={followLoading}
                          onClick={handleFollowToggle}
                          startIcon={
                            isFollowing ? (
                              <NotificationsActiveRoundedIcon fontSize="small" />
                            ) : (
                              <NotificationsNoneRoundedIcon fontSize="small" />
                            )
                          }
                          sx={{ ml: 'auto' }}
                        >
                          {isFollowing ? 'Following' : 'Follow'}
                        </Button>
                      )}
                    </Grid>
                  </Grid>

                  <Stack direction="row" sx={{ flexWrap: 'wrap', width: '100%', gap: 2.5, alignItems: 'center' }}>
                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}
                    >
                      <ExtensionIcon fontSize="inherit" />{' '}
                      {`${collection.patterns.length} pattern${collection.patterns.length !== 1 ? 's' : ''}`}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem', mr: 'auto' }}
                    >
                      <CalendarTodayOutlinedIcon fontSize="inherit" /> {createPrettyDate(collection.created)}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}
                    >
                      Last Updated: {createPrettyDate(collection.updated)}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            {/* ─── Pattern list ─── */}
            {!collection.expand?.patterns || collection.expand.patterns.length === 0 ? (
              <Box
                sx={{
                  py: 8,
                  textAlign: 'center',
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  borderRadius: 3,
                }}
              >
                <ExtensionIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.disabled">
                  No patterns in this collection yet.
                </Typography>
              </Box>
            ) : (
              <Stack spacing={2}>
                {collection.expand.patterns.map((pattern, index) => (
                  <React.Fragment key={pattern.id}>
                    <CollectionPatternRow pattern={pattern} />
                    {index < (collection.expand?.patterns?.length ?? 0) - 1 && <Divider />}
                  </React.Fragment>
                ))}
              </Stack>
            )}
          </>
        )}
      </Container>
    </GeneralLayout>
  );
}

// ─── Pattern row ──────────────────────────────────────────────────────────────

type CollectionPatternRowProps = {
  pattern: TypePatternResponse;
};

const CollectionPatternRow = ({ pattern }: CollectionPatternRowProps) => {
  const imageSrc = generatePbImage(pattern);
  const svgDownloadSrc = generatePbImageSVG(pattern);
  const authorName = pattern.expand?.authors?.map((a) => a.name).join(', ') || pattern.author_manual?.join(', ') || '';
  const visibleTags = pattern.tags?.slice(0, 25) ?? [];
  const extraTagCount = (pattern.tags?.length ?? 0) - visibleTags.length;

  const [isVisible, setIsVisible] = React.useState(false);

  return (
    <>
      <Box
        sx={{
          display: 'flex',
          gap: { xs: 2, sm: 3 },
          alignItems: 'flex-start',
          py: 1,
        }}
      >
        {/* Thumbnail */}
        <Box
          sx={{
            backgroundColor: '#fff',
            flexShrink: 0,
            width: { xs: 72, sm: 100 },
            height: { xs: 72, sm: 100 },
            borderRadius: 2,
            overflow: 'hidden',
            border: '1px solid',
            borderColor: 'divider',
            display: 'block',
          }}
        >
          <Box
            component="img"
            loading="lazy"
            src={imageSrc}
            alt={pattern.name}
            sx={{ width: '100%', height: '100%', objectFit: 'contain', display: 'block', p: 1 }}
          />
        </Box>

        {/* Info */}
        <Box sx={{ flex: 1, minWidth: 0 }}>
          <Typography
            variant="subtitle1"
            fontWeight={700}
            sx={{ mb: 0.25, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
          >
            {pattern.name}
          </Typography>

          {authorName && (
            <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.5 }}>
              by {authorName}
            </Typography>
          )}

          {pattern.description && (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: '0.8rem',
                mb: 0.75,
              }}
            >
              {pattern.description}
            </Typography>
          )}

          {visibleTags.length > 0 && (
            <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5, alignItems: 'center' }}>
              <LocalOfferOutlinedIcon sx={{ fontSize: 14, color: 'text.disabled', mt: '3px' }} />
              {visibleTags.map((tag) => (
                <Chip
                  key={tag}
                  label={tag}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              ))}
              {extraTagCount > 0 && (
                <Chip
                  label={`+${extraTagCount}`}
                  size="small"
                  variant="outlined"
                  sx={{ height: 20, fontSize: '0.7rem', '& .MuiChip-label': { px: 0.75 } }}
                />
              )}
            </Stack>
          )}
        </Box>

        {/* Actions */}
        <Stack spacing={1} sx={{ flexShrink: 0, alignSelf: 'center' }}>
          {pattern.pattern_file && (
            <Button
              size="small"
              variant="text"
              onClick={() => setIsVisible(!isVisible)}
              startIcon={
                isVisible ? <ExpandLessRoundedIcon fontSize="small" /> : <ExpandMoreRoundedIcon fontSize="small" />
              }
            >
              More Details
            </Button>
          )}

          {pattern?.pattern_file_external && (
            <Button size="small" variant="text" startIcon={<LaunchRoundedIcon fontSize="small" />}>
              View
            </Button>
          )}
        </Stack>
      </Box>

      <Collapse in={isVisible}>
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <ExportPatternForPrintV3 viewData={pattern} key={'print' + pattern?.id} />
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <ExportPatternForSVG viewData={pattern} key={'svg' + pattern?.id} />

            <BorderedCard>
              <DecorativeTitle>View</DecorativeTitle>

              <Typography sx={{ mb: 3, textAlign: 'center' }}>
                You can also view this pattern on it's standalone page
              </Typography>

              <Button
                component={Link as any}
                to={'/'}
                search={{ id: [pattern.id], patternId: pattern.id }}
                fullWidth
                variant="contained"
              >
                View Pattern
              </Button>
            </BorderedCard>
          </Grid>
        </Grid>
      </Collapse>
    </>
  );
};

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const CollectionDetailSkeleton = () => (
  <>
    <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, md: 4 }, mb: 3 }}>
      <Stack direction="row" spacing={2}>
        <Skeleton variant="rounded" width={52} height={52} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="40%" sx={{ fontSize: '1.5rem', mb: 0.5 }} />
          <Skeleton variant="text" width="70%" />
          <Stack direction="row" spacing={1} sx={{ mt: 1.5 }}>
            <Skeleton variant="rounded" width={100} height={24} />
            <Skeleton variant="rounded" width={80} height={24} />
          </Stack>
        </Box>
      </Stack>
    </Paper>
    <Stack spacing={2}>
      {[1, 2, 3].map((i) => (
        <Box key={i} sx={{ display: 'flex', gap: 3, alignItems: 'flex-start', py: 1 }}>
          <Skeleton variant="rounded" width={100} height={100} />
          <Box sx={{ flex: 1 }}>
            <Skeleton variant="text" width="50%" sx={{ fontSize: '1rem' }} />
            <Skeleton variant="text" width="30%" sx={{ fontSize: '0.75rem' }} />
            <Skeleton variant="text" width="80%" />
            <Skeleton variant="text" width="60%" />
          </Box>
        </Box>
      ))}
    </Stack>
  </>
);
