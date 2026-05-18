import React from 'react';
import { useGlobalAuthData } from '@/data/auth-data';
import {
  useQueryGetUserCollectionsAll,
  useMutationUpdateCollectionPatterns,
  type TypeCollectionResponse,
} from '@/functions/database/collections';
import { CreateCollectionDialog } from '@/components/collections/CreateCollectionDialog';
import { enqueueSnackbar } from 'notistack';

import AddIcon from '@mui/icons-material/Add';
import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import CheckRoundedIcon from '@mui/icons-material/CheckRounded';
import CloseRoundedIcon from '@mui/icons-material/CloseRounded';

import {
  Box,
  Chip,
  CircularProgress,
  Dialog,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Skeleton,
  Stack,
  Typography,
} from '@mui/material';

const MAX_PATTERNS = 500;

type AddToCollectionDialogProps = {
  open: boolean;
  onClose: () => void;
  patternId: string;
};

export const AddToCollectionDialog = ({ open, onClose, patternId }: AddToCollectionDialogProps) => {
  const { authData } = useGlobalAuthData();
  const [createOpen, setCreateOpen] = React.useState(false);
  const [addingToId, setAddingToId] = React.useState<string | null>(null);

  const { data: collections = [], isPending, refetch } = useQueryGetUserCollectionsAll(authData?.id || '');
  const updatePatterns = useMutationUpdateCollectionPatterns();

  const handleClose = () => {
    if (updatePatterns.isPending) return;
    onClose();
  };

  const handleAddToCollection = async (collection: TypeCollectionResponse) => {
    if (collection.patterns.length >= MAX_PATTERNS) return;
    if (collection.patterns.includes(patternId)) return;

    setAddingToId(collection.id);
    try {
      await updatePatterns.mutateAsync({
        collectionId: collection.id,
        patternIds: [...collection.patterns, patternId],
      });
      enqueueSnackbar(`Added to "${collection.name}"`, { variant: 'success' });
      await refetch();
      onClose();
    } catch {
      enqueueSnackbar('Could not add to collection. Please try again.', { variant: 'error' });
    } finally {
      setAddingToId(null);
    }
  };

  const handleCreateSuccess = () => {
    setCreateOpen(false);
    refetch();
    onClose();
  };

  return (
    <>
      <Dialog open={open} onClose={handleClose} maxWidth="xs" fullWidth>
        <DialogTitle sx={{ pr: 6 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'center' }}>
            <BookmarksOutlinedIcon fontSize="small" color="primary" />
            <Typography variant="subtitle1" fontWeight={700}>
              Add to Collection
            </Typography>
          </Stack>
          <IconButton
            size="small"
            onClick={handleClose}
            disabled={updatePatterns.isPending}
            sx={{ position: 'absolute', top: 12, right: 12 }}
          >
            <CloseRoundedIcon fontSize="small" />
          </IconButton>
        </DialogTitle>

        <DialogContent sx={{ p: 0 }}>
          {/* Create new option */}
          <ListItemButton onClick={() => setCreateOpen(true)} sx={{ px: 2, py: 1.5 }}>
            <ListItemIcon sx={{ minWidth: 36 }}>
              <AddIcon fontSize="small" color="primary" />
            </ListItemIcon>
            <ListItemText primary="Create new collection" color="primary" />
          </ListItemButton>

          <Divider />

          {/* Existing collections */}
          {isPending ? (
            <Stack spacing={0}>
              {[1, 2, 3].map((i) => (
                <Box key={i} sx={{ px: 2, py: 1.25 }}>
                  <Skeleton variant="text" width="60%" />
                  <Skeleton variant="text" width="30%" sx={{ fontSize: '0.75rem' }} />
                </Box>
              ))}
            </Stack>
          ) : collections.length === 0 ? (
            <Box sx={{ px: 2, py: 3, textAlign: 'center' }}>
              <Typography variant="body2" color="text.secondary">
                No collections yet. Create one above.
              </Typography>
            </Box>
          ) : (
            <List disablePadding>
              {collections.map((collection) => {
                const alreadyAdded = collection.patterns.includes(patternId);
                const isFull = collection.patterns.length >= MAX_PATTERNS;
                const isDisabled = alreadyAdded || isFull;
                const isThisLoading = addingToId === collection.id;

                return (
                  <ListItemButton
                    key={collection.id}
                    disabled={isDisabled || updatePatterns.isPending}
                    onClick={() => handleAddToCollection(collection)}
                    sx={{ px: 2, py: 1 }}
                  >
                    <ListItemText
                      primary={collection.name}
                      secondary={
                        isFull
                          ? 'Collection full (500/500)'
                          : `${collection.patterns.length} pattern${collection.patterns.length !== 1 ? 's' : ''}`
                      }
                      primaryTypographyProps={{ variant: 'body2', fontWeight: 500 }}
                      secondaryTypographyProps={{ variant: 'caption' }}
                    />
                    {alreadyAdded && (
                      <Chip
                        icon={<CheckRoundedIcon />}
                        label="Added"
                        size="small"
                        color="success"
                        variant="outlined"
                        sx={{ ml: 1 }}
                      />
                    )}
                    {isFull && !alreadyAdded && <Chip label="Full" size="small" variant="outlined" sx={{ ml: 1 }} />}
                    {isThisLoading && <CircularProgress size={16} sx={{ ml: 1 }} />}
                  </ListItemButton>
                );
              })}
            </List>
          )}
        </DialogContent>
      </Dialog>

      <CreateCollectionDialog
        open={createOpen}
        onClose={() => setCreateOpen(false)}
        onSuccess={handleCreateSuccess}
        initialPatternId={patternId}
      />
    </>
  );
};
