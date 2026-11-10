import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { LatLng } from '@/lib/geo';

export type UserLocationProps = {
  position: LatLng;
  accuracyM?: number;
};

const EARTH_RADIUS_M = 6371008.8;

// MapLibre tidak punya komponen Circle bermeter, jadi lingkaran dibentuk sebagai polygon GeoJSON.
function circlePolygon(center: LatLng, radiusM: number, steps = 64): GeoJSON.Feature<GeoJSON.Polygon> {
  const lat = (center.latitude * Math.PI) / 180;
  const dLat = (radiusM / EARTH_RADIUS_M) * (180 / Math.PI);
  const dLng = dLat / Math.cos(lat);
  const ring: number[][] = [];
  for (let i = 0; i <= steps; i++) {
    const t = (i / steps) * 2 * Math.PI;
    ring.push([center.longitude + dLng * Math.cos(t), center.latitude + dLat * Math.sin(t)]);
  }
  return { type: 'Feature', properties: {}, geometry: { type: 'Polygon', coordinates: [ring] } };
}

/**
 * F01 / PB03: Titik biru posisi pengguna beserta lingkaran radius akurasi (accuracyM).
 */
export function UserLocation({ position, accuracyM = 15 }: UserLocationProps) {
  const safeAccuracyRadius = accuracyM > 0 ? accuracyM : 10;
  const accuracyCircle = useMemo(
    () => circlePolygon(position, safeAccuracyRadius),
    [position, safeAccuracyRadius],
  );

  return (
    <>
      {/* Lingkaran akurasi dalam satuan meter di peta */}
      <GeoJSONSource id="user-accuracy" data={accuracyCircle}>
        <Layer
          id="user-accuracy-fill"
          type="fill"
          paint={{ 'fill-color': 'rgba(6, 92, 187, 0.16)' }}
        />
        <Layer
          id="user-accuracy-line"
          type="line"
          paint={{ 'line-color': 'rgba(6, 92, 187, 0.45)', 'line-width': 1.5 }}
        />
      </GeoJSONSource>

      {/* Titik biru posisi pengguna dengan ukuran piksel konsisten di segala level zoom */}
      <Marker
        id="user-location"
        lngLat={[position.longitude, position.latitude]}
        anchor="center"
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
