import { useState } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { generateSEO } from '@/functions/utilities/seo';
import {
  getManualAuthorBySlugOptions,
  useQueryGetManualAuthorBySlug,
  useQueryGetPatternsByManualAuthorName,
} from '@/functions/database/manual-authors';
import { generateManualAuthorAvatarUrl } from '@/functions/utilities/generate-pb-image';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternTileCard } from '@/components/cards/PatternTileCard';
import { PatternListDrawer } from '@/components/PatternListDrawer';
import { BreadcrumbJsonLd } from '@/components/BreadcrumbJsonLd';
import { staticCacheHeaders } from '@/functions/utilities/cache-headers';

import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import PersonRoundedIcon from '@mui/icons-material/PersonRounded';
import ExtensionIcon from '@mui/icons-material/Extension';

import {
  Alert,
  Avatar,
  Box,
  Button,
  Container,
  Grid,
  Pagination,
  Paper,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/authors/$slug')({
  component: RouteComponent,
  loader: ({ params, context }) =>
    context.queryClient.ensureQueryData(getManualAuthorBySlugOptions(params.slug)).catch(() => undefined),
  head: ({ loaderData, match }) =>
    generateSEO(
      loaderData?.name,
      loaderData?.description || (loaderData?.name ? `Stained glass patterns by ${loaderData.name}.` : ''),
      match.pathname,
      // Author avatar if uploaded, otherwise a generated author card
      (loaderData && generateManualAuthorAvatarUrl(loaderData)) ||
        (loaderData?.name
          ? `https://patternarchive.net/api/og-image?type=author&title=${encodeURIComponent(loaderData.name)}`
          : undefined),
    ),
  headers: staticCacheHeaders,
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { slug } = Route.useParams();
  const [page, setPage] = useState(1);
  const [selectedIndex, setSelectedIndex] = useState<number | null>(null);

  const { data: author, isPending: authorPending, isError: authorError } = useQueryGetManualAuthorBySlug(slug);
  const { data: patternsData, isPending: patternsPending } = useQueryGetPatternsByManualAuthorName(
    author?.name ?? '',
    page,
  );

  const patterns = patternsData?.items ?? [];
  const totalPages = patternsData?.totalPages ?? 1;
  const totalItems = patternsData?.totalItems ?? 0;

  if (authorPending)
    return (
      <GeneralLayout>
        <AuthorSkeleton />
      </GeneralLayout>
    );

  if (authorError || !author) {
    return (
      <GeneralLayout>
        <Container maxWidth="lg" sx={{ py: 6 }}>
          <Alert severity="info">
            This artist page could not be found. It may not exist yet, or may have been unpublished.
          </Alert>
        </Container>
      </GeneralLayout>
    );
  }

  const avatarUrl = generateManualAuthorAvatarUrl(author);

  return (
    <GeneralLayout>
      <BreadcrumbJsonLd
        items={[
          { name: 'Home', url: '/' },
          { name: author.name, url: `/authors/${slug}` },
        ]}
      />
      <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, md: 4 } }}>
        {/* ─── Header card ─── */}
        <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 3, md: 4 }, mb: 4 }}>
          <Stack
            direction={{ xs: 'column', sm: 'row' }}
            spacing={3}
            sx={{ alignItems: { xs: 'center', sm: 'flex-start' } }}
          >
            <Avatar src={avatarUrl ?? undefined} sx={{ width: 100, height: 100, flexShrink: 0, fontSize: '2.5rem' }}>
              <PersonRoundedIcon sx={{ fontSize: 52 }} />
            </Avatar>

            <Box sx={{ flex: 1, minWidth: 0, textAlign: { xs: 'center', sm: 'left' } }}>
              <Typography variant="h4" component="h1" sx={{ fontWeight: 700, letterSpacing: '-0.5px', mb: 0.5 }}>
                {author.name}
              </Typography>

              {author.description && (
                <Box sx={{ mb: author.external_url ? 2 : 0, color: 'text.secondary' }}>
                  <MarkdownWrapper>{author.description}</MarkdownWrapper>
                </Box>
              )}

              {author.external_url && (
                <Button
                  variant="contained"
                  href={author.external_url}
                  target="_blank"
                  rel="noopener noreferrer"
                  endIcon={<LaunchRoundedIcon />}
                  sx={{ mt: author.description ? 0 : 1 }}
                >
                  Learn More
                </Button>
              )}
            </Box>
          </Stack>
        </Paper>

        {/* ─── Patterns ─── */}
        <Box sx={{ mb: 2 }}>
          <Typography variant="h6" sx={{ fontWeight: 600 }}>
            Patterns by {author.name}
          </Typography>
          {!patternsPending && (
            <Typography variant="body2" color="text.secondary">
              {totalItems} pattern{totalItems !== 1 ? 's' : ''}
            </Typography>
          )}
        </Box>

        {patternsPending ? (
          <Grid container spacing={2}>
            {Array.from({ length: 8 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
        ) : patterns.length === 0 ? (
          <Box sx={{ py: 8, textAlign: 'center', border: '1.5px dashed', borderColor: 'divider', borderRadius: 3 }}>
            <ExtensionIcon sx={{ fontSize: 40, color: 'text.disabled', mb: 1 }} />
            <Typography variant="body1" color="text.disabled">
              No patterns found for this artist yet.
            </Typography>
          </Box>
        ) : (
          <>
            <Grid container spacing={2}>
              {patterns.map((pattern, i) => (
                <Grid key={pattern.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
                  <PatternTileCard pattern={pattern} onSelect={() => setSelectedIndex(i)} />
                </Grid>
              ))}
            </Grid>

            {totalPages > 1 && (
              <Stack sx={{ mt: 4, alignItems: 'center' }}>
                <Pagination
                  count={totalPages}
                  page={page}
                  onChange={(_, v) => {
                    setPage(v);
                    setSelectedIndex(null);
                  }}
                  color="primary"
                  shape="rounded"
                />
              </Stack>
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

// ─── Skeleton ─────────────────────────────────────────────────────────────────

const AuthorSkeleton = () => (
  <Container maxWidth="lg" sx={{ py: 4, px: { xs: 2, md: 4 } }}>
    <Paper elevation={0} variant="outlined" sx={{ borderRadius: 3, p: { xs: 3, md: 4 }, mb: 4 }}>
      <Stack direction="row" spacing={3} sx={{ alignItems: 'flex-start' }}>
        <Skeleton variant="circular" width={100} height={100} />
        <Box sx={{ flex: 1 }}>
          <Skeleton variant="text" width="40%" sx={{ fontSize: '2rem', mb: 1 }} />
          <Skeleton variant="text" width="80%" />
          <Skeleton variant="text" width="60%" />
          <Skeleton variant="rounded" width={140} height={36} sx={{ mt: 2 }} />
        </Box>
      </Stack>
    </Paper>
    <Grid container spacing={2}>
      {Array.from({ length: 8 }).map((_, i) => (
        <Grid key={i} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
          <Skeleton variant="rounded" sx={{ aspectRatio: '1/1', borderRadius: 3 }} />
        </Grid>
      ))}
    </Grid>
  </Container>
);
