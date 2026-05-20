import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { AddToCollectionDialog } from '@/components/collections/AddToCollectionDialog';
import { enqueueSnackbar } from 'notistack';
import type { TypeViewData } from '@/functions/types/types';

import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';

import { IconButton, Tooltip } from '@mui/material';

export const PatternAddToCollectionButton = (props: TypeViewData) => {
  const viewData = props.viewData;
  const { authData } = useGlobalAuthData();
  const [dialogOpen, setDialogOpen] = React.useState(false);

  if (!authData) return null;

  const handleClick = () => {
    if (!authData.verified) {
      enqueueSnackbar('You need to verify your email before adding patterns to collections', { variant: 'error' });
      return;
    }
    if (!viewData?.id) return;
    setDialogOpen(true);
  };

  return (
    <>
      <Tooltip title="Add to collection">
        <IconButton onClick={handleClick}>
          <BookmarksOutlinedIcon color="primary" />
        </IconButton>
      </Tooltip>

      {viewData?.id && (
        <AddToCollectionDialog open={dialogOpen} onClose={() => setDialogOpen(false)} patternId={viewData.id} />
      )}
    </>
  );
};
