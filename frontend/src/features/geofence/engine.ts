// F02 / PB06 / PB07 – Mesin event geofence (fungsi murni, tanpa Expo, mudah di-unit-test).
//
// Satu pembacaan lokasi masuk → state baru + daftar event:
//   AREA_ENTRY  : masuk radius kawasan (entryRadiusM, mis. 100 m)
//   AREA_EXIT   : keluar kawasan (> entryRadiusM + exitHysteresisM)
//   PROXIMITY   : masuk radius tenant (triggerRadiusM), maks. sekali per POI_COOLDOWN_MS
//   DWELL       : berada di geofence tenant ≥ DWELL_MIN_MS → kunjungan tercatat
//   EXIT        : keluar geofence tenant (> triggerRadiusM + POI_EXIT_HYSTERESIS_M)
//
// Pencegahan trigger palsu: pembacaan dengan akurasi > MAX_ACCURACY_M diabaikan seluruhnya.

import {
  DEFAULT_TRIGGER_RADIUS_M,
  DWELL_MIN_MS,
  MAX_ACCURACY_M,
  POI_COOLDOWN_MS,
  POI_EXIT_HYSTERESIS_M,
} from '@/constants/config';
import { computeAreaStatus, haversineM, type AreaGeometry, type AreaStatus, type LatLng, type UserPosition } from '@/lib/geo';

export type GeofencePoi = LatLng & { id: string; triggerRadiusM: number };

export type PoiTrackState = {
  inside: boolean;
  /** Waktu (ms) masuk geofence; null jika di luar. */
  enteredAt: number | null;
  /** Dwell sudah tercatat untuk kunjungan yang sedang berlangsung. */
  dwellRecorded: boolean;
  /** Waktu (ms) proximity terakhir dipicu, untuk cooldown. Bertahan lintas sesi. */
  lastProximityAt: number | null;
};

export type GeofenceState = {
  area: AreaStatus;
  pois: Record<string, PoiTrackState>;
};

export type GeofenceEvent =
  | { type: 'AREA_ENTRY'; at: number }
  | { type: 'AREA_EXIT'; at: number }
  | { type: 'PROXIMITY'; poiId: string; distanceM: number; at: number }
  | { type: 'DWELL'; poiId: string; durationMs: number; at: number }
  | { type: 'EXIT'; poiId: string; visited: boolean; at: number };

export type GeofenceContext = {
  area: AreaGeometry;
  pois: GeofencePoi[];
  /** Waktu evaluasi (ms). Default: timestamp pembacaan lokasi. */
  now?: number;
};

export const INITIAL_GEOFENCE_STATE: GeofenceState = { area: 'UNKNOWN', pois: {} };

const EMPTY_POI_STATE: PoiTrackState = {
  inside: false,
  enteredAt: null,
  dwellRecorded: false,
  lastProximityAt: null,
};

export const radiusOf = (poi: Pick<GeofencePoi, 'triggerRadiusM'>): number =>
  poi.triggerRadiusM > 0 ? poi.triggerRadiusM : DEFAULT_TRIGGER_RADIUS_M;

export function stepGeofence(
  state: GeofenceState,
  pos: UserPosition,
  ctx: GeofenceContext,
): { state: GeofenceState; events: GeofenceEvent[] } {
  // Filter jitter: pembacaan tidak akurat tidak boleh memicu atau mengakhiri apa pun.
  if (!(pos.accuracyM <= MAX_ACCURACY_M)) return { state, events: [] };

  const now = ctx.now ?? pos.timestamp;
  const events: GeofenceEvent[] = [];

  // ── Kawasan ──
  const area = computeAreaStatus(pos, ctx.area, state.area);
  // UNKNOWN → INSIDE (fix pertama saat sudah di dalam) tidak dianggap "masuk"; sambutan di
  // foreground sudah ditangani modal Beranda.
  if (state.area === 'OUTSIDE' && area === 'INSIDE') events.push({ type: 'AREA_ENTRY', at: now });
  if (state.area === 'INSIDE' && area === 'OUTSIDE') events.push({ type: 'AREA_EXIT', at: now });

  // ── Tenant ──
  const pois: Record<string, PoiTrackState> = {};
  for (const poi of ctx.pois) {
    const prev = state.pois[poi.id] ?? EMPTY_POI_STATE;
    const next: PoiTrackState = { ...prev };
    const d = haversineM(pos.coordinate, poi);
    const r = radiusOf(poi);

    if (!prev.inside && d <= r) {
      next.inside = true;
      next.enteredAt = now;
      next.dwellRecorded = false;
      const coolingDown = prev.lastProximityAt !== null && now - prev.lastProximityAt < POI_COOLDOWN_MS;
      if (!coolingDown) {
        next.lastProximityAt = now;
        events.push({ type: 'PROXIMITY', poiId: poi.id, distanceM: Math.round(d), at: now });
      }
    } else if (prev.inside && d > r + POI_EXIT_HYSTERESIS_M) {
      events.push({ type: 'EXIT', poiId: poi.id, visited: prev.dwellRecorded, at: now });
      next.inside = false;
      next.enteredAt = null;
      next.dwellRecorded = false;
    }

    if (next.inside && !next.dwellRecorded && next.enteredAt !== null) {
      const durationMs = now - next.enteredAt;
      if (durationMs >= DWELL_MIN_MS) {
        next.dwellRecorded = true;
        events.push({ type: 'DWELL', poiId: poi.id, durationMs, at: now });
      }
    }

    pois[poi.id] = next;
  }

  return { state: { area, pois }, events };
}

/**
 * Akhiri sesi pelacakan (Mode Jelajah dimatikan): status di dalam/luar dilupakan karena tidak
 * dilacak lagi, tetapi cooldown proximity tetap disimpan agar tenant yang sama tidak langsung
 * memicu ulang saat Mode Jelajah diaktifkan kembali.
 */
export function endGeofenceSession(state: GeofenceState): GeofenceState {
  const pois: Record<string, PoiTrackState> = {};
  for (const [id, s] of Object.entries(state.pois)) {
    if (s.lastProximityAt !== null) pois[id] = { ...EMPTY_POI_STATE, lastProximityAt: s.lastProximityAt };
  }
  return { area: 'UNKNOWN', pois };
}
