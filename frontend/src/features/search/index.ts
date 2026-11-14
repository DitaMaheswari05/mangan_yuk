// F05 / PB10 – Mesin Pencari Lokal Toleran Typo (Fuse.js) & Filter Multi-Parameter (SB-3.3)
// Mendukung pencarian toleran salah ketik berdasarkan nama tenant (bobot 0.6),
// nama menu (bobot 0.4), kategori kuliner, dan kata kunci (threshold fuzziness 0.35).

import Fuse, { type IFuseOptions } from 'fuse.js';
import { haversineM } from '@/features/location';
import { getAllMenuItems, getPoiById, isOpenAt } from '@/features/poi';
import type { LatLng } from '@/lib/geo';
import type { DishCategory, FoodType, MenuItem, MenuPriceBucket, Poi, PriceBucket, TasteTag } from '@/types/content';

export const DEFAULT_FUSE_OPTIONS: IFuseOptions<Poi> = {
  keys: [
    { name: 'name', weight: 0.6 },
    { name: 'menu.name', weight: 0.4 },
    { name: 'categoryLabel', weight: 0.3 },
    { name: 'searchKeywords', weight: 0.3 },
    { name: 'tasteTags', weight: 0.2 },
    { name: 'type', weight: 0.2 },
  ],
  threshold: 0.35, // Diturunkan dari 0.6 agar tidak false positive (misal 'soto' -> 'roti')
  minMatchCharLength: 2,
  ignoreLocation: true, // Toleran lokasi substring dalam teks
  includeScore: true,
  includeMatches: true,
  shouldSort: true,
};

export type SearchFilters = {
  query?: string;
  priceBucket?: PriceBucket; // 'under15k' | '15to30k' | 'over30k'
  taste?: TasteTag; // 'pedas' | 'manis' | 'gurih' | 'segar' | 'aromatik'
  type?: FoodType; // 'makanan' | 'minuman' | 'jajanan'
  openNow?: boolean;
  referenceDate?: Date; // Untuk pengujian / simulasi waktu
  userCoordinate?: LatLng;
  sortBy?: 'relevance' | 'distance';
};

export type SearchResultItem = {
  poi: Poi;
  score?: number; // 0 = kecocokan sempurna, 1 = tidak cocok
  distanceM?: number;
  matchedFields?: string[];
  matchedMenuNames?: string[];
};

export type SearchResponse = {
  results: SearchResultItem[];
  total: number;
  executionTimeMs: number;
};

/**
 * Filter POI secara deterministik berdasarkan parameter harga, rasa, jenis makanan, dan jam buka.
 */
export function applyFilters(
  pois: Poi[],
  filters: Omit<SearchFilters, 'query' | 'userCoordinate' | 'sortBy'>,
): Poi[] {
  const { priceBucket, taste, type, openNow, referenceDate } = filters;
  const now = referenceDate ?? new Date();

  return pois.filter((poi) => {
    // 1. Filter Rentang Harga (under15k / 15to30k / over30k)
    if (priceBucket && poi.priceBucket !== priceBucket) {
      return false;
    }

    // 2. Filter Profil Rasa (dari tag tenant atau tag menu)
    if (taste) {
      const hasTenantTaste = poi.tasteTags.includes(taste);
      const hasMenuTaste = poi.menu.some((m) => m.tastes.includes(taste));
      if (!hasTenantTaste && !hasMenuTaste) {
        return false;
      }
    }

    // 3. Filter Jenis (makanan / minuman / jajanan)
    if (type && poi.type !== type) {
      return false;
    }

    // 4. Filter Status Buka Saat Ini
    if (openNow) {
      if (!isOpenAt(poi, now)) {
        return false;
      }
    }

    return true;
  });
}

/**
 * Eksekusi pencarian toleran typo (Fuse.js) dan filter multi-parameter.
 * Memenuhi kriteria performa F05-AC1 (offline, waktu respons ≤1 detik).
 */
export function searchPois(
  pois: Poi[],
  filters: SearchFilters = {},
  customFuseOptions?: IFuseOptions<Poi>,
): SearchResponse {
  const startTime = Date.now();
  const { query, userCoordinate, sortBy = 'relevance', ...filterOptions } = filters;

  const trimmedQuery = query?.trim();

  let matchedItems: Array<{
    poi: Poi;
    score?: number;
    matchedFields?: string[];
    matchedMenuNames?: string[];
  }> = [];

  if (!trimmedQuery) {
    // Jika tidak ada kata kunci pencarian, tampilkan semua yang lolos filter parameter
    matchedItems = pois.map((poi) => ({ poi }));
  } else {
    // Buat index Fuse.js untuk pencarian toleran salah ketik
    const fuse = new Fuse(pois, {
      ...DEFAULT_FUSE_OPTIONS,
      ...customFuseOptions,
    });

    const fuseResults = fuse.search(trimmedQuery);

    matchedItems = fuseResults.map((res) => {
      const matchedFields = new Set<string>();
      const matchedMenuNames = new Set<string>();

      res.matches?.forEach((m) => {
        if (m.key === 'name') matchedFields.add('Nama Tenant');
        if (m.key === 'categoryLabel') matchedFields.add('Kategori');
        if (m.key === 'tasteTags') matchedFields.add('Profil Rasa');
        if (m.key === 'searchKeywords') matchedFields.add('Kata Kunci');
        if (m.key === 'menu.name' && m.value) {
          matchedFields.add('Menu');
          matchedMenuNames.add(m.value);
        }
      });

      return {
        poi: res.item,
        score: res.score,
        matchedFields: Array.from(matchedFields),
        matchedMenuNames: Array.from(matchedMenuNames),
      };
    });
  }

  // Terapkan filter multi-parameter
  const filtered = matchedItems.filter((item) => {
    const passed = applyFilters([item.poi], filterOptions);
    return passed.length > 0;
  });

  // Hitung jarak jika userCoordinate tersedia
  const resultsWithDistance: SearchResultItem[] = filtered.map((item) => {
    let distanceM: number | undefined;
    if (userCoordinate) {
      distanceM = Math.round(
        haversineM(userCoordinate, {
          latitude: item.poi.latitude,
          longitude: item.poi.longitude,
        }),
      );
    }
    return {
      poi: item.poi,
      score: item.score,
      distanceM,
      matchedFields: item.matchedFields,
      matchedMenuNames: item.matchedMenuNames,
    };
  });

  // Pengurutan hasil
  if (sortBy === 'distance' && userCoordinate) {
    resultsWithDistance.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  } else if (!trimmedQuery && userCoordinate) {
    // Default jika tidak ada query: urutkan dari yang terdekat
    resultsWithDistance.sort((a, b) => (a.distanceM ?? Infinity) - (b.distanceM ?? Infinity));
  }

  const executionTimeMs = Math.max(1, Date.now() - startTime);

  return {
    results: resultsWithDistance,
    total: resultsWithDistance.length,
    executionTimeMs,
  };
}

// ── Filter per menu (F05) ────────────────────────────────────────────────────

export type MenuFilterOptions = {
  query?: string;
  tastes?: TasteTag[];
  type?: FoodType;
  dishCategory?: DishCategory;
  priceBucket?: MenuPriceBucket;
  isHalalOnly?: boolean;
};

export type MenuItemWithPoi = MenuItem & { poi?: Poi };

/**
 * Filter dan cari item menu berdasarkan rasa, jenis, jenis hidangan, halal, harga, dan nama.
 * Menyertakan POI (tenant) agar UI bisa langsung bernavigasi ke tenant saat menu diklik.
 */
export function filterMenuItems(options: MenuFilterOptions = {}): MenuItemWithPoi[] {
  const q = options.query?.toLowerCase().trim();
  return getAllMenuItems()
    .filter((item) => {
      if (q && !item.name.toLowerCase().includes(q)) return false;
      // Cocok jika menu punya minimal salah satu rasa yang dipilih.
      if (options.tastes?.length && !options.tastes.some((t) => item.tastes.includes(t))) return false;
      if (options.type && item.type !== options.type) return false;
      if (options.dishCategory && item.dishCategory !== options.dishCategory) return false;
      if (options.priceBucket && item.priceBucket !== options.priceBucket) return false;
      if (options.isHalalOnly && item.isHalal === false) return false;
      return true;
    })
    .map((item) => ({ ...item, poi: getPoiById(item.poiId) }));
}
