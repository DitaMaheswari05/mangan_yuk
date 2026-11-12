// F06 / PB-11 – Navigasi rute, kompas, deviasi arah, dan deteksi kedatangan.
import { bearingDeg, haversineM, type LatLng } from '@/lib/geo';

export * from './compass';

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
