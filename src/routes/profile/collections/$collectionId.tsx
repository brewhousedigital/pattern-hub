import { createFileRoute, Link } from '@tanstack/react-router';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  useQueryGetCollectionById,
  useQueryGetUserFollowedCollections,
  useMutationFollowCollection,
  useMutationUnfollowCollection,
} from '@/functions/database/collections';
import { createPrettyDate } from '@/functions/utilities/dates';
import { generateSEO } from '@/functions/utilities/seo';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternTileCard } from '@/components/cards/PatternTileCard';
import { alpha } from '@mui/material/styles';

import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ExtensionIcon from '@mui/icons-material/Extension';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

import { Alert, Box, Button, Container, Paper, Skeleton, Stack, Typography, Grid } from '@mui/material';

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

  const patterns = collection?.expand?.patterns ?? [];
  const patternIdArray = patterns.map((item) => item.id);

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
      // notistack not imported here - silent; user can retry
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
                    backgroundColor: (t) => alpha(t.palette.primary.main, 0.1),
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
                        <Box sx={{ mb: 1.5 }}>
                          <MarkdownWrapper>{collection.description}</MarkdownWrapper>
                        </Box>
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
            {!patterns || patterns.length === 0 ? (
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
              <Grid container spacing={2}>
                {patterns.map((pattern) => (
                  <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={pattern.id}>
                    <PatternTileCard pattern={pattern} patternIdArray={patternIdArray} />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Container>
    </GeneralLayout>
  );
}

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
