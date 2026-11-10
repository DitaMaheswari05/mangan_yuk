// ============================================================================
// Unit Test: 04-typo-tolerant-search-and-filter.test.ts
// Terkait: F05, PB-10, Pencarian Toleran Salah Ketik (Typo) & Multi-Filter
// ============================================================================

import {
  filterPois,
  fuzzyMatch,
  levenshteinDistance,
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

describe('Kategori 1: Kalkulasi Jarak Edit (Levenshtein Distance)', () => {
  it('menghitung distance 0 untuk kata yang identik', () => {
    expect(levenshteinDistance('pandu', 'pandu')).toBe(0);
    expect(levenshteinDistance('Soto', 'soto')).toBe(0); // case insensitive
  });

  it('menghitung distance untuk substitusi 1 karakter ("pndu" vs "pandu" = 1)', () => {
    expect(levenshteinDistance('pndu', 'pandu')).toBe(1);
  });

  it('menghitung distance jika salah satu string kosong', () => {
    expect(levenshteinDistance('', 'pempek')).toBe(6);
    expect(levenshteinDistance('soto', '')).toBe(4);
  });
});

describe('Kategori 2: Pencarian Toleran Salah Ketik (Fuzzy Match)', () => {
  it('menemukan "Pandu Baso Goreng Tenggiri" saat pengguna mencari "pandu" atau typo "pndu"', () => {
    const results = searchPois(samplePois, 'pndu');
    expect(results.length).toBeGreaterThan(0);
    expect(results[0].id).toBe('P13');
  });

  it('menemukan "Pandu Baso Goreng Tenggiri" saat mencari "batagr" via searchKeywords (AC F05)', () => {
    const results = searchPois(samplePois, 'batagr');
    expect(results.some((p) => p.id === 'P13')).toBe(true);
  });

  it('menemukan "Dapur Sotoku" saat mencari "soto"', () => {
    const results = searchPois(samplePois, 'soto');
    expect(results.some((p) => p.id === 'P09')).toBe(true);
  });

  it('mampu mencari berdasarkan nama menu item (misal "pisang" atau "gandasturi" memunculkan P01)', () => {
    const pisangRes = searchPois(samplePois, 'pisang');
    expect(pisangRes.some((p) => p.id === 'P01')).toBe(true);

    const gandaRes = searchPois(samplePois, 'gandasturi');
    expect(gandaRes.some((p) => p.id === 'P01')).toBe(true);
  });

  it('mampu mencari berdasarkan kategori atau tipe kuliner (misal "minuman" memunculkan Susu Mbok Darmi)', () => {
    const results = searchPois(samplePois, 'minuman');
    expect(results.some((p) => p.id === 'P22')).toBe(true);
  });

  it('mampu mencari berdasarkan searchKeywords yang terdaftar (misal "cuko" memunculkan Pempek Gochan)', () => {
    const results = searchPois(samplePois, 'cuko');
    expect(results.some((p) => p.id === 'P28')).toBe(true);
  });
});

describe('Kategori 3: Multi-Filter (Harga, Rasa, Tipe, Status Buka)', () => {
  it('memfilter berdasarkan priceBucket: under15k hanya menampilkan P01 (Gorengan Rp5rb) dan P22 (Susu Rp13rb)', () => {
    const filters: SearchFilters = { priceBucket: 'under15k' };
    const results = filterPois(samplePois, filters);
    expect(results.map((p) => p.id)).toEqual(['P01', 'P22']);
  });

  it('memfilter berdasarkan profil rasa (tasteTags: pedas) menghasilkan Pempek Gochan', () => {
    const filters: SearchFilters = { taste: 'pedas' };
    const results = filterPois(samplePois, filters);
    expect(results.map((p) => p.id)).toEqual(['P28']);
  });

  it('memfilter berdasarkan foodType: jajanan menghasilkan P13 dan P01', () => {
    const filters: SearchFilters = { foodType: 'jajanan' };
    const results = filterPois(samplePois, filters);
    expect(results.map((p) => p.id)).toEqual(['P13', 'P01']);
  });

  it('memfilter kombinasi multi-filter: jajanan + harga under15k', () => {
    const filters: SearchFilters = { foodType: 'jajanan', priceBucket: 'under15k' };
    const results = filterPois(samplePois, filters);
    expect(results.map((p) => p.id)).toEqual(['P01']); // Traditional Fried Food
  });

  it('memfilter berdasarkan status buka saat ini (openNow)', () => {
    // Jumat pukul 16:30 -> P13, P01, P09, P22 buka; P28 (buka 17:00) tutup
    const friday1630 = new Date('2026-11-06T16:30:00');
    const filters: SearchFilters = { openNow: true, referenceTime: friday1630 };
    const results = filterPois(samplePois, filters);
    expect(results.map((p) => p.id)).toEqual(['P13', 'P01', 'P09', 'P22']);
    expect(results.some((p) => p.id === 'P28')).toBe(false);
  });
});

describe('Kategori 4: Edge Cases Pencarian', () => {
  it('string pencarian kosong mengembalikan seluruh POI tanpa error', () => {
    expect(searchPois(samplePois, '')).toHaveLength(samplePois.length);
    expect(searchPois(samplePois, '   ')).toHaveLength(samplePois.length);
  });

  it('pencarian dengan karakter spesial atau tanda baca tidak memicu crash', () => {
    expect(searchPois(samplePois, '!@#$%^&*()')).toEqual([]);
    expect(searchPois(samplePois, 'soto!??')).toHaveLength(1);
  });

  it('pencarian case-insensitive: "PANDU" dan "pandu" memberikan hasil yang sama', () => {
    const lower = searchPois(samplePois, 'pandu');
    const upper = searchPois(samplePois, 'PANDU');
    expect(lower).toEqual(upper);
  });

  it('kata kunci yang sama sekali tidak relevan mengembalikan array kosong []', () => {
    expect(searchPois(samplePois, 'pizza burger spaghetti')).toEqual([]);
  });
});
