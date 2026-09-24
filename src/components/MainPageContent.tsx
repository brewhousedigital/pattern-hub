import React from 'react';
import { Link } from '@tanstack/react-router';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';
import { DifficultyChip } from '@/components/PatternUtilities/DifficultyChip';
import { useGlobalIsViewOpen } from '@/data/view';
import { RingSpinner } from '@/components/RingSpinner';

import FavoriteRoundedIcon from '@mui/icons-material/FavoriteRounded';
import StarRoundedIcon from '@mui/icons-material/StarRounded';
import ExtensionRoundedIcon from '@mui/icons-material/ExtensionRounded';

import { Box, Grid, Card, Chip, Stack, Alert, Link as MuiLink, Skeleton } from '@mui/material';
import { alpha } from '@mui/material/styles';

const statChipSx = {
  fontSize: '0.65rem',
  height: 18,
  color: 'text.secondary',
  borderColor: 'rgba(0, 0, 0, 0.3)',
  '& .MuiChip-icon': { color: 'text.secondary', ml: '7px' },
};

export const MainPageContent = () => {
  // Get the pattern data
  const { isPending, data } = useQueryGetAllPatternsByPagination();
  const resultIds = data?.items.map((p) => p.id) || [];

  const { navigateToPattern } = usePatternSearch();
  const { isViewOpen } = useGlobalIsViewOpen();

  // The card the user clicked, until the View Drawer opens. The drawer can
  // take a moment to open (for example, on the first open), so the card
  // shows a spinner to tell the user that the click worked. The drawer
  // covers the grid when it opens, so the spinner is not necessary after
  // that.
  const [openingPatternId, setOpeningPatternId] = React.useState<string | null>(null);
  if (openingPatternId && isViewOpen) setOpeningPatternId(null);

  const handleClick = (e: React.MouseEvent, pattern: TypePatternResponse) => {
    e.preventDefault();

    setOpeningPatternId(pattern.id);
    // Safety net: if the drawer does not open (for example, a failed
    // navigation), do not leave the spinner on the card.
    window.setTimeout(() => {
      setOpeningPatternId((current) => (current === pattern.id ? null : current));
    }, 10_000);

    // Set the global view - but only after the browser paints the spinner.
    // The navigation opens the drawer, and the drawer's first render is slow
    // enough to block the main thread. If it starts in this same task, the
    // spinner goes into the DOM and comes out again before any frame shows
    // it. requestAnimationFrame runs just before the next paint, and the
    // setTimeout inside it runs just after that paint.
    requestAnimationFrame(() => {
      setTimeout(() => navigateToPattern(pattern.id, resultIds), 0);
    });
  };

  if (isPending) {
    return (
      <Grid container spacing={2}>
        {Array.from(Array(20)).map((item, index) => (
          <Grid key={`pattern-${index}`} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 }}>
            <Skeleton width="100%" variant="rounded" sx={{ borderRadius: 6, aspectRatio: '1 / 1', height: 'auto' }} />
          </Grid>
        ))}
      </Grid>
    );
  }

  if (data && data?.items?.length > 0) {
    return (
      <Grid container spacing={2}>
        {data?.items?.map((pattern) => {
          const isOpening = openingPatternId === pattern.id;
          return (
            <Grid key={`pattern-${pattern.id}`} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 }}>
              <MuiLink
                component={Link}
                to={`/pattern/${pattern.id}`}
                onClick={(e) => handleClick(e, pattern)}
                aria-busy={isOpening}
                style={{ textDecoration: 'none', display: 'block', height: '100%' }}
              >
                <Card
                  elevation={0}
                  sx={{
                    position: 'relative',
                    height: '100%',
                    display: 'flex',
                    flexDirection: 'column',
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
                  {pattern.pattern_file_external ? (
                    <Box sx={{ p: 2, position: 'relative', flexShrink: 0 }}>
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
                        sx={{ position: 'absolute', top: 4, right: 4, fontWeight: 600, border: '2px solid #fff' }}
                      />
                    </Box>
                  ) : (
                    <Box sx={{ p: 2, flexShrink: 0 }}>
                      <img
                        loading="lazy"
                        src={generatePbImage(pattern)}
                        alt={`pattern template for ${pattern.name}`}
                        style={{
                          width: '100%',
                          height: 'auto',
                          aspectRatio: '1/1',
                          display: 'block',
                        }}
                      />
                    </Box>
                  )}

                  <Box
                    sx={{
                      mt: 'auto',
                      px: 1.5,
                      pb: 1.5,
                      display: 'flex',
                      gap: 0.75,
                      flexWrap: 'wrap',
                      justifyContent: 'center',
                    }}
                  >
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<FavoriteRoundedIcon sx={{ fontSize: '0.7rem !important' }} />}
                      label={pattern.favorite_count ?? 0}
                      sx={statChipSx}
                    />
                    <Chip
                      size="small"
                      variant="outlined"
                      icon={<StarRoundedIcon sx={{ fontSize: '0.7rem !important' }} />}
                      label={(pattern.avg_rating ?? 0).toFixed(1)}
                      sx={statChipSx}
                    />
                    {!!pattern.pieces && (
                      <Chip
                        size="small"
                        variant="outlined"
                        icon={<ExtensionRoundedIcon sx={{ fontSize: '0.7rem !important' }} />}
                        label={pattern.pieces}
                        sx={statChipSx}
                      />
                    )}
                    <DifficultyChip value={pattern.avg_difficulty} sx={{ fontSize: '0.65rem', height: 18 }} />
                  </Box>

                  {isOpening && (
                    <Box
                      sx={{
                        position: 'absolute',
                        inset: 0,
                        zIndex: 1,
                        borderRadius: 'inherit',
                        display: 'flex',
                        alignItems: 'center',
                        justifyContent: 'center',
                        backgroundColor: (t) => alpha(t.palette.background.paper, 0.55),
                      }}
                    >
                      <RingSpinner label={`Opening ${pattern.name}`} />
                    </Box>
                  )}
                </Card>
              </MuiLink>
            </Grid>
          );
        })}
      </Grid>
    );
  }

  if (data && data?.items?.length === 0) {
    return (
      <Stack sx={{ alignItems: 'center', justifyContent: 'center', minHeight: '50svh' }}>
        <Alert severity="info">No results found for your search</Alert>
      </Stack>
    );
  }
};
