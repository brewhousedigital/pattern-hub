import { useState } from 'react';
import { Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetSetById,
  useQueryGetUserFollowedSets,
  useMutationFollowSet,
  useMutationUnfollowSet,
} from '@/functions/database/sets';
import { useGlobalAuthData } from '@/data/auth-data';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternTileCard } from '@/components/cards/PatternTileCard';
import { PatternListDrawer } from '@/components/PatternListDrawer';
import { enqueueSnackbar } from 'notistack';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import NotificationsActiveRoundedIcon from '@mui/icons-material/NotificationsActiveRounded';
import NotificationsNoneRoundedIcon from '@mui/icons-material/NotificationsNoneRounded';

import { Alert, Box, Button, Container, Grid, Link as MuiLink, Skeleton, Stack, Typography, Chip } from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/sets/$setId')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Set', '', match.pathname),
  }),
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { setId } = Route.useParams();
  const { data: set, isPending, isError } = useQueryGetSetById(setId);
  const { authData } = useGlobalAuthData();

  const patterns = set?.expand?.patterns ?? [];

  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

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
  // Disabled while followedLoading to prevent a double-follow race during the initial fetch window
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
      <Container maxWidth="lg" sx={{ py: 5 }}>
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

        {isPending && (
          <>
            <Skeleton variant="text" width={320} height={48} sx={{ mb: 1 }} />
            <Skeleton variant="text" width={480} height={24} sx={{ mb: 4 }} />
            <Grid container spacing={2}>
              {Array.from({ length: 12 }).map((_, i) => (
                <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: 4 }} />
                </Grid>
              ))}
            </Grid>
          </>
        )}

        {set && (
          <>
            {!set.is_published && (
              <Alert severity="warning" sx={{ mb: 3 }}>
                This set is not published.
              </Alert>
            )}

            {/* Set header */}
            <Box
              sx={{
                mb: 4,
                pb: 3,
                borderBottom: '1px solid',
                borderColor: 'divider',
                borderLeft: set.color ? `4px solid ${set.color}` : 'none',
                pl: set.color ? 2 : 0,
              }}
            >
              <Stack
                direction="row"
                sx={{ alignItems: 'flex-start', mb: 0.5, flexWrap: 'wrap', gap: 1.5, justifyContent: 'space-between' }}
              >
                <Box>
                  <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2, mb: 1 }}>
                    {set.title}
                  </Typography>

                  <Chip
                    icon={<StyleRoundedIcon sx={{ fontSize: '13px !important' }} />}
                    label={`${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}`}
                    size="small"
                    variant="outlined"
                    sx={{ fontSize: '0.72rem', height: 24 }}
                  />
                </Box>

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
                  >
                    {isFollowing ? 'Following' : 'Follow'}
                  </Button>
                )}
              </Stack>

              {set.description && (
                <Box sx={{ maxWidth: 700, mt: 1 }}>
                  <MarkdownWrapper>{set.description}</MarkdownWrapper>
                </Box>
              )}
            </Box>

            {/* Pattern grid */}
            {patterns.length === 0 ? (
              <Box sx={{ textAlign: 'center', py: 10 }}>
                <StyleRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
                <Typography variant="h6" color="text.secondary">
                  No patterns in this set yet
                </Typography>
              </Box>
            ) : (
              <Grid container spacing={2}>
                {patterns.map((pattern, i) => (
                  <Grid key={pattern.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                    <PatternTileCard pattern={pattern} onSelect={() => setSelectedIndex(i)} />
                  </Grid>
                ))}
              </Grid>
            )}
          </>
        )}
      </Container>

      <PatternListDrawer
        patterns={patterns}
        selectedIndex={selectedIndex}
        onNavigate={setSelectedIndex}
        onClose={() => setSelectedIndex(null)}
      />
    </GeneralLayout>
  );
}
