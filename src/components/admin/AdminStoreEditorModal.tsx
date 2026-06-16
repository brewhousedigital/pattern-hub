import React, { useState, useEffect } from 'react';
import {
  type TypeStoreLocation,
  useMutationCreateStore,
  useMutationUpdateStore,
  geocodeAddress,
  type TypeNominatimResult,
} from '@/functions/database/stores';
import { enqueueSnackbar } from 'notistack';
import { useAdminLogger, diffAdminChanges } from '@/functions/database/admin-logs';

import SearchIcon from '@mui/icons-material/Search';
import MyLocationIcon from '@mui/icons-material/MyLocation';

import {
  Autocomplete,
  Box,
  Button,
  CircularProgress,
  Dialog,
  DialogActions,
  DialogContent,
  DialogTitle,
  Divider,
  Grid,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Tooltip,
  Typography,
} from '@mui/material';

type Props = {
  open: boolean;
  onClose: () => void;
  store: TypeStoreLocation | null;
  onSaved: () => void;
};

const EMPTY_TAGS: string[] = [];

export const AdminStoreEditorModal = ({ open, onClose, store, onSaved }: Props) => {
  const isEdit = !!store;

  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [streetAddress, setStreetAddress] = useState('');
  const [phone, setPhone] = useState('');
  const [website, setWebsite] = useState('');
  const [lat, setLat] = useState('');
  const [lon, setLon] = useState('');
  const [tags, setTags] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Geocoding state
  const [geocodeLoading, setGeocodeLoading] = useState(false);
  const [geocodeResults, setGeocodeResults] = useState<TypeNominatimResult[]>([]);

  const createStore = useMutationCreateStore();
  const updateStore = useMutationUpdateStore();
  const { log } = useAdminLogger();

  // Populate form when editing
  useEffect(() => {
    if (store) {
      setName(store.name ?? '');
      setDescription(store.description ?? '');
      setStreetAddress(store.street_address ?? '');
      setPhone(store.phone ?? '');
      setWebsite(store.website ?? '');
      setLat(store.location?.lat != null ? String(store.location.lat) : '');
      setLon(store.location?.lon != null ? String(store.location.lon) : '');
      setTags(Array.isArray(store.tags) ? store.tags : []);
    } else {
      setName('');
      setDescription('');
      setStreetAddress('');
      setPhone('');
      setWebsite('');
      setLat('');
      setLon('');
      setTags(EMPTY_TAGS);
    }
    setGeocodeResults([]);
  }, [store, open]);

  const handleGeocode = async () => {
    if (!streetAddress.trim()) return;
    setGeocodeLoading(true);
    setGeocodeResults([]);
    try {
      const results = await geocodeAddress(streetAddress.trim());
      setGeocodeResults(results.slice(0, 5));
      if (results.length === 0) {
        enqueueSnackbar('No results found for that address.', { variant: 'warning' });
      }
    } catch {
      enqueueSnackbar('Geocoding failed. Check your network and try again.', { variant: 'error' });
    } finally {
      setGeocodeLoading(false);
    }
  };

  const handlePickGeocodeResult = (result: TypeNominatimResult) => {
    setLat(parseFloat(result.lat).toFixed(6));
    setLon(parseFloat(result.lon).toFixed(6));
    setStreetAddress(result.display_name);
    setGeocodeResults([]);
    enqueueSnackbar('Coordinates set from geocode result.', { variant: 'success' });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) return;

    const latNum = parseFloat(lat);
    const lonNum = parseFloat(lon);
    if (isNaN(latNum) || isNaN(lonNum)) {
      enqueueSnackbar('Please enter valid latitude and longitude values.', { variant: 'warning' });
      return;
    }

    setSaving(true);
    try {
      const payload = {
        name: name.trim(),
        description: description.trim(),
        street_address: streetAddress.trim(),
        phone: phone.trim(),
        website: website.trim(),
        location: { lat: latNum, lon: lonNum },
        tags,
      };

      if (isEdit && store) {
        await updateStore.mutateAsync({ id: store.id, ...payload });
        log({
          action: 'Store Updated',
          entity_type: 'Store',
          entity_id: store.id,
          entity_name: payload.name,
          changes: diffAdminChanges(
            { name: store.name, description: store.description, street_address: store.street_address, phone: store.phone, website: store.website } as Record<string, unknown>,
            { name: payload.name, description: payload.description, street_address: payload.street_address, phone: payload.phone, website: payload.website } as Record<string, unknown>,
            ['name', 'description', 'street_address', 'phone', 'website'],
          ),
          metadata: { lat: payload.location.lat, lon: payload.location.lon },
        });
        enqueueSnackbar('Store updated successfully.', { variant: 'success' });
      } else {
        const created = await createStore.mutateAsync(payload);
        log({
          action: 'Store Created',
          entity_type: 'Store',
          entity_id: (created as any)?.id ?? '',
          entity_name: payload.name,
          changes: {},
          metadata: { lat: payload.location.lat, lon: payload.location.lon },
        });
        enqueueSnackbar('Store created successfully.', { variant: 'success' });
      }

      onSaved();
      onClose();
    } catch {
      enqueueSnackbar('Failed to save store. Please try again.', { variant: 'error' });
    } finally {
      setSaving(false);
    }
  };

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle sx={{ fontWeight: 700 }}>{isEdit ? 'Edit Store' : 'Add Store'}</DialogTitle>

      <Divider />

      <Box component="form" onSubmit={handleSubmit}>
        <DialogContent sx={{ display: 'flex', flexDirection: 'column', gap: 2.5, pt: 3 }}>
          {/* Name */}
          <TextField
            label="Store Name"
            value={name}
            onChange={(e) => setName(e.target.value)}
            required
            fullWidth
            variant="filled"
            autoFocus
          />

          {/* Description */}
          <TextField
            label="Description"
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            fullWidth
            multiline
            rows={3}
            variant="filled"
          />

          {/* Street address + geocode */}
          <Box>
            <TextField
              label="Street Address"
              value={streetAddress}
              onChange={(e) => {
                setStreetAddress(e.target.value);
                setGeocodeResults([]);
              }}
              fullWidth
              variant="filled"
              //helperText="Enter the full address, then click 🔍 to look up coordinates."
              /*slotProps={{
                input: {
                  endAdornment: (
                    <InputAdornment position="end">
                      <Tooltip title="Look up coordinates for this address">
                        <IconButton
                          onClick={handleGeocode}
                          disabled={geocodeLoading || !streetAddress.trim()}
                          edge="end"
                          size="small"
                        >
                          {geocodeLoading ? <CircularProgress size={16} /> : <SearchIcon fontSize="small" />}
                        </IconButton>
                      </Tooltip>
                    </InputAdornment>
                  ),
                },
              }}*/
            />

            {/* Geocode dropdown results */}
            {geocodeResults.length > 0 && (
              <Paper variant="outlined" sx={{ mt: 0.5, borderRadius: 2, overflow: 'hidden' }}>
                <Typography variant="caption" sx={{ px: 1.5, py: 0.75, display: 'block', color: 'text.disabled' }}>
                  Select a result to use its coordinates
                </Typography>
                <Divider />
                <List dense disablePadding>
                  {geocodeResults.map((r) => (
                    <ListItemButton
                      key={r.place_id}
                      onClick={() => handlePickGeocodeResult(r)}
                      sx={{ borderRadius: 0 }}
                    >
                      <ListItemText
                        primary={r.display_name}
                        secondary={`${parseFloat(r.lat).toFixed(5)}, ${parseFloat(r.lon).toFixed(5)}`}
                        slotProps={{
                          primary: { sx: { fontSize: '0.8rem' } },
                          secondary: { sx: { fontSize: '0.7rem' } },
                        }}
                      />
                    </ListItemButton>
                  ))}
                </List>
              </Paper>
            )}
          </Box>

          {/* Lat / Lon */}
          <Grid container spacing={2}>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Latitude"
                type="number"
                value={lat}
                onChange={(e) => setLat(e.target.value)}
                fullWidth
                variant="filled"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <MyLocationIcon sx={{ fontSize: 16, color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                  },
                  htmlInput: { step: 'any' },
                }}
              />
            </Grid>
            <Grid size={{ xs: 6 }}>
              <TextField
                label="Longitude"
                type="number"
                value={lon}
                onChange={(e) => setLon(e.target.value)}
                fullWidth
                variant="filled"
                slotProps={{ htmlInput: { step: 'any' } }}
              />
            </Grid>
          </Grid>

          {/* Phone */}
          <TextField
            label="Phone Number"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            fullWidth
            variant="filled"
            type="tel"
          />

          {/* Website */}
          <TextField
            label="Website URL"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            fullWidth
            variant="filled"
            type="url"
            placeholder="https://example.com"
          />

          {/* Tags */}
          <Autocomplete
            multiple
            freeSolo
            disableClearable
            options={[]}
            value={tags}
            onChange={(_, newValue) => setTags(newValue as string[])}
            slotProps={{ chip: { size: 'small' } }}
            renderInput={(params) => (
              <TextField
                {...params}
                variant="filled"
                label="Product Tags"
                placeholder="Type a tag and press Enter"
                helperText='e.g. "supplies", "restoration", "classes"'
              />
            )}
          />
        </DialogContent>

        <Divider />

        <DialogActions sx={{ px: 3, py: 2, gap: 1 }}>
          <Button onClick={onClose} variant="outlined" sx={{ borderRadius: 2 }}>
            Cancel
          </Button>
          <Button
            type="submit"
            variant="contained"
            loading={saving}
            disabled={!name.trim()}
            sx={{ borderRadius: 2, fontWeight: 700 }}
          >
            {isEdit ? 'Save Changes' : 'Create Store'}
          </Button>
        </DialogActions>
      </Box>
    </Dialog>
  );
};
