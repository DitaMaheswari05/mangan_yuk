// F03 / PB08 – Pemutar audio narasi POI (offline, dari aset bundel).
// Pemutaran berlanjut saat app di background / layar terkunci (SB-2.6).

import {
  createAudioPlayer,
  setAudioModeAsync,
  useAudioPlayer,
  useAudioPlayerStatus,
  type AudioPlayer,
} from 'expo-audio';
import { useCallback, useEffect } from 'react';
import { CONTENT_ASSETS } from '@/data/assets';
import type { Poi } from '@/types/content';

/** assetKey ('poi-audio/P01.mp3') → modul aset bundel; null jika file belum diekspor. */
export function resolveAsset(assetKey: string | null | undefined): number | null {
  if (!assetKey) return null;
  return CONTENT_ASSETS[assetKey] ?? null;
}

let sessionConfigured: Promise<void> | null = null;

/** Sekali per proses: audio tetap bunyi di mode senyap & di background, pause app lain. */
export function configureAudioSession(): Promise<void> {
  sessionConfigured ??= setAudioModeAsync({
    playsInSilentMode: true,
    shouldPlayInBackground: true,
    interruptionMode: 'doNotMix',
  }).catch(() => {
    sessionConfigured = null;
  });
  return sessionConfigured ?? Promise.resolve();
}

export type NarrationState = {
  /** false jika POI belum punya audio atau file belum ada di bundel. */
  available: boolean;
  playing: boolean;
  positionSec: number;
  durationSec: number;
  toggle: () => void;
  seekTo: (sec: number) => void;
  seekBy: (deltaSec: number) => void;
};

export function useNarration(poi: Pick<Poi, 'name' | 'audio'> | null | undefined): NarrationState {
  const source = resolveAsset(poi?.audio?.assetKey);
  const player = useAudioPlayer(source, { updateInterval: 500 });
  const status = useAudioPlayerStatus(player);

  const available = source !== null;
  // Durasi dari metadata data dipakai sampai file selesai dimuat.
  const durationSec = status.duration > 0 ? status.duration : (poi?.audio?.durationSec ?? 0);
  const positionSec = Math.min(status.currentTime, durationSec || status.currentTime);

  useEffect(() => {
    if (available) void configureAudioSession();
  }, [available]);

  // Android menghentikan audio background ±3 menit kecuali sesi media (kontrol lock screen) aktif.
  useEffect(() => {
    if (!available) return;
    try {
      player.setActiveForLockScreen(status.playing, {
        title: poi?.name ?? 'Cerita kuliner',
        artist: 'Mangan Yuk · Sudirman Street Food',
      });
    } catch {
      // abaikan di platform tanpa dukungan
    }
  }, [available, player, poi?.name, status.playing]);

  // Selesai diputar → kembali ke awal agar tombol play memutar ulang.
  useEffect(() => {
    if (status.didJustFinish) {
      player.pause();
      void player.seekTo(0);
    }
  }, [player, status.didJustFinish]);

  const toggle = useCallback(() => {
    if (!available) return;
    if (status.playing) player.pause();
    else player.play();
  }, [available, player, status.playing]);

  const seekTo = useCallback(
    (sec: number) => {
      if (!available) return;
      const max = durationSec > 0 ? durationSec : sec;
      void player.seekTo(Math.max(0, Math.min(sec, max)));
    },
    [available, durationSec, player],
  );

  const seekBy = useCallback(
    (deltaSec: number) => seekTo(status.currentTime + deltaSec),
    [seekTo, status.currentTime],
  );

  return { available, playing: status.playing, positionSec, durationSec, toggle, seekTo, seekBy };
}

// F04 – Pemutar di luar komponen React, untuk tombol "Dengar" di notifikasi (lock screen /
// background task) saat UI kartu POI tidak terbuka. Hanya satu narasi aktif dalam satu waktu.
let detachedPlayer: AudioPlayer | null = null;
let detachedSub: { remove: () => void } | null = null;

export function stopNarration(): void {
  detachedSub?.remove();
  detachedSub = null;
  if (!detachedPlayer) return;
  const player = detachedPlayer;
  detachedPlayer = null;
  try {
    player.clearLockScreenControls();
  } catch {
    // abaikan
  }
  try {
    player.pause();
    player.release();
  } catch {
    // abaikan
  }
}

/** Putar narasi POI tanpa UI. false jika POI belum punya audio di bundel. */
export async function playNarration(
  poi: Pick<Poi, 'name' | 'audio'>,
  onFinish?: () => void,
): Promise<boolean> {
  const source = resolveAsset(poi.audio?.assetKey);
  if (source === null) return false;

  await configureAudioSession();
  stopNarration();

  const player = createAudioPlayer(source, { updateInterval: 1000 });
  detachedPlayer = player;
  detachedSub = player.addListener('playbackStatusUpdate', (s) => {
    if (s.didJustFinish && detachedPlayer === player) {
      stopNarration();
      onFinish?.();
    }
  });

  // Wajib di Android agar audio tidak dihentikan OS saat app di background / layar terkunci.
  try {
    player.setActiveForLockScreen(true, {
      title: poi.name,
      artist: 'Mangan Yuk · Sudirman Street Food',
    });
  } catch {
    // abaikan di platform tanpa dukungan
  }

  player.play();
  return true;
}

/** 75 → '1:15' */
export function formatClock(totalSec: number): string {
  const s = Math.max(0, Math.floor(totalSec));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;
}

export * from './tts';
export * from './queue';
export * from './walkMode';

