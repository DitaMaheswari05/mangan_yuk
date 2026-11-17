// F06 / PB-11 – Navigasi rute, kompas, deviasi arah, dan deteksi kedatangan.
import { bearingDeg, haversineM, type LatLng } from '@/lib/geo';
import { pointAlongRoute, routeLengthM } from './routing';

export * from './compass';
export * from './routing';

export type NavigationTarget = {
  poiId: string;
  name: string;
  coordinate: LatLng;
};

export type NavigationStatus = {
  distanceM: number;
  bearingDeg: number;
  deviationDeg: number;
  isOnTarget: boolean;
  hasArrived: boolean;
};

/**
 * Menghitung deviasi sudut antara arah hadap pengguna (heading) dan bearing target.
 * Rentang hasil: -180° s.d. +180° (negatif = target di sebelah kiri, positif = target di sebelah kanan).
 */
export function calculateHeadingDeviation(userHeadingDeg: number, targetBearingDeg: number): number {
  let diff = (targetBearingDeg - userHeadingDeg) % 360;
  if (diff > 180) diff -= 360;
  if (diff < -180) diff += 360;
  return diff;
}

/**
 * Memeriksa apakah heading pengguna menghadap ke target dalam batas toleransi (default 30° sesuai AC F06).
 */
export function isHeadingOnTarget(deviationDeg: number, toleranceDeg: number = 30): boolean {
  return Math.abs(deviationDeg) <= toleranceDeg;
}

/**
 * Memeriksa apakah pengguna sudah tiba di lokasi tenant (default <= 10 meter sesuai AC F06).
 */
export function checkArrival(userCoord: LatLng, targetCoord: LatLng, arrivalThresholdM: number = 10): boolean {
  const d = haversineM(userCoord, targetCoord);
  return d <= arrivalThresholdM;
}

/**
 * Menentukan apakah instruksi panduan suara perlu dipicu:
 * Terjadi setiap pengurangan jarak sebesar intervalM (default 20 m).
 */
export function shouldTriggerDistanceAudioCue(
  previousDistanceM: number,
  currentDistanceM: number,
  intervalM: number = 20,
): boolean {
  if (currentDistanceM >= previousDistanceM) return false;
  const prevBucket = Math.floor(previousDistanceM / intervalM);
  const currBucket = Math.floor(currentDistanceM / intervalM);
  return currBucket < prevBucket && currentDistanceM > 0;
}

/**
 * Menghitung seluruh status navigasi aktif.
 */
export function computeNavigationStatus(
  userCoord: LatLng,
  userHeadingDeg: number,
  targetCoord: LatLng,
  options?: { arrivalThresholdM?: number; targetToleranceDeg?: number },
): NavigationStatus {
  const distanceM = Math.round(haversineM(userCoord, targetCoord));
  const bearing = Math.round(bearingDeg(userCoord, targetCoord));
  const deviationDeg = Math.round(calculateHeadingDeviation(userHeadingDeg, bearing));
  const isOnTarget = isHeadingOnTarget(deviationDeg, options?.targetToleranceDeg ?? 30);
  const hasArrived = checkArrival(userCoord, targetCoord, options?.arrivalThresholdM ?? 10);

  return {
    distanceM,
    bearingDeg: bearing,
    deviationDeg,
    isOnTarget,
    hasArrived,
  };
}

/** Jarak "lihat ke depan" di sepanjang rute untuk arah panah kompas. */
export const ROUTE_LOOKAHEAD_M = 15;

/**
 * Status navigasi saat mengikuti rute jalan:
 * - jarak = sisa panjang rute (bukan jarak lurus),
 * - panah kompas menunjuk titik ±15 m ke depan di rute (ikut belokan jalan),
 * - kedatangan tetap berdasar jarak lurus ke tenant (≤10 m, AC F06-3).
 * `remaining` adalah hasil remainingRoute(route, userCoord).
 */
export function computeRouteNavigationStatus(
  userCoord: LatLng,
  userHeadingDeg: number,
  targetCoord: LatLng,
  remaining: LatLng[],
  options?: { arrivalThresholdM?: number; targetToleranceDeg?: number },
): NavigationStatus {
  const base = computeNavigationStatus(userCoord, userHeadingDeg, targetCoord, options);
  if (remaining.length < 2 || base.hasArrived) return base;

  const guide = pointAlongRoute(remaining, ROUTE_LOOKAHEAD_M);
  const bearing = Math.round(bearingDeg(userCoord, guide));
  const deviationDeg = Math.round(calculateHeadingDeviation(userHeadingDeg, bearing));
  return {
    distanceM: Math.max(base.distanceM, Math.round(routeLengthM(remaining))),
    bearingDeg: bearing,
    deviationDeg,
    isOnTarget: isHeadingOnTarget(deviationDeg, options?.targetToleranceDeg ?? 30),
    hasArrived: base.hasArrived,
  };
}
