// F08 / PB-14 & PB-15 – Smart Culinary Trail Planner (Nearest Neighbor Heuristic) & Dwell Monitor.
import { haversineM, type LatLng } from '@/lib/geo';
import type { Poi, TasteTag } from '@/types/content';

export type TrailPlanParams = {
  userPosition: LatLng;
  pois: Poi[];
  durationMin: number; // 30, 60, atau 90 menit
  budget: number;
  preferredTastes?: TasteTag[];
};

export type TrailStep = {
  stepNumber: number;
  poi: Poi;
  distanceFromPreviousM: number;
  estimatedWalkingMin: number;
  allocatedVisitMin: number;
  estimatedCostIdr: number;
};

export type TrailPlanResult = {
  steps: TrailStep[];
  totalEstimatedCostIdr: number;
  totalEstimatedMin: number;
  isValid: boolean;
  message?: string;
};

// Asumsi rata-rata kecepatan jalan kaki santai di pasar kuliner: ~1 m/s (60 meter per menit)
const WALKING_METERS_PER_MIN = 60;

/**
 * Menyusun rute kuliner optimal menggunakan heuristik Nearest Neighbor.
 * Memastikan rute tidak bolak-balik, total biaya <= budget, dan total waktu <= durasi.
 */
export function planTrail(params: TrailPlanParams): TrailPlanResult {
  const { userPosition, pois, durationMin, budget, preferredTastes = [] } = params;

  if (durationMin <= 0 || budget <= 0) {
    return {
      steps: [],
      totalEstimatedCostIdr: 0,
      totalEstimatedMin: 0,
      isValid: false,
      message: 'Durasi dan budget harus lebih besar dari 0.',
    };
  }

  // Jam buka tidak membatasi rute: tenant yang tutup tetap boleh direncanakan.
  const availablePois = pois.filter((p) => p.priceMinIdr <= budget);

  if (availablePois.length === 0) {
    return {
      steps: [],
      totalEstimatedCostIdr: 0,
      totalEstimatedMin: 0,
      isValid: false,
      message: 'Tidak ada tenant yang sesuai dengan batas budget.',
    };
  }

  const selectedSteps: TrailStep[] = [];
  const visitedIds = new Set<string>();

  // Cek apakah posisi awal pengguna berada di luar kawasan kuliner (> 300m dari seluruh tenant).
  // Misalnya pengguna sedang merencanakan rute dari rumah / luar kawasan Sudirman Street Food.
  // Gunakan titik tengah tenant sebagai titik awal kalkulasi agar jarak tempuh dari luar kawasan
  // tidak menghabiskan kuota durasi eksplorasi kuliner di dalam kawasan.
  const isFarFromPois = availablePois.every(
    (p) => haversineM(userPosition, { latitude: p.latitude, longitude: p.longitude }) > 300
  );

  let currentPosition: LatLng;
  if (isFarFromPois) {
    const avgLat = availablePois.reduce((sum, p) => sum + p.latitude, 0) / availablePois.length;
    const avgLng = availablePois.reduce((sum, p) => sum + p.longitude, 0) / availablePois.length;
    currentPosition = { latitude: avgLat, longitude: avgLng };
  } else {
    currentPosition = userPosition;
  }

  let remainingBudget = budget;
  let remainingMin = durationMin;
  let totalCost = 0;
  let totalTime = 0;

  // Lanjutkan memilih tenant terdekat berikutnya selama waktu dan budget masih mencukupi
  while (true) {
    let bestPoi: Poi | null = null;
    let minDistance = Infinity;
    let bestEstimatedWalkMin = 0;

    for (const poi of availablePois) {
      if (visitedIds.has(poi.id)) continue;
      if (poi.priceMinIdr > remainingBudget) continue;

      const dist = haversineM(currentPosition, { latitude: poi.latitude, longitude: poi.longitude });
      const walkMin = Math.ceil(dist / WALKING_METERS_PER_MIN);
      const neededTime = walkMin + poi.avgVisitMin;

      if (neededTime > remainingMin) continue;

      // Berikan prioritas pada tenant yang memiliki rasa preferensi
      const hasPreferredTaste = preferredTastes.some((t) => poi.tasteTags.includes(t));
      const effectiveDist = hasPreferredTaste ? dist * 0.7 : dist;

      if (effectiveDist < minDistance) {
        minDistance = effectiveDist;
        bestPoi = poi;
        bestEstimatedWalkMin = walkMin;
      }
    }

    if (!bestPoi) break; // Tidak ada lagi tenant yang muat dalam sisa waktu & budget

    const stepCost = bestPoi.priceMinIdr;
    const stepTime = bestEstimatedWalkMin + bestPoi.avgVisitMin;

    visitedIds.add(bestPoi.id);
    selectedSteps.push({
      stepNumber: selectedSteps.length + 1,
      poi: bestPoi,
      distanceFromPreviousM: Math.round(haversineM(currentPosition, { latitude: bestPoi.latitude, longitude: bestPoi.longitude })),
      estimatedWalkingMin: bestEstimatedWalkMin,
      allocatedVisitMin: bestPoi.avgVisitMin,
      estimatedCostIdr: stepCost,
    });

    totalCost += stepCost;
    totalTime += stepTime;
    remainingBudget -= stepCost;
    remainingMin -= stepTime;
    currentPosition = { latitude: bestPoi.latitude, longitude: bestPoi.longitude };

    // Maksimal 5 tenant per trail agar realistis
    if (selectedSteps.length >= 5) break;
  }

  return {
    steps: selectedSteps,
    totalEstimatedCostIdr: totalCost,
    totalEstimatedMin: totalTime,
    isValid: selectedSteps.length > 0,
    message: selectedSteps.length === 0 ? 'Waktu atau budget tidak mencukupi untuk minimal 1 kunjungan.' : undefined,
  };
}

/**
 * Memeriksa apakah pengguna berdiam di tenant melebihi alokasi waktu + toleransi (default 5 menit).
 * Sesuai SB-4.3 & PRD F08.
 */
export function checkDwellAlert(
  dwellingDurationMs: number,
  allocatedVisitMin: number,
  gracePeriodMin: number = 5,
): boolean {
  const allowedMs = (allocatedVisitMin + gracePeriodMin) * 60_000;
  return dwellingDurationMs > allowedMs;
}
