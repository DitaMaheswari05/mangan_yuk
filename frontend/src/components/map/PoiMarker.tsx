import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Marker } from 'react-native-maps';
import type { Poi } from '@/types/content';

export type PoiMarkerProps = {
  poi: Poi;
  selected?: boolean;
  onPress?: (poi: Poi) => void;
};

export function PoiMarker({ poi, selected = false, onPress }: PoiMarkerProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(poi);
    } else {
      router.push(`/poi/${poi.id}`);
    }
  };

  return (
    <Marker
      coordinate={{ latitude: poi.latitude, longitude: poi.longitude }}
      title={poi.name}
      description={poi.categoryLabel}
      onPress={handlePress}
      onCalloutPress={() => router.push(`/poi/${poi.id}`)}
      tracksViewChanges={true}
    >
      <View style={[styles.pin, selected && styles.pinSelected]}>
        <MaterialCommunityIcons
          name="storefront"
          size={selected ? 20 : 15}
          color={selected ? '#FFFFFF' : '#FF8316'}
        />
      </View>
    </Marker>
  );
}

const styles = StyleSheet.create({
  pin: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    borderWidth: 1.5,
    borderColor: '#FF8316',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 2 },
    shadowOpacity: 0.18,
    shadowRadius: 3,
  },
  pinSelected: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: '#FF8316',
    borderWidth: 3,
    borderColor: '#FFE0C2',
    elevation: 6,
  },
});
