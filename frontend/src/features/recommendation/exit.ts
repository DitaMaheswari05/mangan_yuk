// F07 / PB-13 – Rekomendasi saat exit event: setelah pengguna selesai di satu tenant, sarankan 3
// tenant berikutnya. Hasilnya disimpan supaya rekomendasi yang dihitung di background tetap bisa
// ditampilkan saat app dibuka dari notifikasi.

import { useCallback, useEffect, useState } from 'react';
import { AppState } from 'react-native';
import pairingsJson from '@/data/taste-pairings.json';
import { doneTrailSteps, remainingTrailBudget, type TrailSession } from '@/features/trail';
import type { LatLng } from '@/lib/geo';
import { load, save } from '@/storage';
import type { Poi, TastePairing, TasteTag } from '@/types/content';
import { getRecommendations } from './index';

export type ExitRecommendationItem = {
  poiId: string;
  poiName: string;
  distanceM: number;
  reason: string;
};

export type ExitRecommendation = {
  fromPoiId: string;
  fromPoiName: string;
  createdAt: number;
  items: ExitRecommendationItem[];
};

export type ExitRecommendationInput = {
  exitedPoi: Poi;
  position: LatLng;
  pois: Poi[];
  visitedPoiIds: Iterable<string>;
  trail: TrailSession | null;
  halalOnly: boolean;
  at: number;
  pairings?: TastePairing[];
};

const TASTE_PAIRINGS = pairingsJson as TastePairing[];

/** Rekomendasi kedaluwarsa setelah 15 menit karena posisi pengguna sudah berubah. */
export const EXIT_RECOMMENDATION_TTL_MS = 15 * 60_000;

/** Rasa yang dipakai untuk aturan pasangan: rasa pertama tenant yang punya aturan, kalau tidak ada rasa utamanya. */
export function pairingTasteOf(poi: Pick<Poi, 'tasteTags'>, pairings: TastePairing[]): TasteTag | null {
  const withRule = poi.tasteTags.find((t) => pairings.some((p) => p.afterTaste === t));
  return withRule ?? poi.tasteTags[0] ?? null;
}

export function buildExitRecommendation(input: ExitRecommendationInput): ExitRecommendation | null {
  const { exitedPoi, position, pois, trail, halalOnly, at, pairings = TASTE_PAIRINGS } = input;

  const visited = new Set(input.visitedPoiIds);
  visited.add(exitedPoi.id);
  if (trail) doneTrailSteps(trail).forEach((s) => visited.add(s.poi.id));

  const items = getRecommendations({
    userPosition: position,
    pois: halalOnly ? pois.filter((p) => p.isHalal === true) : pois,
    visitedPoiIds: visited,
    activePoiId: exitedPoi.id,
    lastVisitedTaste: pairingTasteOf(exitedPoi, pairings),
    remainingBudget: trail ? remainingTrailBudget(trail) : null,
    pairings,
    referenceTime: new Date(at),
  });
  if (items.length === 0) return null;

  return {
    fromPoiId: exitedPoi.id,
    fromPoiName: exitedPoi.name,
    createdAt: at,
    items: items.map((r) => ({
      poiId: r.poi.id,
      poiName: r.poi.name,
      distanceM: r.distanceM,
      reason: r.reason,
    })),
  };
}

const KEY = 'recommendation.exit.v1';
const listeners = new Set<(r: ExitRecommendation | null) => void>();

function emit(r: ExitRecommendation | null): void {
  listeners.forEach((l) => l(r));
}

export const ExitRecommendationStore = {
  async get(now: number = Date.now()): Promise<ExitRecommendation | null> {
    try {
      const r = await load<ExitRecommendation | null>(KEY, null);
      return r && now - r.createdAt <= EXIT_RECOMMENDATION_TTL_MS ? r : null;
    } catch {
      return null;
    }
  },

  async set(r: ExitRecommendation): Promise<void> {
    try {
      await save(KEY, r);
    } catch {
      // Tetap tampilkan di sesi ini walau gagal disimpan.
    }
    emit(r);
  },

  async clear(): Promise<void> {
    try {
      await save(KEY, null);
    } catch {
      // abaikan
    }
    emit(null);
  },

  subscribe(listener: (r: ExitRecommendation | null) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
};

/** Rekomendasi exit terbaru yang belum ditutup, ikut dimuat ulang saat app kembali ke foreground. */
export function useExitRecommendation(): { recommendation: ExitRecommendation | null; dismiss: () => void } {
  const [recommendation, setRecommendation] = useState<ExitRecommendation | null>(null);

  useEffect(() => {
    let active = true;
    const reload = () => {
      void ExitRecommendationStore.get().then((r) => active && setRecommendation(r));
    };
    reload();
    const unsub = ExitRecommendationStore.subscribe((r) => active && setRecommendation(r));
    const appSub = AppState.addEventListener('change', (s) => {
      if (s === 'active') reload();
    });
    return () => {
      active = false;
      unsub();
      appSub.remove();
    };
  }, []);

  const dismiss = useCallback(() => {
    void ExitRecommendationStore.clear();
  }, []);

  return { recommendation, dismiss };
}
