import { StyleSheet, View } from 'react-native';
import { Circle, Marker } from 'react-native-maps';
import { colors } from '@/constants/theme';
import type { LatLng } from '@/lib/geo';

export type UserLocationProps = {
  position: LatLng;
  accuracyM?: number;
};

/**
 * F01 / PB03: Titik biru posisi pengguna beserta lingkaran radius akurasi (accuracyM).
 */
export function UserLocation({ position, accuracyM = 15 }: UserLocationProps) {
  const safeAccuracyRadius = accuracyM > 0 ? accuracyM : 10;

  return (
    <>
      {/* Lingkaran akurasi dalam satuan meter di peta */}
      <Circle
        center={position}
        radius={safeAccuracyRadius}
        fillColor="rgba(6, 92, 187, 0.16)"
        strokeColor="rgba(6, 92, 187, 0.45)"
        strokeWidth={1.5}
      />

      {/* Titik biru posisi pengguna dengan ukuran piksel konsisten di segala level zoom */}
      <Marker
        coordinate={position}
        anchor={{ x: 0.5, y: 0.5 }}
        flat
        tracksViewChanges={false}
        accessibilityLabel="Lokasi kamu saat ini"
      >
        <View style={styles.halo}>
          <View style={styles.dot} />
        </View>
      </Marker>
    </>
  );
}

const styles = StyleSheet.create({
  halo: {
    width: 26,
    height: 26,
    borderRadius: 13,
    backgroundColor: 'rgba(6, 92, 187, 0.24)',
    alignItems: 'center',
    justifyContent: 'center',
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
});
