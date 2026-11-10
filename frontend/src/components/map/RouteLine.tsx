import { GeoJSONSource, Layer } from '@maplibre/maplibre-react-native';
import type { LatLng } from '@/lib/geo';

export function RouteLine({ points }: { points: LatLng[] }) {
  const data: GeoJSON.Feature<GeoJSON.LineString> = {
    type: 'Feature',
    properties: {},
    geometry: {
      type: 'LineString',
      coordinates: points.map((p) => [p.longitude, p.latitude]),
    },
  };

  return (
    <GeoJSONSource id="route" data={data}>
      <Layer
        id="route-line"
        type="line"
        layout={{ 'line-cap': 'round', 'line-join': 'round' }}
        paint={{ 'line-color': '#1e88e5', 'line-width': 4 }}
      />
    </GeoJSONSource>
  );
}
