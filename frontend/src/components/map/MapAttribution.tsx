import { Text } from 'react-native';
import { OSM_ATTRIBUTION } from '@/constants/map';

// Wajib menurut kebijakan tile OpenStreetMap.
export function MapAttribution() {
  return (
    <Text style={{ position: 'absolute', bottom: 4, right: 6, fontSize: 10, backgroundColor: '#fffc' }}>
      {OSM_ATTRIBUTION}
    </Text>
  );
}
