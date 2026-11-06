import { bearingDeg, computeAreaStatus, haversineM, type AreaStatus, type LatLng } from '../geo';

// Pusat Sudirman Street Food (seed areas).
const center: LatLng = { latitude: -6.92089, longitude: 107.600574 };
const area = { center, entryRadiusM: 100, exitHysteresisM: 10 };
const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_000;

/** Titik `m` meter ke utara (+) / selatan (−) dari pusat. */
const north = (m: number): LatLng => ({ latitude: center.latitude + m / M_PER_DEG_LAT, longitude: center.longitude });
const pos = (m: number, accuracyM = 5) => ({ coordinate: north(m), accuracyM, timestamp: 0 });

describe('haversineM', () => {
  it('0 untuk titik yang sama', () => {
    expect(haversineM(center, center)).toBe(0);
  });

  it('jarak utara–selatan sesuai meter yang digeser', () => {
    expect(haversineM(center, north(100))).toBeCloseTo(100, 3);
    expect(haversineM(center, north(-37.5))).toBeCloseTo(37.5, 3);
  });

  it('simetris', () => {
    const a = north(40);
    const b = { latitude: -6.9212, longitude: 107.6009 };
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 9);
  });

  it('Jakarta–Bandung ±115 km', () => {
    const jakarta = { latitude: -6.2088, longitude: 106.8456 };
    expect(haversineM(jakarta, center) / 1000).toBeGreaterThan(110);
    expect(haversineM(jakarta, center) / 1000).toBeLessThan(120);
  });
});

describe('bearingDeg', () => {
  const d = 0.001;
  it.each([
    ['utara', { latitude: center.latitude + d, longitude: center.longitude }, 0],
    ['timur', { latitude: center.latitude, longitude: center.longitude + d }, 90],
    ['selatan', { latitude: center.latitude - d, longitude: center.longitude }, 180],
    ['barat', { latitude: center.latitude, longitude: center.longitude - d }, 270],
  ])('%s → %i°', (_, to, expected) => {
    expect(bearingDeg(center, to)).toBeCloseTo(expected, 0);
  });

  it('selalu dalam [0, 360)', () => {
    const b = bearingDeg(center, { latitude: center.latitude + d, longitude: center.longitude - d / 1e6 });
    expect(b).toBeGreaterThanOrEqual(0);
    expect(b).toBeLessThan(360);
  });
});

describe('computeAreaStatus', () => {
  it('di dalam radius entry → INSIDE', () => {
    expect(computeAreaStatus(pos(0), area, 'UNKNOWN')).toBe('INSIDE');
    expect(computeAreaStatus(pos(99), area, 'OUTSIDE')).toBe('INSIDE');
  });

  it('di luar radius + hysteresis → OUTSIDE', () => {
    expect(computeAreaStatus(pos(111), area, 'INSIDE')).toBe('OUTSIDE');
    expect(computeAreaStatus(pos(5000), area, 'UNKNOWN')).toBe('OUTSIDE');
  });

  it.each<[AreaStatus, AreaStatus]>([
    ['INSIDE', 'INSIDE'],
    ['OUTSIDE', 'OUTSIDE'],
    ['UNKNOWN', 'OUTSIDE'],
  ])('di zona hysteresis (105 m), prev %s → %s', (prev, expected) => {
    expect(computeAreaStatus(pos(105), area, prev)).toBe(expected);
  });

  it('akurasi > 30 m diabaikan, status sebelumnya dipertahankan', () => {
    expect(computeAreaStatus(pos(0, 31), area, 'OUTSIDE')).toBe('OUTSIDE');
    expect(computeAreaStatus(pos(5000, 50), area, 'INSIDE')).toBe('INSIDE');
    expect(computeAreaStatus(pos(0, 31), area, 'UNKNOWN')).toBe('UNKNOWN');
  });

  it('akurasi tepat 30 m masih dipakai', () => {
    expect(computeAreaStatus(pos(0, 30), area, 'OUTSIDE')).toBe('INSIDE');
  });

  it('akurasi NaN dianggap tidak valid', () => {
    expect(computeAreaStatus(pos(0, NaN), area, 'OUTSIDE')).toBe('OUTSIDE');
  });

  it('berjalan keluar-masuk tidak berkedip di batas', () => {
    const path = [90, 101, 104, 109, 105, 112, 108, 102, 99];
    let s: AreaStatus = 'UNKNOWN';
    const seen = path.map((m) => (s = computeAreaStatus(pos(m), area, s)));
    expect(seen).toEqual(['INSIDE', 'INSIDE', 'INSIDE', 'INSIDE', 'INSIDE', 'OUTSIDE', 'OUTSIDE', 'OUTSIDE', 'INSIDE']);
  });
});
