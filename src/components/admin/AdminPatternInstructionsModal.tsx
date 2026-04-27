import React from 'react';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { enqueueSnackbar } from 'notistack';
import { type TypePatternResponse, useMutationUpdateInstructionsPattern } from '@/functions/database/patterns';

import VerticalSplitRoundedIcon from '@mui/icons-material/VerticalSplitRounded';
import CloseIcon from '@mui/icons-material/Close';

import {
  Dialog,
  DialogTitle,
  DialogContent,
  DialogActions,
  Button,
  Box,
  Typography,
  IconButton,
  CircularProgress,
  Tooltip,
} from '@mui/material';

type AdminPatternInstructionsEditorModalProps = TypePatternResponse & {
  callback?: () => void;
  largeButton?: boolean;
};

export const AdminPatternInstructionsModal = (props: AdminPatternInstructionsEditorModalProps) => {
  const [isOpen, setIsOpen] = React.useState(false);

  const handleCloseModal = () => {
    setIsOpen(false);
  };

  const handleOpenModal = () => {
    setIsOpen(true);
  };

  const [content, setContent] = React.useState(props?.instructions || '');

  const update = useMutationUpdateInstructionsPattern();

  const isPending = update.isPending;

  React.useEffect(() => {
    if (isOpen) {
      setContent(props.instructions ?? '');
    }
  }, [isOpen, props.id]);

  async function handleSubmit() {
    try {
      await update.mutateAsync({ id: props?.id, instructions: content });

      if (props?.callback) {
        await props.callback();
      }

      handleCloseModal();
    } catch (error: any) {
      enqueueSnackbar(error?.message || 'An error occurred while saving the FAQ.', { variant: 'error' });
      return;
    }
  }

  return (
    <>
      <Box>
        {props.largeButton ? (
          <Button
            startIcon={<VerticalSplitRoundedIcon fontSize="inherit" />}
            variant="outlined"
            onClick={handleOpenModal}
          >
            Instructions Popup
          </Button>
        ) : (
          <Tooltip title="Instructions" arrow>
            <IconButton size="small" onClick={handleOpenModal}>
              <VerticalSplitRoundedIcon fontSize="inherit" />
            </IconButton>
          </Tooltip>
        )}
      </Box>

      <Dialog open={isOpen} onClose={handleCloseModal} fullWidth maxWidth="xl">
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', pb: 1 }}>
          <Typography variant="h6" fontWeight={500}>
            Instructions
          </Typography>

          <IconButton onClick={handleCloseModal} size="small">
            <CloseIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent dividers sx={{ display: 'flex', flexDirection: 'column', gap: 2.5 }}>
          <GenericMarkdownEditor content={content} setContent={setContent} characterLimit={10000} />
        </DialogContent>

        <DialogActions sx={{ px: 3, py: 1.5 }}>
          <Button onClick={handleCloseModal} color="inherit" disabled={isPending}>
            Cancel
          </Button>

          <Button
            onClick={handleSubmit}
            variant="contained"
            color="success"
            disabled={isPending}
            startIcon={isPending ? <CircularProgress size={14} color="inherit" /> : null}
          >
            Save instructions
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
