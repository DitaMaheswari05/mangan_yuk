// ============================================================================
// Unit Test: 05-contextual-recommendation-engine.test.ts
// Terkait: F07, PB-13, Sistem Rekomendasi Kontekstual Berbasis Aturan Deterministik
// ============================================================================

import { getRecommendations } from '@/features/recommendation';
import type { LatLng } from '@/lib/geo';
import type { Poi } from '@/types/content';

const userPos: LatLng = { latitude: -6.92089, longitude: 107.600574 };

// Menggunakan data tenant riil Sudirman Street Food:
const candidatePois: Poi[] = [
  {
    id: 'P28',
    name: 'Pempek Gochan',
    slug: 'pempek-gochan',
    type: 'makanan',
    categoryLabel: 'Pempek / Gurih-Pedas',
    tasteTags: ['pedas', 'gurih'],
    isHalal: null,
    zone: 'Zone D',
    latitude: -6.92095,
    longitude: 107.60058,
    triggerRadiusM: 10,
    avgVisitMin: 20,
    description: 'Pempek kuah cuko pedas.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: 'P28-M1', name: 'Paket A Kapal Selam', priceIdr: 30000, tastes: ['pedas'], isSignature: true }],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr: 30000,
    priceMaxIdr: 30000,
    priceBucket: '15to30k',
  },
  {
    id: 'P27',
    name: 'Rainbow Juice',
    slug: 'rainbow-juice',
    type: 'minuman',
    categoryLabel: 'Jus / Segar',
    tasteTags: ['segar', 'manis'],
    isHalal: null,
    zone: 'Zone B',
    latitude: -6.92105,
    longitude: 107.6006,
    triggerRadiusM: 10,
    avgVisitMin: 10,
    description: 'Jus buah segar dingin pelepas dahaga.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: 'P27-M1', name: 'Strawberry + Jeruk', priceIdr: 15000, tastes: ['segar'], isSignature: true }],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr: 15000,
    priceMaxIdr: 15000,
    priceBucket: '15to30k',
  },
  {
    id: 'P01',
    name: 'Traditional Fried Food from West Borneo',
    slug: 'traditional-fried-food-from-west-borneo',
    type: 'jajanan',
    categoryLabel: 'Gorengan / Manis',
    tasteTags: ['manis'],
    isHalal: null,
    zone: 'Zone A',
    latitude: -6.92115,
    longitude: 107.60062,
    triggerRadiusM: 10,
    avgVisitMin: 10,
    description: 'Pisang goreng tanduk madu manis renyah.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: 'P01-M1', name: 'Pisang Tanduk Madu', priceIdr: 5000, tastes: ['manis'], isSignature: true }],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr: 5000,
    priceMaxIdr: 5000,
    priceBucket: 'under15k',
  },
  {
    id: 'P04',
    name: 'Bebek Gober Bumbu Hitam',
    slug: 'bebek-gober-bumbu-hitam',
    type: 'makanan',
    categoryLabel: 'Bebek / Gurih',
    tasteTags: ['gurih'],
    isHalal: null,
    zone: 'Zone C',
    latitude: -6.92125,
    longitude: 107.60065,
    triggerRadiusM: 10,
    avgVisitMin: 25,
    description: 'Bebek goreng bumbu hitam Madura.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: 'P04-M1', name: 'Bebek Bumbu Hitam', priceIdr: 35000, tastes: ['gurih'], isSignature: true }],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr: 35000,
    priceMaxIdr: 35000,
    priceBucket: 'over30k',
  },
  {
    id: 'P09',
    name: 'Dapur Sotoku (Tutup)',
    slug: 'dapur-sotoku-tutup',
    type: 'makanan',
    categoryLabel: 'Soto / Gurih',
    tasteTags: ['gurih'],
    isHalal: null,
    zone: 'Zone E',
    latitude: -6.92092,
    longitude: 107.600575,
    triggerRadiusM: 10,
    avgVisitMin: 15,
    description: 'Tenant yang tutup saat jam tes.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: 'P09-M1', name: 'Soto Bandung', priceIdr: 25000, tastes: ['gurih'], isSignature: true }],
    openingHours: [{ day: 5, open: '21:00', close: '23:00' }], // Tutup sebelum jam 21:00
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    priceMinIdr: 25000,
    priceMaxIdr: 25000,
    priceBucket: '15to30k',
  },
];

const testTime = new Date('2026-11-06T18:00:00'); // Jumat pukul 18:00

describe('Kategori 1: Sifat Deterministik Rekomendasi (AC F07-4)', () => {
  it('input yang sama menghasilkan daftar rekomendasi, skor, dan urutan yang persis sama', () => {
    const params = {
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: ['P28'],
      lastVisitedTaste: 'pedas' as const,
      remainingBudget: 30000,
      referenceTime: testTime,
    };

    const run1 = getRecommendations(params);
    const run2 = getRecommendations(params);

    expect(run1).toEqual(run2);
    expect(run1.map((r) => r.poi.id)).toEqual(run2.map((r) => r.poi.id));
  });
});

describe('Kategori 2: Aturan Eksklusi Ketat (AC F07-1)', () => {
  it('tidak pernah memuat tenant yang berstatus tutup pada waktu rekomendasi diminta', () => {
    // P09 buka jam 21:00, jam tes 18:00 -> P09 TUTUP
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: [],
      referenceTime: testTime,
    });
    expect(results.some((r) => r.poi.id === 'P09')).toBe(false);
  });

  it('tidak pernah memuat tenant yang sudah dikunjungi (visitedPoiIds)', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: ['P28', 'P27'],
      referenceTime: testTime,
    });
    const ids = results.map((r) => r.poi.id);
    expect(ids).not.toContain('P28');
    expect(ids).not.toContain('P27');
  });

  it('tidak memuat activePoiId (tenant tempat pengguna baru saja berada)', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: [],
      activePoiId: 'P28',
      referenceTime: testTime,
    });
    expect(results.some((r) => r.poi.id === 'P28')).toBe(false);
  });
});

describe('Kategori 3: Aturan Pasangan Rasa & Rekomendasi Cerdas', () => {
  it('setelah makanan pedas (mis. Pempek Gochan), sistem memprioritaskan minuman segar (Rainbow Juice)', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: ['P28'], // Baru selesai makan pempek pedas di P28
      lastVisitedTaste: 'pedas',
      referenceTime: testTime,
    });

    expect(results.length).toBeGreaterThan(0);
    // P27 adalah minuman segar -> harus menduduki peringkat #1
    expect(results[0].poi.id).toBe('P27');
    expect(results[0].reason).toContain('pencuci mulut segar setelah makanan pedas');
  });

  it('memperhitungkan sisa budget dalam skoring dan memuatnya dalam alasan rekomendasi', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: [],
      remainingBudget: 15000,
      referenceTime: testTime,
    });

    // P01 (Rp5.000) dan P27 (Rp15.000) muat dalam budget Rp15.000, P04 (Rp35.000) melebihi
    const p01Res = results.find((r) => r.poi.id === 'P01');
    expect(p01Res?.reason).toContain('sesuai sisa budget');
  });

  it('setiap item rekomendasi selalu memuat string alasan yang jelas (AC F07-2)', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: [],
      referenceTime: testTime,
    });

    for (const item of results) {
      expect(item.reason).toBeDefined();
      expect(item.reason.length).toBeGreaterThan(5);
      expect(item.reason).toContain('dari sini');
    }
  });

  it('hanya mengembalikan maksimal 3 rekomendasi teratas (limit = 3)', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: [],
      referenceTime: testTime,
    });
    expect(results.length).toBeLessThanOrEqual(3);
  });
});

describe('Kategori 4: Edge Cases Rekomendasi', () => {
  it('mengembalikan array kosong [] jika semua tenant sudah dikunjungi', () => {
    const allIds = candidatePois.map((p) => p.id);
    const results = getRecommendations({
      userPosition: userPos,
      pois: candidatePois,
      visitedPoiIds: allIds,
      referenceTime: testTime,
    });
    expect(results).toEqual([]);
  });

  it('mengembalikan array kosong [] jika dataset POI kosong', () => {
    const results = getRecommendations({
      userPosition: userPos,
      pois: [],
      visitedPoiIds: [],
      referenceTime: testTime,
    });
    expect(results).toEqual([]);
  });
});
