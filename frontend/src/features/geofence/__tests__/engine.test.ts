import { DWELL_MIN_MS, POI_COOLDOWN_MS } from '@/constants/config';
import type { UserPosition } from '@/lib/geo';
import {
  endGeofenceSession,
  INITIAL_GEOFENCE_STATE,
  stepGeofence,
  type GeofenceEvent,
  type GeofenceState,
} from '../engine';

// Geometri sederhana: pusat kawasan di (0,0), satu tenant 50 m di utara pusat.
const M_PER_DEG = (Math.PI / 180) * 6_371_000;
const north = (m: number) => ({ latitude: m / M_PER_DEG, longitude: 0 });

const area = { center: north(0), entryRadiusM: 100, exitHysteresisM: 10 };
const POI = { id: 'P01', triggerRadiusM: 10, ...north(50) };
const ctx = { area, pois: [POI] };

const MIN = 60_000;
const T0 = 1_000_000;

const at = (metersNorth: number, t: number, accuracyM = 5): UserPosition => ({
  coordinate: north(metersNorth),
  accuracyM,
  timestamp: t,
});

/** Jalankan urutan pembacaan; kembalikan state akhir + semua event. */
function run(readings: UserPosition[], start: GeofenceState = INITIAL_GEOFENCE_STATE) {
  let state = start;
  const events: GeofenceEvent[] = [];
  for (const r of readings) {
    const res = stepGeofence(state, r, ctx);
    state = res.state;
    events.push(...res.events);
  }
  return { state, events, types: events.map((e) => e.type) };
}

describe('filter jitter (akurasi > 30 m)', () => {
  it('pembacaan tidak akurat tidak memicu trigger dan tidak mengubah state', () => {
    const res = stepGeofence(INITIAL_GEOFENCE_STATE, at(50, T0, 45), ctx);
    expect(res.events).toEqual([]);
    expect(res.state).toBe(INITIAL_GEOFENCE_STATE);
  });

  it('lompatan GPS tidak akurat tidak dianggap exit', () => {
    const { types } = run([at(50, T0), at(500, T0 + 3000, 80), at(50, T0 + 6000)]);
    expect(types).toEqual(['PROXIMITY']);
  });

  it('akurasi tidak diketahui (Infinity) diabaikan', () => {
    expect(stepGeofence(INITIAL_GEOFENCE_STATE, at(50, T0, Infinity), ctx).events).toEqual([]);
  });
});

describe('entry & exit kawasan', () => {
  it('OUTSIDE → INSIDE memicu AREA_ENTRY sekali', () => {
    const { types } = run([at(300, T0), at(90, T0 + 3000), at(80, T0 + 6000)]);
    expect(types).toEqual(['AREA_ENTRY']);
  });

  it('fix pertama sudah di dalam kawasan tidak dianggap entry', () => {
    expect(run([at(0, T0)]).types).toEqual([]);
  });

  it('keluar dengan hysteresis: 105 m masih di dalam, 115 m keluar', () => {
    const inBand = run([at(300, T0), at(0, T0 + 1), at(105, T0 + 2)]);
    expect(inBand.types).toEqual(['AREA_ENTRY']);
    const out = run([at(300, T0), at(0, T0 + 1), at(115, T0 + 2)]);
    expect(out.types).toEqual(['AREA_ENTRY', 'AREA_EXIT']);
  });
});

describe('proximity tenant', () => {
  it('masuk radius tenant memicu PROXIMITY dengan jarak', () => {
    const { events } = run([at(0, T0), at(45, T0 + 3000)]);
    expect(events).toEqual([{ type: 'PROXIMITY', poiId: 'P01', distanceM: 5, at: T0 + 3000 }]);
  });

  it('tidak berulang selama pengguna tetap di area POI', () => {
    const readings = Array.from({ length: 20 }, (_, i) => at(50 + (i % 2 ? 3 : -3), T0 + i * 3000));
    expect(run(readings).types.filter((t) => t === 'PROXIMITY')).toHaveLength(1);
  });

  it('keluar lalu masuk lagi sebelum 30 menit → tidak dipicu ulang (cooldown)', () => {
    const { types } = run([at(50, T0), at(0, T0 + MIN), at(50, T0 + 10 * MIN)]);
    expect(types.filter((t) => t === 'PROXIMITY')).toHaveLength(1);
  });

  it('masuk lagi setelah cooldown 30 menit → dipicu lagi', () => {
    const { types } = run([at(50, T0), at(0, T0 + MIN), at(50, T0 + POI_COOLDOWN_MS)]);
    expect(types.filter((t) => t === 'PROXIMITY')).toHaveLength(2);
  });

  it('memakai DEFAULT_TRIGGER_RADIUS_M jika triggerRadiusM 0', () => {
    const res = stepGeofence(INITIAL_GEOFENCE_STATE, at(42, T0), {
      area,
      pois: [{ ...POI, triggerRadiusM: 0 }],
    });
    expect(res.events.map((e) => e.type)).toEqual(['PROXIMITY']);
  });
});

describe('dwell (≥3 menit) & exit tenant', () => {
  it('diam ≥3 menit → DWELL sekali, durasi tercatat', () => {
    const { events } = run([at(50, T0), at(50, T0 + 2 * MIN), at(50, T0 + DWELL_MIN_MS), at(50, T0 + 5 * MIN)]);
    const dwell = events.filter((e) => e.type === 'DWELL');
    expect(dwell).toEqual([{ type: 'DWELL', poiId: 'P01', durationMs: DWELL_MIN_MS, at: T0 + DWELL_MIN_MS }]);
  });

  it('hanya lewat (<3 menit) → tidak tercatat berkunjung', () => {
    const { types, events } = run([at(50, T0), at(50, T0 + 2 * MIN), at(0, T0 + 2.5 * MIN)]);
    expect(types).not.toContain('DWELL');
    expect(events.find((e) => e.type === 'EXIT')).toMatchObject({ visited: false });
  });

  it('dwell bisa dievaluasi ulang dengan `now` tanpa pembacaan baru', () => {
    const first = stepGeofence(INITIAL_GEOFENCE_STATE, at(50, T0), ctx);
    const tick = stepGeofence(first.state, at(50, T0), { ...ctx, now: T0 + DWELL_MIN_MS });
    expect(tick.events.map((e) => e.type)).toEqual(['DWELL']);
  });

  it('exit memakai hysteresis: radius 10 m + 10 m → 18 m masih di dalam, 21 m keluar', () => {
    const inBand = run([at(50, T0), at(50 + 18, T0 + 3000)]);
    expect(inBand.types).not.toContain('EXIT');
    expect(inBand.state.pois.P01.inside).toBe(true);

    const out = run([at(50, T0), at(50 + 21, T0 + 3000)]);
    expect(out.types).toContain('EXIT');
  });

  it('keluar setelah dwell → EXIT dengan visited: true', () => {
    const { events } = run([at(50, T0), at(50, T0 + DWELL_MIN_MS), at(0, T0 + 4 * MIN)]);
    expect(events.find((e) => e.type === 'EXIT')).toMatchObject({ poiId: 'P01', visited: true });
  });

  it('flapping di batas radius tidak memicu exit/proximity berulang', () => {
    // Bolak-balik antara 9 m dan 15 m dari tenant (di dalam pita hysteresis).
    const readings = Array.from({ length: 10 }, (_, i) => at(50 + (i % 2 ? 15 : 9), T0 + i * 3000));
    expect(run(readings).types).toEqual(['PROXIMITY']);
  });
});

describe('endGeofenceSession', () => {
  it('melupakan status di dalam, tetapi cooldown tetap berlaku di sesi berikutnya', () => {
    const s1 = run([at(50, T0)]).state;
    const s2 = endGeofenceSession(s1);
    expect(s2.area).toBe('UNKNOWN');
    expect(s2.pois.P01).toMatchObject({ inside: false, enteredAt: null, lastProximityAt: T0 });

    const again = run([at(50, T0 + 5 * MIN)], s2);
    expect(again.types).not.toContain('PROXIMITY');
    expect(again.state.pois.P01.inside).toBe(true); // tetap dilacak untuk dwell
  });
});
