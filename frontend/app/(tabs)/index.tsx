import { View } from 'react-native';
import { OsmMap } from '@/components/map/OsmMap';

// F01/F03: Beranda berisi peta OSM dengan marker POI.
export default function HomeScreen() {
  return (
    <View style={{ flex: 1 }}>
      <OsmMap />
    </View>
  );
}
