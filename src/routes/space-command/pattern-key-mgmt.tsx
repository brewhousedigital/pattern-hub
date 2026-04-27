import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetAllPatternKeys,
  useQueryGetAllPatternKeyCollections,
  useMutationSavePatternKey,
  useMutationSavePatternKeyCollection,
  useMutationDeletePatternKeyCollection,
  useMutationSoftDeletePatternKey,
  type TypePatternKeyReferenceObject,
  type TypePatternKeyCollectionResponse,
  type TypeSavePatternKeyCollectionPayload,
} from '@/functions/database/patterns';
import { generatePbImagePatternKeyRef } from '@/functions/utilities/generate-pb-image';
import { enqueueSnackbar } from 'notistack';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';

import EditRoundedIcon from '@mui/icons-material/EditRounded';
import UploadFileIcon from '@mui/icons-material/UploadFile';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import {
  Grid,
  Box,
  Typography,
  Stack,
  IconButton,
  Avatar,
  Tooltip,
  CircularProgress,
  Divider,
  Button,
  TextField,
  Checkbox,
  Collapse,
  Card,
  CardContent,
} from '@mui/material';

export const Route = createFileRoute('/space-command/pattern-key-mgmt')({
  component: RouteComponent,
});

function RouteComponent() {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragOver, setDragOver] = React.useState(false);
  const [panelOpen, setPanelOpen] = React.useState(false);

  const [collectionId, setCollectionId] = React.useState('');
  const [collectionName, setCollectionName] = React.useState('');
  const [selectedLegends, setSelectedLegends] = React.useState<TypePatternKeyReferenceObject[]>([]);

  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.PATTERN_KEY_MGMT_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.PATTERN_KEY_MGMT_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.PATTERN_KEY_MGMT_AD);

  const { data: legends = [], isLoading: legendsLoading, refetch: refetchKeys } = useQueryGetAllPatternKeys();

  const {
    data: collections = [],
    isLoading: collectionsLoading,
    refetch: refetchCollections,
  } = useQueryGetAllPatternKeyCollections();

  const savePatternKey = useMutationSavePatternKey();
  const softDeleteKey = useMutationSoftDeletePatternKey();

  const saveCollection = useMutationSavePatternKeyCollection();
  const deleteCollection = useMutationDeletePatternKeyCollection();

  const handleSaveCollection = async () => {
    const payload: TypeSavePatternKeyCollectionPayload = {
      name: collectionName,
      collection: selectedLegends,
    };

    if (collectionId) {
      payload.id = collectionId;
    }

    try {
      await saveCollection.mutateAsync(payload);

      await refetchCollections();

      resetPanel();
    } catch (error: any) {
      enqueueSnackbar('Not able to save your collection for some reason... try again in a few minutes.', {
        variant: 'error',
      });
    }
  };

  const handleFile = async (file: File | undefined) => {
    if (!file) return;

    if (file.type !== 'image/svg+xml') {
      enqueueSnackbar('Not a SVG format!', {
        variant: 'error',
      });
      return;
    }

    try {
      await savePatternKey.mutateAsync(file);

      await refetchKeys();

      if (inputRef.current) {
        inputRef.current.value = '';
      }
    } catch (error: any) {
      enqueueSnackbar(`Couldn't upload for some reason. Try again in a few minutes. Error: ${error?.message}`, {
        variant: 'error',
      });
    }
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    handleFile(e.dataTransfer.files[0]);
  };

  const resetPanel = () => {
    setPanelOpen(false);
    setSelectedLegends([]);
    setCollectionName('');
    setCollectionId('');
  };

  const selectedList = Object.values(selectedLegends);

  const canSave =
    collectionName.trim() !== '' && selectedList.length > 0 && selectedList.every((item) => item.name.trim() !== '');

  const handleToggleLegendToNewCollection = (
    e: React.ChangeEvent<HTMLInputElement>,
    name: string,
    fullPath: string,
  ) => {
    const isChecked = e.target.checked;

    if (isChecked) {
      setSelectedLegends((prev) => {
        return [
          ...prev,
          {
            name: '',
            // This is the name of the legend image... not the custom name
            image: name,
            fullPath: fullPath,
          },
        ];
      });
    } else {
      setSelectedLegends((prev) => {
        return prev.filter((item) => item.image !== name);
      });
    }
  };

  const handleCustomNamePerKeyForNewCollection = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement, Element>,
    name: string,
  ) => {
    const customName = e.target.value;

    setSelectedLegends((prev) => {
      const thisLegendIndex = prev.findIndex((item) => item.image === name);

      const clonedArray = JSON.parse(JSON.stringify(prev));
      clonedArray[thisLegendIndex].name = customName;

      return clonedArray;
    });
  };

  const handleDeleteCollection = async (collection: TypePatternKeyCollectionResponse) => {
    const shouldDelete = confirm(`Are you sure you want to delete the collection called '${collection.name}'`);

    if (shouldDelete) {
      try {
        await deleteCollection.mutateAsync(collection.id);
        await refetchCollections();
      } catch (error: any) {
        enqueueSnackbar(`Something went wrong deleting that collection... sorry about that. Error: ${error?.message}`);
      }
    }
  };

  const handleEditCollection = async (collection: TypePatternKeyCollectionResponse) => {
    setPanelOpen(true);
    setSelectedLegends(collection.collection);
    setCollectionName(collection.name);
    setCollectionId(collection.id);
  };

  const handleSoftDeleteKey = async (id: string) => {
    const shouldDelete = confirm('Are you sure you want to delete this?');

    if (shouldDelete) {
      try {
        await softDeleteKey.mutateAsync(id);
        await refetchKeys();
      } catch (error: any) {
        enqueueSnackbar(`Ran into an error trying to delete this key image... whoops. Error: ${error?.message}`);
      }
    }
  };

  return (
    <Box>
      <AdminHeaderContainer title="Pattern Key Management" />

      {/* ── Legends ── */}
      <Typography variant="overline" color="text.secondary" display="block" mb={1}>
        Legends
      </Typography>

      {canAdd && (
        <Box
          onClick={() => inputRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault();
            setDragOver(true);
          }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          sx={{
            border: '1.5px dashed',
            borderColor: dragOver ? '#3B6D11' : 'divider',
            borderRadius: 2,
            py: 4,
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            gap: 0.75,
            cursor: 'pointer',
            transition: 'background 0.15s, border-color 0.15s',
            backgroundColor: dragOver ? '#EAF3DE' : 'transparent',
            mb: 1.5,
            '&:hover': { backgroundColor: 'action.hover' },
          }}
        >
          <Avatar sx={{ backgroundColor: '#EAF3DE', width: 40, height: 40 }}>
            {savePatternKey.isPending || legendsLoading ? (
              <CircularProgress size={18} sx={{ color: '#3B6D11' }} />
            ) : (
              <UploadFileIcon sx={{ color: '#3B6D11', fontSize: 20 }} />
            )}
          </Avatar>

          <Typography variant="body2" fontWeight={500}>
            Click to upload
          </Typography>

          <Typography variant="caption" color="text.disabled">
            .svg only
          </Typography>

          <input
            ref={inputRef}
            type="file"
            accept="image/svg+xml"
            hidden
            onChange={(e) => handleFile(e.target.files?.[0])}
          />
        </Box>
      )}

      {legendsLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} sx={{ color: '#3B6D11' }} />
        </Box>
      ) : legends.length === 0 ? (
        <Typography variant="body2" color="text.disabled" py={1.5}>
          No legends yet.
        </Typography>
      ) : (
        <Grid container spacing={4}>
          {legends?.map((legend) => {
            const url = generatePbImagePatternKeyRef(legend);
            const filename = legend.name;

            return (
              <Grid key={legend.id} size={{ xs: 6, md: 4, lg: 3, xl: 2.4 }}>
                <Box sx={{ position: 'relative' }}>
                  <Box
                    component="img"
                    src={url}
                    alt={filename}
                    sx={{
                      width: '100%',
                      height: 'auto',
                      borderRadius: 1,
                      objectFit: 'cover',
                    }}
                  />

                  <IconButton
                    size="small"
                    onClick={() => handleSoftDeleteKey(legend.id)}
                    disabled={softDeleteKey.isPending}
                    sx={{
                      position: 'absolute',
                      top: 4,
                      right: 4,
                      zIndex: 6,
                      backgroundColor: '#eee',
                      '&:hover': { color: 'error.main', backgroundColor: '#eee' },
                    }}
                  >
                    <DeleteOutlineIcon fontSize="small" />
                  </IconButton>
                </Box>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Divider sx={{ my: 3 }} />

      <AdminHeaderContainer
        title="Key Collections"
        subtitle="Pre-built pattern key lists that can be quickly added to new pattern uploads."
        actionNode={
          <Button
            disabled={!canAdd}
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => setPanelOpen((v) => !v)}
            sx={{
              fontSize: 13,
              color: 'text.primary',
              border: '0.5px solid',
              borderColor: 'divider',
              borderRadius: 1.5,
              px: 1.5,
              py: 0.5,
              textTransform: 'none',
              '&:hover': { backgroundColor: 'action.hover' },
            }}
          >
            New collection
          </Button>
        }
      />

      {/* Inline creation panel */}
      <Collapse in={panelOpen} unmountOnExit>
        <Box
          sx={{
            border: '0.5px solid',
            borderColor: 'divider',
            borderRadius: 2,
            p: 2,
            mb: 4,
            backgroundColor: 'background.paper',
          }}
        >
          <Typography variant="subtitle2" fontWeight={500} mb={1.5}>
            New key collection
          </Typography>

          <Box sx={{ mb: 4, maxWidth: 768 }}>
            <TextField
              fullWidth
              label="Collection name"
              size="small"
              value={collectionName}
              onChange={(e) => setCollectionName(e.target.value)}
              sx={{
                '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B6D11' },
                '& label.Mui-focused': { color: '#3B6D11' },
              }}
            />
          </Box>

          <Typography variant="overline" color="text.secondary" display="block" mb={1}>
            Select legends &amp; name each
          </Typography>

          {legends.length === 0 ? (
            <Typography variant="body2" color="text.disabled" mb={2}>
              Upload legends first.
            </Typography>
          ) : (
            <Box sx={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 0.75, mb: 4 }}>
              {legends.map((legend, index) => {
                const isSelected = selectedLegends.some((item) => item.image === legend.name);

                const thisCustomName = selectedLegends.find((item) => item.image === legend.name);

                const url = generatePbImagePatternKeyRef(legend);

                return (
                  <Box
                    key={`new-collection-item-${index}`}
                    sx={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: 1,
                      border: '0.5px solid',
                      borderColor: isSelected ? '#3B6D11' : 'divider',
                      borderRadius: 1.5,
                      backgroundColor: isSelected ? '#EAF3DE' : 'background.paper',
                      px: 1.25,
                      py: 1,
                      cursor: 'pointer',
                      transition: 'border-color 0.12s, background 0.12s',
                    }}
                  >
                    <Checkbox
                      checked={isSelected}
                      size="small"
                      onChange={(e) => handleToggleLegendToNewCollection(e, legend.name, url)}
                      sx={{
                        p: 0,
                        color: 'divider',
                        '&.Mui-checked': { color: '#3B6D11' },
                      }}
                    />

                    <Box
                      component="img"
                      src={url}
                      alt={legend.name}
                      sx={{
                        width: 200,
                        height: 'auto',
                        borderRadius: 0.75,
                        objectFit: 'cover',
                        flexShrink: 0,
                        backgroundColor: 'action.hover',
                      }}
                    />

                    <Box flex={1} minWidth={0} onClick={(e) => e.stopPropagation()}>
                      <TextField
                        size="small"
                        placeholder="Name…"
                        value={thisCustomName?.name || ''}
                        disabled={!isSelected}
                        onChange={(e) => handleCustomNamePerKeyForNewCollection(e, legend.name)}
                        onClick={(e) => e.stopPropagation()}
                        fullWidth
                        sx={{
                          '& .MuiInputBase-root': { fontSize: 12, height: 26 },
                          '& .Mui-focused .MuiOutlinedInput-notchedOutline': { borderColor: '#3B6D11' },
                        }}
                      />
                    </Box>
                  </Box>
                );
              })}
            </Box>
          )}

          <Box sx={{ mb: 4 }}>
            <Divider />
          </Box>

          <Box display="flex" justifyContent="flex-end" gap={1}>
            <Button
              size="small"
              onClick={resetPanel}
              sx={{
                textTransform: 'none',
                color: 'text.secondary',
                border: '0.5px solid',
                borderColor: 'divider',
                borderRadius: 1.5,
              }}
            >
              Cancel
            </Button>

            <Button
              size="small"
              disabled={!canSave}
              loading={saveCollection.isPending}
              onClick={handleSaveCollection}
              sx={{
                textTransform: 'none',
                backgroundColor: '#3B6D11',
                color: 'white',
                borderRadius: 1.5,
                px: 2,
                '&:hover': { backgroundColor: '#27500A' },
                '&.Mui-disabled': { backgroundColor: 'action.disabledBackground' },
              }}
            >
              Save collection
            </Button>
          </Box>
        </Box>
      </Collapse>

      {/* Collections list */}
      {collectionsLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} sx={{ color: '#3B6D11' }} />
        </Box>
      ) : collections.length === 0 ? (
        <Typography variant="body2" color="text.disabled" py={1.5}>
          No collections yet.
        </Typography>
      ) : (
        <>
          <Grid container spacing={4}>
            {collections?.map((collection) => {
              return (
                <Grid key={collection.id} size={{ xs: 6, md: 4, lg: 3, xl: 2.4 }}>
                  <Card>
                    <CardContent>
                      <Stack
                        direction="row"
                        sx={{
                          gap: 1,
                          alignItems: 'center',
                          mb: 1,
                          pb: 1,
                          borderBottom: '1px solid #eee',
                        }}
                      >
                        <Box sx={{ mr: 'auto' }}>
                          <Typography variant="body2" fontWeight={500} noWrap>
                            {collection.name}
                          </Typography>

                          <Typography variant="caption" color="text.secondary">
                            {collection.collection?.length ?? 0} keys
                          </Typography>
                        </Box>

                        <Box>
                          <IconButton disabled={!canEdit} size="small" onClick={() => handleEditCollection(collection)}>
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Box>
                          <IconButton
                            disabled={!canDelete}
                            size="small"
                            onClick={() => handleDeleteCollection(collection)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Stack>

                      {collection.collection.map((item, index) => (
                        <Box key={`collection-${collection.id}-${index}`}>
                          <Typography variant="caption" color="text.secondary">
                            {item.name}
                          </Typography>

                          <Box
                            component="img"
                            src={item.fullPath}
                            alt={item.name}
                            sx={{
                              width: '100%',
                              height: 'auto',
                              borderRadius: 1,
                              objectFit: 'cover',
                            }}
                          />
                        </Box>
                      ))}
                    </CardContent>
                  </Card>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
    </Box>
  );
}
