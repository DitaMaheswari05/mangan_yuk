// ============================================================================
// Unit Test: 02-poi-dataset-and-validator.test.ts
// Terkait: F03, PB-04, Aturan Validasi V1–V7, PB08, Price Buckets, Opening Hours
// ============================================================================

import areaJson from '@/data/area.json';
import poisJson from '@/data/pois.json';
import { isOpenAt, priceBucket, withDerivedPrice } from '@/features/poi';
import { validate } from '@/features/poi/validator';
import type { PoiRecord } from '@/types/content';

function makeValidPoi(idNumber: number, overrides: Partial<PoiRecord> = {}): PoiRecord {
  const id = `P${String(idNumber).padStart(2, '0')}`;
  return {
    id,
    name: `Tenant ${id}`,
    slug: `tenant-${idNumber}`,
    type: 'makanan',
    categoryLabel: 'Uji Coba / Gurih',
    tasteTags: ['gurih', 'pedas'],
    isHalal: true,
    zone: 'Zone A',
    latitude: areaJson.center.latitude + 0.0001 * idNumber,
    longitude: areaJson.center.longitude,
    triggerRadiusM: 15,
    avgVisitMin: 20,
    description: 'Deskripsi tenant untuk keperluan pengujian.',
    culturalStory: 'Cerita filosofi kuliner Sunda yang kaya makna.',
    photos: [
      { assetKey: `poi-photos/${id}/1.jpg`, kind: 'food', caption: 'Makanan' },
      { assetKey: `poi-photos/${id}/2.jpg`, kind: 'tenant', caption: 'Tenant' },
      { assetKey: `poi-photos/${id}/3.jpg`, kind: 'ambience', caption: 'Suasana' },
    ],
    audio: {
      assetKey: `poi-audio/${id}.mp3`,
      durationSec: 65,
      transcript: 'Transkrip audio narasi budaya.',
    },
    menu: [
      { id: `${id}-M01`, name: 'Nasi Goreng Spesial', priceIdr: 25000, tastes: ['gurih'], isSignature: true },
      { id: `${id}-M02`, name: 'Es Teh Manis', priceIdr: 5000, tastes: ['manis'], isSignature: false },
    ],
    openingHours: [
      { day: 0, open: '16:00', close: '23:00' },
      { day: 1, open: '16:00', close: '23:00' },
      { day: 2, open: '16:00', close: '23:00' },
      { day: 3, open: '16:00', close: '23:00' },
      { day: 4, open: '16:00', close: '23:00' },
      { day: 5, open: '16:00', close: '23:00' },
      { day: 6, open: '16:00', close: '23:00' },
    ],
    peakHours: [{ day: 6, open: '18:00', close: '21:00' }],
    searchKeywords: ['nasi', 'goreng', 'gurih'],
    qrCode: `QR-${id}`,
    ...overrides,
  };
}

function makeValidDataset(count = 10) {
  return {
    area: areaJson,
    pois: Array.from({ length: count }, (_, i) => makeValidPoi(i + 1)),
  };
}

describe('Kategori 1: Validasi Integritas Dataset Bundel (PB04 & V1–V7)', () => {
  it('dataset asli yang dibundel (pois.json & area.json) lolos seluruh validasi PB04', () => {
    const res = validate({ area: areaJson, pois: poisJson }, 'PB04');
    expect(res.valid).toBe(true);
    expect(res.errors).toEqual([]);
    expect(res.invalidPoiIds).toEqual([]);
  });

  it('V1: menolak dataset yang memiliki kurang dari batas minimal POI (< 10 POI)', () => {
    const dataset = makeValidDataset(9);
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('V1'))).toBe(true);
  });

  it('V2: menolak POI dengan format ID tidak valid (bukan P00)', () => {
    const dataset = makeValidDataset(10);
    dataset.pois[0].id = 'INVALID_ID';
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('V2 id harus berformat P00'))).toBe(true);
  });

  it('V2: menolak dataset yang memiliki ID POI atau ID Menu duplikat', () => {
    const dataset = makeValidDataset(10);
    dataset.pois[1].id = dataset.pois[0].id; // duplicate POI ID
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('V2 id duplikat'))).toBe(true);
  });

  it('V3: menolak POI dengan koordinat yang berada di luar batas toleransi kawasan', () => {
    const dataset = makeValidDataset(10);
    dataset.pois[0].latitude = -6.2; // jauh di Jakarta
    dataset.pois[0].longitude = 106.8;
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('V3'))).toBe(true);
  });

  it('V4: menolak POI dengan daftar menu kosong atau menu dengan harga <= 0', () => {
    const dataset = makeValidDataset(10);
    dataset.pois[0].menu = [];
    const resEmpty = validate(dataset, 'PB04');
    expect(resEmpty.valid).toBe(false);
    expect(resEmpty.errors.some((e) => e.includes('V4 menu kosong'))).toBe(true);

    const dataset2 = makeValidDataset(10);
    dataset2.pois[0].menu = [{ id: 'P01-M01', name: 'Free', priceIdr: 0, tastes: ['manis'], isSignature: true }];
    const resZero = validate(dataset2, 'PB04');
    expect(resZero.valid).toBe(false);
    expect(resZero.errors.some((e) => e.includes('priceIdr harus integer > 0'))).toBe(true);
  });

  it('V5: menolak jadwal buka dengan open == close atau format bukan HH:mm', () => {
    const dataset = makeValidDataset(10);
    dataset.pois[0].openingHours = [{ day: 1, open: '17:00', close: '17:00' }];
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('open sama dengan close'))).toBe(true);
  });

  it('V6: menolak rasa (tasteTags) dan tipe makanan (foodType) yang tidak dikenal', () => {
    const dataset = makeValidDataset(10);
    // @ts-expect-error test invalid enum
    dataset.pois[0].tasteTags = ['rasa_aneh'];
    // @ts-expect-error test invalid enum
    dataset.pois[0].type = 'tipe_aneh';
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('V6 tasteTag tidak dikenal'))).toBe(true);
    expect(res.errors.some((e) => e.includes('V6 type tidak dikenal'))).toBe(true);
  });

  it('V7: menolak POI dengan triggerRadiusM <= 0 atau avgVisitMin <= 0', () => {
    const dataset = makeValidDataset(10);
    dataset.pois[0].triggerRadiusM = 0;
    dataset.pois[0].avgVisitMin = -5;
    const res = validate(dataset, 'PB04');
    expect(res.valid).toBe(false);
    expect(res.errors.some((e) => e.includes('V7'))).toBe(true);
  });
});

describe('Kategori 2: Penentuan Rentang Harga (Price Buckets)', () => {
  it('mengelompokkan harga menu termurah < 15.000 sebagai under15k', () => {
    expect(priceBucket(0)).toBe('under15k');
    expect(priceBucket(5000)).toBe('under15k');
    expect(priceBucket(14999)).toBe('under15k');
  });

  it('mengelompokkan harga menu termurah 15.000 s.d. 30.000 sebagai 15to30k', () => {
    expect(priceBucket(15000)).toBe('15to30k');
    expect(priceBucket(22000)).toBe('15to30k');
    expect(priceBucket(30000)).toBe('15to30k');
  });

  it('mengelompokkan harga menu termurah > 30.000 sebagai over30k', () => {
    expect(priceBucket(30001)).toBe('over30k');
    expect(priceBucket(50000)).toBe('over30k');
  });

  it('withDerivedPrice menghitung priceMinIdr, priceMaxIdr, dan priceBucket dengan tepat', () => {
    const poiRecord = makeValidPoi(1, {
      menu: [
        { id: 'M1', name: 'Teh Botol', priceIdr: 6000, tastes: ['manis'], isSignature: false },
        { id: 'M2', name: 'Nasi Liwet', priceIdr: 35000, tastes: ['gurih'], isSignature: true },
      ],
    });
    const poi = withDerivedPrice(poiRecord);
    expect(poi.priceMinIdr).toBe(6000);
    expect(poi.priceMaxIdr).toBe(35000);
    expect(poi.priceBucket).toBe('under15k');
  });
});

describe('Kategori 3: Logika Jam Operasional (isOpenAt) Termasuk Lintas Tengah Malam', () => {
  const normalPoi = makeValidPoi(1, {
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }], // Jumat 16:00 - 23:00
  });

  it('mengembalikan true jika waktu berada di dalam rentang jam buka hari yang sama', () => {
    // 2026-11-06 adalah hari Jumat (day 5)
    const testDate = new Date('2026-11-06T18:30:00');
    expect(isOpenAt(normalPoi, testDate)).toBe(true);
  });

  it('mengembalikan false jika waktu berada di luar jam operasional (terlalu awal atau terlalu larut)', () => {
    const tooEarly = new Date('2026-11-06T12:00:00');
    const tooLate = new Date('2026-11-06T23:30:00');
    expect(isOpenAt(normalPoi, tooEarly)).toBe(false);
    expect(isOpenAt(normalPoi, tooLate)).toBe(false);
  });

  it('mengembalikan false jika hari tidak cocok (misal buka hanya Jumat, dites hari Sabtu)', () => {
    const saturday = new Date('2026-11-07T18:00:00'); // Sabtu
    expect(isOpenAt(normalPoi, saturday)).toBe(false);
  });

  it('mendukung jam operasional lintas tengah malam (misal Sabtu 17:00 hingga Minggu 02:00 pagi)', () => {
    const crossMidnightPoi = makeValidPoi(2, {
      openingHours: [{ day: 6, open: '17:00', close: '02:00' }], // Sabtu 17:00 -> Minggu 02:00
    });

    // 1. Dites Sabtu malam pukul 23:30 -> BUKA
    const saturdayNight = new Date('2026-11-07T23:30:00');
    expect(isOpenAt(crossMidnightPoi, saturdayNight)).toBe(true);

    // 2. Dites Minggu dini hari pukul 01:15 -> BUKA (efek cross-midnight slot hari sebelumnya)
    const sundayEarlyMorning = new Date('2026-11-08T01:15:00');
    expect(isOpenAt(crossMidnightPoi, sundayEarlyMorning)).toBe(true);

    // 3. Dites Minggu pagi pukul 04:00 -> TUTUP
    const sundayMorning = new Date('2026-11-08T04:00:00');
    expect(isOpenAt(crossMidnightPoi, sundayMorning)).toBe(false);
  });
});

describe('Kategori 4: PoiRepository (load, getAll, getById, getArea)', () => {
  const {
    __setSourceForTest,
    getAll,
    getArea,
    getById,
    load,
  } = require('@/features/poi');

  afterEach(() => {
    __setSourceForTest();
  });

  it('load mengembalikan dataset dengan validasi sukses', async () => {
    const res = await load();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.pois.length).toBeGreaterThanOrEqual(10);
      expect(res.data.area).toBeDefined();
    }
  });

  it('getAll mengembalikan seluruh daftar POI valid', async () => {
    const res = await getAll();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.length).toBeGreaterThanOrEqual(10);
      expect(res.data[0].priceBucket).toBeDefined();
    }
  });

  it('getById mengembalikan POI yang dicari jika ada, dan NOT_FOUND jika tidak ada', async () => {
    const found = await getById('P01');
    expect(found.ok).toBe(true);
    if (found.ok) {
      expect(found.data.id).toBe('P01');
    }

    const missing = await getById('P999_NON_EXISTENT');
    expect(missing).toEqual({
      ok: false,
      error: { code: 'NOT_FOUND', message: 'Tenant tidak ditemukan.' },
    });
  });

  it('getArea mengembalikan konfigurasi area kawasan Sudirman Street Food', async () => {
    const res = await getArea();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.name).toBe(areaJson.name);
      expect(res.data.entryRadiusM).toBe(areaJson.entryRadiusM);
    }
  });
});
