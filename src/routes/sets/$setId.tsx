import { Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetSetById } from '@/functions/database/sets';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { alpha } from '@mui/material/styles';

import ArrowBackRoundedIcon from '@mui/icons-material/ArrowBackRounded';
import StyleRoundedIcon from '@mui/icons-material/StyleRounded';

import {
  Alert,
  Box,
  Card,
  Chip,
  Container,
  Grid,
  Link as MuiLink,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

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
              <Stack direction="row" alignItems="center" spacing={1.5} mb={0.5}>
                <Typography variant="h4" fontWeight={700} lineHeight={1.2}>
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
                <Typography variant="body1" color="text.secondary" maxWidth={600}>
                  {set.description}
                </Typography>
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
                    <SetPatternCard pattern={pattern} />
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

// ─── SetPatternCard ───────────────────────────────────────────────────────────

function SetPatternCard({ pattern }: { pattern: TypePatternResponse }) {
  const authors = pattern.expand?.authors?.map((a) => a.name).filter(Boolean).join(', ');

  return (
    <Link to="/" search={{ patternId: pattern.id }} style={{ textDecoration: 'none', display: 'block' }}>
      <Card
        elevation={0}
        sx={{
          border: '1px solid',
          borderColor: 'divider',
          borderRadius: 4,
          overflow: 'hidden',
          transition: 'transform 0.18s ease, box-shadow 0.18s ease, border-color 0.18s ease',
          '&:hover': {
            transform: 'translateY(-3px)',
            boxShadow: (t) => `0 8px 28px ${alpha(t.palette.common.black, 0.14)}`,
            borderColor: 'transparent',
          },
        }}
      >
        {/* Thumbnail */}
        <Box sx={{ p: 1.5, pb: 0, position: 'relative' }}>
          {pattern.pattern_file_external ? (
            <>
              <Box
                sx={{
                  aspectRatio: '1/1',
                  borderRadius: 3,
                  backgroundImage: `url("${generatePbImage(pattern)}")`,
                  backgroundSize: 'cover',
                  backgroundPosition: 'center',
                }}
              />
              <Chip
                label="External"
                color="primary"
                size="small"
                sx={{ position: 'absolute', top: 8, right: 8, fontWeight: 600, border: '2px solid #fff' }}
              />
            </>
          ) : (
            <img
              loading="lazy"
              src={generatePbImage(pattern)}
              alt={`pattern template for ${pattern.name}`}
              style={{ width: '100%', height: 'auto', aspectRatio: '1/1', display: 'block', borderRadius: 12 }}
            />
          )}
        </Box>

        {/* Info */}
        <Box sx={{ px: 1.5, pt: 1, pb: 1.5 }}>
          <Typography
            fontSize={13}
            fontWeight={600}
            lineHeight={1.3}
            sx={{
              overflow: 'hidden',
              display: '-webkit-box',
              WebkitBoxOrient: 'vertical',
              WebkitLineClamp: 2,
            }}
          >
            {pattern.name}
          </Typography>
          {authors && (
            <Typography fontSize={11} color="text.secondary" mt={0.25} noWrap>
              {authors}
            </Typography>
          )}
        </Box>
      </Card>
    </Link>
  );
}
