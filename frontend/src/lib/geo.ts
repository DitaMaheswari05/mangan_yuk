// GeoUtils — PB03 di docs/api/client-contracts.yaml. Fungsi murni, tanpa dependensi Expo.
import { MAX_ACCURACY_M } from '@/constants/config';

export type LatLng = { latitude: number; longitude: number };

export type UserPosition = { coordinate: LatLng; accuracyM: number; timestamp: number };

export type AreaStatus = 'INSIDE' | 'OUTSIDE' | 'UNKNOWN';

/** Cukup field AreaConfig yang dibutuhkan computeAreaStatus. */
export type AreaGeometry = { center: LatLng; entryRadiusM: number; exitHysteresisM: number };

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;
const toDeg = (rad: number) => (rad * 180) / Math.PI;

/** Jarak haversine dalam meter. */
export function haversineM(a: LatLng, b: LatLng): number {
  const dLat = toRad(b.latitude - a.latitude);
  const dLon = toRad(b.longitude - a.longitude);
  const h =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(a.latitude)) * Math.cos(toRad(b.latitude)) * Math.sin(dLon / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(h)));
}

/** Alias lama; pakai haversineM untuk kode baru. */
export const distanceMeters = haversineM;

/** Arah awal dari a ke b, 0–360° searah jarum jam dari utara (untuk panah kompas PB11). */
export function bearingDeg(a: LatLng, b: LatLng): number {
  const φ1 = toRad(a.latitude);
  const φ2 = toRad(b.latitude);
  const Δλ = toRad(b.longitude - a.longitude);
  const y = Math.sin(Δλ) * Math.cos(φ2);
  const x = Math.cos(φ1) * Math.sin(φ2) - Math.sin(φ1) * Math.cos(φ2) * Math.cos(Δλ);
  return (toDeg(Math.atan2(y, x)) + 360) % 360;
}

/**
 * Status di dalam/di luar kawasan dengan hysteresis (F01-AC3, F02):
 * - akurasi > MAX_ACCURACY_M → status sebelumnya dipertahankan (UNKNOWN jika belum ada)
 * - jarak ≤ entryRadiusM → INSIDE
 * - jarak > entryRadiusM + exitHysteresisM → OUTSIDE
 * - di antaranya → status sebelumnya (OUTSIDE jika belum ada)
 */
export function computeAreaStatus(pos: UserPosition, area: AreaGeometry, prev: AreaStatus): AreaStatus {
  if (!(pos.accuracyM <= MAX_ACCURACY_M)) return prev;
  const d = haversineM(pos.coordinate, area.center);
  if (d <= area.entryRadiusM) return 'INSIDE';
  if (d > area.entryRadiusM + area.exitHysteresisM) return 'OUTSIDE';
  return prev === 'UNKNOWN' ? 'OUTSIDE' : prev;
}
