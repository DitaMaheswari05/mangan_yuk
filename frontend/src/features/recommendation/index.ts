// F07 / PB-13 – Rekomendasi kontekstual berbasis aturan (rule-based scoring).
import { isOpenAt } from '@/features/poi';
import { haversineM, type LatLng } from '@/lib/geo';
import type { Poi, TastePairing, TasteTag } from '@/types/content';

export type RecommendationItem = {
  poi: Poi;
  score: number;
  distanceM: number;
  reason: string;
};

export type RecommendationParams = {
  userPosition: LatLng;
  pois: Poi[];
  visitedPoiIds: Set<string> | string[];
  activePoiId?: string | null;
  lastVisitedTaste?: TasteTag | null;
  remainingBudget?: number | null;
  pairings?: TastePairing[];
  referenceTime?: Date;
  limit?: number;
};

export const DEFAULT_TASTE_PAIRINGS: TastePairing[] = [
  {
    afterTaste: 'pedas',
    suggestTaste: 'segar',
    suggestFoodType: 'minuman',
    reason: 'pencuci mulut segar setelah makanan pedas',
  },
  {
    afterTaste: 'gurih',
    suggestTaste: 'manis',
    suggestFoodType: 'jajanan',
    reason: 'pencuci mulut manis setelah makanan gurih',
  },
];

/**
 * Menghitung rekomendasi top 3 tenant yang relevan berdasarkan aturan deterministik.
 */
export function getRecommendations(params: RecommendationParams): RecommendationItem[] {
  const {
    userPosition,
    pois,
    visitedPoiIds,
    activePoiId,
    lastVisitedTaste,
    remainingBudget,
    pairings = DEFAULT_TASTE_PAIRINGS,
    referenceTime = new Date(),
    limit = 3,
  } = params;

  const visitedSet = visitedPoiIds instanceof Set ? visitedPoiIds : new Set(visitedPoiIds);

  // 1. Filter awal: tidak boleh tenant tutup, tidak boleh sudah dikunjungi, tidak boleh active POI
  const candidates = pois.filter((poi) => {
    if (activePoiId && poi.id === activePoiId) return false;
    if (visitedSet.has(poi.id)) return false;
    if (!isOpenAt(poi, referenceTime)) return false;
    return true;
  });

  if (candidates.length === 0) return [];

  // Cari pairing yang relevan dengan lastVisitedTaste
  const matchingPairing = lastVisitedTaste
    ? pairings.find((p) => p.afterTaste === lastVisitedTaste)
    : null;

  // 2. Skoring deterministik setiap kandidat
  const scoredItems: RecommendationItem[] = candidates.map((poi) => {
    const distanceM = Math.round(haversineM(userPosition, { latitude: poi.latitude, longitude: poi.longitude }));
    const reasons: string[] = [];

    // Jarak skor: bobot dasar (makin dekat makin tinggi nilainya)
    let score = Math.max(0, 100 - distanceM);
    reasons.push(`${distanceM} m dari sini`);

    // Budget check
    if (remainingBudget !== null && remainingBudget !== undefined && remainingBudget > 0) {
      if (poi.priceMinIdr <= remainingBudget) {
        score += 30;
        reasons.push('sesuai sisa budget');
      } else {
        score -= 20;
      }
    }

    // Aturan pasangan rasa
    if (matchingPairing) {
      let isPairingMatch = false;
      if (matchingPairing.suggestTaste && poi.tasteTags.includes(matchingPairing.suggestTaste)) {
        score += 40;
        isPairingMatch = true;
      }
      if (matchingPairing.suggestFoodType && poi.type === matchingPairing.suggestFoodType) {
        score += 25;
        isPairingMatch = true;
      }
      if (isPairingMatch) {
        reasons.push(matchingPairing.reason);
      }
    }

    return {
      poi,
      score,
      distanceM,
      reason: reasons.join(' · '),
    };
  });

  // 3. Urutkan deterministik: skor menurun, lalu jarak menaik, lalu ID asc
  scoredItems.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    if (a.distanceM !== b.distanceM) return a.distanceM - b.distanceM;
    return a.poi.id.localeCompare(b.poi.id);
  });

  return scoredItems.slice(0, limit);
}
