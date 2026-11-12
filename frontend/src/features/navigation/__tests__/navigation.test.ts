// ============================================================================
// Unit Test: 07-navigation-and-compass.test.ts
// Terkait: F06, PB-11, Navigasi Kompas, Deviasi Arah, Kedatangan, & Audio Cue
// ============================================================================

import {
  calculateHeadingDeviation,
  checkArrival,
  computeNavigationStatus,
  isHeadingOnTarget,
  shouldTriggerDistanceAudioCue,
} from '@/features/navigation';
import { bearingDeg, type LatLng } from '@/lib/geo';

const M_PER_DEG = (Math.PI / 180) * 6_371_000;
const north = (meters: number): LatLng => ({
  latitude: meters / M_PER_DEG,
  longitude: 0,
});
const east = (meters: number): LatLng => ({
  latitude: 0,
  longitude: meters / M_PER_DEG,
});

describe('Kategori 1: Kalkulasi Sudut Bearing & Penyesuaian Kompas (0–360°)', () => {
  it('menghasilkan 0° untuk target tepat di utara', () => {
    const from = north(0);
    const to = north(50);
    expect(Math.round(bearingDeg(from, to))).toBe(0);
  });

  it('menghasilkan 90° untuk target tepat di timur', () => {
    const from = north(0);
    const to = east(50);
    expect(Math.round(bearingDeg(from, to))).toBe(90);
  });

  it('menghasilkan 180° untuk target tepat di selatan', () => {
    const from = north(50);
    const to = north(0);
    expect(Math.round(bearingDeg(from, to))).toBe(180);
  });

  it('menghasilkan 270° untuk target tepat di barat', () => {
    const from = east(50);
    const to = east(0);
    expect(Math.round(bearingDeg(from, to))).toBe(270);
  });
});

describe('Kategori 2: Deviasi Sudut Hadap Pengguna (Heading Deviation)', () => {
  it('menghitung deviasi 0 jika arah hadap pengguna persis sama dengan bearing target', () => {
    expect(calculateHeadingDeviation(45, 45)).toBe(0);
  });

  it('menghitung deviasi positif jika target berada di sebelah kanan (misal heading 10°, bearing 40° -> +30°)', () => {
    expect(calculateHeadingDeviation(10, 40)).toBe(30);
  });

  it('menghitung deviasi negatif jika target berada di sebelah kiri (misal heading 50°, bearing 20° -> -30°)', () => {
    expect(calculateHeadingDeviation(50, 20)).toBe(-30);
  });

  it('menangani batas wrap-around 360° dengan mulus (misal heading 350° dan bearing 10° -> +20°)', () => {
    expect(calculateHeadingDeviation(350, 10)).toBe(20);
  });

  it('menangani batas wrap-around sebaliknya (misal heading 10° dan bearing 350° -> -20°)', () => {
    expect(calculateHeadingDeviation(10, 350)).toBe(-20);
  });

  it('isHeadingOnTarget bernilai true jika deviasi berada dalam batas toleransi ≤ 30° (AC F06-1)', () => {
    expect(isHeadingOnTarget(0)).toBe(true);
    expect(isHeadingOnTarget(25)).toBe(true);
    expect(isHeadingOnTarget(-30)).toBe(true);
    expect(isHeadingOnTarget(35)).toBe(false);
    expect(isHeadingOnTarget(-45)).toBe(false);
  });
});

describe('Kategori 3: Deteksi Kedatangan di Tenant (AC F06-3)', () => {
  const target: LatLng = north(50);

  it('mengembalikan true jika jarak ke target ≤ 10 meter (pengguna telah sampai)', () => {
    const userAt42m = north(42); // jarak 8 m
    expect(checkArrival(userAt42m, target, 10)).toBe(true);

    const userAt40m = north(40); // tepat jarak 10 m
    expect(checkArrival(userAt40m, target, 10)).toBe(true);
  });

  it('mengembalikan false jika jarak ke target masih > 10 meter', () => {
    const userAt35m = north(35); // jarak 15 m
    expect(checkArrival(userAt35m, target, 10)).toBe(false);
  });
});

describe('Kategori 4: Pemicu Panduan Suara Berkala (Audio Cue Tiap Pengurangan 20 m)', () => {
  it('memicu audio cue saat jarak berkurang melewati kelipatan 20 m (misal 45 m -> 38 m)', () => {
    // 45 m (bucket 2) -> 38 m (bucket 1) -> melewati kelipatan 40 m
    expect(shouldTriggerDistanceAudioCue(45, 38, 20)).toBe(true);
  });

  it('tidak memicu audio cue jika jarak berkurang tapi belum melewati kelipatan 20 m (misal 38 m -> 32 m)', () => {
    expect(shouldTriggerDistanceAudioCue(38, 32, 20)).toBe(false);
  });

  it('tidak memicu audio cue jika pengguna bergerak menjauh (jarak bertambah, misal 30 m -> 45 m)', () => {
    expect(shouldTriggerDistanceAudioCue(30, 45, 20)).toBe(false);
  });
});

describe('Kategori 5: Evaluasi Komprehensif Status Navigasi (computeNavigationStatus)', () => {
  it('menghitung jarak, bearing, deviasi, isOnTarget, dan hasArrived secara simultan', () => {
    const user: LatLng = north(0);
    const target: LatLng = north(50);
    const heading = 15; // sedikit melenceng ke kanan

    const status = computeNavigationStatus(user, heading, target);

    expect(status.distanceM).toBe(50);
    expect(status.bearingDeg).toBe(0);
    expect(status.deviationDeg).toBe(-15);
    expect(status.isOnTarget).toBe(true); // -15° masih <= 30°
    expect(status.hasArrived).toBe(false); // 50 m > 10 m
  });
});
