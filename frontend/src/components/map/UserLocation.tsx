import { Circle } from 'react-native-maps';
import type { LatLng } from '@/lib/geo';

export function UserLocation({ position }: { position: LatLng }) {
  return <Circle center={position} radius={6} fillColor="#1e88e5" strokeColor="#fff" />;
}
