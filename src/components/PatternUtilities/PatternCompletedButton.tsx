import React from 'react';
import type { TypeViewData } from '@/functions/types/types';
import { useGlobalAuthData } from '@/data/auth-data';
import { enqueueSnackbar } from 'notistack';
import {
  useMutationMarkDonePattern,
  useMutationRemoveMarkDonePattern,
} from '@/functions/database/marked-done';
import {
  useQueryGetPatternDrawerData,
  useInvalidateDrawerData,
} from '@/functions/database/pattern-drawer-data';

import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutlined';

import { IconButton, Tooltip } from '@mui/material';

export const PatternCompletedButton = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();

  const patternId = viewData?.id || '';
  const userId = authData?.id || '';

  const { data: drawerData, isPending, isFetching } = useQueryGetPatternDrawerData(patternId, userId);
  const invalidateDrawerData = useInvalidateDrawerData(patternId, userId);

  const markAsCompletedPattern = useMutationMarkDonePattern();
  const removeMarkAsCompleted = useMutationRemoveMarkDonePattern();

  const isLoading = isPending || isFetching || markAsCompletedPattern.isPending || removeMarkAsCompleted.isPending;
  const isCompleted = !!drawerData?.userMarkedDone?.id;

  const handleMarkAsDone = async () => {
    if (!authData?.verified) {
      enqueueSnackbar('You need to verify your email before you can mark this pattern as done', { variant: 'error' });
      return;
    }

    try {
      if (isCompleted) {
        await removeMarkAsCompleted.mutateAsync(drawerData!.userMarkedDone!.id);
      } else {
        await markAsCompletedPattern.mutateAsync(patternId);
      }
      await invalidateDrawerData();
    } catch {
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
