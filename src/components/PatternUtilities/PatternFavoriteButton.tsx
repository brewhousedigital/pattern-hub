import React, { useState } from 'react';
import { usePatternViewData } from '@/functions/hooks/usePatternView.ts';
import { useGlobalAuthData } from '@/data/auth-data.ts';
import {
  useMutationFavoritePattern,
  useMutationRemoveFavoritePattern,
  useQueryGetPatternFavoriteStatus,
} from '@/functions/database/favorites.ts';
import { enqueueSnackbar } from 'notistack';

import FavoriteIcon from '@mui/icons-material/Favorite';
import FavoriteBorderIcon from '@mui/icons-material/FavoriteBorder';

import { Button } from '@mui/material';

export const PatternFavoriteButton = () => {
  const { viewData } = usePatternViewData();
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data, refetch } = useQueryGetPatternFavoriteStatus(viewData?.id || '');

  const favoritePattern = useMutationFavoritePattern();
  const removeFavorite = useMutationRemoveFavoritePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;

  const [isFavorite, setIsFavorite] = useState(false);

  React.useEffect(() => {
    setIsFavorite(!!data?.id);
  }, [data]);

  const handleFavorite = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can favorite this pattern', { variant: 'error' });
      return;
    }

    try {
      if (isFavorite) {
        await removeFavorite.mutateAsync(data?.id || '');
      } else {
        await favoritePattern.mutateAsync(viewData?.id || '');
      }

      await refetch();

      setIsFavorite((prev) => !prev);
    } catch (error: any) {
      enqueueSnackbar('Something went wrong trying to favorite this pattern. Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Button
      loading={isLoading}
      onClick={handleFavorite}
      size="small"
      disableElevation
      variant={isFavorite ? 'contained' : 'outlined'}
      fullWidth
      startIcon={isFavorite ? <FavoriteIcon /> : <FavoriteBorderIcon />}
    >
      Favorite
    </Button>
  );
};
