import React from 'react';
import { useMutationCreateCollection, useMutationUpdateCollectionPatterns } from '@/functions/database/collections';
import { enqueueSnackbar } from 'notistack';

import CloseRoundedIcon from '@mui/icons-material/CloseRounded';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';

import {
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  IconButton,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type CreateCollectionDialogProps = {
  open: boolean;
  onClose: () => void;
  onSuccess: (collectionId: string) => void;
  /** If provided, this pattern ID will be added to the new collection immediately after creation. */
  initialPatternId?: string;
};

export const CreateCollectionDialog = ({ open, onClose, onSuccess, initialPatternId }: CreateCollectionDialogProps) => {
  const [name, setName] = React.useState('');
  const [description, setDescription] = React.useState('');

  const createCollection = useMutationCreateCollection();
  const updatePatterns = useMutationUpdateCollectionPatterns();

  const isLoading = createCollection.isPending || updatePatterns.isPending;
  const canSubmit = name.trim().length > 0 && !isLoading;

  const handleClose = () => {
    if (isLoading) return;
    setName('');
    setDescription('');
    onClose();
  };

  const handleSubmit = async () => {
    if (!canSubmit) return;
    try {
      const record = await createCollection.mutateAsync({
        name: name.trim(),
        description: description.trim(),
      });

      if (initialPatternId) {
        await updatePatterns.mutateAsync({
          collectionId: record.id,
          patternIds: [initialPatternId],
        });
      }

      enqueueSnackbar(`"${record.name}" collection created`, { variant: 'success' });

      if (initialPatternId) {
        enqueueSnackbar(`"Pattern added to ${record.name}"`, { variant: 'success' });
      }
      setName('');
      setDescription('');
      onSuccess(record.id);
    } catch {
      enqueueSnackbar('Could not create the collection. Please try again.', { variant: 'error' });
    }
  };

  return (
    <Dialog open={open} onClose={handleClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ pr: 6 }}>
        <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
          <BookmarksOutlinedIcon fontSize="small" color="primary" />
          <Box>
            <Typography variant="subtitle1" fontWeight={700} lineHeight={1.2}>
              New Collection
            </Typography>
            {initialPatternId && (
              <Typography variant="caption" color="text.secondary">
                This pattern will be added automatically
              </Typography>
            )}
          </Box>
        </Stack>
        <IconButton
          size="small"
          onClick={handleClose}
          disabled={isLoading}
          sx={{ position: 'absolute', top: 12, right: 12 }}
        >
          <CloseRoundedIcon fontSize="small" />
        </IconButton>
      </DialogTitle>

      <DialogContent dividers>
        <Stack spacing={2.5} sx={{ py: 0.5 }}>
          <TextField
            label="Collection name"
            placeholder="e.g. My Flower Patterns"
            value={name}
            onChange={(e) => setName(e.target.value.slice(0, 100))}
            inputProps={{ maxLength: 100 }}
            helperText={`${name.length}/100`}
            size="small"
            variant="filled"
            fullWidth
            required
            autoFocus
            disabled={isLoading}
            onKeyDown={(e) => e.key === 'Enter' && canSubmit && handleSubmit()}
          />

          <TextField
            label="Description"
            placeholder="Optional — what is this collection about?"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            size="small"
            variant="filled"
            fullWidth
            multiline
            rows={3}
            disabled={isLoading}
          />

          <Button
            variant="contained"
            fullWidth
            disabled={!canSubmit}
            onClick={handleSubmit}
            startIcon={isLoading ? <CircularProgress size={16} color="inherit" /> : <BookmarksOutlinedIcon />}
          >
            {isLoading ? 'Creating…' : 'Create Collection'}
          </Button>
        </Stack>
      </DialogContent>
    </Dialog>
  );
};
