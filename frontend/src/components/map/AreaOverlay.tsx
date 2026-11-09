import { Geojson } from 'react-native-maps';
import area from '@/data/area.geojson';

// Batas area kawasan Sudirman Street Food (diekspor dari backend).
export function AreaOverlay() {
  return (
    <Geojson
      geojson={area}
      strokeColor="#FFA352"
      fillColor="rgba(255, 201, 153, 0.32)"
      strokeWidth={2}
    />
  );
}
