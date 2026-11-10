import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import area from '@/data/area.geojson';

// Batas area kawasan Sudirman Street Food (diekspor dari backend).
export function AreaOverlay() {
  return (
    <GeoJSONSource id="area" data={area}>
      <Layer
        id="area-fill"
        type="fill"
        paint={{ 'fill-color': 'rgba(255, 201, 153, 0.32)' }}
      />
      <Layer
        id="area-line"
        type="line"
        paint={{ 'line-color': '#FFA352', 'line-width': 2 }}
      />
    </GeoJSONSource>
  );
}
