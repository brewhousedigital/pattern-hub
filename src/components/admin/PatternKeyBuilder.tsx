import React from 'react';
import { generatePbImagePatternKeyRef } from '@/functions/utilities/generate-pb-image';
import {
  useQueryGetAllPatternKeys,
  useQueryGetAllPatternKeyCollections,
  type TypePatternKeyReferenceObject,
} from '@/functions/database/patterns';

import DeleteRoundedIcon from '@mui/icons-material/DeleteRounded';

import {
  Alert,
  Box,
  Button,
  CircularProgress,
  Grid,
  IconButton,
  List,
  ListItem,
  ListItemText,
  MenuItem,
  Stack,
  TextField,
  Typography,
} from '@mui/material';

type PatternKeyBuilderProps = {
  value: TypePatternKeyReferenceObject[];
  onChange: (newValue: TypePatternKeyReferenceObject[]) => void;
  variant?: 'outlined' | 'filled';
};

// Shared by AdminEditPatternModal and the user-submission review page: lets an
// admin pick from the pattern-key catalog (with a per-use display name) and
// bulk-apply saved key collections. Self-contained - queries its own data,
// only couples to the parent via the assigned-keys value/onChange.
export const PatternKeyBuilder = (props: PatternKeyBuilderProps) => {
  const { value, onChange } = props;
  const variant = props.variant ?? 'outlined';

  const {
    isPending: isPendingPatternKeys,
    isError: isErrorPatternKeys,
    data: patternKeys,
  } = useQueryGetAllPatternKeys();
  const { data: patternKeyCollections } = useQueryGetAllPatternKeyCollections();

  const [quickAddKeyCollection, setQuickAddKeyCollection] = React.useState('');
  const [newPatternKey, setNewPatternKey] = React.useState<TypePatternKeyReferenceObject>({
    image: '',
    name: '',
    fullPath: '',
  });
  const [openKeySelectWindow, setOpenKeySelectWindow] = React.useState(false);

  const handleNewChangePatternKey = (newData: Partial<TypePatternKeyReferenceObject>) => {
    setNewPatternKey((prev) => ({ ...prev, ...newData }));
  };

  const handleResetChangePatternKey = () => {
    setNewPatternKey({ image: '', name: '', fullPath: '' });
  };

  const handleAddPatternKey = (newData: TypePatternKeyReferenceObject) => {
    onChange([...value, { ...newData }]);
    setTimeout(() => handleResetChangePatternKey(), 100);
  };

  const handleDeletePatternKey = (fullPath: string) => {
    onChange(value.filter((item) => item.fullPath !== fullPath));
  };

  const handleOpenKeySelect = () => {
    const promises =
      patternKeys?.map(
        (item) =>
          new Promise<void>((resolve) => {
            const img = new Image();
            img.onload = () => resolve();
            img.onerror = () => resolve();
            img.src = generatePbImagePatternKeyRef(item);
          }),
      ) || [];
    Promise.all(promises).then(() => setOpenKeySelectWindow(true));
  };

  const handleClickQuickAddKeyCollection = () => {
    const quickAdd = JSON.parse(quickAddKeyCollection) as TypePatternKeyReferenceObject[];
    onChange(quickAdd);
    setQuickAddKeyCollection('');
  };

  return (
    <>
      <Stack direction="row" sx={{ alignItems: 'center', gap: 1 }}>
        <Box sx={{ mr: 'auto' }}>
          <Typography variant="body2" sx={{ fontWeight: 600 }}>
            Pattern Key Builder
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Add key images to the legend
          </Typography>
        </Box>

        <TextField
          select
          size="small"
          label="Quick-add collection"
          sx={{ minWidth: 200 }}
          value={quickAddKeyCollection}
          onChange={(e) => setQuickAddKeyCollection(e.target.value)}
        >
          {patternKeyCollections?.map((item, index) => (
            <MenuItem key={`key-collection-quick-add-${index}`} value={JSON.stringify(item.collection)}>
              {item.name}
            </MenuItem>
          ))}
        </TextField>

        <Button
          size="small"
          variant="outlined"
          onClick={handleClickQuickAddKeyCollection}
          disabled={!quickAddKeyCollection}
        >
          Apply
        </Button>
      </Stack>

      {isPendingPatternKeys && <CircularProgress size={20} />}

      {isErrorPatternKeys && (
        <Alert severity="error">Unable to load the pattern keys… that's probably not good. Try refreshing.</Alert>
      )}

      {patternKeys && (
        <Grid container spacing={2}>
          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              select
              variant={variant}
              label="Key Image"
              value={newPatternKey.fullPath}
              slotProps={{
                select: {
                  open: openKeySelectWindow,
                  onOpen: handleOpenKeySelect,
                  onClose: () => setOpenKeySelectWindow(false),
                },
              }}
              onChange={(e) => handleNewChangePatternKey({ fullPath: e.target.value })}
            >
              {patternKeys.map((item) => (
                <MenuItem key={item.id} value={generatePbImagePatternKeyRef(item)}>
                  <Box
                    component="img"
                    loading="lazy"
                    src={generatePbImagePatternKeyRef(item)}
                    alt={`pattern-key-img-${item.id}`}
                    sx={{ width: '100%', height: 'auto', maxHeight: 100 }}
                  />
                </MenuItem>
              ))}
            </TextField>
          </Grid>

          <Grid size={{ xs: 12, md: 6 }}>
            <TextField
              fullWidth
              variant={variant}
              label="Key Name"
              value={newPatternKey.name}
              onChange={(e) => handleNewChangePatternKey({ name: e.target.value })}
              sx={{ mb: 2 }}
            />
            <Stack direction="row" spacing={2} sx={{ justifyContent: 'space-between' }}>
              <Button variant="outlined" color="error" onClick={handleResetChangePatternKey}>
                Reset
              </Button>
              <Button
                variant="outlined"
                color="success"
                disabled={!newPatternKey.fullPath || !newPatternKey.name.trim()}
                onClick={() => handleAddPatternKey(newPatternKey)}
              >
                Add key
              </Button>
            </Stack>
          </Grid>
        </Grid>
      )}

      <Box>
        <Typography variant="body2" sx={{ fontWeight: 600, mb: 0.5 }}>
          Assigned Keys
        </Typography>

        {!value?.length ? (
          <Alert severity="warning" variant="outlined">
            No keys have been assigned to this pattern yet.
          </Alert>
        ) : (
          <List disablePadding>
            {value.map((item) => (
              <ListItem
                key={item.fullPath}
                disableGutters
                divider
                secondaryAction={
                  <IconButton
                    aria-label="remove this pattern key"
                    size="small"
                    onClick={() => handleDeletePatternKey(item?.fullPath || '')}
                  >
                    <DeleteRoundedIcon fontSize="small" />
                  </IconButton>
                }
              >
                <ListItemText
                  primary={
                    <Typography variant="body2" sx={{ fontWeight: 500 }}>
                      {item.name}
                    </Typography>
                  }
                  secondary={
                    <Box
                      component="img"
                      loading="lazy"
                      src={item.fullPath}
                      alt={`pattern-key-img-added-${item.name}`}
                      sx={{ width: '100%', maxWidth: 200, height: 'auto', mt: 0.5 }}
                    />
                  }
                />
              </ListItem>
            ))}
          </List>
        )}
      </Box>
    </>
  );
};
