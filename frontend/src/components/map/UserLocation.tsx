import { GeoJSONSource, Layer, Marker } from '@maplibre/maplibre-react-native';
import { useMemo } from 'react';
import { StyleSheet, View } from 'react-native';
import { colors } from '@/constants/theme';
import type { LatLng } from '@/lib/geo';

export type UserLocationProps = {
  position: LatLng;
  accuracyM?: number;
  exploreMode?: boolean;
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
  const accuracyCircle = useMemo(
    () => circlePolygon(position, displayRadius),
    [position, displayRadius],
  );

  return (
    <>
      {/* Lingkaran akurasi / radar geofence dalam satuan meter di peta */}
      <GeoJSONSource id="user-accuracy" data={accuracyCircle}>
        <Layer
          id="user-accuracy-fill"
          type="fill"
          paint={{
            'fill-color': exploreMode ? 'rgba(255, 201, 153, 0.35)' : 'rgba(6, 92, 187, 0.16)',
          }}
        />
        <Layer
          id="user-accuracy-line"
          type="line"
          paint={{
            'line-color': exploreMode ? '#FFA352' : 'rgba(6, 92, 187, 0.45)',
            'line-width': 1.5,
          }}
        />
      </GeoJSONSource>

      {/* Titik posisi pengguna */}
      <Marker
        id="user-location"
        lngLat={[position.longitude, position.latitude]}
        anchor="center"
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
