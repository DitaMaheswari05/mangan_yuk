import { NotificationService } from '@/features/notifications';
import { INITIAL_PASSPORT_STATE, PassportClient } from '@/features/passport';
import { getPois } from '@/features/poi';
import { ExitRecommendationStore } from '@/features/recommendation/exit';
import { createTrailSession, TrailSessionStore, type TrailStep } from '@/features/trail';
import { VisitRepository } from '@/features/visits';
import { haversineM, type UserPosition } from '@/lib/geo';
import { GeofenceRuntime } from '../runtime';

jest.mock('@/features/notifications', () => ({
  NotificationService: {
    notifyAreaEntry: jest.fn(async () => {}),
    notifyNearbyPoi: jest.fn(async () => {}),
    notifyTrailOverstay: jest.fn(async () => {}),
    notifyTrailAutoSkipped: jest.fn(async () => {}),
    notifyRecommendations: jest.fn(async () => {}),
  },
}));

jest.mock('@/features/audio', () => ({
  WalkModeService: { handleProximityAudioTrigger: jest.fn(async () => ({ autoPlayed: false })) },
}));

const MIN = 60_000;
const T0 = new Date('2026-11-06T18:00:00').getTime();

const [first, ...rest] = getPois();
// Tenant kedua harus di luar radius tenant pertama agar tidak ikut didiami.
const second = rest.find((p) => haversineM(first, p) > 50)!;
const at = (lat: number, lng: number, timestamp: number): UserPosition =>
  ({ coordinate: { latitude: lat, longitude: lng }, accuracyM: 5, timestamp }) as UserPosition;
const atFirst = (t: number) => at(first.latitude, first.longitude, t);

const step = (poi: typeof first, n: number): TrailStep => ({
  stepNumber: n,
  poi,
  distanceFromPreviousM: 0,
  estimatedWalkingMin: 1,
  allocatedVisitMin: 10,
  estimatedCostIdr: poi.priceMinIdr,
});

beforeEach(async () => {
  GeofenceRuntime.__reset();
  TrailSessionStore.__reset();
  await ExitRecommendationStore.clear();
  await PassportClient.saveLocalPassport(INITIAL_PASSPORT_STATE);
  await VisitRepository.clear();
  jest.clearAllMocks();
  const plan = { steps: [step(first, 1), step(second, 2)], totalEstimatedCostIdr: 0, totalEstimatedMin: 22, isValid: true };
  await TrailSessionStore.start(
    createTrailSession(plan, { durationMin: 60, budget: 100000, preferredTastes: [] }, T0),
  );
});

it('dwell di tenant trail menandai step selesai', async () => {
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(atFirst(T0 + 3 * MIN));
  const s = await TrailSessionStore.get();
  expect(s?.status[first.id]).toBe('done');
  expect(s?.status[second.id]).toBe('pending');
});

it('dwell mencatat kunjungan tapi tidak memberi stempel paspor', async () => {
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(atFirst(T0 + 3 * MIN));

  expect(await VisitRepository.isVisited(first.id)).toBe(true);
  expect((await PassportClient.loadLocalPassport()).stamps[first.id]).toBeUndefined();
});

it('mengirim pengingat sekali saat berdiam melebihi alokasi + 5 menit', async () => {
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(atFirst(T0 + 15 * MIN));
  expect(NotificationService.notifyTrailOverstay).not.toHaveBeenCalled();

  await GeofenceRuntime.processPosition(atFirst(T0 + 16 * MIN));
  await GeofenceRuntime.processPosition(atFirst(T0 + 20 * MIN));
  expect(NotificationService.notifyTrailOverstay).toHaveBeenCalledTimes(1);
  expect(NotificationService.notifyTrailOverstay).toHaveBeenCalledWith(
    expect.objectContaining({ poiId: first.id, dwellMin: 16, remainingMin: 44, remainingStops: 1 }),
  );
});

it('keluar dari tenant setelah dwell menyimpan 3 rekomendasi berikutnya', async () => {
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(atFirst(T0 + 3 * MIN));
  await GeofenceRuntime.processPosition(at(second.latitude, second.longitude, T0 + 4 * MIN));

  // Tenant di sebelah P01 berjarak beberapa meter dan ikut terdiami, jadi asal rekomendasi
  // adalah exit terakhir di antara tenant tersebut.
  const rec = await ExitRecommendationStore.get(T0 + 4 * MIN);
  expect(rec).not.toBeNull();
  expect(rec!.items).toHaveLength(3);
  const ids = rec!.items.map((i) => i.poiId);
  expect(ids).not.toContain(first.id);
  expect(ids).not.toContain(rec!.fromPoiId);
});

it('lewat tenant tanpa dwell tidak memicu rekomendasi', async () => {
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(at(second.latitude, second.longitude, T0 + MIN));

  expect(await ExitRecommendationStore.get(T0 + MIN)).toBeNull();
  expect(NotificationService.notifyRecommendations).not.toHaveBeenCalled();
});

it('tenant trail yang tutup di tengah jalan dilewati otomatis dan pengguna diberi tahu', async () => {
  // Tenant data asli tutup pukul 23:00 (Jumat). Trail dimulai 22:50, posisi berikutnya 23:05.
  const late = new Date('2026-11-06T22:50:00').getTime();
  const plan = { steps: [step(first, 1), step(second, 2)], totalEstimatedCostIdr: 0, totalEstimatedMin: 22, isValid: true };
  await TrailSessionStore.start(
    createTrailSession(plan, { durationMin: 60, budget: 100000, preferredTastes: [] }, late),
  );

  await GeofenceRuntime.processPosition(at(-6.9, 107.5, late + 15 * MIN));

  const s = await TrailSessionStore.get();
  expect(s?.status[first.id]).toBe('skipped');
  expect(NotificationService.notifyTrailAutoSkipped).toHaveBeenCalledTimes(1);
  expect(NotificationService.notifyTrailAutoSkipped).toHaveBeenCalledWith(
    expect.objectContaining({ skippedNames: expect.arrayContaining([first.name]) }),
  );
});

it('tanpa trail aktif tidak ada pengingat', async () => {
  await TrailSessionStore.end();
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(atFirst(T0 + 30 * MIN));
  expect(NotificationService.notifyTrailOverstay).not.toHaveBeenCalled();
});
