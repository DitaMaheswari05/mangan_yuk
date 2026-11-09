// Tipe konten hasil `npm run export` (backend/scripts/export-content.ts) → src/data/*.json.
// Nilai enum harus sama dengan enum di backend/supabase/migrations.

export type TasteTag = 'pedas' | 'manis' | 'gurih' | 'segar' | 'aromatik';
export type FoodType = 'makanan' | 'minuman' | 'jajanan';
export type DishCategory =
  | 'nasi'
  | 'mie'
  | 'kwetiau-bihun'
  | 'bubur'
  | 'soto-sup'
  | 'sate'
  | 'lauk'
  | 'pempek'
  | 'gorengan'
  | 'dimsum-bakpao'
  | 'roti-sandwich'
  | 'dessert'
  | 'kopi'
  | 'teh'
  | 'susu'
  | 'jus-es-buah'
  | 'alkohol'
  | 'minuman-lain'
  | 'pelengkap';

/** Rentang harga per menu: murah < 25rb ≤ sedang < 50rb ≤ mahal < 100rb ≤ premium. */
export type PriceBucket = 'murah' | 'sedang' | 'mahal' | 'premium';

export type MenuItem = {
  id: string; // 'P01-M01'
  poiId: string; // tenant pemilik menu, untuk membuka detail tenant dari hasil filter
  name: string;
  priceIdr: number;
  priceBucket: PriceBucket;
  tasteTags: TasteTag[];
  type: FoodType;
  dishCategory: DishCategory;
  /** false = tidak halal (menu atau dapur tenant), null = belum diverifikasi. */
  isHalal: boolean | null;
  isSignature: boolean;
};

export type Poi = {
  id: string;
  name: string;
  slug: string;
  type: FoodType;
  categoryLabel: string;
  tasteTags: TasteTag[];
  isHalal: boolean | null;
  zone: string;
  description: string;
  latitude: number;
  longitude: number;
  triggerRadiusM: number;
  avgVisitMin: number;
  searchKeywords: string[];
  menu: MenuItem[];
  photos: string[];
  audio: string | null;
  audioDurationSec: number | null;
};

export type Trail = {
  id: string;
  name: string;
  description: string;
  poiIds: string[];
};
