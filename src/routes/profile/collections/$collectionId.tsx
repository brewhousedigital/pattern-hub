import { useState, useMemo } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import Fuse from 'fuse.js';
import { BrowseSearchBar, type BrowseSortValue, applyBrowseSort } from '@/components/browse/BrowseSearchBar';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  getCollectionByIdOptions,
  useQueryGetCollectionById,
  useQueryGetUserFollowedCollections,
  useMutationFollowCollection,
  useMutationUnfollowCollection,
} from '@/functions/database/collections';
import { createPrettyDate } from '@/functions/utilities/dates';
import { generateSEO } from '@/functions/utilities/seo';
import { stripMarkdown, truncate } from '@/functions/utilities/strip-markdown';
import { generateUserAvatarUrl } from '@/functions/utilities/generate-pb-image';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternTileCard } from '@/components/cards/PatternTileCard';
import { PatternListDrawer } from '@/components/PatternListDrawer';
import { alpha } from '@mui/material/styles';
import { enqueueSnackbar } from 'notistack';

import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ExtensionIcon from '@mui/icons-material/Extension';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

import { Alert, Avatar, Box, Button, Container, Paper, Skeleton, Stack, Typography, Grid } from '@mui/material';

export const Route = createFileRoute('/profile/collections/$collectionId')({
  component: RouteComponent,
  // Loader runs on the server so shared collection links get real SEO meta;
  // the component itself renders client-side only (auth-dependent UI).
  ssr: 'data-only',
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(getCollectionByIdOptions(params.collectionId)).catch(() => undefined),
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.name,
      loaderData?.description ? truncate(stripMarkdown(loaderData.description), 160) : '',
      match.pathname,
    ),
});

function RouteComponent() {
  const { collectionId } = Route.useParams();
  const { authData } = useGlobalAuthData();

  const { isPending, isError, data: collection } = useQueryGetCollectionById(collectionId);

  // Memoised so the fallback [] doesn't create a new identity every render
  // (it feeds the fuse/filteredPatterns memos below)
  const patterns = useMemo(() => collection?.expand?.patterns ?? [], [collection?.expand?.patterns]);

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
  const [patternSearch, setPatternSearch] = useState('');
  const [patternSort, setPatternSort] = useState<BrowseSortValue>('-updated');

  const fuse = useMemo(
    () =>
      new Fuse(patterns, {
        keys: [
          { name: 'name', weight: 1.0 },
          { name: 'description', weight: 0.7 },
          { name: 'tags', weight: 0.8 },
          { name: 'author_manual', weight: 0.5 },
          { name: 'difficulty', weight: 0.3 },
        ],
        threshold: 0.35,
        minMatchCharLength: 2,
        ignoreLocation: true,
      }),
    [patterns],
  );

  const filteredPatterns = useMemo(() => {
    const results = patternSearch.trim() ? fuse.search(patternSearch).map((r) => r.item) : patterns;
    return applyBrowseSort(results, patternSort);
  }, [patternSearch, fuse, patterns, patternSort]);

  // Follow state
  const isOwner = !!authData && !!collection && authData.id === collection.owner_id;
  const canFollow = !!authData && !isOwner;

  const {
    data: followedCollections = [],
    isLoading: followedLoading,
    refetch: refetchFollowed,
  } = useQueryGetUserFollowedCollections(authData?.id || '');
  const followRecord = followedCollections.find((f) => f.collection_id === collectionId);
  const isFollowing = !!followRecord;

  const followMutation = useMutationFollowCollection();
  const unfollowMutation = useMutationUnfollowCollection();
  // Also disabled while followedLoading to prevent a double-follow race during the initial fetch window
  const followLoading = followMutation.isPending || unfollowMutation.isPending || followedLoading;

  const handleFollowToggle = async () => {
    if (!collection || !canFollow) return;
    try {
      if (isFollowing && followRecord) {
        await unfollowMutation.mutateAsync(followRecord.id);
      } else {
        await followMutation.mutateAsync({ collectionId, collectionUpdated: collection.updated });
      }
      await refetchFollowed();
    } catch {
      enqueueSnackbar('Something went wrong trying to follow this collection... try again in a minute or two.', {
        variant: 'error',
      });
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
                      <Typography
                        variant="h5"
                        component="h1"
                        sx={{ fontWeight: 700, letterSpacing: '-0.4px', mb: 0.5 }}
                      >
                        {collection.name}
                      </Typography>

                      {collection.description && (
                        <Box sx={{ mb: 1.5 }}>
                          <MarkdownWrapper>{collection.description}</MarkdownWrapper>
                        </Box>
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
                    {collection.expand?.owner_id && (
                      <Link
                        to="/profile"
                        search={{ id: collection.owner_id, tab: 0 }}
                        style={{ textDecoration: 'none', display: 'block' }}
                      >
                        <Box
                          sx={{
                            display: 'flex',
                            alignItems: 'center',
                            gap: 1,
                            px: 1.25,
                            py: 0.5,
                            borderRadius: 6,
                            border: '1px solid',
                            borderColor: 'divider',
                            transition: 'border-color 0.15s, background-color 0.15s',
                            '&:hover': { borderColor: 'primary.main', backgroundColor: 'action.hover' },
                          }}
                        >
                          <Avatar
                            src={generateUserAvatarUrl(collection.expand.owner_id) ?? undefined}
                            sx={{ width: 22, height: 22, fontSize: '0.65rem' }}
                          >
                            {(collection.expand.owner_id.name || '?')[0].toUpperCase()}
                          </Avatar>
                          <Typography
                            variant="body2"
                            sx={{ fontSize: '0.8rem', color: 'text.primary', fontWeight: 500 }}
                          >
                            {collection.expand.owner_id.name || 'Unknown'}
                          </Typography>
                        </Box>
                      </Link>
                    )}

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
              <>
                <BrowseSearchBar
                  title={collection.name}
                  value={patternSearch}
                  onChange={(v) => {
                    setPatternSearch(v);
                    setSelectedIndex(null);
                  }}
                  placeholder="Search patterns by name, tag, description…"
                  totalCount={patterns.length}
                  resultCount={filteredPatterns.length}
                  sortValue={patternSort}
                  onSortChange={setPatternSort}
                />

                {filteredPatterns.length === 0 ? (
                  <Box
                    sx={{ py: 8, textAlign: 'center', border: '1.5px dashed', borderColor: 'divider', borderRadius: 3 }}
                  >
                    <ExtensionIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body1" color="text.disabled">
                      No patterns match your search.
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {filteredPatterns.map((pattern, i) => (
                      <Grid size={{ xs: 12, sm: 6, md: 4, lg: 3 }} key={pattern.id}>
                        <PatternTileCard pattern={pattern} onSelect={() => setSelectedIndex(i)} />
                      </Grid>
                    ))}
                  </Grid>
                )}
              </>
            )}
          </>
        )}
      </Container>

      <PatternListDrawer
        patterns={filteredPatterns}
        selectedIndex={selectedIndex}
        onNavigate={setSelectedIndex}
        onClose={() => setSelectedIndex(null)}
      />
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
