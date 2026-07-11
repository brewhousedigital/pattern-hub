import React, { useEffect } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import L from 'leaflet';
import 'leaflet/dist/leaflet.css';

import type { TypeStoreLocation } from '@/functions/database/stores';

import { Box, Typography } from '@mui/material';

// This module (and leaflet, which touches `window` on import) is loaded lazily
// and client-only from the store-locator route - it must never run on the server.

// ─── Fix Leaflet default icon paths broken by Vite ───────────────────────────
delete (L.Icon.Default.prototype as unknown as Record<string, unknown>)._getIconUrl;
L.Icon.Default.mergeOptions({
  iconRetinaUrl: new URL('leaflet/dist/images/marker-icon-2x.png', import.meta.url).href,
  iconUrl: new URL('leaflet/dist/images/marker-icon.png', import.meta.url).href,
  shadowUrl: new URL('leaflet/dist/images/marker-shadow.png', import.meta.url).href,
});

export type PanTarget = { center: [number, number]; zoom: number; storeId: string | null };

// ─── Map controller (child component - has access to map context) ────────────

function MapController({
  target,
  markerRefs,
}: {
  target: PanTarget | null;
  markerRefs: React.RefObject<Map<string, L.Marker>>;
}) {
  const map = useMap();
  useEffect(() => {
    if (!target) return;
    map.closePopup();
    map.setView(target.center, target.zoom, { animate: true });
    if (!target.storeId) return;
    const id = setTimeout(() => {
      markerRefs.current.get(target.storeId!)?.openPopup();
    }, 300);
    return () => clearTimeout(id);
  }, [target, map, markerRefs]);
  return null;
}

// ─── USA geographic center - default map view ─────────────────────────────

const USA_CENTER: [number, number] = [39.5, -98.35];
const USA_ZOOM = 4;

type StoreLocatorMapProps = {
  panTarget: PanTarget | null;
  stores: TypeStoreLocation[];
  distanceLabel: (store: TypeStoreLocation) => string | null;
};

export default function StoreLocatorMap({ panTarget, stores, distanceLabel }: StoreLocatorMapProps) {
  const markerRefs = React.useRef<Map<string, L.Marker>>(new Map());

  return (
    <MapContainer center={USA_CENTER} zoom={USA_ZOOM} style={{ width: '100%', height: '100%' }} scrollWheelZoom>
      <TileLayer
        attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors'
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />

      <MapController target={panTarget} markerRefs={markerRefs} />

      {stores
        .filter((s) => s.location?.lat != null && s.location?.lon != null)
        .map((store) => (
          <Marker
            key={store.id}
            position={[store.location.lat, store.location.lon]}
            ref={(m) => {
              if (m) markerRefs.current.set(store.id, m);
              else markerRefs.current.delete(store.id);
            }}
          >
            <Popup minWidth={200} maxWidth={280}>
              <Box sx={{ py: 0.5 }}>
                <Typography variant="body2" sx={{ fontWeight: 700, mb: 0.5 }}>
                  {store.name}
                </Typography>
                {store.street_address && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
                    {store.street_address}
                  </Typography>
                )}
                {store.phone && (
                  <Typography variant="caption" color="text.secondary" sx={{ display: 'block' }}>
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
                    sx={{ display: 'block', color: 'primary.main', mt: 0.25 }}
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
  );
}
