// F02 – Deteksi geofence POI & kontrol siklus hidup Mode Jelajah (PB05–PB07)
import {
  DEFAULT_TRIGGER_RADIUS_M,
  EXPLORE_TIME_INTERVAL_MS,
} from '@/constants/config';
import { IS_MOCK_LOCATION, LocationService, type UserPosition } from '@/features/location';
import { NotificationService } from '@/features/notifications';
import { getPoiById, getPois } from '@/features/poi';
import { haversineM, type LatLng } from '@/lib/geo';
import { BACKGROUND_LOCATION_TASK } from '@/tasks/backgroundLocation';
import type { Poi } from '@/types/content';
import { GeofenceRuntime, type GeofenceEvent } from './runtime';

export { GeofenceRuntime, type GeofenceEvent } from './runtime';
export { radiusOf, stepGeofence, type GeofenceState } from './engine';

export type NearbyPoiItem = {
  poi: Poi;
  distanceM: number;
  insideGeofence: boolean;
};

export function isInsideGeofence(
  user: LatLng,
  poi: LatLng,
  radius = DEFAULT_TRIGGER_RADIUS_M,
): boolean {
  return haversineM(user, poi) <= radius;
}

/**
 * Mengurutkan daftar POI berdasarkan jarak terdekat dari posisi pengguna.
 */
export function getNearbyPoisSorted(
  user: LatLng,
  pois: Poi[],
  limit = 6,
): NearbyPoiItem[] {
  const mapped = pois.map((poi) => {
    const poiCoord = { latitude: poi.latitude, longitude: poi.longitude };
    const dist = haversineM(user, poiCoord);
    const radius = poi.triggerRadiusM > 0 ? poi.triggerRadiusM : DEFAULT_TRIGGER_RADIUS_M;
    return {
      poi,
      distanceM: Math.round(dist),
      insideGeofence: dist <= radius,
    };
  });

  mapped.sort((a, b) => a.distanceM - b.distanceM);
  return mapped.slice(0, limit);
}

/** Evaluasi ulang dwell tiap selang ini walau posisi tidak berubah (watch foreground tidak kirim update saat diam). */
const DWELL_TICK_MS = 15_000;

let unsubscribeWatch: (() => void) | null = null;
let unsubscribeEvents: (() => void) | null = null;
let dwellTimer: ReturnType<typeof setInterval> | null = null;
let lastPosition: UserPosition | null = null;
let lastStickyKey: string | null = null;
let exploreSessionActive = false;

async function updateStickyNotification(pos: UserPosition | null, pois: Poi[]): Promise<void> {
  const nearest = pos ? getNearbyPoisSorted(pos.coordinate, pois, 1)[0] : undefined;
  // Jarak dibulatkan ke 10 m supaya notifikasi tidak di-render ulang tiap 3 detik.
  const info = nearest
    ? { nearestPoiName: nearest.poi.name, distanceM: Math.round(nearest.distanceM / 10) * 10 }
    : undefined;
  const key = info ? `${info.nearestPoiName}|${info.distanceM}` : '-';
  if (key === lastStickyKey) return;
  lastStickyKey = key;
  await NotificationService.showPersistentExploreNotification(info);
}

async function startBackgroundUpdates(): Promise<void> {
  // Lokasi palsu (dev) hanya ada di JS; GPS asli di background akan "memindahkan" pengguna.
  if (IS_MOCK_LOCATION) return;
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    const bgPerm = await Location.getBackgroundPermissionsAsync();
    if (bgPerm.status !== 'granted') return;
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) return;
    await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
      accuracy: Location.Accuracy.High,
      timeInterval: EXPLORE_TIME_INTERVAL_MS,
      // 0: tetap dapat lokasi saat pengguna diam di tenant → dwell event bisa tercatat di background.
      distanceInterval: 0,
      showsBackgroundLocationIndicator: true,
      pausesUpdatesAutomatically: false,
      foregroundService: {
        notificationTitle: 'Mode Jelajah Aktif · Sudirman Street Food',
        notificationBody: 'Memantau tenant kuliner terdekat di Sudirman Street Food.',
        notificationColor: '#FF8316',
        killServiceOnDestroy: false,
      },
    });
  } catch {
    // Expo Go / simulator tanpa izin background: cukup watch foreground.
  }
}

async function stopBackgroundUpdates(): Promise<void> {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    const Location = require('expo-location') as typeof import('expo-location');
    if (await Location.hasStartedLocationUpdatesAsync(BACKGROUND_LOCATION_TASK)) {
      await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
    }
  } catch {
    // abaikan
  }
}

export const ExploreModeController = {
  isActive(): boolean {
    return exploreSessionActive;
  },

  /**
   * Mengaktifkan Mode Jelajah:
   * 1. Notifikasi permanen "Mode Jelajah Aktif"
   * 2. Watch lokasi foreground + background updates (foreground service) → GeofenceRuntime
   * 3. Event geofence (proximity/dwell/exit/entry) diteruskan ke callback UI
   */
  async start(opts?: {
    initialPosition?: UserPosition | null;
    pois?: Poi[];
    onPositionUpdate?: (pos: UserPosition) => void;
    onEnterPoiGeofence?: (poi: Poi, distanceM: number) => void;
    onGeofenceEvent?: (e: GeofenceEvent) => void;
  }): Promise<void> {
    await this.stop();
    exploreSessionActive = true;

    const poiList = opts?.pois?.length ? opts.pois : getPois();
    lastPosition = opts?.initialPosition ?? null;

    unsubscribeEvents = GeofenceRuntime.subscribe((e) => {
      opts?.onGeofenceEvent?.(e);
      if (e.type === 'PROXIMITY') {
        const poi = poiList.find((p) => p.id === e.poiId) ?? getPoiById(e.poiId);
        if (poi) opts?.onEnterPoiGeofence?.(poi, e.distanceM);
      }
    });

    await updateStickyNotification(lastPosition, poiList);
    if (lastPosition) {
      // Posisi awal dievaluasi dengan waktu sekarang agar tidak dianggap pembacaan lama.
      void GeofenceRuntime.processPosition(lastPosition, Date.now());
    }

    const watchRes = await LocationService.watchPosition(
      (pos) => {
        if (!exploreSessionActive) return;
        lastPosition = pos;
        opts?.onPositionUpdate?.(pos);
        void GeofenceRuntime.processPosition(pos);
        void updateStickyNotification(pos, poiList);
      },
      () => {
        // Error lokasi tidak memutus sesi; pembacaan berikutnya tetap diproses.
      },
    );
    if (watchRes.ok) unsubscribeWatch = watchRes.data;

    dwellTimer = setInterval(() => {
      if (exploreSessionActive && lastPosition) {
        void GeofenceRuntime.processPosition(lastPosition, Date.now());
      }
    }, DWELL_TICK_MS);

    await startBackgroundUpdates();
  },

  /**
   * Mematikan Mode Jelajah: hentikan watch, timer dwell, background updates, dan notifikasi permanen.
   * Cooldown proximity tetap disimpan (lihat endGeofenceSession).
   */
  async stop(): Promise<void> {
    const wasActive = exploreSessionActive;
    exploreSessionActive = false;

    try {
      unsubscribeWatch?.();
    } catch {
      // abaikan
    }
    unsubscribeWatch = null;
    unsubscribeEvents?.();
    unsubscribeEvents = null;
    if (dwellTimer) clearInterval(dwellTimer);
    dwellTimer = null;
    lastPosition = null;
    lastStickyKey = null;

    await stopBackgroundUpdates();
    if (wasActive) await GeofenceRuntime.endSession();
    await NotificationService.dismissPersistentExploreNotification();
  },
};
