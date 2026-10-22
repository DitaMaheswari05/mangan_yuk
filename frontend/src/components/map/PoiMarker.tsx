import { router } from 'expo-router';
import { Marker } from 'react-native-maps';
import type { Poi } from '@/types/content';

export function PoiMarker({ poi }: { poi: Poi }) {
  return (
    <Marker
      coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
      title={poi.name}
      onCalloutPress={() => router.push(`/poi/${poi.id}`)}
    />
  );
}
