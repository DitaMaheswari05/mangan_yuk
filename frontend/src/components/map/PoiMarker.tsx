import { MaterialCommunityIcons } from '@expo/vector-icons';
import { router } from 'expo-router';
import { StyleSheet, View } from 'react-native';
import { Marker } from '@maplibre/maplibre-react-native';
import type { Poi } from '@/types/content';

export type PoiMarkerProps = {
  poi: Poi;
  selected?: boolean;
  /** Sudah dikunjungi (dwell event tercatat) → marker hijau. */
  visited?: boolean;
  onPress?: (poi: Poi) => void;
};

const VISITED = '#2E9E4F';

export function PoiMarker({ poi, selected = false, visited = false, onPress }: PoiMarkerProps) {
  const handlePress = () => {
    if (onPress) {
      onPress(poi);
    } else {
      router.push(`/poi/${poi.id}`);
    }
  };

  return (
    <Marker
      id={`poi-${poi.id}`}
      lngLat={[poi.longitude, poi.latitude]}
      anchor="center"
      onPress={handlePress}
      accessibilityLabel={`${poi.name}, ${poi.categoryLabel}${visited ? ', sudah dikunjungi' : ''}`}
    >
      <View
        style={[
          styles.pin,
          visited && styles.pinVisited,
          selected && styles.pinSelected,
          selected && visited && styles.pinSelectedVisited,
        ]}
      >
        <MaterialCommunityIcons
          name="storefront"
          size={selected ? 20 : 15}
          color={selected ? '#FFFFFF' : visited ? VISITED : '#FF8316'}
        />
        {visited ? (
          <View style={styles.visitedTick}>
            <MaterialCommunityIcons name="check" size={9} color="#FFFFFF" />
          </View>
        ) : null}
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
  pinVisited: {
    borderColor: VISITED,
  },
  pinSelectedVisited: {
    backgroundColor: VISITED,
    borderColor: '#CDEBD6',
  },
  visitedTick: {
    position: 'absolute',
    top: -3,
    right: -3,
    width: 14,
    height: 14,
    borderRadius: 7,
    backgroundColor: VISITED,
    borderWidth: 1.5,
    borderColor: '#FFFFFF',
    alignItems: 'center',
    justifyContent: 'center',
  },
});
