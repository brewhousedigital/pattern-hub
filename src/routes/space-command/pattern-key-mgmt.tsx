import React from 'react';
import { createFileRoute } from '@tanstack/react-router';
import {
  useQueryGetAllPatternKeys,
  useQueryGetAllPatternKeyCollections,
  useMutationSavePatternKey,
  useMutationSavePatternKeyCollection,
  useMutationDeletePatternKeyCollection,
  useMutationSoftDeletePatternKey,
  useQueryGetPatternReferenceKeys,
  type TypePatternKeyReferenceObject,
  type TypePatternKeyCollectionResponse,
  type TypeSavePatternKeyCollectionPayload,
} from '@/functions/database/patterns';
import { generatePbImagePatternKeyRef } from '@/functions/utilities/generate-pb-image';
import { enqueueSnackbar } from 'notistack';
import { AdminHeaderContainer } from '@/components/admin/AdminHeaderContainer';
import { useCheckAdminAccess } from '@/functions/hooks/useCheckAccess';
import { EnumLevelsAdmin } from '@/functions/database/authentication';
import { downloadAllFilesAsZip } from '@/functions/utilities/download-all-files';
import { BorderedCard } from '@/components/cards/BorderedCard';
import { SvgDropZone } from '@/components/admin/SvgDropZone';

import ContentCopyRoundedIcon from '@mui/icons-material/ContentCopyRounded';
import DownloadForOfflineRoundedIcon from '@mui/icons-material/DownloadForOfflineRounded';
import EditRoundedIcon from '@mui/icons-material/EditRounded';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import AddIcon from '@mui/icons-material/Add';

import {
  Grid,
  Box,
  Typography,
  Stack,
  IconButton,
  Tooltip,
  CircularProgress,
  Divider,
  Button,
  TextField,
  Checkbox,
  Collapse,
  Chip,
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableRow,
} from '@mui/material';

export const Route = createFileRoute('/space-command/pattern-key-mgmt')({
  component: RouteComponent,
});

function RouteComponent() {
  const [panelOpen, setPanelOpen] = React.useState(false);

  const [collectionId, setCollectionId] = React.useState('');
  const [collectionName, setCollectionName] = React.useState('');
  const [selectedLegends, setSelectedLegends] = React.useState<TypePatternKeyReferenceObject[]>([]);

  const { checkAccess } = useCheckAdminAccess();

  const canAdd = checkAccess(EnumLevelsAdmin.PATTERN_KEY_MGMT_AC);
  const canEdit = checkAccess(EnumLevelsAdmin.PATTERN_KEY_MGMT_AU);
  const canDelete = checkAccess(EnumLevelsAdmin.PATTERN_KEY_MGMT_AD);

  const { data: legends = [], isLoading: legendsLoading, refetch: refetchKeys } = useQueryGetAllPatternKeys();
  const { data: referenceKeys = [], isLoading: referenceKeysLoading } = useQueryGetPatternReferenceKeys();

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

  const handleDuplicateCollection = async (collectionData: TypeSavePatternKeyCollectionPayload) => {
    try {
      const clonedData = JSON.parse(JSON.stringify(collectionData)) as TypeSavePatternKeyCollectionPayload;
      delete clonedData.id;
      clonedData.name = 'Duplicated Collection';

      await saveCollection.mutateAsync(clonedData);

      await refetchCollections();
    } catch (error: any) {
      enqueueSnackbar('Not able to duplicate your collection for some reason... try again in a few minutes.', {
        variant: 'error',
      });
    }
  };

  const handleFile = async (file: File) => {
    if (file.type !== 'image/svg+xml') {
      enqueueSnackbar('Not a SVG format!', { variant: 'error' });
      return;
    }

    try {
      await savePatternKey.mutateAsync(file);
      await refetchKeys();
    } catch (error: any) {
      enqueueSnackbar(`Couldn't upload for some reason. Try again in a few minutes. Error: ${error?.message}`, {
        variant: 'error',
      });
    }
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

  const [isZippingFiles, setIsZippingFiles] = React.useState(false);

  const handleDownloadPatternKeys = async () => {
    setIsZippingFiles(true);

    try {
      const fileArray = legends?.map((legend) => {
        return generatePbImagePatternKeyRef(legend);
      });

      await downloadAllFilesAsZip(fileArray, 'pattern-archive-legend-images');
    } catch (error: any) {
      enqueueSnackbar(
        `Something went wrong zipping up the pattern keys... sorry about that. Try again in a minute or two. Error: ${error?.message}`,
      );
    }

    setIsZippingFiles(false);
  };

  const isCollectionsLoading = saveCollection.isPending || collectionsLoading;

  return (
    <Box>
      <AdminHeaderContainer
        title="Pattern Key Management"
        action={handleDownloadPatternKeys}
        actionText="Download All Key Patterns"
        actionIcon={<DownloadForOfflineRoundedIcon />}
        actionLoading={isZippingFiles}
      />

      {/* ── Legends ── */}
      <Typography variant="overline" color="text.secondary" display="block" mb={1}>
        Legends
      </Typography>

      {canAdd && (
        <Box sx={{ mb: 4 }}>
          <SvgDropZone
            accept="image/svg+xml"
            acceptLabel=".svg only"
            onFile={handleFile}
            isLoading={savePatternKey.isPending || legendsLoading}
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
        <Grid container spacing={4} sx={{ alignItems: 'center' }}>
          {legends?.map((legend) => {
            const url = generatePbImagePatternKeyRef(legend);
            const filename = legend.name;

            return (
              <Grid key={legend.id} size={{ xs: 6, md: 4, lg: 3, xl: 2.4 }} sx={{ height: '100%' }}>
                <BorderedCard>
                  <Box
                    sx={{
                      position: 'relative',
                      minHeight: 150,
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                    }}
                  >
                    <Box
                      component="img"
                      loading="lazy"
                      src={url}
                      alt={filename}
                      sx={{
                        width: '100%',
                        height: 'auto',
                        maxHeight: 100,
                        borderRadius: 1,
                      }}
                    />

                    <IconButton
                      size="small"
                      onClick={() => handleSoftDeleteKey(legend.id)}
                      disabled={softDeleteKey.isPending}
                      sx={{
                        position: 'absolute',
                        top: 0,
                        right: 0,
                        zIndex: 6,
                        backgroundColor: '#eee',
                        '&:hover': { color: 'error.main', backgroundColor: '#eee' },
                      }}
                    >
                      <DeleteOutlineIcon fontSize="small" />
                    </IconButton>
                  </Box>
                </BorderedCard>
              </Grid>
            );
          })}
        </Grid>
      )}

      <Divider sx={{ my: 4 }} />

      <AdminHeaderContainer
        title="Key Collections"
        subtitle="Pre-built pattern key lists that can be quickly added to new pattern uploads."
        actionNode={
          <Button
            disabled={!canAdd}
            size="small"
            startIcon={<AddIcon fontSize="small" />}
            onClick={() => setPanelOpen((v) => !v)}
            variant="contained"
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
                      loading="lazy"
                      src={url}
                      alt={legend.name}
                      sx={{
                        width: 200,
                        maxHeight: 50,
                        height: 'auto',
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
                <Grid key={collection.id} size={{ xs: 12, md: 4, lg: 3 }}>
                  <BorderedCard>
                    <Box>
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
                          <IconButton
                            loading={isCollectionsLoading}
                            disabled={!canEdit}
                            size="small"
                            onClick={() => handleEditCollection(collection)}
                          >
                            <EditRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Box>
                          <IconButton
                            loading={isCollectionsLoading}
                            disabled={!canEdit}
                            size="small"
                            onClick={() => handleDuplicateCollection(collection)}
                          >
                            <ContentCopyRoundedIcon fontSize="small" />
                          </IconButton>
                        </Box>

                        <Box>
                          <IconButton
                            loading={isCollectionsLoading}
                            disabled={!canDelete}
                            size="small"
                            onClick={() => handleDeleteCollection(collection)}
                          >
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Box>
                      </Stack>

                      <Stack sx={{ gap: 2 }}>
                        {collection.collection.map((item, index) => (
                          <Box key={`collection-${collection.id}-${index}`}>
                            <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                              {item.name}
                            </Typography>

                            <Box
                              component="img"
                              loading="lazy"
                              src={item.fullPath}
                              alt={item.name}
                              sx={{
                                width: '100%',
                                height: 'auto',
                                borderRadius: 1,
                                maxHeight: 75,
                              }}
                            />
                          </Box>
                        ))}
                      </Stack>
                    </Box>
                  </BorderedCard>
                </Grid>
              );
            })}
          </Grid>
        </>
      )}
      <Divider sx={{ my: 4 }} />

      <AdminHeaderContainer
        title="Pattern Key Usage"
        subtitle="Each key image used across all patterns, with a count of how many patterns reference it."
      />

      {referenceKeysLoading ? (
        <Box display="flex" justifyContent="center" py={3}>
          <CircularProgress size={22} sx={{ color: '#3B6D11' }} />
        </Box>
      ) : referenceKeys.length === 0 ? (
        <Typography variant="body2" color="text.disabled" py={1.5}>
          No pattern key references found.
        </Typography>
      ) : (
        <Box sx={{ border: '0.5px solid', borderColor: 'divider', borderRadius: 2, overflow: 'hidden' }}>
          <Table size="small">
            <TableHead>
              <TableRow sx={{ backgroundColor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 600, width: 160 }}>Image</TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Name</TableCell>
                <TableCell sx={{ fontWeight: 600, width: 80 }} align="center">
                  Count
                </TableCell>
                <TableCell sx={{ fontWeight: 600 }}>Patterns</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {referenceKeys.map((row) => {
                const patternFilter = row.pattern_ids.map((id) => `id='${id}'`).join(' || ');
                const patternHref = `/space-command/patterns?filter=${encodeURIComponent(patternFilter)}`;
                return (
                  <TableRow key={row.id} hover>
                    <TableCell>
                      <Box
                        component="img"
                        src={row.fullPath}
                        alt={row.name}
                        loading="lazy"
                        sx={{ width: 140, height: 'auto', maxHeight: 80, display: 'block' }}
                      />
                    </TableCell>
                    <TableCell>
                      <Typography variant="body2" sx={{ fontFamily: 'monospace', fontSize: '0.8rem' }}>
                        {row.name}
                      </Typography>
                    </TableCell>
                    <TableCell align="center">
                      <Chip label={row.count} size="small" />
                    </TableCell>
                    <TableCell>
                      {row.pattern_ids.length > 0 ? (
                        <Button
                          component="a"
                          href={patternHref}
                          size="small"
                          variant="outlined"
                          sx={{ textTransform: 'none', borderRadius: 1.5 }}
                        >
                          View {row.pattern_ids.length} pattern{row.pattern_ids.length !== 1 ? 's' : ''}
                        </Button>
                      ) : (
                        <Typography variant="body2" color="text.disabled">
                          —
                        </Typography>
                      )}
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        </Box>
      )}
    </Box>
  );
}
