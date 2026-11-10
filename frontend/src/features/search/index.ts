// F05 / PB-10 – Pencarian POI toleran typo (fuzzy) & multi-filter.
import type { FoodType, Poi, PriceBucket, TasteTag } from '@/types/content';
import { isOpenAt } from '@/features/poi';

export type SearchFilters = {
  priceBucket?: PriceBucket;
  taste?: TasteTag;
  foodType?: FoodType;
  isHalal?: boolean | null;
  openNow?: boolean;
  referenceTime?: Date;
};

/**
 * Menghitung Levenshtein distance antara dua string.
 */
export function levenshteinDistance(a: string, b: string): number {
  const s1 = a.toLowerCase().trim();
  const s2 = b.toLowerCase().trim();

  if (s1 === s2) return 0;
  if (s1.length === 0) return s2.length;
  if (s2.length === 0) return s1.length;

  const row = Array.from({ length: s2.length + 1 }, (_, i) => i);

  for (let i = 1; i <= s1.length; i++) {
    let prev = i;
    for (let j = 1; j <= s2.length; j++) {
      let current = row[j - 1];
      if (s1[i - 1] !== s2[j - 1]) {
        current = Math.min(row[j - 1], prev, row[j]) + 1;
      }
      row[j - 1] = prev;
      prev = current;
    }
    row[s2.length] = prev;
  }

  return row[s2.length];
}

/**
 * Fuzzy matcher toleran typo.
 * True jika substring cocok, atau jarak Levenshtein relatif terhadap panjang kata <= maxRelativeError.
 */
export function fuzzyMatch(query: string, target: string, maxDistanceRatio: number = 0.35): boolean {
  const q = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();
  const t = target.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();

  if (!q) return true;
  if (!t) return false;
  if (t.includes(q)) return true;

  // Cek kecocokan per kata (token)
  const targetWords = t.split(/\s+/).filter(Boolean);
  for (const word of targetWords) {
    if (word.includes(q)) return true;
    const dist = levenshteinDistance(q, word);
    const maxAllowedDist = Math.max(1, Math.floor(Math.max(q.length, word.length) * maxDistanceRatio));
    if (dist <= maxAllowedDist) return true;
  }

  // Cek kecocokan kalimat penuh jika query terdiri dari beberapa kata
  if (q.includes(' ')) {
    const dist = levenshteinDistance(q, t);
    const maxAllowedDist = Math.max(1, Math.floor(Math.max(q.length, t.length) * maxDistanceRatio));
    if (dist <= maxAllowedDist) return true;
  }

  return false;
}

/**
 * Filter POI berdasarkan kriteria: harga, rasa, tipe makanan, kehalalan, dan status buka.
 */
export function filterPois(pois: Poi[], filters?: SearchFilters): Poi[] {
  if (!filters) return pois;

  const now = filters.referenceTime ?? new Date();

  return pois.filter((poi) => {
    if (filters.priceBucket && poi.priceBucket !== filters.priceBucket) {
      return false;
    }
    if (filters.taste && !poi.tasteTags.includes(filters.taste)) {
      return false;
    }
    if (filters.foodType && poi.type !== filters.foodType) {
      return false;
    }
    if (filters.isHalal !== undefined && filters.isHalal !== null && poi.isHalal !== filters.isHalal) {
      return false;
    }
    if (filters.openNow && !isOpenAt(poi, now)) {
      return false;
    }
    return true;
  });
}

/**
 * Mencari POI dengan toleransi typo dan multi-filter.
 * Mencocokkan: nama tenant, nama menu, kategori, tasteTags, dan searchKeywords.
 */
export function searchPois(pois: Poi[], query: string, filters?: SearchFilters): Poi[] {
  const filtered = filterPois(pois, filters);
  const rawQ = query.trim();

  // Jika input hanya whitespace atau kosong, kembalikan semua
  if (!rawQ) return filtered;

  // Bersihkan tanda baca
  const q = rawQ.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').trim();

  // Jika query hanya berisi tanda baca atau simbol tanpa huruf/angka, tidak ada hasil yang cocok
  if (!q) return [];

  return filtered.filter((poi) => {
    // 1. Nama tenant
    if (fuzzyMatch(q, poi.name)) return true;

    // 2. Kategori label & tipe
    if (fuzzyMatch(q, poi.categoryLabel) || fuzzyMatch(q, poi.type)) return true;

    // 3. Kata kunci rasa
    if (poi.tasteTags.some((tag) => fuzzyMatch(q, tag))) return true;

    // 4. Menu items
    if (poi.menu.some((item) => fuzzyMatch(q, item.name))) return true;

    // 5. Search keywords tambahan
    if (poi.searchKeywords.some((kw) => fuzzyMatch(q, kw))) return true;

    return false;
  });
}
