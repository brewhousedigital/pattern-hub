import React from 'react';
import { Link } from '@tanstack/react-router';
import type { TypePatternResponse } from '@/functions/database/patterns';
import { useGlobalIsViewOpen } from '@/data/view';
import { generatePbImage } from '@/functions/utilities/generate-pb-image';
import { useQueryGetAllPatternsByPagination } from '@/functions/database/patterns';
import { usePatternSearch } from '@/functions/hooks/usePatternSearchV2';

import { Box, Grid, Card, Chip, Stack, Alert, Link as MuiLink, Skeleton } from '@mui/material';

export const MainPageContent = () => {
  // Get the pattern data
  const { isPending, data } = useQueryGetAllPatternsByPagination();
  const resultIds = data?.items.map((p) => p.id) || [];

  const { navigateToPattern } = usePatternSearch();

  const handleClick = (e: React.MouseEvent, pattern: TypePatternResponse) => {
    e.preventDefault();

    // Set the global view
    navigateToPattern(pattern?.id, resultIds);
  };

  if (isPending) {
    return (
      <Grid container spacing={2}>
        {Array.from(Array(25)).map((item, index) => (
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
          return (
            <Grid key={`pattern-${pattern.id}`} size={{ xs: 12, sm: 6, md: 4, lg: 3, xl: 2.4 }}>
              <MuiLink
                component={Link}
                to={`/pattern/${pattern.id}`}
                onClick={(e) => handleClick(e, pattern)}
                style={{ textDecoration: 'none' }}
              >
                <Card elevation={0}>
                  {pattern.pattern_file_external ? (
                    <Box sx={{ p: 2, position: 'relative' }}>
                      <Box
                        sx={{
                          aspectRatio: '1/1',
                          borderRadius: 4,
                          backgroundImage: `url("${generatePbImage(pattern)}")`,
                          backgroundSize: 'cover',
                          backgroundPosition: 'center',
                        }}
                      />

                      <Chip label="External Pattern" color="primary" sx={{ position: 'absolute', top: 8, right: 8 }} />
                    </Box>
                  ) : (
                    <Box sx={{ p: 2 }}>
                      <img
                        src={generatePbImage(pattern)}
                        alt={`pattern template for ${pattern.name}`}
                        style={{
                          width: '100%',
                          height: 'auto',
                          aspectRatio: '1/1',
                          borderRadius: 16,
                          display: 'block',
                        }}
                      />
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
