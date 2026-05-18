import React from 'react';
import { Link } from '@tanstack/react-router';
import { createPrettyDate } from '@/functions/utilities/dates';
import { useMutationDeleteCollection, type TypeCollectionResponse } from '@/functions/database/collections';
import { enqueueSnackbar } from 'notistack';

import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import ExtensionIcon from '@mui/icons-material/Extension';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';

import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  Popover,
  Stack,
  Tooltip,
  Typography,
} from '@mui/material';

type CollectionCardProps = {
  collection: TypeCollectionResponse;
  isOwner: boolean;
  onDeleted?: () => void;
};

export const CollectionCard = ({ collection, isOwner, onDeleted }: CollectionCardProps) => {
  const [deleteAnchor, setDeleteAnchor] = React.useState<HTMLButtonElement | null>(null);
  const deleteCollection = useMutationDeleteCollection();

  const handleDeleteConfirm = async () => {
    try {
      await deleteCollection.mutateAsync(collection.id);
      enqueueSnackbar(`"${collection.name}" deleted`, { variant: 'success' });
      setDeleteAnchor(null);
      onDeleted?.();
    } catch {
      enqueueSnackbar('Could not delete the collection. Please try again.', { variant: 'error' });
    }
  };

  return (
    <>
      <Card
        variant="outlined"
        sx={{
          borderRadius: 2,
          display: 'flex',
          flexDirection: 'column',
          height: '100%',
          transition: 'box-shadow 0.15s',
          '&:hover': { boxShadow: 2 },
        }}
      >
        {/* Card header */}
        <CardContent sx={{ pb: 1, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 0.75 }}>
            <BookmarksOutlinedIcon fontSize="small" color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Typography
                variant="subtitle2"
                fontWeight={700}
                sx={{
                  overflow: 'hidden',
                  textOverflow: 'ellipsis',
                  whiteSpace: 'nowrap',
                }}
              >
                {collection.name}
              </Typography>
            </Box>
            {isOwner && (
              <Tooltip title="Delete collection">
                <IconButton
                  size="small"
                  onClick={(e) => setDeleteAnchor(e.currentTarget)}
                  sx={{ mt: -0.25, mr: -0.5, color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                >
                  <DeleteOutlinedIcon fontSize="small" />
                </IconButton>
              </Tooltip>
            )}
          </Stack>

          {collection.description ? (
            <Typography
              variant="body2"
              color="text.secondary"
              sx={{
                display: '-webkit-box',
                WebkitLineClamp: 2,
                WebkitBoxOrient: 'vertical',
                overflow: 'hidden',
                fontSize: '0.8rem',
                mb: 2,
              }}
            >
              {collection.description}
            </Typography>
          ) : (
            <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic', fontSize: '0.8rem', mb: 1 }}>
              No description
            </Typography>
          )}

          <Stack direction="row" spacing={1} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 1 }}>
            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}>
              <ExtensionIcon fontSize="inherit" />{' '}
              {`${collection.patterns.length} pattern${collection.patterns.length !== 1 ? 's' : ''}`}
            </Typography>

            <Typography variant="body2" sx={{ display: 'flex', alignItems: 'center', gap: 0.5, fontSize: '0.75rem' }}>
              <CalendarTodayOutlinedIcon fontSize="inherit" /> {createPrettyDate(collection.created)}
            </Typography>
          </Stack>
        </CardContent>

        <Divider />

        <CardActions sx={{ px: 1.5, py: 1 }}>
          <Button
            component={Link as any}
            to="/profile/collections/$collectionId"
            params={{ collectionId: collection.id }}
            size="small"
            endIcon={<LaunchRoundedIcon fontSize="small" />}
            sx={{ ml: 'auto' }}
          >
            View Collection
          </Button>
        </CardActions>
      </Card>

      {/* Delete confirmation popover */}
      <Popover
        open={!!deleteAnchor}
        anchorEl={deleteAnchor}
        onClose={() => setDeleteAnchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
        transformOrigin={{ vertical: 'top', horizontal: 'right' }}
        slotProps={{ paper: { sx: { p: 2, maxWidth: 240, borderRadius: 2 } } }}
      >
        <Typography variant="body2" fontWeight={600} sx={{ mb: 0.5 }}>
          Delete "{collection.name}"?
        </Typography>
        <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 1.5 }}>
          This cannot be undone. The patterns themselves will not be affected.
        </Typography>
        <Stack direction="row" spacing={1}>
          <Button size="small" onClick={() => setDeleteAnchor(null)} disabled={deleteCollection.isPending}>
            Cancel
          </Button>
          <Button
            size="small"
            variant="contained"
            color="error"
            onClick={handleDeleteConfirm}
            disabled={deleteCollection.isPending}
            startIcon={deleteCollection.isPending ? <CircularProgress size={12} color="inherit" /> : undefined}
          >
            Delete
          </Button>
        </Stack>
      </Popover>
    </>
  );
};
