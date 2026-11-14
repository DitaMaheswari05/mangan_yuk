// Bentuk data konten yang dibundel di app (src/data/*.json).
// File JSON-nya di-generate oleh backend/scripts/export-content.ts dari skema Supabase v2
// (backend/supabase/migrations/20261104000000_schema_v2.sql). Ubah keduanya bersamaan.

import type { LatLng } from '@/lib/geo';

export const TASTE_TAGS = ['pedas', 'manis', 'gurih', 'segar', 'aromatik'] as const;
export const FOOD_TYPES = ['makanan', 'minuman', 'jajanan'] as const;
export const PHOTO_KINDS = ['food', 'tenant', 'ambience'] as const;

export type TasteTag = (typeof TASTE_TAGS)[number];
export type FoodType = (typeof FOOD_TYPES)[number];
export type PhotoKind = (typeof PHOTO_KINDS)[number];

/** Jam dalam format 'HH:mm' (24 jam). */
export type HHmm = string;

/** day: 0 = Minggu … 6 = Sabtu (sama dengan Date.getDay()). close < open berarti lewat tengah malam. */
export type TimeSlot = { day: number; open: HHmm; close: HHmm };

/** Jenis hidangan per menu (filter F05). Harus sama dengan enum dish_category di migration menu_filters. */
export const DISH_CATEGORIES = [
  'nasi',
  'mie',
  'kwetiau-bihun',
  'bubur',
  'soto-sup',
  'sate',
  'lauk',
  'pempek',
  'gorengan',
  'dimsum-bakpao',
  'roti-sandwich',
  'dessert',
  'kopi',
  'teh',
  'susu',
  'jus-es-buah',
  'alkohol',
  'minuman-lain',
  'pelengkap',
] as const;
export type DishCategory = (typeof DISH_CATEGORIES)[number];

/** Rentang harga per menu: murah < 25rb ≤ sedang < 50rb ≤ mahal < 100rb ≤ premium. Beda dari PriceBucket tenant. */
export type MenuPriceBucket = 'murah' | 'sedang' | 'mahal' | 'premium';

export type MenuItem = {
  id: string; // 'P01-M01'
  poiId: string; // tenant pemilik menu, untuk membuka detail tenant dari hasil filter
  name: string;
  priceIdr: number;
  priceBucket: MenuPriceBucket;
  tastes: TasteTag[];
  type: FoodType; // jenis per menu (Es Teh di tenant makanan = 'minuman')
  dishCategory: DishCategory;
  /** false = tidak halal (menu atau dapur tenant), null = belum diverifikasi. */
  isHalal: boolean | null;
  isSignature: boolean;
};

/** assetKey = '<bucket>/<path>', mis. 'poi-photos/P01/1.jpg'. */
export type PhotoRef = { assetKey: string; kind: PhotoKind; caption: string | null };
export type AudioRef = { assetKey: string; durationSec: number; transcript: string };

/** Satu POI persis seperti di pois.json (belum ada field turunan). */
export type PoiRecord = {
  id: string; // 'P01'
  name: string;
  slug: string;
  type: FoodType;
  categoryLabel: string;
  tasteTags: TasteTag[];
  isHalal: boolean | null; // null = belum diverifikasi
  zone: string;
  latitude: number;
  longitude: number;
  triggerRadiusM: number;
  avgVisitMin: number;
  description: string;
  culturalStory: string | null;
  photos: PhotoRef[];
  audio: AudioRef | null;
  menu: MenuItem[];
  openingHours: TimeSlot[];
  peakHours: TimeSlot[];
  searchKeywords: string[];
  qrCode: string | null;
};

/** Rentang harga filter F05, dihitung dari menu termurah. */
export type PriceBucket = 'under15k' | '15to30k' | 'over30k';

/** POI setelah load: PoiRecord + field turunan harga. */
export type Poi = PoiRecord & {
  priceMinIdr: number;
  priceMaxIdr: number;
  priceBucket: PriceBucket;
};

export type AreaConfig = {
  id: string;
  name: string;
  center: LatLng;
  entryRadiusM: number; // entry event F02
  exitHysteresisM: number; // keluar jika jarak > entryRadiusM + ini
  googleMapsQuery: string | null;
};

export type PoiDataset = { area: AreaConfig; pois: Poi[] };

export type TastePairing = {
  afterTaste: TasteTag;
  suggestTaste: TasteTag | null;
  suggestFoodType: FoodType | null;
  reason: string;
};

/** Trail tematik Paspor Kuliner (F10). */
export type Trail = {
  id: string;
  name: string;
  description: string;
  badgeName: string;
  badgeIcon: string | null;
  poiIds: string[];
};
