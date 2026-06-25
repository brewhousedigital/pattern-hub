import { Link } from '@tanstack/react-router';
import { createFileRoute } from '@tanstack/react-router';
import { useQueryGetPublishedSets } from '@/functions/database/sets';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { stripMarkdown } from '@/functions/utilities/markdown';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { alpha } from '@mui/material/styles';

import StyleRoundedIcon from '@mui/icons-material/StyleRounded';
import ArrowForwardRoundedIcon from '@mui/icons-material/ArrowForwardRounded';

import {
  Alert,
  Box,
  Card,
  CardActionArea,
  CardContent,
  Container,
  Grid,
  Skeleton,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

// ─── Route ────────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/sets/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Sets', 'Browse curated pattern collections', match.pathname),
  }),
});

// ─── Constants ────────────────────────────────────────────────────────────────

const PREVIEW_LIMIT = 5;
const AVATAR_SIZE = 56;
const AVATAR_OVERLAP = 14;

// ─── Component ────────────────────────────────────────────────────────────────

function RouteComponent() {
  const { data: sets, isPending, isError } = useQueryGetPublishedSets();

  return (
    <GeneralLayout>
      <Container maxWidth="lg" sx={{ py: 5 }}>
        {/* Page header */}
        <Box sx={{ mb: 5 }}>
          <Typography variant="h4" sx={{ fontWeight: 700, lineHeight: 1.2 }} gutterBottom>
            Sets
          </Typography>
          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 560 }}>
            Curated collections of patterns handpicked by our team
          </Typography>
          {sets && sets.length > 0 && (
            <Typography variant="caption" color="text.disabled" sx={{ display: 'block', mt: 0.75 }}>
              {sets.length} set{sets.length !== 1 ? 's' : ''} available
            </Typography>
          )}
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
                <Skeleton variant="rounded" height={320} sx={{ borderRadius: 3 }} />
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
            {sets.map((set) => {
              const accentColor = set.color || '#1976d2';
              const previews = (set.expand?.patterns ?? []).slice(0, PREVIEW_LIMIT);
              const patternCount = set.patterns?.length ?? 0;
              const overflow = patternCount - previews.length;

              return (
                <Grid key={set.id} size={{ xs: 12, sm: 6, md: 4 }}>
                  <Card
                    variant="outlined"
                    sx={{
                      borderRadius: 3,
                      height: '100%',
                      display: 'flex',
                      flexDirection: 'column',
                      overflow: 'hidden',
                      transition: 'box-shadow 0.2s, transform 0.15s, border-color 0.2s',
                      '&:hover': {
                        boxShadow: 6,
                        transform: 'translateY(-2px)',
                        borderColor: accentColor,
                      },
                    }}
                  >
                    <Link
                      to="/sets/$setId"
                      params={{ setId: set.id }}
                      style={{ textDecoration: 'none', flexGrow: 1, display: 'flex', flexDirection: 'column' }}
                    >
                      <CardActionArea
                        component="div"
                        sx={{ flexGrow: 1, display: 'flex', flexDirection: 'column', alignItems: 'stretch' }}
                      >
                        {/* Solid accent color header */}
                        <Box
                          sx={{
                            backgroundColor: accentColor,
                            px: 2.5,
                            pt: 2.5,
                            pb: 2,
                            display: 'flex',
                            alignItems: 'flex-start',
                            gap: 1.5,
                          }}
                        >
                          <Box
                            sx={{
                              width: 40,
                              height: 40,
                              borderRadius: 2,
                              backgroundColor: alpha('#fff', 0.2),
                              display: 'flex',
                              alignItems: 'center',
                              justifyContent: 'center',
                              flexShrink: 0,
                            }}
                          >
                            <StyleRoundedIcon sx={{ color: '#fff', fontSize: 22 }} />
                          </Box>
                          <Typography
                            variant="h6"
                            sx={{ fontWeight: 700, lineHeight: 1.3, color: '#fff', pt: 0.5 }}
                          >
                            {set.title}
                          </Typography>
                        </Box>

                        <CardContent
                          sx={{
                            flexGrow: 1,
                            px: 2.5,
                            pt: 2,
                            display: 'flex',
                            flexDirection: 'column',
                            '&:last-child': { pb: 2.5 },
                          }}
                        >
                          {/* Description */}
                          {set.description && (
                            <Typography
                              variant="body2"
                              sx={{
                                mb: 2.5,
                                color: '#222',
                                display: '-webkit-box',
                                WebkitBoxOrient: 'vertical',
                                WebkitLineClamp: 2,
                                overflow: 'hidden',
                                lineHeight: 1.65,
                              }}
                            >
                              {stripMarkdown(set.description)}
                            </Typography>
                          )}

                          {/* Pattern thumbnail previews — own dedicated row */}
                          {previews.length > 0 && (
                            <Box sx={{ display: 'flex', alignItems: 'center', mb: 2.5 }}>
                              {previews.map((p, i) => (
                                <Tooltip key={p.id} title={p.name} arrow placement="top">
                                  <Box
                                    sx={{
                                      position: 'relative',
                                      zIndex: PREVIEW_LIMIT - i,
                                      width: AVATAR_SIZE,
                                      height: AVATAR_SIZE,
                                      borderRadius: '50%',
                                      backgroundImage: `url("${generatePbImage(p)}")`,
                                      backgroundSize: 'cover',
                                      backgroundPosition: 'center',
                                      backgroundColor: alpha(accentColor, 0.1),
                                      border: '3px solid',
                                      borderColor: 'background.paper',
                                      ml: i === 0 ? 0 : `-${AVATAR_OVERLAP}px`,
                                      transition: 'transform 0.15s',
                                      '&:hover': {
                                        transform: 'scale(1.12) translateY(-4px)',
                                        zIndex: PREVIEW_LIMIT + 1,
                                      },
                                    }}
                                  />
                                </Tooltip>
                              ))}

                              {/* +N overflow badge */}
                              {overflow > 0 && (
                                <Box
                                  sx={{
                                    position: 'relative',
                                    zIndex: 0,
                                    width: AVATAR_SIZE,
                                    height: AVATAR_SIZE,
                                    borderRadius: '50%',
                                    backgroundColor: alpha(accentColor, 0.12),
                                    border: '3px solid',
                                    borderColor: 'background.paper',
                                    ml: `-${AVATAR_OVERLAP}px`,
                                    display: 'flex',
                                    alignItems: 'center',
                                    justifyContent: 'center',
                                  }}
                                >
                                  <Typography
                                    sx={{
                                      fontSize: '0.72rem',
                                      fontWeight: 700,
                                      color: accentColor,
                                      lineHeight: 1,
                                    }}
                                  >
                                    +{overflow}
                                  </Typography>
                                </Box>
                              )}
                            </Box>
                          )}

                          {/* Footer: pattern count + arrow */}
                          <Stack
                            direction="row"
                            sx={{ alignItems: 'center', justifyContent: 'space-between', mt: 'auto' }}
                          >
                            <Typography
                              variant="caption"
                              sx={{ fontWeight: 600, color: '#222', opacity: 0.55 }}
                            >
                              {patternCount} pattern{patternCount !== 1 ? 's' : ''}
                            </Typography>
                            <ArrowForwardRoundedIcon sx={{ fontSize: 18, color: accentColor }} />
                          </Stack>
                        </CardContent>
                      </CardActionArea>
                    </Link>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        )}
      </Container>
    </GeneralLayout>
  );
}
