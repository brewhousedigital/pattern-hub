import React, { useState } from 'react';
import type { TypeViewData } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import {
  useMutationMarkDonePattern,
  useMutationRemoveMarkDonePattern,
  useQueryGetPatternDoneStatus,
} from '@/functions/database/marked-done';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

import { Button, IconButton, Tooltip } from '@mui/material';

export const PatternCompletedButton = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const { isPending, isFetching, isError, data, refetch } = useQueryGetPatternDoneStatus(viewData?.id || '');

  const markAsCompletedPattern = useMutationMarkDonePattern();
  const removeMarkAsCompleted = useMutationRemoveMarkDonePattern();

  const isLoading = isPending || isFetching || markAsCompletedPattern.isPending || removeMarkAsCompleted.isPending;

  const [isCompleted, setIsCompleted] = useState(false);

  React.useEffect(() => {
    setIsCompleted(!!data?.id);
  }, [data]);

  const handleMarkAsDone = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can mark this pattern as done', { variant: 'error' });
      return;
    }

    try {
      if (isCompleted) {
        await removeMarkAsCompleted.mutateAsync(data?.id || '');
      } else {
        await markAsCompletedPattern.mutateAsync(viewData?.id || '');
      }

      await refetch();

      setIsCompleted((prev) => !prev);
    } catch (error: any) {
      enqueueSnackbar('Something went wrong trying to mark this pattern as completed. Try again in a few minutes', {
        variant: 'error',
      });
    }
  };

  return (
    <Tooltip title={isCompleted ? 'Mark as not completed' : 'Mark as completed'} arrow>
      <IconButton loading={isLoading} onClick={handleMarkAsDone}>
        {isCompleted ? <CheckCircleIcon color="success" /> : <CheckCircleOutlineIcon color="success" />}
      </IconButton>
    </Tooltip>
  );
};
