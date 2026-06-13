import React, { useState } from 'react';
import { useGlobalAuthData } from '@/data/auth-data.ts';
import type { TypeViewData } from '@/functions/types/types';
import {
  useMutationFavoritePattern,
  useMutationRemoveFavoritePattern,
} from '@/functions/database/favorites.ts';
import {
  useQueryGetPatternDrawerData,
  useInvalidateDrawerData,
} from '@/functions/database/pattern-drawer-data';
import { enqueueSnackbar } from 'notistack';

import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

import { IconButton, Tooltip } from '@mui/material';

export const PatternFavoriteButton = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const patternId = viewData?.id || '';
  const userId = authData?.id || '';

  const { data: drawerData, isPending, isFetching } = useQueryGetPatternDrawerData(patternId, userId);
  const invalidateDrawerData = useInvalidateDrawerData(patternId, userId);

  const favoritePattern = useMutationFavoritePattern();
  const removeFavorite = useMutationRemoveFavoritePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;
  const isFavorite = !!drawerData?.userFavorite?.id;

  const handleFavorite = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can favorite this pattern', { variant: 'error' });
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(drawerData!.userFavorite!.id);
      } else {
        await favoritePattern.mutateAsync(patternId);
      }
      await invalidateDrawerData();
    } catch {
      enqueueSnackbar('Something went wrong trying to favorite this pattern. Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Tooltip title={isFavorite ? 'Remove from favorites' : 'Add to favorites'} arrow>
      <IconButton loading={isLoading} onClick={handleFavorite}>
        {isFavorite ? <FavoriteIcon color="error" /> : <FavoriteBorderIcon color="error" />}
      </IconButton>
    </Tooltip>
  );
};
