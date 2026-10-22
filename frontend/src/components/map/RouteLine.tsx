import { Polyline } from 'react-native-maps';
import type { LatLng } from '@/lib/geo';

export function RouteLine({ points }: { points: LatLng[] }) {
  return <Polyline coordinates={points} strokeColor="#1e88e5" strokeWidth={4} />;
}
