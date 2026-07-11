import { useState, useMemo } from 'react';
import { Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import Fuse from 'fuse.js';
import { BrowseSearchBar, type BrowseSortValue, applyBrowseSort } from '@/components/browse/BrowseSearchBar';
import {
  getSetByIdOptions,
  useQueryGetSetById,
  useQueryGetUserFollowedSets,
  useMutationFollowSet,
  useMutationUnfollowSet,
} from '@/functions/database/sets';
import { useGlobalAuthData } from '@/data/auth-data';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { stripMarkdown, truncate } from '@/functions/utilities/strip-markdown';
import { createPrettyDate } from '@/functions/utilities/dates';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternTileCard } from '@/components/cards/PatternTileCard';
import { PatternListDrawer } from '@/components/PatternListDrawer';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { enqueueSnackbar } from 'notistack';
import { alpha } from '@mui/material/styles';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';
import ExtensionIcon from '@mui/icons-material/Extension';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

import {
  Alert,
  Box,
  Button,
  Container,
  Grid,
  Link as MuiLink,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/sets/$setId')({
  component: RouteComponent,
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(getSetByIdOptions(params.setId)).catch(() => undefined),
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.title,
      loaderData?.description ? truncate(stripMarkdown(loaderData.description), 160) : '',
      match.pathname,
    ),
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { setId } = Route.useParams();
  const { data: set, isPending, isError } = useQueryGetSetById(setId);
  const { authData } = useGlobalAuthData();

  // Memoised so the fallback [] doesn't create a new identity every render
  // (it feeds the fuse/filteredPatterns memos below)
  const patterns = useMemo(() => set?.expand?.patterns ?? [], [set?.expand?.patterns]);

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

  // ── Follow state ──────────────────────────────────────────────────────────
  const canFollow = !!authData;

  const {
    data: followedSets = [],
    isLoading: followedLoading,
    refetch: refetchFollowed,
  } = useQueryGetUserFollowedSets(authData?.id || '');
  const followRecord = followedSets.find((f) => f.set_id === setId);
  const isFollowing = !!followRecord;

  const followMutation = useMutationFollowSet();
  const unfollowMutation = useMutationUnfollowSet();
  const followButtonLoading = followMutation.isPending || unfollowMutation.isPending || followedLoading;

  const handleFollowToggle = async () => {
    if (!set || !canFollow) return;
    try {
      if (isFollowing && followRecord) {
        await unfollowMutation.mutateAsync(followRecord.id);
      } else {
        await followMutation.mutateAsync({ setId, setUpdated: set.updated });
      }
      await refetchFollowed();
    } catch {
      enqueueSnackbar('Something went wrong trying to follow this set... try again in a minute or two.', {
        variant: 'error',
      });
    }
  };
  // ─────────────────────────────────────────────────────────────────────────

  return (
    <GeneralLayout>
      <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        {/* Back link */}
        <MuiLink
          component={Link}
          to="/sets"
          sx={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: 0.5,
            mb: 3,
            fontSize: 14,
            fontWeight: 500,
            textDecoration: 'none',
            color: 'text.secondary',
            '&:hover': { color: 'text.primary' },
          }}
        >
          <ArrowBackRoundedIcon sx={{ fontSize: 16 }} />
          All Sets
        </MuiLink>

        {isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Set not found or failed to load. It may have been removed or is not published.
          </Alert>
        )}

        {isPending && <SetDetailSkeleton />}

        {set && (
          <>
            <BreadcrumbJsonLd
              items={[
                { name: 'Home', url: '/' },
                { name: 'Sets', url: '/sets' },
                { name: set.title, url: `/sets/${setId}` },
              ]}
            />

            {!set.is_published && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                This set is not published.
              </Alert>
            )}

            {/* ─── Header ─── */}
            <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 2.5, md: 4 }, mb: 3 }}>
              <Stack
                direction={{ xs: 'column', md: 'row' }}
                spacing={2}
                sx={{ alignItems: { xs: 'center', md: 'flex-start' } }}
              >
                {/* Icon box — uses the set's accent color when available */}
                <Box
                  sx={{
                    width: 52,
                    height: 52,
                    borderRadius: 2,
                    backgroundColor: set.color ? alpha(set.color, 0.15) : (t) => alpha(t.palette.primary.main, 0.1),
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    flexShrink: 0,
                  }}
                >
                  <StyleRoundedIcon sx={{ color: set.color ?? 'primary.main' }} />
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
                        {set.title}
                      </Typography>

                      {set.description && (
                        <Box sx={{ mb: 1.5 }}>
                          <MarkdownWrapper>{set.description}</MarkdownWrapper>
                        </Box>
                      )}
                    </Grid>

                    <Grid size={{ xs: 12, md: 6 }} sx={{ textAlign: { xs: 'center', md: 'right' } }}>
                      {canFollow && (
                        <Button
                          size="small"
                          variant={isFollowing ? 'contained' : 'outlined'}
                          loading={followButtonLoading}
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
                      {`${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}`}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem', mr: 'auto' }}
                    >
                      <CalendarTodayOutlinedIcon fontSize="inherit" /> {createPrettyDate(set.created)}
                    </Typography>

                    <Typography
                      variant="body2"
                      sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}
                    >
                      Last Updated: {createPrettyDate(set.updated)}
                    </Typography>
                  </Stack>
                </Box>
              </Stack>
            </Paper>

            {/* ─── Pattern grid ─── */}
            {patterns.length === 0 ? (
              <Box
                sx={{
                  py: 8,
                  textAlign: 'center',
                  border: '1.5px dashed',
                  borderColor: 'divider',
                  borderRadius: 3,
                }}
              >
                <StyleRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                <Typography variant="body1" color="text.disabled">
                  No patterns in this set yet.
                </Typography>
              </Box>
            ) : (
              <>
                <BrowseSearchBar
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
                    <StyleRoundedIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
                    <Typography variant="body1" color="text.disabled">
                      No patterns match your search.
                    </Typography>
                  </Box>
                ) : (
                  <Grid container spacing={2}>
                    {filteredPatterns.map((pattern, i) => (
                      <Grid key={pattern.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
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

const SetDetailSkeleton = () => (
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
    <Grid container spacing={2}>
      {Array.from({ length: 12 }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: 4 }} />
        </Grid>
      ))}
    </Grid>
  </>
);
