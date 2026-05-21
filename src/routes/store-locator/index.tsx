import React, { useState, useMemo, useCallback, useEffect } from 'react';
import { createFileRoute, Link } from '@tanstack/react-router';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import {
  useQueryGetStoresCached,
  geocodeAddress,
  haversineKm,
  type TypeStoreLocation,
  type TypeNominatimResult,
} from '@/functions/database/stores';
import { useGlobalAuthData } from '@/data/auth-data';
import { GeneralLayout } from '@/components/layout/GeneralLayout';
import { generateSEO } from '@/functions/utilities/seo';
import { PRIMARY_COLOR } from '@/data/constants';
import { alpha } from '@mui/material/styles';

import SearchIcon from '@mui/icons-material/Search';
import MyLocationIcon from '@mui/icons-material/MyLocation';
import PlaceIcon from '@mui/icons-material/Place';
import PhoneOutlinedIcon from '@mui/icons-material/PhoneOutlined';
import LanguageOutlinedIcon from '@mui/icons-material/LanguageOutlined';
import StorefrontOutlinedIcon from '@mui/icons-material/StorefrontOutlined';
import LockOutlinedIcon from '@mui/icons-material/LockOutlined';
import ClearIcon from '@mui/icons-material/Clear';

import { StoreReportIssue } from '@/components/StoreReportIssue';

import {
  Alert,
  Box,
  Button,
  Card,
  CardContent,
  Container,
  Chip,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  List,
  ListItemButton,
  ListItemText,
  Paper,
  Stack,
  TextField,
  Tooltip,
  Typography,
  useMediaQuery,
  useTheme,
} from '@mui/material';

// ─── Fix Leaflet default icon paths broken by Vite ───────────────────────────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

// ─── Route ───────────────────────────────────────────────────────────────────

export const Route = createFileRoute('/store-locator/')({
  component: RouteComponent,
  head: ({ match }) => ({
    meta: generateSEO('Store Locator', 'Find craft supply stores near you', match.pathname),
  }),
});

// ─── Map pan helper (child component — has access to map context) ──────────

type MapPannerProps = { center: [number, number] | null; zoom?: number };

function MapPanner({ center, zoom = 12 }: MapPannerProps) {
  const map = useMap();
  useEffect(() => {
    if (center) {
      map.setView(center, zoom, { animate: true });
    }
  }, [center, zoom, map]);
  return null;
}

// ─── USA geographic center — default map view ─────────────────────────────

const USA_CENTER: [number, number] = [39.5, -98.35];
const USA_ZOOM = 4;

// ─── Main component ───────────────────────────────────────────────────────

function RouteComponent() {
  const { authData } = useGlobalAuthData();
  const theme = useTheme();
  const isMd = useMediaQuery(theme.breakpoints.up('md'));

  const { data: stores = [], isLoading: storesLoading } = useQueryGetStoresCached();

  // ── Map pan target ───────────────────────────────────────────────────────
  const [mapCenter, setMapCenter] = useState<[number, number] | null>(null);
  const [mapZoom, setMapZoom] = useState<number>(12);

  // ── Reference point for distance (user location OR geocoded address) ─────
  const [refPoint, setRefPoint] = useState<{ lat: number; lon: number } | null>(null);

  // ── Address search state ─────────────────────────────────────────────────
  const [searchInput, setSearchInput] = useState('');
  const [searchLoading, setSearchLoading] = useState(false);
  const [searchResults, setSearchResults] = useState<TypeNominatimResult[]>([]);

  // ── Geolocation state ────────────────────────────────────────────────────
  const [geoLoading, setGeoLoading] = useState(false);
  const [geoError, setGeoError] = useState('');

  // ── Tag filter state ─────────────────────────────────────────────────────
  const [activeTags, setActiveTags] = useState<Set<string>>(new Set());

  // Derive unique tag list from all stores
  const allTags = useMemo(() => {
    const set = new Set<string>();
    stores.forEach((s) => {
      (Array.isArray(s.tags) ? s.tags : []).forEach((t) => set.add(t.toLowerCase()));
    });
    return Array.from(set).sort();
  }, [stores]);

  const toggleTag = (tag: string) => {
    setActiveTags((prev) => {
      const next = new Set(prev);
      if (next.has(tag)) next.delete(tag);
      else next.add(tag);
      return next;
    });
  };

  // ── Filtered + sorted stores ─────────────────────────────────────────────
  const filteredStores = useMemo(() => {
    let result = stores;

    if (activeTags.size > 0) {
      result = result.filter((s) => {
        const tags = Array.isArray(s.tags) ? s.tags.map((t) => t.toLowerCase()) : [];
        return [...activeTags].every((t) => tags.includes(t));
      });
    }

    if (refPoint) {
      result = [...result].sort((a, b) => {
        const dA = haversineKm(refPoint.lat, refPoint.lon, a.location.lat, a.location.lon);
        const dB = haversineKm(refPoint.lat, refPoint.lon, b.location.lat, b.location.lon);
        return dA - dB;
      });
    }

    return result;
  }, [stores, activeTags, refPoint]);

  // ── Distance formatter ───────────────────────────────────────────────────
  const distanceLabel = useCallback(
    (store: TypeStoreLocation): string | null => {
      if (!refPoint || !store.location?.lat) return null;
      const km = haversineKm(refPoint.lat, refPoint.lon, store.location.lat, store.location.lon);
      const mi = km * 0.621371;
      return `${km.toFixed(1)} km (${mi.toFixed(1)} mi)`;
    },
    [refPoint],
  );

  // ── Address search handler ───────────────────────────────────────────────
  const handleSearch = async () => {
    if (!searchInput.trim()) return;
    setSearchLoading(true);
    setSearchResults([]);
    try {
      const results = await geocodeAddress(searchInput.trim());
      setSearchResults(results.slice(0, 5));
    } catch {
      // silent — show empty results
    } finally {
      setSearchLoading(false);
    }
  };

  const handlePickResult = (result: TypeNominatimResult) => {
    const lat = parseFloat(result.lat);
    const lon = parseFloat(result.lon);
    setRefPoint({ lat, lon });
    setMapCenter([lat, lon]);
    setMapZoom(12);
    setSearchInput(result.display_name);
    setSearchResults([]);
  };

  const handleClearSearch = () => {
    setSearchInput('');
    setSearchResults([]);
    setRefPoint(null);
    setMapCenter(null);
  };

  // ── "Use my location" handler (only on button click) ────────────────────
  const handleMyLocation = () => {
    if (!navigator.geolocation) {
      setGeoError('Geolocation is not supported by your browser.');
      return;
    }
    setGeoLoading(true);
    setGeoError('');
    navigator.geolocation.getCurrentPosition(
      (position) => {
        const lat = position.coords.latitude;
        const lon = position.coords.longitude;
        setRefPoint({ lat, lon });
        setMapCenter([lat, lon]);
        setMapZoom(12);
        setGeoLoading(false);
      },
      () => {
        setGeoError('Could not get your location. Please check your browser permissions.');
        setGeoLoading(false);
      },
      { timeout: 10000 },
    );
  };

  // ─── Auth gate ────────────────────────────────────────────────────────────
  /*if (!authData) {
    return (
      <GeneralLayout>
        <Box
          sx={{
            display: 'flex',
            flexDirection: 'column',
            alignItems: 'center',
            justifyContent: 'center',
            minHeight: '60svh',
            gap: 3,
            px: 2,
            textAlign: 'center',
          }}
        >
          <Box
            sx={{
              width: 64,
              height: 64,
              borderRadius: '50%',
              bgcolor: (t) => alpha(t.palette.primary.main, 0.1),
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
            }}
          >
            <LockOutlinedIcon color="primary" sx={{ fontSize: 32 }} />
          </Box>
          <Box>
            <Typography variant="h5" fontWeight={700} gutterBottom>
              Sign in to use the Store Locator
            </Typography>
            <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 400, mb: 3 }}>
              The store locator is available to registered members. Find craft supply stores near you — yarn shops, fabric stores, glass studios, and more.
            </Typography>
            <Stack direction="row" spacing={2} justifyContent="center">
              <Button component={Link} to="/auth/login" variant="contained" sx={{ borderRadius: 2, fontWeight: 700 }}>
                Sign in
              </Button>
              <Button component={Link} to="/auth/register" variant="outlined" sx={{ borderRadius: 2 }}>
                Create account
              </Button>
            </Stack>
          </Box>
        </Box>
      </GeneralLayout>
    );
  }*/

  return (
    <GeneralLayout>
      <Container sx={{ pt: 8, pb: 12 }}>
        {/* ── Page title ── */}
        <Box sx={{ textAlign: 'center', mb: 8 }}>
          <Typography variant="h1" sx={{ fontSize: '46px!important' }}>
            Store Locator
          </Typography>

          <Typography variant="body1" color="text.secondary" sx={{ maxWidth: 500, mx: 'auto', lineHeight: 1.8 }}>
            Find craft supply stores near you
          </Typography>
        </Box>

        {/* ── Search bar ── */}
        <Paper variant="outlined" sx={{ p: 2, borderRadius: 3, mb: 2 }}>
          <Stack direction={{ xs: 'column', sm: 'row' }} spacing={1.5}>
            <Box sx={{ position: 'relative', flex: 1 }}>
              <TextField
                fullWidth
                size="small"
                placeholder="Search by city, ZIP code, or full address…"
                value={searchInput}
                onChange={(e) => {
                  setSearchInput(e.target.value);
                  if (!e.target.value) setSearchResults([]);
                }}
                onKeyDown={(e) => e.key === 'Enter' && void handleSearch()}
                variant="outlined"
                slotProps={{
                  input: {
                    startAdornment: (
                      <InputAdornment position="start">
                        <SearchIcon fontSize="small" sx={{ color: 'text.disabled' }} />
                      </InputAdornment>
                    ),
                    endAdornment: searchInput ? (
                      <InputAdornment position="end">
                        <IconButton size="small" onClick={handleClearSearch}>
                          <ClearIcon fontSize="small" />
                        </IconButton>
                      </InputAdornment>
                    ) : null,
                  },
                }}
              />

              {/* Geocode dropdown */}
              {searchResults.length > 0 && (
                <Paper
                  elevation={4}
                  sx={{
                    position: 'absolute',
                    top: '100%',
                    left: 0,
                    right: 0,
                    zIndex: 1400,
                    mt: 0.5,
                    borderRadius: 2,
                    overflow: 'hidden',
                  }}
                >
                  <List dense disablePadding>
                    {searchResults.map((r) => (
                      <ListItemButton key={r.place_id} onClick={() => handlePickResult(r)} divider>
                        <ListItemText
                          primary={r.display_name}
                          primaryTypographyProps={{ fontSize: '0.8125rem', noWrap: false }}
                        />
                      </ListItemButton>
                    ))}
                  </List>
                </Paper>
              )}
            </Box>

            <Button
              variant="contained"
              onClick={() => void handleSearch()}
              disabled={searchLoading || !searchInput.trim()}
              startIcon={searchLoading ? <CircularProgress size={14} color="inherit" /> : <SearchIcon />}
              sx={{ borderRadius: 2, fontWeight: 700, whiteSpace: 'nowrap', flexShrink: 0 }}
            >
              Search
            </Button>

            <Tooltip title="Use your current location">
              <Button
                variant="outlined"
                onClick={handleMyLocation}
                disabled={geoLoading}
                startIcon={geoLoading ? <CircularProgress size={14} /> : <MyLocationIcon />}
                sx={{ borderRadius: 2, whiteSpace: 'nowrap', flexShrink: 0 }}
              >
                My Location
              </Button>
            </Tooltip>
          </Stack>

          {geoError && (
            <Alert severity="warning" sx={{ mt: 1.5, borderRadius: 2 }}>
              {geoError}
            </Alert>
          )}
        </Paper>

        {/* ── Tag filters ── */}
        {allTags.length > 0 && (
          <Stack direction="row" spacing={0.75} sx={{ flexWrap: 'wrap', gap: 0.75, mb: 2 }}>
            <Typography variant="caption" color="text.disabled" sx={{ alignSelf: 'center', mr: 0.5 }}>
              Filter by type:
            </Typography>
            {allTags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant={activeTags.has(tag) ? 'filled' : 'outlined'}
                color={activeTags.has(tag) ? 'primary' : 'default'}
                onClick={() => toggleTag(tag)}
                sx={{ textTransform: 'capitalize', cursor: 'pointer' }}
              />
            ))}
            {activeTags.size > 0 && (
              <Chip
                label="Clear filters"
                size="small"
                variant="outlined"
                color="error"
                onClick={() => setActiveTags(new Set())}
                onDelete={() => setActiveTags(new Set())}
              />
            )}
          </Stack>
        )}

        {/* ── Main layout: map + list ── */}
        {storesLoading ? (
          <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}>
            <CircularProgress />
          </Box>
        ) : (
          <Box
            sx={{
              display: 'grid',
              gridTemplateColumns: { xs: '1fr', md: '1fr 360px' },
              gap: 2,
              alignItems: 'start',
            }}
          >
            {/* ── Map ── */}
            <Box
              sx={{
                borderRadius: 3,
                overflow: 'hidden',
                border: '1px solid',
                borderColor: 'divider',
                height: { xs: 340, md: 600 },
                // ensure map renders above page background
                position: 'relative',
                zIndex: 0,
              }}
            >
              <MapContainer
                center={USA_CENTER}
                zoom={USA_ZOOM}
                style={{ width: '100%', height: '100%' }}
                scrollWheelZoom
              >
                <TileLayer
                  attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
                  url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
                />

                {/* Pan map when refPoint or search changes */}
                <MapPanner center={mapCenter} zoom={mapZoom} />

                {filteredStores
                  .filter((s) => s.location?.lat != null && s.location?.lon != null)
                  .map((store) => (
                    <Marker key={store.id} position={[store.location.lat, store.location.lon]}>
                      <Popup minWidth={200} maxWidth={280}>
                        <Box sx={{ py: 0.5 }}>
                          <Typography variant="body2" fontWeight={700} sx={{ mb: 0.5 }}>
                            {store.name}
                          </Typography>
                          {store.street_address && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {store.street_address}
                            </Typography>
                          )}
                          {store.phone && (
                            <Typography variant="caption" color="text.secondary" display="block">
                              {store.phone}
                            </Typography>
                          )}
                          {store.website && (
                            <Typography
                              variant="caption"
                              component="a"
                              href={store.website}
                              target="_blank"
                              rel="noopener noreferrer"
                              display="block"
                              sx={{ color: 'primary.main', mt: 0.25 }}
                            >
                              Visit website ↗
                            </Typography>
                          )}
                          {distanceLabel(store) && (
                            <Typography
                              variant="caption"
                              sx={{ color: 'success.main', fontWeight: 600, display: 'block', mt: 0.5 }}
                            >
                              📍 {distanceLabel(store)}
                            </Typography>
                          )}
                        </Box>
                      </Popup>
                    </Marker>
                  ))}
              </MapContainer>
            </Box>

            {/* ── Store list ── */}
            <Box
              sx={{
                maxHeight: { xs: 'none', md: 600 },
                overflowY: { xs: 'visible', md: 'auto' },
                scrollbarWidth: 'thin',
                display: 'flex',
                flexDirection: 'column',
                gap: 1.5,
              }}
            >
              {filteredStores.length === 0 ? (
                <Alert severity="info" sx={{ borderRadius: 2 }}>
                  {activeTags.size > 0 ? 'No stores match the selected filters.' : 'No stores found.'}
                </Alert>
              ) : (
                <>
                  <Typography variant="caption" color="text.disabled">
                    {filteredStores.length} store{filteredStores.length !== 1 ? 's' : ''}
                    {refPoint ? ', sorted by distance' : ''}
                  </Typography>

                  {filteredStores.map((store) => (
                    <StoreListCard key={store.id} store={store} distance={distanceLabel(store)} />
                  ))}
                </>
              )}
            </Box>
          </Box>
        )}
      </Container>
    </GeneralLayout>
  );
}

// ─── Store list card ──────────────────────────────────────────────────────────

function StoreListCard({ store, distance }: { store: TypeStoreLocation; distance: string | null }) {
  const tags = Array.isArray(store.tags) ? store.tags : [];

  return (
    <Card
      variant="outlined"
      sx={{
        borderRadius: 2.5,
        transition: 'border-color 0.15s',
        '&:hover': { borderColor: 'primary.main' },
      }}
    >
      <CardContent sx={{ pb: '12px !important' }}>
        <Stack direction="row" sx={{ justifyContent: 'space-between', alignItems: 'center', mb: 0.5 }}>
          <Typography variant="body2" fontWeight={700}>
            {store.name}
          </Typography>
          <Stack direction="row" sx={{ alignItems: 'center', gap: 0.75, flexShrink: 0, ml: 1 }}>
            {distance && (
              <Typography variant="caption" sx={{ color: 'success.main', fontWeight: 600 }}>
                {distance}
              </Typography>
            )}
            <StoreReportIssue store={store} />
          </Stack>
        </Stack>

        {store.description && (
          <Typography variant="caption" color="text.secondary" sx={{ display: 'block', mb: 0.75 }}>
            {store.description}
          </Typography>
        )}

        <Stack spacing={0.5} sx={{ mb: 1 }}>
          {store.street_address && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'flex-start' }}>
              <PlaceIcon sx={{ fontSize: 13, color: 'text.disabled', mt: '2px', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">
                {store.street_address}
              </Typography>
            </Stack>
          )}
          {store.phone && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <PhoneOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
              <Typography variant="caption" color="text.secondary">
                {store.phone}
              </Typography>
            </Stack>
          )}
          {store.website && (
            <Stack direction="row" spacing={0.75} sx={{ alignItems: 'center' }}>
              <LanguageOutlinedIcon sx={{ fontSize: 13, color: 'text.disabled', flexShrink: 0 }} />
              <Typography
                variant="caption"
                component="a"
                href={store.website}
                target="_blank"
                rel="noopener noreferrer"
                sx={{ color: 'primary.main' }}
              >
                {store.website.replace(/^https?:\/\//, '')}
              </Typography>
            </Stack>
          )}
        </Stack>

        {tags.length > 0 && (
          <Stack direction="row" spacing={0.5} sx={{ flexWrap: 'wrap', gap: 0.5 }}>
            {tags.map((tag) => (
              <Chip
                key={tag}
                label={tag}
                size="small"
                variant="outlined"
                sx={{ textTransform: 'capitalize', fontSize: '0.65rem', height: 20 }}
              />
            ))}
          </Stack>
        )}
      </CardContent>
    </Card>
  );
}
