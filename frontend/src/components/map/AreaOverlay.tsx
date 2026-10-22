import { Geojson } from 'react-native-maps';
import area from '@/data/area.geojson';

// Batas area kawasan (diekspor dari backend).
export function AreaOverlay() {
  return <Geojson geojson={area} strokeColor="#e4572e" fillColor="#e4572e22" strokeWidth={2} />;
}
