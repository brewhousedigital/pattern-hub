import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { PatternFavoriteButton } from '@/components/PatternUtilities/PatternFavoriteButton';
import { PatternDownButton } from '@/components/PatternUtilities/PatternDownButton';
import type { TypeViewData } from '@/functions/types/types';

import { Alert, Box, Grid } from '@mui/material';

export const PatternSaveContainer = (props: TypeViewData) => {
  const viewData = props.viewData;

  const { authData } = useGlobalAuthData();

  if (!authData) {
    return (
      <Box sx={{ mb: 2.5 }}>
        <Alert severity="info">Log in to favorite the patterns you like</Alert>
      </Box>
    );
  }

  return (
    <Grid container spacing={1.5} sx={{ mb: 2.5 }}>
      <Grid size={{ xs: 6 }}>
        <PatternFavoriteButton viewData={viewData} />
      </Grid>

      <Grid size={{ xs: 6 }}>
        <PatternDownButton viewData={viewData} />
      </Grid>
    </Grid>
  );
};
