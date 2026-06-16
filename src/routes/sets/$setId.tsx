import { Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetSetById } from '@/functions/database/sets';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { MarkdownWrapper } from '@/components/MarkdownWrapper';
import { PatternTileCard } from '@/components/cards/PatternTileCard';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';

import { Alert, Box, Container, Grid, Link as MuiLink, Skeleton, Stack, Typography, Chip } from '@mui/material';

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

  const patterns = set?.expand?.patterns ?? [];
  const patternIdArray = patterns.map((item) => item.id);

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
              <Stack direction="row" sx={{ alignItems: 'center', mb: 0.5 }} spacing={1.5}>
                <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }}>
                  {set.title}
                </Typography>
                <Chip
                  icon={<StyleRoundedIcon sx={{ fontSize: '13px !important' }} />}
                  label={`${patterns.length} pattern${patterns.length !== 1 ? 's' : ''}`}
                  size="small"
                  variant="outlined"
                  sx={{ fontSize: '0.72rem', height: 24 }}
                />
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
                {patterns.map((pattern) => (
                  <Grid key={pattern.id} size={{ xs: 12, sm: 6, md: 4, lg: 3 }}>
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

