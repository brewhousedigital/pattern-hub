import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { PatternFavoriteButton } from '@/components/PatternUtilities/PatternFavoriteButton';
import { PatternCompletedButton } from './PatternCompletedButton';
import { PatternAddToCollectionButton } from '@/components/PatternUtilities/PatternAddToCollectionButton';
import type { TypeViewData } from '@/functions/types/types';

import { Alert, Box, Grid, Stack } from '@mui/material';

export const PatternSaveContainer = (props: TypeViewData) => {
  const viewData = props.viewData;

  const { authData } = useGlobalAuthData();

  if (!authData) {
    return <></>;
  }

  return (
    <Stack direction="row" sx={{ gap: 1 }}>
      <PatternFavoriteButton viewData={viewData} />

      <PatternCompletedButton viewData={viewData} />

      <PatternAddToCollectionButton viewData={viewData} />
    </Stack>
  );
};
