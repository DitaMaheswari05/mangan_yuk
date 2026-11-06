import area from '@/data/area.json';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

// Pusat kawasan dari data export (areas.center_*), jadi tidak perlu diubah manual.
export const INITIAL_REGION = {
  latitude: area.center.latitude,
  longitude: area.center.longitude,
  latitudeDelta: 0.004,
  longitudeDelta: 0.004,
};
