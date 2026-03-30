import React, { useState } from 'react';
import { useGlobalViewData } from '@/data/view';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import {
  useMutationMarkDonePattern,
  useMutationRemoveMarkDonePattern,
  useQueryGetPatternDoneStatus,
} from '@/functions/database/marked-done';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { Button } from '@mui/material';

export const PatternDownButton = () => {
  const { viewData } = useGlobalViewData();
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data, refetch } = useQueryGetPatternDoneStatus(viewData?.id || '');

  const favoritePattern = useMutationMarkDonePattern();
  const removeFavorite = useMutationRemoveMarkDonePattern();

  const isLoading = isPending || isFetching || favoritePattern.isPending || removeFavorite.isPending;

  const [isFavorite, setIsFavorite] = useState(false);

  React.useEffect(() => {
    setIsFavorite(!!data?.id);
  }, [data]);

  const handleFavorite = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can mark this pattern as done', { variant: 'error' });
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
      startIcon={isFavorite ? <CheckCircleIcon /> : <CheckCircleOutlineIcon />}
    >
      Mark as Done
    </Button>
  );
};
