// F02 – Runtime geofence: satu instance mesin event yang dipakai bersama oleh watch foreground
// dan background task Mode Jelajah. Karena keduanya memakai state yang sama, pembacaan lokasi
// ganda tidak menghasilkan event ganda.
//
// State disimpan ke AsyncStorage supaya cooldown & timer dwell tetap benar walau proses JS
// dimulai ulang oleh OS (headless background task).

import { AppState } from 'react-native';
import areaJson from '@/data/area.json';
import { WalkModeService } from '@/features/audio';
import { NotificationService } from '@/features/notifications';
import { PreferenceRepository } from '@/features/onboarding';
import { getPoiById, getPois } from '@/features/poi';
import { buildExitRecommendation, ExitRecommendationStore } from '@/features/recommendation/exit';
import {
  completeTrailStep,
  findTrailOverstay,
  markOverstayNotified,
  skipClosedTrailSteps,
  TrailSessionStore,
  type AutoSkipResult,
} from '@/features/trail';
import { VisitRepository } from '@/features/visits';
import type { LatLng, UserPosition } from '@/lib/geo';
import { load, save } from '@/storage';
import type { AreaConfig } from '@/types/content';
import {
  endGeofenceSession,
  INITIAL_GEOFENCE_STATE,
  stepGeofence,
  type GeofenceEvent,
  type GeofenceState,
} from './engine';

const STATE_KEY = 'geofence.state.v1';
const AREA = areaJson as AreaConfig;

let state: GeofenceState = INITIAL_GEOFENCE_STATE;
let hydrated: Promise<void> | null = null;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(e: GeofenceEvent) => void>();

function hydrate(): Promise<void> {
  hydrated ??= load<GeofenceState>(STATE_KEY, INITIAL_GEOFENCE_STATE)
    .then((s) => {
      state = s;
    })
    .catch(() => {});
  return hydrated;
}

async function persist(): Promise<void> {
  try {
    await save(STATE_KEY, state);
  } catch {
    // Gagal simpan bukan alasan menghentikan pelacakan.
  }
}

async function vibrate(): Promise<void> {
  // Getaran langsung hanya saat app terbuka; di background notifikasi channel HIGH sudah bergetar.
  if (AppState.currentState !== 'active') return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Haptics = require('expo-haptics') as typeof import('expo-haptics');
    await Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
  } catch {
    // abaikan
  }
}

async function recommendAfterExit(poiId: string, position: LatLng, at: number): Promise<void> {
  const exitedPoi = getPoiById(poiId);
  if (!exitedPoi) return;
  const [visits, trail, prefs] = await Promise.all([
    VisitRepository.getAll(),
    TrailSessionStore.get(),
    PreferenceRepository.get(),
  ]);
  const rec = buildExitRecommendation({
    exitedPoi,
    position,
    pois: getPois(),
    visitedPoiIds: Object.keys(visits),
    trail,
    halalOnly: prefs.ok && prefs.data.halalOnly,
    at,
  });
  if (!rec) return;
  await ExitRecommendationStore.set(rec);
  // Di foreground sheet sudah tampil; notifikasi hanya untuk app di background.
  if (AppState.currentState !== 'active') await NotificationService.notifyRecommendations(rec);
}

async function runSideEffects(e: GeofenceEvent, pos: UserPosition): Promise<void> {
  switch (e.type) {
    case 'AREA_ENTRY':
      await NotificationService.notifyAreaEntry(AREA.name);
      return;
    case 'PROXIMITY': {
      const poi = getPoiById(e.poiId);
      if (!poi) return;
      await vibrate();
      const { autoPlayed } = await WalkModeService.handleProximityAudioTrigger(poi);
      await NotificationService.notifyNearbyPoi(poi, e.distanceM, { autoPlaying: autoPlayed });
      return;
    }
    case 'DWELL':
      await VisitRepository.markVisited(e.poiId, e.at);
      await TrailSessionStore.update((s) => completeTrailStep(s, e.poiId, e.at));
      return;
    case 'EXIT':
      // Hanya setelah dwell: lewat sebentar di depan tenant bukan berarti selesai makan.
      if (e.visited) await recommendAfterExit(e.poiId, pos.coordinate, e.at);
      return;
    case 'AREA_EXIT':
      await ExitRecommendationStore.clear();
      return;
  }
}

async function remindTrailOverstay(now: number): Promise<void> {
  const session = await TrailSessionStore.get();
  if (!session) return;
  const enteredAt: Record<string, number | null> = {};
  for (const [id, p] of Object.entries(state.pois)) enteredAt[id] = p.inside ? p.enteredAt : null;
  const alert = findTrailOverstay(session, enteredAt, now);
  if (!alert) return;
  await TrailSessionStore.update((s) => markOverstayNotified(s, alert.poiId));
  await NotificationService.notifyTrailOverstay(alert);
}

/** SB4.4: tenant trail yang tutup di tengah jalan dilewati otomatis, lalu rute disusun ulang. */
async function autoSkipClosedTenants(position: LatLng, now: number): Promise<void> {
  let result: AutoSkipResult | null = null;
  await TrailSessionStore.update((s) => {
    result = skipClosedTrailSteps(s, getPois(), position, now);
    return result.session;
  });
  const res = result as AutoSkipResult | null;
  if (!res || res.skippedPoiIds.length === 0) return;
  const nameOf = (id: string) => getPoiById(id)?.name ?? id;
  await NotificationService.notifyTrailAutoSkipped({
    skippedNames: res.skippedPoiIds.map(nameOf),
    addedNames: res.addedPoiIds.map(nameOf),
  });
}

async function processOne(pos: UserPosition, now: number): Promise<GeofenceEvent[]> {
  await hydrate();
  const pois = getPois();
  const res = stepGeofence(state, pos, { area: AREA, pois, now });
  const changed = JSON.stringify(res.state) !== JSON.stringify(state);
  state = res.state;
  if (changed) await persist();

  for (const e of res.events) {
    try {
      await runSideEffects(e, pos);
    } catch {
      // Satu efek gagal (mis. notifikasi ditolak) tidak boleh menghentikan event lain.
    }
    listeners.forEach((l) => l(e));
  }

  try {
    await remindTrailOverstay(now);
  } catch {
    // Pengingat gagal tidak boleh menghentikan pemrosesan lokasi.
  }
  try {
    await autoSkipClosedTenants(pos.coordinate, now);
  } catch {
    // Gagal menyusun ulang tidak boleh menghentikan pemrosesan lokasi.
  }
  return res.events;
}

export const GeofenceRuntime = {
  /**
   * Proses satu pembacaan lokasi. `now` bisa diisi lebih baru dari timestamp lokasi untuk
   * mengevaluasi ulang dwell saat posisi tidak berubah. Panggilan diserialkan agar state konsisten.
   */
  processPosition(pos: UserPosition, now: number = pos.timestamp): Promise<GeofenceEvent[]> {
    const run = queue.then(() => processOne(pos, now));
    queue = run.catch(() => {});
    return run;
  },

  /** Mode Jelajah dimatikan: lupakan status di dalam/luar, simpan cooldown. */
  endSession(): Promise<void> {
    const run = queue.then(async () => {
      await hydrate();
      state = endGeofenceSession(state);
      await persist();
    });
    queue = run.catch(() => {});
    return run;
  },

  /** Daftar ke event geofence (UI foreground). Mengembalikan fungsi unsubscribe. */
  subscribe(listener: (e: GeofenceEvent) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Hanya untuk test. */
  __reset(): void {
    state = INITIAL_GEOFENCE_STATE;
    hydrated = Promise.resolve();
    queue = Promise.resolve();
    listeners.clear();
  },
};

export type { GeofenceEvent } from './engine';
