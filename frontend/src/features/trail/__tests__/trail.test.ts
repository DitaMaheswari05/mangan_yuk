// ============================================================================
// Unit Test: 06-smart-culinary-trail-planner.test.ts
// Terkait: F08, PB-14, PB-15, Smart Culinary Trail Planner (Nearest Neighbor) & Dwell Alert
// ============================================================================

import {
  checkDwellAlert,
  planTrail,
  type TrailPlanParams,
} from '@/features/trail';
import type { LatLng } from '@/lib/geo';
import type { Poi } from '@/types/content';

const startPos: LatLng = { latitude: -6.92089, longitude: 107.600574 };

// Helper pembuatan tenant berjarak teratur ke arah utara
const makeTestPoi = (idNum: number, metersNorth: number, priceMinIdr: number, avgVisitMin: number, tastes: string[]): Poi => {
  const id = `P${String(idNum).padStart(2, '0')}`;
  return {
    id,
    name: `Tenant ${id}`,
    slug: `tenant-${idNum}`,
    type: 'makanan',
    categoryLabel: 'Test',
    // @ts-expect-error test taste tags
    tasteTags: tastes,
    isHalal: true,
    zone: 'Zone A',
    latitude: startPos.latitude + metersNorth * 0.000009, // ~1 m per 0.000009 deg
    longitude: startPos.longitude,
    triggerRadiusM: 15,
    avgVisitMin,
    description: '',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: `${id}-M1`, name: 'Menu', priceIdr: priceMinIdr, tastes: ['gurih'], isSignature: true, poiId: 'P00', priceBucket: 'murah', type: 'makanan', dishCategory: 'lauk', isHalal: null }],
    openingHours: [{ day: 5, open: '15:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr,
    priceMaxIdr: priceMinIdr,
    priceBucket: priceMinIdr < 15000 ? 'under15k' : priceMinIdr <= 30000 ? '15to30k' : 'over30k',
  };
};

const pois: Poi[] = [
  makeTestPoi(1, 20, 5000, 10, ['manis', 'gurih']), // P01: Traditional Fried Food (20 m)
  makeTestPoi(9, 50, 25000, 20, ['gurih']), // P09: Dapur Sotoku (50 m)
  makeTestPoi(28, 90, 30000, 20, ['pedas', 'gurih']), // P28: Pempek Gochan (90 m)
  makeTestPoi(13, 150, 36000, 15, ['gurih']), // P13: Pandu Baso Goreng (150 m)
];

describe('Kategori 1: Validasi Input Trail Planner (AC F08-1)', () => {
  it('menolak input jika durasi <= 0 atau budget <= 0', () => {
    const invalidDuration = planTrail({
      userPosition: startPos,
      pois,
      durationMin: 0,
      budget: 50000,
    });
    expect(invalidDuration.isValid).toBe(false);
    expect(invalidDuration.steps).toEqual([]);

    const invalidBudget = planTrail({
      userPosition: startPos,
      pois,
      durationMin: 60,
      budget: -1000,
    });
    expect(invalidBudget.isValid).toBe(false);
  });
});

describe('Kategori 2: Algoritma Rute Berurutan (Nearest Neighbor) & Non-Backtracking', () => {
  it('menghasilkan rute urut terdekat (P01 -> P02 -> P03) tanpa melompat bolak-balik', () => {
    const params: TrailPlanParams = {
      userPosition: startPos,
      pois,
      durationMin: 60,
      budget: 50000,
    };

    const result = planTrail(params);

    expect(result.isValid).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(2);

    const stepPoiIds = result.steps.map((s) => s.poi.id);
    expect(stepPoiIds[0]).toBe('P01'); // paling dekat ke start (20m)
    expect(stepPoiIds[1]).toBe('P09'); // berikutnya paling dekat (30m dari P01)
  });

  it('memastikan tidak ada POI yang dikunjungi dua kali (no duplicate POI in trail)', () => {
    const result = planTrail({
      userPosition: startPos,
      pois,
      durationMin: 90,
      budget: 100000,
    });

    const ids = result.steps.map((s) => s.poi.id);
    const uniqueIds = new Set(ids);
    expect(ids.length).toBe(uniqueIds.size);
  });
});

describe('Kategori 3: Kepatuhan Batasan Keras (Budget & Waktu)', () => {
  it('total estimasi biaya rencana rute selalu <= budget yang ditentukan pengguna', () => {
    const userBudget = 40000;
    const result = planTrail({
      userPosition: startPos,
      pois,
      durationMin: 90,
      budget: userBudget,
    });

    expect(result.isValid).toBe(true);
    expect(result.totalEstimatedCostIdr).toBeLessThanOrEqual(userBudget);
  });

  it('total estimasi waktu (jalan kaki + makan) selalu <= durasi yang dialokasikan', () => {
    const userDurationMin = 45;
    const result = planTrail({
      userPosition: startPos,
      pois,
      durationMin: userDurationMin,
      budget: 100000,
    });

    expect(result.isValid).toBe(true);
    expect(result.totalEstimatedMin).toBeLessThanOrEqual(userDurationMin);
  });

  it('berhasil merencanakan rute meskipun pengguna berada jauh di luar kawasan kuliner (misal dari rumah/kantor)', () => {
    // Koordinat Tamansari / luar kawasan (~6.4 km dari startPos)
    const outsidePosition: LatLng = { latitude: -6.892, longitude: 107.610 };
    const result = planTrail({
      userPosition: outsidePosition,
      pois,
      durationMin: 30,
      budget: 50000,
    });

    expect(result.isValid).toBe(true);
    expect(result.steps.length).toBeGreaterThanOrEqual(1);
    expect(result.totalEstimatedMin).toBeLessThanOrEqual(30);
  });
});

describe('Kategori 4: Pengingat Batas Waktu Kunjungan (Dwell Time Alert)', () => {
  it('tidak memicu peringatan jika waktu nongkrong belum melewati alokasi + toleransi 5 menit', () => {
    const allocatedMin = 15;
    // Berada 18 menit (15 + 3 menit) -> masih dalam toleransi 5 menit
    const isAlert = checkDwellAlert(18 * 60_000, allocatedMin, 5);
    expect(isAlert).toBe(false);
  });

  it('memicu peringatan jika pengguna berdiam melebihi alokasi waktu + toleransi 5 menit', () => {
    const allocatedMin = 15;
    // Berada 21 menit (15 + 6 menit) -> melebihi toleransi
    const isAlert = checkDwellAlert(21 * 60_000, allocatedMin, 5);
    expect(isAlert).toBe(true);
  });
});

describe('Kategori 5: Jam Operasional Tidak Membatasi Rute', () => {
  it('tetap menyusun rute walaupun semua tenant sedang tutup', () => {
    const closedPois = pois.map((p) => ({ ...p, openingHours: [] }));
    const plan = planTrail({ userPosition: startPos, pois: closedPois, durationMin: 60, budget: 50000 });

    expect(plan.isValid).toBe(true);
    expect(plan.steps.length).toBeGreaterThanOrEqual(1);
  });
});
