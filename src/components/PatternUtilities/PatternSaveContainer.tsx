import React, { useState } from 'react';
import { useGlobalViewData } from '@/data/view';
import { useGlobalAuthData } from '@/data/auth-data';
import { PatternFavoriteButton } from '@/components/PatternUtilities/PatternFavoriteButton';
import { PatternDownButton } from '@/components/PatternUtilities/PatternDownButton';
import {
  useMutationFavoritePattern,
  useMutationRemoveFavoritePattern,
  useQueryGetPatternFavoriteStatus,
} from '@/functions/database/favorites';

import { Alert, Box, Grid } from '@mui/material';

export const PatternSaveContainer = () => {
  const { viewData } = useGlobalViewData();
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data } = useQueryGetPatternFavoriteStatus(viewData?.id || '');

  const favoritePattern = useMutationFavoritePattern();
  const removeFavorite = useMutationRemoveFavoritePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;

  const [done, setDone] = useState(false);
  const [doneCount, setDoneCount] = useState(37);

  const handleDone = () => {
    setDone((prev) => !prev);
    setDoneCount((prev) => (done ? prev - 1 : prev + 1));
  };

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
        <PatternFavoriteButton />
      </Grid>

      <Grid size={{ xs: 6 }}>
        <PatternDownButton />
      </Grid>
    </Grid>
  );
};
