import type { LngLat, StyleSpecification } from '@maplibre/maplibre-react-native';
import area from '@/data/area.json';

export const OSM_TILE_URL = 'https://tile.openstreetmap.org/{z}/{x}/{y}.png';
export const OSM_ATTRIBUTION = '© OpenStreetMap contributors';

// Style MapLibre: basemap raster dari tile OpenStreetMap.
export const MAP_STYLE: StyleSpecification = {
  version: 8,
  sources: {
    osm: {
      type: 'raster',
      tiles: [OSM_TILE_URL],
      tileSize: 256,
      maxzoom: 19,
      attribution: OSM_ATTRIBUTION,
    },
  },
  layers: [{ id: 'osm', type: 'raster', source: 'osm' }],
};

// Pusat kawasan dari data export (areas.center_*), jadi tidak perlu diubah manual.
export const AREA_CENTER: LngLat = [area.center.longitude, area.center.latitude];

// Kamera awal: zoom ini setara kira-kira dengan delta 0.004° di react-native-maps.
export const INITIAL_CAMERA = {
  center: AREA_CENTER,
  zoom: 16.5,
};

export const RECENTER_ZOOM = 17.3;
