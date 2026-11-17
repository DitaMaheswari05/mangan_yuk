// ============================================================================
// Unit Test: 04-typo-tolerant-search-and-filter.test.ts
// Terkait: F05, PB-10, Pencarian Toleran Salah Ketik (Typo) & Multi-Filter
// ============================================================================

import {
  applyFilters,
  DEFAULT_FUSE_OPTIONS,
  searchPois,
  type SearchFilters,
} from '@/features/search';
import type { Poi } from '@/types/content';

// Menggunakan data tenant riil Sudirman Street Food (sesuai pois.json):
const samplePois: Poi[] = [
  {
    id: 'P13',
    name: 'Pandu Baso Goreng Tenggiri',
    slug: 'pandu-baso-goreng-tenggiri',
    type: 'jajanan',
    categoryLabel: 'Jajanan / Gurih',
    tasteTags: ['gurih'],
    isHalal: null,
    zone: 'Zone B',
    latitude: -6.92089,
    longitude: 107.600574,
    triggerRadiusM: 10,
    avgVisitMin: 10,
    description: 'Baso goreng tenggiri gurih dan renyah khas Bandung.',
    culturalStory: 'Baso goreng tenggiri legendaris di Sudirman.',
    photos: [],
    audio: null,
    menu: [
      { id: 'P13-M01', name: 'Baso Goreng Siap Santap (4 Pcs)', priceIdr: 36000, tastes: ['gurih'], isSignature: true },
      { id: 'P13-M02', name: 'Baso Goreng Siap Santap (6 Pcs)', priceIdr: 54000, tastes: ['gurih'], isSignature: false },
    ],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: ['baso', 'bakso', 'goreng', 'tenggiri', 'batagor'],
    qrCode: null,
    priceMinIdr: 36000,
    priceMaxIdr: 54000,
    priceBucket: 'over30k',
  },
  {
    id: 'P01',
    name: 'Traditional Fried Food from West Borneo',
    slug: 'traditional-fried-food-from-west-borneo',
    type: 'jajanan',
    categoryLabel: 'Gorengan / Gurih',
    tasteTags: ['gurih'],
    isHalal: null,
    zone: 'Zone A',
    latitude: -6.921332,
    longitude: 107.60065,
    triggerRadiusM: 10,
    avgVisitMin: 10,
    description: 'Aneka pisang goreng dan gorengan Pontianak.',
    culturalStory: 'Gorengan manis khas Pontianak.',
    photos: [],
    audio: null,
    menu: [
      { id: 'P01-M01', name: 'Pisang Goreng Kipas Khas Pontianak', priceIdr: 5000, tastes: ['manis'], isSignature: true },
      { id: 'P01-M02', name: 'Pisang Tanduk Madu', priceIdr: 5000, tastes: ['manis'], isSignature: false },
      { id: 'P01-M03', name: 'Gandasturi / Gandas Kacang Hijau', priceIdr: 5000, tastes: ['manis'], isSignature: false },
    ],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: ['pisang', 'goreng', 'pontianak', 'gandasturi'],
    qrCode: null,
    priceMinIdr: 5000,
    priceMaxIdr: 5000,
    priceBucket: 'under15k',
  },
  {
    id: 'P09',
    name: 'Dapur Sotoku',
    slug: 'dapur-sotoku',
    type: 'makanan',
    categoryLabel: 'Makanan Berkuah / Gurih',
    tasteTags: ['gurih'],
    isHalal: null,
    zone: 'Zone A',
    latitude: -6.9212,
    longitude: 107.6007,
    triggerRadiusM: 10,
    avgVisitMin: 20,
    description: 'Soto Bandung hangat kuah bening dengan lobak dan kacang kedelai.',
    culturalStory: 'Soto Bandung khas Sunda.',
    photos: [],
    audio: null,
    menu: [
      { id: 'P09-M01', name: 'Soto Bandung', priceIdr: 25000, tastes: ['gurih'], isSignature: true },
      { id: 'P09-M02', name: 'Soto Lamongan', priceIdr: 25000, tastes: ['gurih'], isSignature: false },
    ],
    openingHours: [{ day: 5, open: '16:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: ['soto', 'bandung', 'kuah', 'lobak'],
    qrCode: null,
    priceMinIdr: 25000,
    priceMaxIdr: 25000,
    priceBucket: '15to30k',
  },
  {
    id: 'P22',
    name: 'Susu Mbok Darmi',
    slug: 'susu-mbok-darmi',
    type: 'minuman',
    categoryLabel: 'Minuman / Manis',
    tasteTags: ['manis'],
    isHalal: null,
    zone: 'Zone C',
    latitude: -6.9214,
    longitude: 107.6008,
    triggerRadiusM: 10,
    avgVisitMin: 10,
    description: 'Susu murni aneka rasa manis segar.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [
      { id: 'P22-M01', name: 'Darmi Lychee', priceIdr: 13000, tastes: ['manis'], isSignature: true },
      { id: 'P22-M02', name: 'Darmi Greentea', priceIdr: 15000, tastes: ['manis'], isSignature: false },
    ],
    openingHours: [{ day: 5, open: '15:00', close: '22:00' }],
    peakHours: [],
    searchKeywords: ['susu', 'mbok', 'darmi', 'minuman'],
    qrCode: null,
    priceMinIdr: 13000,
    priceMaxIdr: 15000,
    priceBucket: 'under15k',
  },
  {
    id: 'P28',
    name: 'Pempek Gochan',
    slug: 'pempek-gochan',
    type: 'makanan',
    categoryLabel: 'Pempek / Gurih-Pedas',
    tasteTags: ['gurih', 'pedas'],
    isHalal: null,
    zone: 'Zone D',
    latitude: -6.9215,
    longitude: 107.60085,
    triggerRadiusM: 10,
    avgVisitMin: 20,
    description: 'Pempek Palembang asli dengan kuah cuko pedas mantap.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [
      { id: 'P28-M01', name: 'Paket A (3 Kapal Selam Besar)', priceIdr: 30000, tastes: ['gurih', 'pedas'], isSignature: true },
    ],
    openingHours: [{ day: 5, open: '17:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: ['pempek', 'palembang', 'cuko', 'pedas'],
    qrCode: null,
    priceMinIdr: 30000,
    priceMaxIdr: 30000,
    priceBucket: '15to30k',
  },
];

// Helper: pencarian via mesin Fuse.js milik aplikasi, dikembalikan sebagai daftar POI.
const search = (query: string): Poi[] =>
  searchPois(samplePois, { query }).results.map((r) => r.poi);
const filterPois = (filters: SearchFilters): Poi[] => applyFilters(samplePois, filters);

describe('Kategori 1: Konfigurasi Fuzzy Matching (Fuse.js)', () => {
  it('ambang toleransi typo 0.35 (cukup longgar untuk typo, tidak false positive)', () => {
    expect(DEFAULT_FUSE_OPTIONS.threshold).toBe(0.35);
  });

  it('nama tenant berbobot tertinggi, diikuti nama menu', () => {
    const keys = DEFAULT_FUSE_OPTIONS.keys as { name: string; weight: number }[];
    const weight = (name: string) => keys.find((k) => k.name === name)?.weight ?? 0;
    expect(weight('name')).toBe(0.6);
    expect(weight('menu.name')).toBe(0.4);
    expect(Math.max(...keys.map((k) => k.weight))).toBe(weight('name'));
  });
});

describe('Kategori 2: Pencarian Toleran Salah Ketik (Fuzzy Match)', () => {
  it('menemukan "Pandu Baso Goreng Tenggiri" saat pengguna mencari "pandu" atau typo "pndu"', () => {
    expect(search('pandu')[0].id).toBe('P13');
    // Typo tetap ditemukan; urutan pada fixture kecil ini bisa bersaing tipis dengan kecocokan menu.
    expect(search('pndu').some((p) => p.id === 'P13')).toBe(true);
  });

  it('menemukan "Pandu Baso Goreng Tenggiri" saat mencari "batagr" via searchKeywords (AC F05)', () => {
    expect(search('batagr').some((p) => p.id === 'P13')).toBe(true);
  });

  it('menemukan "Dapur Sotoku" saat mencari "soto"', () => {
    expect(search('soto').some((p) => p.id === 'P09')).toBe(true);
  });

  it('mampu mencari berdasarkan nama menu item (misal "pisang" atau "gandasturi" memunculkan P01)', () => {
    expect(search('pisang').some((p) => p.id === 'P01')).toBe(true);
    expect(search('gandasturi').some((p) => p.id === 'P01')).toBe(true);
  });

  it('mampu mencari berdasarkan kategori atau tipe kuliner (misal "minuman" memunculkan Susu Mbok Darmi)', () => {
    expect(search('minuman').some((p) => p.id === 'P22')).toBe(true);
  });

  it('mampu mencari berdasarkan searchKeywords yang terdaftar (misal "cuko" memunculkan Pempek Gochan)', () => {
    expect(search('cuko').some((p) => p.id === 'P28')).toBe(true);
  });
});

describe('Kategori 3: Multi-Filter (Harga, Rasa, Tipe, Status Buka)', () => {
  it('memfilter berdasarkan priceBucket: under15k hanya menampilkan P01 (Gorengan Rp5rb) dan P22 (Susu Rp13rb)', () => {
    expect(filterPois({ priceBucket: 'under15k' }).map((p) => p.id)).toEqual(['P01', 'P22']);
  });

  it('memfilter berdasarkan profil rasa (tasteTags: pedas) menghasilkan Pempek Gochan', () => {
    expect(filterPois({ taste: 'pedas' }).map((p) => p.id)).toEqual(['P28']);
  });

  it('memfilter berdasarkan jenis (type): jajanan menghasilkan P13 dan P01', () => {
    expect(filterPois({ type: 'jajanan' }).map((p) => p.id)).toEqual(['P13', 'P01']);
  });

  it('memfilter kombinasi multi-filter: jajanan + harga under15k', () => {
    expect(filterPois({ type: 'jajanan', priceBucket: 'under15k' }).map((p) => p.id)).toEqual(['P01']); // Traditional Fried Food
  });

  it('memfilter berdasarkan status buka saat ini (openNow)', () => {
    // Jumat pukul 16:30 -> P13, P01, P09, P22 buka; P28 (buka 17:00) tutup
    const friday1630 = new Date('2026-11-06T16:30:00');
    const results = filterPois({ openNow: true, referenceDate: friday1630 });
    expect(results.map((p) => p.id)).toEqual(['P13', 'P01', 'P09', 'P22']);
    expect(results.some((p) => p.id === 'P28')).toBe(false);
  });

  it('filter dan kata kunci digabung dalam satu pemanggilan searchPois', () => {
    const results = searchPois(samplePois, { query: 'soto', type: 'minuman' }).results;
    expect(results).toEqual([]);
  });
});

describe('Kategori 4: Edge Cases Pencarian', () => {
  it('string pencarian kosong mengembalikan seluruh POI tanpa error', () => {
    expect(search('')).toHaveLength(samplePois.length);
    expect(search('   ')).toHaveLength(samplePois.length);
  });

  it('pencarian dengan karakter spesial atau tanda baca tidak memicu crash', () => {
    expect(search('!@#$%^&*()')).toEqual([]);
    expect(search('soto!??').some((p) => p.id === 'P09')).toBe(true);
  });

  it('pencarian case-insensitive: "PANDU" dan "pandu" memberikan hasil yang sama', () => {
    expect(search('pandu').map((p) => p.id)).toEqual(search('PANDU').map((p) => p.id));
  });

  it('kata kunci yang sama sekali tidak relevan mengembalikan array kosong []', () => {
    expect(search('pizza burger spaghetti')).toEqual([]);
  });
});
