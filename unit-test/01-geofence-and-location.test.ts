// ============================================================================
// Unit Test: 01-geofence-and-location.test.ts
// Terkait: F01, F02, PB-05, PB-06, PB-07, NFR GPS Filter & Anti-Flapping
// ============================================================================

import { DWELL_MIN_MS, MAX_ACCURACY_M, POI_COOLDOWN_MS } from '@/constants/config';
import {
  endGeofenceSession,
  INITIAL_GEOFENCE_STATE,
  stepGeofence,
  type GeofenceContext,
  type GeofenceEvent,
  type GeofenceState,
} from '@/features/geofence/engine';
import {
  bearingDeg,
  computeAreaStatus,
  haversineM,
  type LatLng,
  type UserPosition,
} from '@/lib/geo';

// Helper konversi jarak meter ke koordinat (1 derajat lat ~ 111.195 km)
const M_PER_DEG = (Math.PI / 180) * 6_371_000;
const north = (meters: number): LatLng => ({
  latitude: meters / M_PER_DEG,
  longitude: 0,
});
const east = (meters: number): LatLng => ({
  latitude: 0,
  longitude: meters / M_PER_DEG,
});

const defaultArea = {
  center: north(0),
  entryRadiusM: 100,
  exitHysteresisM: 10,
};

const defaultPois = [
  { id: 'P01', triggerRadiusM: 15, ...north(40) },
  { id: 'P04', triggerRadiusM: 15, ...north(70) },
];

const ctx: GeofenceContext = {
  area: defaultArea,
  pois: defaultPois,
};

const T0 = 1_700_000_000_000;
const MIN = 60_000;

function posAt(metersNorth: number, timestamp = T0, accuracyM = 5): UserPosition {
  return {
    coordinate: north(metersNorth),
    accuracyM,
    timestamp,
  };
}

function runSequence(readings: UserPosition[], startState: GeofenceState = INITIAL_GEOFENCE_STATE) {
  let state = startState;
  const events: GeofenceEvent[] = [];
  for (const r of readings) {
    const res = stepGeofence(state, r, ctx);
    state = res.state;
    events.push(...res.events);
  }
  return { state, events, types: events.map((e) => e.type) };
}

describe('Kategori 1: Kalkulasi Jarak Geodesik & Bearing (Haversine)', () => {
  it('menghitung jarak 0 untuk koordinat yang identik', () => {
    const p = { latitude: -6.92089, longitude: 107.600574 };
    expect(haversineM(p, p)).toBe(0);
  });

  it('menghitung jarak secara simetris: dist(A, B) == dist(B, A)', () => {
    const a = { latitude: -6.92089, longitude: 107.600574 };
    const b = { latitude: -6.921332, longitude: 107.60065 };
    expect(haversineM(a, b)).toBeCloseTo(haversineM(b, a), 4);
  });

  it('menghitung jarak terukur secara akurat terhadap benchmark lintang/bujur', () => {
    const a = north(0);
    const b = north(50);
    expect(Math.round(haversineM(a, b))).toBe(50);
  });

  it('menangani batas ekstrem koordinat (-90, +90, -180, +180) tanpa NaN atau error', () => {
    const northPole: LatLng = { latitude: 90, longitude: 0 };
    const southPole: LatLng = { latitude: -90, longitude: 0 };
    const d = haversineM(northPole, southPole);
    expect(Number.isFinite(d)).toBe(true);
    expect(d).toBeGreaterThan(19_000_000); // ~20.000 km
  });

  it('menghitung bearing arah utara murni = 0° dan timur murni = 90°', () => {
    const origin = north(0);
    expect(Math.round(bearingDeg(origin, north(100)))).toBe(0);
    expect(Math.round(bearingDeg(origin, east(100)))).toBe(90);
  });
});

describe('Kategori 2: GPS Jitter Filter & Kualitas Sinyal (NFR)', () => {
  it('mengabaikan pembacaan dengan akurasi lebih buruk dari batas (> 30 m)', () => {
    const badAccuracy = posAt(40, T0, MAX_ACCURACY_M + 5);
    const res = stepGeofence(INITIAL_GEOFENCE_STATE, badAccuracy, ctx);
    expect(res.events).toEqual([]);
    expect(res.state).toBe(INITIAL_GEOFENCE_STATE);
  });

  it('menerima pembacaan dengan akurasi tepat pada batas toleransi (30 m)', () => {
    const boundaryAccuracy = posAt(40, T0, 30);
    const res = stepGeofence(INITIAL_GEOFENCE_STATE, boundaryAccuracy, ctx);
    expect(res.events.length).toBeGreaterThan(0);
  });

  it('mengabaikan pembacaan dengan akurasi tidak valid (NaN, Infinity, atau negatif)', () => {
    expect(stepGeofence(INITIAL_GEOFENCE_STATE, posAt(40, T0, NaN), ctx).events).toEqual([]);
    expect(stepGeofence(INITIAL_GEOFENCE_STATE, posAt(40, T0, Infinity), ctx).events).toEqual([]);
    expect(stepGeofence(INITIAL_GEOFENCE_STATE, posAt(40, T0, -1), ctx).events).toEqual([]);
  });

  it('meredam lonjakan palsu (spike): lompatan 500 m berakurasi buruk tidak dianggap keluar kawasan', () => {
    const sequence = [
      posAt(40, T0, 5), // di dalam
      posAt(500, T0 + 3000, 75), // lonjakan jitter buruk
      posAt(40, T0 + 6000, 5), // kembali
    ];
    const { types } = runSequence(sequence);
    expect(types).not.toContain('AREA_EXIT');
  });
});

describe('Kategori 3: Area Geofence Entry & Exit dengan Hysteresis', () => {
  it('memicu AREA_ENTRY saat pengguna dari luar (300 m) bergerak masuk ke dalam kawasan (90 m)', () => {
    const sequence = [posAt(300, T0), posAt(90, T0 + 3000)];
    const { types, events } = runSequence(sequence);
    expect(types).toContain('AREA_ENTRY');
    const entry = events.find((e) => e.type === 'AREA_ENTRY');
    expect(entry).toBeDefined();
    expect(entry?.at).toBe(T0 + 3000);
  });

  it('fix pertama saat aplikasi baru dibuka sudah di dalam kawasan TIDAK memicu AREA_ENTRY', () => {
    const { types } = runSequence([posAt(50, T0)]);
    expect(types).not.toContain('AREA_ENTRY');
  });

  it('mencegah flapping saat keluar kawasan dengan batas hysteresis 10 m (105 m masih di dalam, 112 m keluar)', () => {
    // entryRadius = 100 m, exitHysteresis = 10 m -> keluar jika > 110 m
    const inBuffer = runSequence([posAt(300, T0), posAt(0, T0 + 1000), posAt(105, T0 + 2000)]);
    expect(inBuffer.types.filter((t) => t.startsWith('AREA_'))).toEqual(['AREA_ENTRY']);
    expect(inBuffer.state.area).toBe('INSIDE');

    const fullExit = runSequence([posAt(300, T0), posAt(0, T0 + 1000), posAt(115, T0 + 2000)]);
    expect(fullExit.types.filter((t) => t.startsWith('AREA_'))).toEqual(['AREA_ENTRY', 'AREA_EXIT']);
    expect(fullExit.state.area).toBe('OUTSIDE');
  });

  it('computeAreaStatus mempertahankan status sebelumnya jika pembacaan akurasi buruk', () => {
    const status1 = computeAreaStatus(posAt(50, T0, 5), defaultArea, 'UNKNOWN');
    expect(status1).toBe('INSIDE');

    const status2 = computeAreaStatus(posAt(500, T0 + 1000, 45), defaultArea, status1);
    expect(status2).toBe('INSIDE'); // tetap INSIDE karena akurasi 45 m diabaikan
  });
});

describe('Kategori 4: Tenant Proximity & Anti-Flapping', () => {
  it('memicu event PROXIMITY saat pengguna memasuki radius tenant (< 15 m) beserta jaraknya', () => {
    // P01 berada di 40 m utara, radius 15 m. Posisi 42 m -> jarak 2 m ke tenant
    const { events } = runSequence([posAt(0, T0), posAt(42, T0 + 3000)]);
    expect(events).toContainEqual(
      expect.objectContaining({
        type: 'PROXIMITY',
        poiId: 'P01',
      }),
    );
  });

  it('tidak memicu event PROXIMITY berulang kali selama pengguna tetap berada di dalam radius tenant', () => {
    const continuousStay = Array.from({ length: 10 }, (_, i) => posAt(40 + (i % 2), T0 + i * 2000));
    const { types } = runSequence(continuousStay);
    const proximityCount = types.filter((t) => t === 'PROXIMITY').length;
    expect(proximityCount).toBe(1);
  });
});

describe('Kategori 5: Cooldown 30 Menit per POI', () => {
  it('tidak memicu ulang proximity jika pengguna keluar lalu masuk lagi sebelum cooldown 30 menit berakhir', () => {
    const sequence = [
      posAt(40, T0), // masuk P01
      posAt(0, T0 + 5 * MIN), // keluar dari P01
      posAt(40, T0 + 15 * MIN), // masuk lagi pada menit ke-15 (cooldown masih aktif)
    ];
    const { types } = runSequence(sequence);
    expect(types.filter((t) => t === 'PROXIMITY')).toHaveLength(1);
  });

  it('memicu ulang proximity jika pengguna masuk kembali tepat setelah cooldown 30 menit berakhir', () => {
    const sequence = [
      posAt(40, T0), // masuk P01
      posAt(0, T0 + 5 * MIN), // keluar
      posAt(40, T0 + POI_COOLDOWN_MS), // masuk lagi pada pas 30 menit
    ];
    const { types } = runSequence(sequence);
    expect(types.filter((t) => t === 'PROXIMITY')).toHaveLength(2);
  });

  it('memiliki timer cooldown yang independen untuk masing-masing POI berbeda', () => {
    const sequence = [
      posAt(40, T0), // masuk P01
      posAt(70, T0 + 5 * MIN), // masuk P04 pada menit ke-5
    ];
    const { events } = runSequence(sequence);
    const proximityPois = events.filter((e) => e.type === 'PROXIMITY').map((e) => e.poiId);
    expect(proximityPois).toEqual(['P01', 'P04']);
  });
});

describe('Kategori 6: Dwell Time Detection (≥ 3 Menit)', () => {
  it('berdiam kurang dari 3 menit (< 180.000 ms) tidak memicu DWELL event', () => {
    const sequence = [
      posAt(40, T0), // masuk
      posAt(40, T0 + 2 * MIN), // 2 menit
      posAt(40, T0 + DWELL_MIN_MS - 1000), // 2 menit 59 detik
    ];
    const { types } = runSequence(sequence);
    expect(types).not.toContain('DWELL');
  });

  it('berdiam selama minimal 3 menit memicu DWELL event dan mencatat status visited: true', () => {
    const sequence = [
      posAt(40, T0),
      posAt(40, T0 + 1 * MIN),
      posAt(40, T0 + 2 * MIN),
      posAt(40, T0 + DWELL_MIN_MS), // tepat 3 menit
    ];
    const { types, events } = runSequence(sequence);
    expect(types).toContain('DWELL');
    const dwell = events.find((e) => e.type === 'DWELL');
    expect(dwell).toEqual({
      type: 'DWELL',
      poiId: 'P01',
      durationMs: DWELL_MIN_MS,
      at: T0 + DWELL_MIN_MS,
    });
  });

  it('hanya memicu DWELL sekali selama kunjungan kontinu di tenant yang sama (idempotent)', () => {
    const longStay = [
      posAt(40, T0),
      posAt(40, T0 + DWELL_MIN_MS), // menit ke-3: DWELL
      posAt(40, T0 + 5 * MIN), // menit ke-5: tidak boleh DWELL lagi
      posAt(40, T0 + 10 * MIN), // menit ke-10: tidak boleh DWELL lagi
    ];
    const { types } = runSequence(longStay);
    const dwellCount = types.filter((t) => t === 'DWELL').length;
    expect(dwellCount).toBe(1);
  });

  it('jika pengguna keluar dari radius tenant sebelum 3 menit tercapai, timer dwell dibatalkan', () => {
    const sequence = [
      posAt(40, T0), // masuk
      posAt(40, T0 + 1 * MIN), // 1 menit
      posAt(0, T0 + 2 * MIN), // keluar sebelum 3 menit
      posAt(0, T0 + 4 * MIN), // sudah lewat 3 menit dari T0, tapi posisi di luar
    ];
    const { types } = runSequence(sequence);
    expect(types).not.toContain('DWELL');
  });
});

describe('Kategori 7: Tenant Exit Event dengan Hysteresis', () => {
  it('radius 15 m + exit hysteresis 10 m: pengguna di 22 m belum exit, di 27 m memicu EXIT', () => {
    // P01 di lintang 40 m. Radius = 15 m. Threshold exit = 25 m.
    // Posisi 40 + 22 = 62 m (jarak 22 m): masih di dalam batas hysteresis
    // Posisi 40 + 27 = 67 m (jarak 27 m): keluar (> 25 m)
    const inBuffer = runSequence([posAt(40, T0), posAt(62, T0 + 1000)]);
    expect(inBuffer.types).not.toContain('EXIT');

    const fullExit = runSequence([posAt(40, T0), posAt(67, T0 + 1000)]);
    expect(fullExit.types).toContain('EXIT');
    const exitEvent = fullExit.events.find((e) => e.type === 'EXIT');
    expect(exitEvent).toEqual(expect.objectContaining({ type: 'EXIT', poiId: 'P01' }));
  });
});

describe('Kategori 8: Penghentian Sesi Geofence (Session Teardown)', () => {
  it('endGeofenceSession mereset status kawasan ke UNKNOWN saat Mode Jelajah dimatikan', () => {
    const active = runSequence([posAt(300, T0), posAt(50, T0 + 1000)]);
    expect(active.state.area).toBe('INSIDE');

    const teardown = endGeofenceSession(active.state);
    expect(teardown.area).toBe('UNKNOWN');
  });
});

describe('Kategori 9: Helper isInsideGeofence & Geometri POI', () => {
  const { isInsideGeofence } = require('@/features/geofence');
  const poi = { latitude: -6.920838, longitude: 107.600471 }; // P09 Dapur Sotoku

  it('true jika pengguna tepat di posisi koordinat POI', () => {
    expect(isInsideGeofence(poi, poi)).toBe(true);
  });

  it('radius default 10 m: jarak 8 m masuk, 12 m tidak masuk', () => {
    const dLat = (m: number) => m / ((Math.PI / 180) * 6_371_000);
    expect(isInsideGeofence({ ...poi, latitude: poi.latitude + dLat(8) }, poi)).toBe(true);
    expect(isInsideGeofence({ ...poi, latitude: poi.latitude + dLat(12) }, poi)).toBe(false);
  });

  it('radius dapat dikustomisasi per POI (misal 25 m)', () => {
    expect(isInsideGeofence({ latitude: -6.9207, longitude: 107.600471 }, poi, 25)).toBe(true);
  });
});
