import { StyleSheet, View } from 'react-native';
import { Circle, Marker } from 'react-native-maps';
import { colors } from '@/constants/theme';
import type { LatLng } from '@/lib/geo';

export type UserLocationProps = {
  position: LatLng;
  accuracyM?: number;
  exploreMode?: boolean;
};

/**
 * F01 / F02 / PB03: Titik posisi pengguna beserta lingkaran radius akurasi (accuracyM)
 * dan radius radar Mode Jelajah saat aktif (sesuai Figma #174:43840).
 */
export function UserLocation({
  position,
  accuracyM = 15,
  exploreMode = false,
}: UserLocationProps) {
  const safeAccuracyRadius = accuracyM > 0 ? accuracyM : 12;
  const displayRadius = exploreMode ? Math.max(safeAccuracyRadius, 18) : safeAccuracyRadius;

  return (
    <>
      {/* Lingkaran akurasi / radar geofence dalam satuan meter di peta */}
      <Circle
        center={position}
        radius={displayRadius}
        fillColor={
          exploreMode ? 'rgba(255, 201, 153, 0.35)' : 'rgba(6, 92, 187, 0.16)'
        }
        strokeColor={exploreMode ? '#FFA352' : 'rgba(6, 92, 187, 0.45)'}
        strokeWidth={1.5}
      />

      {/* Titik posisi pengguna */}
      <Marker
        coordinate={position}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
        tracksViewChanges={true}
        accessibilityLabel="Lokasi kamu saat ini"
      >
        <View style={[styles.halo, exploreMode && styles.haloExplore]}>
          <View style={[styles.dot, exploreMode && styles.dotExplore]} />
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  halo: {
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: 'rgba(6, 92, 187, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  haloExplore: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: '#FFC69D',
  },
  dot: {
    width: 16,
    height: 16,
    borderRadius: 8,
    backgroundColor: colors.tertiary,
    borderWidth: 3,
    borderColor: '#FFFFFF',
    elevation: 4,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.25,
    shadowRadius: 2,
  },
  dotExplore: {
    width: 20,
    height: 20,
    borderRadius: 10,
    backgroundColor: '#FF6B00',
    borderWidth: 4,
    borderColor: '#FFC69D',
  },
});
