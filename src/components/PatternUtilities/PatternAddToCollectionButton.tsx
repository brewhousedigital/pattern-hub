import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import { AddToCollectionDialog } from '@/components/collections/AddToCollectionDialog';
import { enqueueSnackbar } from 'notistack';
import type { TypeViewData } from '@/functions/types/types';

import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';

import { Button } from '@mui/material';

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
      <Button
        onClick={handleClick}
        size="small"
        disableElevation
        variant="outlined"
        fullWidth
        startIcon={<BookmarksOutlinedIcon />}
      >
        Add to Collection
      </Button>

      {viewData?.id && (
        <AddToCollectionDialog
          open={dialogOpen}
          onClose={() => setDialogOpen(false)}
          patternId={viewData.id}
        />
      )}
    </>
  );
};
