import { getPois } from '@/features/poi';
import { createTrailSession, type TrailStep } from '@/features/trail';
import type { Poi, TastePairing } from '@/types/content';
import { buildExitRecommendation, pairingTasteOf } from '../exit';

// Jumat 19:00: semua tenant buka.
const AT = new Date('2026-11-06T19:00:00').getTime();
const pois = getPois();
const exited = pois[0];
const position = { latitude: exited.latitude, longitude: exited.longitude };

const base = {
  exitedPoi: exited,
  position,
  pois,
  visitedPoiIds: [] as string[],
  trail: null,
  halalOnly: false,
  at: AT,
};

const step = (poi: Poi, n: number): TrailStep => ({
  stepNumber: n,
  poi,
  distanceFromPreviousM: 0,
  estimatedWalkingMin: 1,
  allocatedVisitMin: 10,
  estimatedCostIdr: poi.priceMinIdr,
});

it('memberi 3 tenant, tanpa tenant yang baru ditinggalkan maupun yang sudah dikunjungi', () => {
  const visited = pois.slice(1, 4).map((p) => p.id);
  const rec = buildExitRecommendation({ ...base, visitedPoiIds: visited })!;

  expect(rec.fromPoiId).toBe(exited.id);
  expect(rec.createdAt).toBe(AT);
  expect(rec.items).toHaveLength(3);
  const ids = rec.items.map((i) => i.poiId);
  expect(ids).not.toContain(exited.id);
  visited.forEach((id) => expect(ids).not.toContain(id));
  rec.items.forEach((i) => expect(i.reason).toContain('dari sini'));
});

it('preferensi halal hanya menyarankan tenant berstatus halal', () => {
  const rec = buildExitRecommendation({ ...base, halalOnly: true })!;
  rec.items.forEach((i) => expect(pois.find((p) => p.id === i.poiId)?.isHalal).toBe(true));
});

it('dengan trail aktif, step yang selesai dikecualikan dan sisa budget ikut dinilai', () => {
  const done = pois[5];
  const session = createTrailSession(
    { steps: [step(done, 1)], totalEstimatedCostIdr: done.priceMinIdr, totalEstimatedMin: 11, isValid: true },
    { durationMin: 60, budget: 200000, preferredTastes: [] },
    AT,
  );
  session.status[done.id] = 'done';

  const rec = buildExitRecommendation({ ...base, trail: session })!;
  expect(rec.items.map((i) => i.poiId)).not.toContain(done.id);
  expect(rec.items.some((i) => i.reason.includes('sesuai sisa budget'))).toBe(true);
});

it('mengembalikan null jika tidak ada tenant tersisa', () => {
  const rec = buildExitRecommendation({ ...base, visitedPoiIds: pois.map((p) => p.id) });
  expect(rec).toBeNull();
});

it('rasa untuk aturan pasangan memilih rasa yang punya aturan, bukan sekadar rasa pertama', () => {
  const pairings: TastePairing[] = [
    { afterTaste: 'pedas', suggestTaste: 'segar', suggestFoodType: 'minuman', reason: 'x' },
  ];
  expect(pairingTasteOf({ tasteTags: ['manis', 'pedas'] }, pairings)).toBe('pedas');
  expect(pairingTasteOf({ tasteTags: ['manis'] }, pairings)).toBe('manis');
  expect(pairingTasteOf({ tasteTags: [] }, pairings)).toBeNull();
});
