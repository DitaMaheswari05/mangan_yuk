import { applyFilters, searchPois } from '../index';
import type { Poi } from '@/types/content';

// Fixture POI dataset untuk pengujian pencarian dan filter
const TEST_POIS: Poi[] = [
  {
    id: 'P01',
    name: 'Raja Pukis Modern',
    slug: 'raja-pukis-modern',
    type: 'jajanan',
    categoryLabel: 'Jajanan / Manis',
    tasteTags: ['manis'],
    isHalal: true,
    zone: 'Zone Entrance',
    latitude: -6.9181,
    longitude: 107.6002,
    triggerRadiusM: 10,
    avgVisitMin: 10,
    description: 'Pukis aneka rasa modern',
    culturalStory: 'Kue pukis khas Indonesia',
    photos: [],
    audio: null,
    menu: [
      { id: 'M01', name: 'Pukis Cokelat Keju', priceIdr: 12000, tastes: ['manis'], isSignature: true },
      { id: 'M02', name: 'Pukis Pandan Wangi', priceIdr: 10000, tastes: ['manis'], isSignature: false },
    ],
    openingHours: [{ day: 1, open: '10:00', close: '22:00' }], // Buka Senin jam 10-22
    peakHours: [],
    searchKeywords: ['pukis', 'kue', 'manis'],
    qrCode: null,
    priceMinIdr: 10000,
    priceMaxIdr: 12000,
    priceBucket: 'under15k',
  },
  {
    id: 'P04',
    name: 'Dapur Sotoku',
    slug: 'dapur-sotoku',
    type: 'makanan',
    categoryLabel: 'Makanan Berkuah / Gurih',
    tasteTags: ['gurih', 'segar'],
    isHalal: true,
    zone: 'Zone Tengah B',
    latitude: -6.9184,
    longitude: 107.6007,
    triggerRadiusM: 10,
    avgVisitMin: 20,
    description: 'Soto ayam dan soto daging khas Bandung',
    culturalStory: 'Kuliner kuah tradisional',
    photos: [],
    audio: null,
    menu: [
      { id: 'M03', name: 'Soto Ayam Kuah Bening', priceIdr: 25000, tastes: ['gurih', 'segar'], isSignature: true },
      { id: 'M04', name: 'Soto Babat Santan', priceIdr: 32000, tastes: ['gurih'], isSignature: false },
    ],
    openingHours: [{ day: 1, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: ['soto', 'sop', 'kuah'],
    qrCode: null,
    priceMinIdr: 25000,
    priceMaxIdr: 32000,
    priceBucket: '15to30k',
  },
  {
    id: 'P05',
    name: 'Baso Goreng Pandu',
    slug: 'baso-goreng-pandu',
    type: 'jajanan',
    categoryLabel: 'Jajanan / Gurih',
    tasteTags: ['gurih'],
    isHalal: false,
    zone: 'Zone Lorong Utama',
    latitude: -6.9185,
    longitude: 107.6008,
    triggerRadiusM: 10,
    avgVisitMin: 15,
    description: 'Bakso goreng ikan tenggiri dan batagor renyah',
    culturalStory: 'Resep legendaris sejak 1980',
    photos: [],
    audio: null,
    menu: [
      { id: 'M05', name: 'Batagor Spesial Kuah Kacang', priceIdr: 20000, tastes: ['gurih', 'pedas'], isSignature: true },
      { id: 'M06', name: 'Baso Goreng Crispy', priceIdr: 10000, tastes: ['gurih'], isSignature: false },
    ],
    openingHours: [{ day: 1, open: '12:00', close: '21:00' }],
    peakHours: [],
    searchKeywords: ['batagor', 'siomay', 'baso goreng', 'bakso'],
    qrCode: null,
    priceMinIdr: 10000,
    priceMaxIdr: 20000,
    priceBucket: 'under15k',
  },
  {
    id: 'P02',
    name: 'King Crab Bandung',
    slug: 'king-crab-bandung',
    type: 'makanan',
    categoryLabel: 'Seafood / Pedas',
    tasteTags: ['pedas', 'gurih'],
    isHalal: true,
    zone: 'Zone Utama A',
    latitude: -6.9182,
    longitude: 107.6004,
    triggerRadiusM: 10,
    avgVisitMin: 40,
    description: 'Kepiting saus padang dan aneka seafood',
    culturalStory: 'Seafood fresh laut selatan',
    photos: [],
    audio: null,
    menu: [
      { id: 'M07', name: 'Kepiting Saus Padang Super', priceIdr: 120000, tastes: ['pedas'], isSignature: true },
    ],
    openingHours: [{ day: 1, open: '17:00', close: '23:30' }],
    peakHours: [],
    searchKeywords: ['kepiting', 'seafood', 'crab', 'udang'],
    qrCode: null,
    priceMinIdr: 120000,
    priceMaxIdr: 120000,
    priceBucket: 'over30k',
  },
];

describe('F05 Pencarian Toleran Typo (Fuse.js) & Filter Multi-Parameter (SB-3.3)', () => {
  describe('F05-AC1: Kecepatan dan Performa Offline', () => {
    it('hasil pencarian selesai dalam waktu ≤1 detik (offline)', () => {
      const res = searchPois(TEST_POIS, { query: 'batagor' });
      expect(res.executionTimeMs).toBeLessThanOrEqual(1000);
      expect(res.results.length).toBeGreaterThan(0);
    });
  });

  describe('F05-AC2: Toleransi Typo / Salah Ketik (Fuzzy Search)', () => {
    it('kata kunci "batagor" dan typo "batagr" sama-sama menampilkan tenant batagor', () => {
      const exactRes = searchPois(TEST_POIS, { query: 'batagor' });
      const typoRes = searchPois(TEST_POIS, { query: 'batagr' });

      // Keduanya harus menemukan Baso Goreng Pandu (karena ada menu Batagor dan keyword batagor)
      const exactNames = exactRes.results.map((r) => r.poi.id);
      const typoNames = typoRes.results.map((r) => r.poi.id);

      expect(exactNames).toContain('P05');
      expect(typoNames).toContain('P05');
    });

    it('pencarian menu spesifik: "kuah bening" menemukan Dapur Sotoku', () => {
      const res = searchPois(TEST_POIS, { query: 'kuah bening' });
      expect(res.results.length).toBeGreaterThan(0);
      expect(res.results[0].poi.id).toBe('P04');
      expect(res.results[0].matchedMenuNames).toContain('Soto Ayam Kuah Bening');
    });

    it('threshold 0.35 tidak memunculkan false positive (misal "soto" tidak memunculkan tenant lain secara acak)', () => {
      const res = searchPois(TEST_POIS, { query: 'soto' });
      const foundIds = res.results.map((r) => r.poi.id);

      // Hanya Dapur Sotoku yang muncul
      expect(foundIds).toContain('P04');
      expect(foundIds).not.toContain('P01'); // Pukis tidak boleh muncul
    });
  });

  describe('F05-AC3: Filter Multi-Parameter', () => {
    it('filter harga < Rp15.000 (under15k) hanya menampilkan tenant dengan harga termurah < 15rb', () => {
      const filtered = applyFilters(TEST_POIS, { priceBucket: 'under15k' });
      expect(filtered.map((p) => p.id)).toEqual(['P01', 'P05']);
      filtered.forEach((p) => {
        expect(p.priceBucket).toBe('under15k');
      });
    });

    it('filter rasa "pedas" menampilkan tenant yang memiliki rasa pedas di tenant atau menu', () => {
      const filtered = applyFilters(TEST_POIS, { taste: 'pedas' });
      const ids = filtered.map((p) => p.id);
      expect(ids).toContain('P02'); // King Crab (tasteTags: pedas)
      expect(ids).toContain('P05'); // Baso Pandu (menu: Batagor Spesial rasa pedas)
      expect(ids).not.toContain('P01'); // Pukis manis tidak boleh masuk
    });

    it('kombinasi filter: harga under15k DAN rasa gurih menghasilkan daftar yang sesuai deterministik', () => {
      const filtered = applyFilters(TEST_POIS, { priceBucket: 'under15k', taste: 'gurih' });
      const ids = filtered.map((p) => p.id);
      expect(ids).toEqual(['P05']); // Hanya Baso Goreng Pandu (under15k & gurih)
    });

    it('filter status buka saat ini (openNow)', () => {
      // Buat simulasi waktu: Senin jam 11:00 (P01 buka jam 10-22, P04 buka jam 16-23)
      const monday11Am = new Date('2026-11-09T11:00:00'); // Day 1 = Senin

      const openResults = applyFilters(TEST_POIS, { openNow: true, referenceDate: monday11Am });
      const openIds = openResults.map((p) => p.id);

      expect(openIds).toContain('P01');
      expect(openIds).not.toContain('P04'); // P04 belum buka jam 11 siang
    });
  });

  describe('Pengurutan Berdasarkan Jarak (Distance Sorting)', () => {
    it('menghitung jarak dan mengurutkan dari tenant terdekat jika koordinat pengguna diberikan', () => {
      // Posisi pengguna tepat di dekat P01 (-6.9181, 107.6002)
      const userLoc = { latitude: -6.9181, longitude: 107.6002 };

      const res = searchPois(TEST_POIS, { userCoordinate: userLoc, sortBy: 'distance' });

      expect(res.results[0].poi.id).toBe('P01');
      expect(res.results[0].distanceM).toBe(0);
      expect(res.results[res.results.length - 1].distanceM).toBeGreaterThan(0);
    });
  });
});
