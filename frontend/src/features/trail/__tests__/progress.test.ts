import {
  activeTrailStepIndex,
  completeTrailStep,
  createTrailSession,
  findTrailOverstay,
  jumpToTrailStep,
  markOverstayNotified,
  pendingTrailSteps,
  planTrail,
  remainingTrailBudget,
  skipClosedTrailSteps,
  skipTrailStep,
  TrailSessionStore,
  undoSkipTrailStep,
  type TrailSession,
} from '@/features/trail';
import type { LatLng } from '@/lib/geo';
import type { Poi } from '@/types/content';

const startPos: LatLng = { latitude: -6.92089, longitude: 107.600574 };
const T0 = new Date('2026-11-06T18:00:00').getTime(); // Jumat 18:00
const MIN = 60_000;

const makePoi = (n: number, metersNorth: number, price: number, visitMin: number): Poi => {
  const id = `P${String(n).padStart(2, '0')}`;
  return {
    id,
    name: `Tenant ${id}`,
    slug: `tenant-${n}`,
    type: 'makanan',
    categoryLabel: 'Test',
    tasteTags: ['gurih'],
    isHalal: true,
    zone: 'Zone A',
    latitude: startPos.latitude + metersNorth * 0.000009,
    longitude: startPos.longitude,
    triggerRadiusM: 15,
    avgVisitMin: visitMin,
    description: '',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [],
    openingHours: [{ day: 5, open: '15:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr: price,
    priceMaxIdr: price,
    priceBucket: price < 15000 ? 'under15k' : price <= 30000 ? '15to30k' : 'over30k',
  } as Poi;
};

const pois: Poi[] = [
  makePoi(1, 20, 10000, 10),
  makePoi(2, 40, 10000, 10),
  makePoi(3, 60, 10000, 10),
  makePoi(4, 80, 10000, 10),
  makePoi(5, 100, 10000, 10),
  makePoi(6, 120, 40000, 10),
];

function newSession(durationMin = 60, budget = 30000): TrailSession {
  const plan = planTrail({
    userPosition: startPos,
    pois,
    durationMin,
    budget,
    referenceTime: new Date(T0),
  });
  return createTrailSession(plan, { durationMin, budget, preferredTastes: [] }, T0);
}

describe('createTrailSession', () => {
  it('semua step pending dan step pertama aktif', () => {
    const s = newSession();
    expect(s.steps.map((x) => x.poi.id)).toEqual(['P01', 'P02', 'P03']);
    expect(Object.values(s.status)).toEqual(['pending', 'pending', 'pending']);
    expect(activeTrailStepIndex(s)).toBe(0);
  });
});

describe('completeTrailStep (dwell event)', () => {
  it('menandai tenant selesai dan memajukan step aktif', () => {
    const s = completeTrailStep(newSession(), 'P01', T0 + 5 * MIN);
    expect(s.status.P01).toBe('done');
    expect(s.doneAt.P01).toBe(T0 + 5 * MIN);
    expect(activeTrailStepIndex(s)).toBe(1);
    expect(remainingTrailBudget(s)).toBe(20000);
  });

  it('boleh selesai tidak berurutan', () => {
    const s = completeTrailStep(newSession(), 'P03', T0);
    expect(s.status.P03).toBe('done');
    expect(activeTrailStepIndex(s)).toBe(0);
  });

  it('tenant di luar trail atau yang sudah selesai tidak mengubah sesi', () => {
    const s = newSession();
    expect(completeTrailStep(s, 'P06', T0)).toBe(s);
    const done = completeTrailStep(s, 'P01', T0);
    expect(completeTrailStep(done, 'P01', T0 + MIN)).toBe(done);
  });
});

describe('findTrailOverstay (alokasi + 5 menit)', () => {
  const s = newSession(); // alokasi P01 = 10 menit

  it('belum mengingatkan selama masih dalam alokasi + toleransi', () => {
    expect(findTrailOverstay(s, { P01: T0 }, T0 + 15 * MIN)).toBeNull();
  });

  it('mengingatkan dengan sisa waktu dan jumlah tenant tersisa', () => {
    const alert = findTrailOverstay(s, { P01: T0 + 2 * MIN }, T0 + 18 * MIN);
    expect(alert).toEqual({
      poiId: 'P01',
      poiName: 'Tenant P01',
      dwellMin: 16,
      remainingMin: 42,
      remainingStops: 2,
    });
  });

  it('hanya sekali per tenant', () => {
    const notified = markOverstayNotified(s, 'P01');
    expect(findTrailOverstay(notified, { P01: T0 }, T0 + 30 * MIN)).toBeNull();
  });

  it('mengabaikan tenant yang dilewati atau yang tidak sedang didiami', () => {
    const skipped = { ...s, status: { ...s.status, P01: 'skipped' as const } };
    expect(findTrailOverstay(skipped, { P01: T0 }, T0 + 30 * MIN)).toBeNull();
    expect(findTrailOverstay(s, { P01: null }, T0 + 30 * MIN)).toBeNull();
  });
});

describe('skipTrailStep (lewati & susun ulang)', () => {
  it('mengganti tenant yang dilewati dengan tenant lain dalam sisa budget dan waktu', () => {
    const s = completeTrailStep(newSession(), 'P01', T0 + 12 * MIN);
    const { session, addedPoiIds } = skipTrailStep(s, 'P02', pois, startPos, T0 + 15 * MIN);

    expect(session.status.P01).toBe('done');
    expect(session.status.P02).toBe('skipped');
    expect(addedPoiIds).toEqual(['P04']);

    const pending = pendingTrailSteps(session);
    expect(pending.map((x) => x.poi.id)).toEqual(['P03', 'P04']);
    const cost = pending.reduce((sum, x) => sum + x.estimatedCostIdr, 0);
    const time = pending.reduce((sum, x) => sum + x.estimatedWalkingMin + x.allocatedVisitMin, 0);
    expect(cost).toBeLessThanOrEqual(20000);
    expect(time).toBeLessThanOrEqual(45);
    expect(session.steps.map((x) => x.stepNumber)).toEqual([1, 2, 3, 4]);
  });

  it('tenant di atas sisa budget tidak dipilih sebagai pengganti', () => {
    const { session } = skipTrailStep(newSession(), 'P01', pois, startPos, T0);
    expect(session.status.P06).toBeUndefined();
  });

  it('tanpa sisa waktu, tidak ada pengganti', () => {
    const { session, addedPoiIds } = skipTrailStep(newSession(), 'P01', pois, startPos, T0 + 60 * MIN);
    expect(addedPoiIds).toEqual([]);
    expect(pendingTrailSteps(session)).toEqual([]);
    expect(session.status.P01).toBe('skipped');
  });

  it('tenant yang bukan pending tidak bisa dilewati', () => {
    const s = completeTrailStep(newSession(), 'P01', T0);
    expect(skipTrailStep(s, 'P01', pois, startPos, T0).session).toBe(s);
  });
});

describe('skipClosedTrailSteps (lewati otomatis tenant tutup)', () => {
  // Jumat: tenant tutup pukul 18:20, 20 menit setelah trail dimulai pukul 18:00.
  const closesEarly = (p: Poi): Poi => ({
    ...p,
    openingHours: [{ day: 5, open: '15:00', close: '18:20' }],
  });
  const withHours = (ids: string[], fn: (p: Poi) => Poi) =>
    pois.map((p) => (ids.includes(p.id) ? fn(p) : p));

  function sessionFrom(list: Poi[]): TrailSession {
    const plan = planTrail({ userPosition: startPos, pois: list, durationMin: 60, budget: 30000, referenceTime: new Date(T0) });
    return createTrailSession(plan, { durationMin: 60, budget: 30000, preferredTastes: [] }, T0);
  }

  it('tenant yang tutup di tengah trail dilewati dan diganti tenant yang masih buka', () => {
    const list = withHours(['P02'], closesEarly);
    const s = sessionFrom(list);
    expect(s.steps.map((x) => x.poi.id)).toEqual(['P01', 'P02', 'P03']);

    const res = skipClosedTrailSteps(s, list, startPos, T0 + 25 * MIN);
    expect(res.skippedPoiIds).toEqual(['P02']);
    expect(res.session.status.P02).toBe('skipped');
    expect(res.addedPoiIds).toContain('P04');
    expect(res.session.undo).toBeNull();
  });

  it('pengganti tidak diambil dari tenant yang juga sudah tutup', () => {
    const list = withHours(['P02', 'P04'], closesEarly);
    const res = skipClosedTrailSteps(sessionFrom(list), list, startPos, T0 + 25 * MIN);
    expect(res.addedPoiIds).not.toContain('P04');
    expect(res.addedPoiIds).toContain('P05');
  });

  it('tidak ada perubahan selama semua tenant masih buka', () => {
    const s = newSession();
    const res = skipClosedTrailSteps(s, pois, startPos, T0 + 25 * MIN);
    expect(res.session).toBe(s);
    expect(res.skippedPoiIds).toEqual([]);
  });

  it('tenant yang sudah tutup sejak trail dimulai (rute jam simulasi) tidak dilewati', () => {
    const s = newSession();
    const closedFromStart = {
      ...s,
      steps: s.steps.map((x) =>
        x.poi.id === 'P02'
          ? { ...x, poi: { ...x.poi, openingHours: [{ day: 5, open: '20:00', close: '23:00' }] } }
          : x,
      ),
    };
    const res = skipClosedTrailSteps(closedFromStart, pois, startPos, T0 + 25 * MIN);
    expect(res.session).toBe(closedFromStart);
  });

  it('tenant yang sudah selesai tidak ikut dilewati walau sudah tutup', () => {
    const list = withHours(['P01'], closesEarly);
    const s = completeTrailStep(sessionFrom(list), 'P01', T0 + 10 * MIN);
    const res = skipClosedTrailSteps(s, list, startPos, T0 + 25 * MIN);
    expect(res.session).toBe(s);
    expect(res.session.status.P01).toBe('done');
  });
});

describe('undoSkipTrailStep & jumpToTrailStep', () => {
  it('batal lewati mengembalikan rute sebelum dilewati', () => {
    const s = newSession();
    const { session } = skipTrailStep(s, 'P01', pois, startPos, T0);
    const undone = undoSkipTrailStep(session, 'P01');
    expect(undone.steps).toEqual(s.steps);
    expect(undone.status).toEqual(s.status);
  });

  it('batal lewati tidak tersedia setelah ada tenant selesai', () => {
    const { session } = skipTrailStep(newSession(), 'P01', pois, startPos, T0);
    const progressed = completeTrailStep(session, session.steps[1].poi.id, T0 + MIN);
    expect(undoSkipTrailStep(progressed, 'P01')).toBe(progressed);
  });

  it('langsung ke step ketiga melewati step pending sebelumnya', () => {
    const s = jumpToTrailStep(completeTrailStep(newSession(), 'P01', T0), 2);
    expect(s.status).toEqual({ P01: 'done', P02: 'skipped', P03: 'pending' });
  });
});

describe('TrailSessionStore', () => {
  beforeEach(() => TrailSessionStore.__reset());

  it('menyimpan, memperbarui, dan mengakhiri sesi', async () => {
    const listener = jest.fn();
    TrailSessionStore.subscribe(listener);

    await TrailSessionStore.start(newSession());
    await TrailSessionStore.update((s) => completeTrailStep(s, 'P01', T0));
    TrailSessionStore.__reset();
    expect((await TrailSessionStore.get())?.status.P01).toBe('done');

    await TrailSessionStore.end();
    expect(await TrailSessionStore.get()).toBeNull();
  });

  it('update tanpa perubahan tidak memanggil listener', async () => {
    await TrailSessionStore.start(newSession());
    const listener = jest.fn();
    TrailSessionStore.subscribe(listener);
    await TrailSessionStore.update((s) => completeTrailStep(s, 'P99', T0));
    expect(listener).not.toHaveBeenCalled();
  });
});
