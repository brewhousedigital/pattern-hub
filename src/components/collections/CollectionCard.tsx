import React from 'react';
import { Link } from '@tanstack/react-router';
import { createPrettyDate } from '@/functions/utilities/dates';
import {
  useMutationDeleteCollection,
  useMutationUpdateCollection,
  useQueryGetCollectionById,
  type TypeCollectionResponse,
} from '@/functions/database/collections';
import { GenericMarkdownEditor } from '@/components/admin/GenericMarkdownEditor';
import { enqueueSnackbar } from 'notistack';

import BookmarksOutlinedIcon from '@mui/icons-material/BookmarksOutlined';
import DeleteOutlinedIcon from '@mui/icons-material/DeleteOutlined';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import LaunchRoundedIcon from '@mui/icons-material/LaunchRounded';
import ExtensionIcon from '@mui/icons-material/Extension';
import CalendarTodayOutlinedIcon from '@mui/icons-material/CalendarTodayOutlined';
import RemoveCircleOutlineRoundedIcon from '@mui/icons-material/RemoveCircleOutlineRounded';

import {
  Box,
  Button,
  Card,
  CardActions,
  CardContent,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  IconButton,
  List,
  ListItem,
  ListItemText,
  Popover,
  Skeleton,
  Stack,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

type CollectionCardProps = {
  collection: TypeCollectionResponse;
  isOwner: boolean;
  onDeleted?: () => void;
  onEdited?: () => void;
  hasUpdate?: boolean;
  isDark?: boolean;
  cardBg?: string;
};

type PatternEntry = { id: string; name: string };

export const CollectionCard = ({
  collection,
  isOwner,
  onDeleted,
  onEdited,
  hasUpdate,
  isDark,
  cardBg,
}: CollectionCardProps) => {
  const [deleteAnchor, setDeleteAnchor] = React.useState<HTMLButtonElement | null>(null);
  const [editOpen, setEditOpen] = React.useState(false);
  const [editName, setEditName] = React.useState('');
  const [editDescription, setEditDescription] = React.useState('');
  const [editPatterns, setEditPatterns] = React.useState<PatternEntry[]>([]);

  const deleteCollection = useMutationDeleteCollection();
  const updateCollection = useMutationUpdateCollection();

  // Fetch full collection (with pattern names) only when the edit dialog is open
  const {
    data: fullCollection,
    isFetching: fetchingFull,
    refetch: refetchCollection,
  } = useQueryGetCollectionById(editOpen ? collection.id : '');

  // Sync pattern list from fetched data whenever the dialog opens
  React.useEffect(() => {
    if (!editOpen || !fullCollection) return;
    const patterns =
      fullCollection.expand?.patterns?.map((p) => ({ id: p.id, name: p.name })) ??
      fullCollection.patterns.map((id) => ({ id, name: id }));
    setEditPatterns(patterns);
  }, [editOpen, fullCollection]);

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

  const handleEditOpen = () => {
    setEditName(collection.name);
    setEditDescription(collection.description ?? '');
    setEditPatterns([]);
    setEditOpen(true);
  };

  const handleEditClose = () => {
    if (updateCollection.isPending) return;
    setEditOpen(false);
  };

  const handleEditSave = async () => {
    if (!editName.trim()) return;
    try {
      await updateCollection.mutateAsync({
        collectionId: collection.id,
        name: editName.trim(),
        description: editDescription.trim(),
        patterns: editPatterns.map((p) => p.id),
      });

      // Refetch the data so if the user clicks into the card, the UI has the latest state
      // Otherwise the GET still has the old data
      await refetchCollection();

      enqueueSnackbar(`"${editName.trim()}" updated`, { variant: 'success' });

      setEditOpen(false);
      onEdited?.();
    } catch {
      enqueueSnackbar('Could not update the collection. Please try again.', { variant: 'error' });
    }
  };

  const removePattern = (id: string) => {
    setEditPatterns((prev) => prev.filter((p) => p.id !== id));
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
          ...(isDark
            ? {
                borderColor: 'rgba(255,255,255,0.08)',
                backgroundColor: cardBg || '#242424',
                '& .MuiTypography-root': { color: 'rgba(255,255,255,0.85) !important' },
                '& .MuiDivider-root': { borderColor: 'rgba(255,255,255,0.08)' },
                '& .MuiIconButton-root': { color: 'rgba(255,255,255,0.38)' },
                '& .MuiButton-root': { color: 'rgba(255,255,255,0.75)' },
              }
            : cardBg
              ? { backgroundColor: cardBg }
              : {}),
        }}
      >
        {/* Card header */}
        <CardContent sx={{ pb: 1, flex: 1 }}>
          <Stack direction="row" spacing={1} sx={{ alignItems: 'flex-start', mb: 0.75 }}>
            <BookmarksOutlinedIcon fontSize="small" color="primary" sx={{ mt: 0.25, flexShrink: 0 }} />
            <Box sx={{ flex: 1, minWidth: 0 }}>
              <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center', flexWrap: 'wrap' }}>
                <Typography
                  variant="subtitle2"
                  sx={{ fontWeight: 700, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}
                >
                  {collection.name}
                </Typography>
                {hasUpdate && (
                  <Typography
                    variant="caption"
                    sx={{
                      backgroundColor: 'primary.main',
                      color: 'primary.contrastText',
                      px: 0.75,
                      borderRadius: 1,
                      fontSize: '0.65rem',
                      lineHeight: '18px',
                    }}
                  >
                    Updated
                  </Typography>
                )}
              </Stack>
            </Box>
            {isOwner && (
              <Stack direction="row" spacing={0.25} sx={{ mt: -0.25, mr: -0.5, flexShrink: 0 }}>
                <Tooltip title="Edit collection">
                  <IconButton
                    size="small"
                    onClick={handleEditOpen}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'primary.main' } }}
                  >
                    <EditRoundedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
                <Tooltip title="Delete collection">
                  <IconButton
                    size="small"
                    onClick={(e) => setDeleteAnchor(e.currentTarget)}
                    sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                  >
                    <DeleteOutlinedIcon fontSize="small" />
                  </IconButton>
                </Tooltip>
              </Stack>
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
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
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

      {/* Edit dialog */}
      <Dialog open={editOpen} onClose={handleEditClose} maxWidth="md" fullWidth>
        <DialogTitle sx={{ fontWeight: 700 }}>Edit Collection</DialogTitle>
        <Divider />
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 2.5 }}>
          <TextField
            label="Collection name"
            value={editName}
            onChange={(e) => setEditName(e.target.value.slice(0, 100))}
            slotProps={{ htmlInput: { maxLength: 100 } }}
            helperText={`${editName.length}/100`}
            variant="filled"
            fullWidth
            required
            autoFocus
            disabled={updateCollection.isPending}
          />

          <GenericMarkdownEditor content={editDescription} setContent={setEditDescription} characterLimit={2000} />

          <Divider />

          {/* Pattern list */}
          <Box>
            <Typography variant="subtitle2" sx={{ fontWeight: 700, mb: 1 }}>
              Patterns ({fetchingFull ? '…' : editPatterns.length})
            </Typography>

            {fetchingFull ? (
              <Stack spacing={1}>
                {Array.from({ length: Math.min(collection.patterns.length, 4) }).map((_, i) => (
                  <Skeleton key={i} variant="rounded" height={40} />
                ))}
              </Stack>
            ) : editPatterns.length === 0 ? (
              <Typography variant="body2" color="text.disabled" sx={{ fontStyle: 'italic' }}>
                No patterns in this collection.
              </Typography>
            ) : (
              <List
                dense
                disablePadding
                sx={{ border: '1px solid', borderColor: 'divider', borderRadius: 1, maxHeight: 240, overflowY: 'auto' }}
              >
                {editPatterns.map((pattern) => (
                  <ListItem
                    key={pattern.id}
                    secondaryAction={
                      <Tooltip title="Remove from collection">
                        <IconButton
                          edge="end"
                          size="small"
                          onClick={() => removePattern(pattern.id)}
                          disabled={updateCollection.isPending}
                          sx={{ color: 'text.disabled', '&:hover': { color: 'error.main' } }}
                        >
                          <RemoveCircleOutlineRoundedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    }
                  >
                    <ListItemText
                      primary={<Typography sx={{ fontSize: 13, fontWeight: 500 }}>{pattern.name}</Typography>}
                      secondary={
                        <Typography color="text.disabled" sx={{ fontSize: 11, fontFamily: 'monospace' }}>
                          {pattern.id}
                        </Typography>
                      }
                    />
                  </ListItem>
                ))}
              </List>
            )}
          </Box>
        </DialogContent>
        <Divider />
        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button
            onClick={handleEditClose}
            variant="outlined"
            disabled={updateCollection.isPending}
            sx={{ borderRadius: 2 }}
          >
            Cancel
          </Button>
          <Button
            onClick={handleEditSave}
            variant="contained"
            loading={updateCollection.isPending}
            disabled={!editName.trim()}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            Save Changes
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
};
