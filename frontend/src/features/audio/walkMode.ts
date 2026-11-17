// F04 – Mode Jalan (Walk Mode) Service
// Mengatur pemutaran audio otomatis saat proximity trigger terjadi tanpa interaksi manual.
// Acceptance Criteria F04-2: "Dalam Mode Jalan, narasi mulai ≤3 detik setelah trigger."

import { useEffect, useState } from 'react';
import type { Poi } from '@/types/content';
import { load, save } from '@/storage';
import { AudioQueue } from './queue';
import { speakProximityPrompt } from './tts';

export const WALK_MODE_STORAGE_KEY = 'manganyuk.walk_mode.v1';

let walkModeEnabled = false;
let hydrated: Promise<void> | null = null;
const listeners = new Set<(enabled: boolean) => void>();

function notify(): void {
  listeners.forEach((l) => {
    try {
      l(walkModeEnabled);
    } catch {
      // abaikan
    }
  });
}

/**
 * Memuat state Mode Jalan dari penyimpanan lokal AsyncStorage.
 */
export async function hydrateWalkMode(): Promise<boolean> {
  hydrated ??= load<boolean>(WALK_MODE_STORAGE_KEY, false)
    .then((val) => {
      walkModeEnabled = Boolean(val);
    })
    .catch(() => {
      walkModeEnabled = false;
    });
  await hydrated;
  return walkModeEnabled;
}

/**
 * Mengecek apakah Mode Jalan sedang aktif secara sinkron (dari cache memori).
 */
export function isWalkModeActiveSync(): boolean {
  return walkModeEnabled;
}

/**
 * Mengecek apakah Mode Jalan aktif (memastikan tersinkronisasi dengan storage).
 */
export async function isWalkModeActive(): Promise<boolean> {
  await hydrateWalkMode();
  return walkModeEnabled;
}

/**
 * Mengaktifkan atau mematikan Mode Jalan dan menyimpannya ke storage.
 */
export async function setWalkModeActive(enabled: boolean): Promise<void> {
  walkModeEnabled = enabled;
  notify();
  try {
    await save(WALK_MODE_STORAGE_KEY, enabled);
  } catch {
    // abaikan kegagalan persist
  }
}

/**
 * Toggle status Mode Jalan.
 */
export async function toggleWalkMode(): Promise<boolean> {
  const next = !walkModeEnabled;
  await setWalkModeActive(next);
  return next;
}

/**
 * Menangani respon audio saat proximity trigger terjadi:
 * - Jika Mode Jalan AKTIF: langsung memutar narasi POI (≤3 detik) tanpa prompt manual.
 * - Jika Mode Jalan NONAKTIF: memutar prompt suara eyes-free "Kamu mendekati X. Mau dengar ceritanya?".
 */
export async function handleProximityAudioTrigger(
  poi: Poi,
): Promise<{ autoPlayed: boolean }> {
  await hydrateWalkMode();

  if (walkModeEnabled) {
    // Mode Jalan: langsung putar narasi POI otomatis lewat antrean audio prioritas tinggi
    await AudioQueue.enqueue({
      id: `narration-${poi.id}-${Date.now()}`,
      type: 'narration',
      title: poi.name,
      priority: 'high',
      poi,
    });
    return { autoPlayed: true };
  }

  // Mode Normal: putar prompt suara eyes-free
  try {
    await speakProximityPrompt(poi.name);
  } catch {
    // abaikan jika speech gagal
  }

  return { autoPlayed: false };
}

/**
 * React hook untuk mengamati dan mengontrol Mode Jalan di komponen UI.
 */
export function useWalkMode() {
  const [active, setActive] = useState(walkModeEnabled);

  useEffect(() => {
    void hydrateWalkMode().then((val) => setActive(val));
    const listener = (val: boolean) => setActive(val);
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  }, []);

  return {
    walkModeActive: active,
    toggleWalkMode: () => toggleWalkMode(),
    setWalkMode: (val: boolean) => setWalkModeActive(val),
  };
}

export const WalkModeService = {
  isWalkModeActiveSync,
  isWalkModeActive,
  setWalkModeActive,
  toggleWalkMode,
  handleProximityAudioTrigger,
  hydrateWalkMode,
};
