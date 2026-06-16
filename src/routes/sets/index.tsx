import { Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetPublishedSets } from '@/functions/database/sets';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';

import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

import {
  Alert,
  Box,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Chip,
  Container,
  Grid,
  Skeleton,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/sets/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Sets', 'Browse curated pattern collections', match.pathname),
  }),
});

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { data: sets, isPending, isError } = useQueryGetPublishedSets();

  return (
    <GeneralLayout>
      <Container maxWidth="lg" sx={{ py: 5 }}>
        {/* Page header */}
        <Box sx={{ mb: 4 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }} gutterBottom>
            Sets
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
            Curated collections of patterns
          </Typography>
        </Box>

        {isError && (
          <Alert severity="error" sx={{ mb: 3 }}>
            Failed to load sets. Please try refreshing the page.
          </Alert>
        )}

        {isPending && (
          <Grid container spacing={3}>
            {Array.from({ length: 6 }).map((_, i) => (
              <Grid key={i} size={{ xs: 12, sm: 6, md: 4 }}>
                <Skeleton variant="rounded" height={220} sx={{ borderRadius: 3 }} />
              </Grid>
            ))}
          </Grid>
        )}

        {!isPending && !isError && sets?.length === 0 && (
          <Box sx={{ textAlign: 'center', py: 10 }}>
            <StyleRoundedIcon sx={{ fontSize: 56, color: 'text.disabled', mb: 2 }} />
            <Typography variant="h6" color="text.secondary" gutterBottom>
              No sets yet
            </Typography>
            <Typography variant="body2" color="text.disabled">
              No sets were found. Check back in a few days.
            </Typography>
          </Box>
        )}

        {sets && sets.length > 0 && (
          <Grid container spacing={3}>
            {sets.map((set) => (
              <Grid key={set.id} size={{ xs: 12, sm: 6, md: 4 }}>
                <Card
                  variant="outlined"
                  sx={{
                    borderRadius: 3,
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
                    overflow: 'hidden',
                    transition: 'box-shadow 0.2s, transform 0.15s',
                    '&:hover': {
                      boxShadow: 4,
                      transform: 'translateY(-2px)',
                    },
                  }}
                >
                  {/* Accent color header stripe */}
                  <Box
                    sx={{
                      height: 8,
                      backgroundColor: set.color || 'primary.main',
                      flexShrink: 0,
                    }}
                  />

                  <Link
                    to="/sets/$setId"
                    params={{ setId: set.id }}
                    style={{ textDecoration: 'none', flexGrow: 1, display: 'flex', flexDirection: 'column' }}
                  >
                    <CardActionArea
                      component="div"
                      sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                    >
                      <CardContent sx={{ flexGrow: 1, p: 2.5, '&:last-child': { pb: 2.5 } }}>
                        <Typography variant="h6" sx={{ fontWeight: 700, lineHeight: 1.3 }} gutterBottom>
                          {set.title}
                        </Typography>

                        {set.description && (
                          <Typography
                            variant="body2"
                            color="text.secondary"
                            sx={{
                              mb: 2,
                              display: '-webkit-box',
                              WebkitBoxOrient: 'vertical',
                              WebkitLineClamp: 2,
                              overflow: 'hidden',
                            }}
                          >
                            {set.description}
                          </Typography>
                        )}

                        <Box
                          sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}
                        >
                          <Chip
                            icon={<StyleRoundedIcon sx={{ fontSize: '13px !important' }} />}
                            label={`${set.patterns?.length ?? 0} pattern${(set.patterns?.length ?? 0) !== 1 ? 's' : ''}`}
                            size="small"
                            variant="outlined"
                            sx={{ fontSize: '0.72rem', height: 24 }}
                          />
                          <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: 'text.secondary' }} />
                        </Box>
                      </CardContent>
                    </CardActionArea>
                  </Link>
                </Card>
              </Grid>
            ))}
          </Grid>
        )}
      </Container>
    </GeneralLayout>
  );
}
