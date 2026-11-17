import { NotificationService } from '@/features/notifications';
import { getPois } from '@/features/poi';
import { createTrailSession, TrailSessionStore, type TrailStep } from '@/features/trail';
import { haversineM, type UserPosition } from '@/lib/geo';
import { GeofenceRuntime } from '../runtime';

jest.mock('@/features/notifications', () => ({
  NotificationService: {
    notifyAreaEntry: jest.fn(async () => {}),
    notifyNearbyPoi: jest.fn(async () => {}),
    notifyTrailOverstay: jest.fn(async () => {}),
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

it('tanpa trail aktif tidak ada pengingat', async () => {
  await TrailSessionStore.end();
  await GeofenceRuntime.processPosition(atFirst(T0));
  await GeofenceRuntime.processPosition(atFirst(T0 + 30 * MIN));
  expect(NotificationService.notifyTrailOverstay).not.toHaveBeenCalled();
});
