// F02 – Deteksi masuk radius POI (geofence) & kontrol siklus hidup Mode Jelajah
import {
  DEFAULT_TRIGGER_RADIUS_M,
  LOCATION_DISTANCE_INTERVAL_M,
  LOCATION_TIME_INTERVAL_MS,
} from '@/constants/config';
import { LocationService, type UserPosition } from '@/features/location';
import { NotificationService } from '@/features/notifications';
import { getPois } from '@/features/poi';
import { haversineM, type LatLng } from '@/lib/geo';
import {
  BACKGROUND_LOCATION_TASK,
  resetBackgroundGeofenceSession,
} from '@/tasks/backgroundLocation';
import type { Poi } from '@/types/content';

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

let activeForegroundUnsubscribe: (() => void) | null = null;
let exploreSessionActive = false;
const notifiedForegroundPoiIds = new Set<string>();

export const ExploreModeController = {
  isActive(): boolean {
    return exploreSessionActive;
  },

  /**
   * Mengaktifkan Mode Jelajah:
   * 1. Menampilkan notifikasi permanen/sticky "Mode Jelajah Aktif"
   * 2. Memulai pelacakan lokasi aktif (foreground watch + opsional background updates)
   * 3. Memicu callback saat pengguna masuk radius geofence POI
   */
  async start(opts?: {
    initialPosition?: UserPosition | null;
    pois?: Poi[];
    onPositionUpdate?: (pos: UserPosition) => void;
    onEnterPoiGeofence?: (poi: Poi, distanceM: number) => void;
  }): Promise<void> {
    // Pastikan sesi lama dibersihkan terlebih dahulu
    await this.stop();

    exploreSessionActive = true;
    notifiedForegroundPoiIds.clear();
    resetBackgroundGeofenceSession();

    const poiList = opts?.pois?.length ? opts.pois : getPois();
    let initialNearest: { nearestPoiName?: string; distanceM?: number } | undefined;

    if (opts?.initialPosition && poiList.length > 0) {
      const nearest = getNearbyPoisSorted(opts.initialPosition.coordinate, poiList, 1)[0];
      if (nearest) {
        initialNearest = {
          nearestPoiName: nearest.poi.name,
          distanceM: nearest.distanceM,
        };
      }
    }

    // 1. Tampilkan notifikasi permanen bahwa Mode Jelajah sedang aktif
    await NotificationService.showPersistentExploreNotification(initialNearest);

    // 2. Mulai pelacakan lokasi kontinu (watchPosition)
    const watchRes = await LocationService.watchPosition(
      async (pos) => {
        if (!exploreSessionActive) return;
        opts?.onPositionUpdate?.(pos);

        const sorted = getNearbyPoisSorted(pos.coordinate, poiList, 5);
        const closest = sorted[0];

        if (closest) {
          await NotificationService.showPersistentExploreNotification({
            nearestPoiName: closest.poi.name,
            distanceM: closest.distanceM,
          });
        }

        for (const item of sorted) {
          if (item.insideGeofence && !notifiedForegroundPoiIds.has(item.poi.id)) {
            notifiedForegroundPoiIds.add(item.poi.id);
            opts?.onEnterPoiGeofence?.(item.poi, item.distanceM);
            await NotificationService.notifyNearbyPoi(item.poi, item.distanceM);
          }
        }
      },
      () => {
        // Error lokasi ditangani secara aman tanpa memutus sesi UI
      },
    );

    if (watchRes.ok) {
      activeForegroundUnsubscribe = watchRes.data;
    }

    // 3. Jika platform mendukung background location service, aktifkan juga
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const bgPerm = await Location.getBackgroundPermissionsAsync();
      if (bgPerm.status === 'granted') {
        const started = await Location.hasStartedLocationUpdatesAsync(
          BACKGROUND_LOCATION_TASK,
        );
        if (!started) {
          await Location.startLocationUpdatesAsync(BACKGROUND_LOCATION_TASK, {
            accuracy: Location.Accuracy.High,
            timeInterval: LOCATION_TIME_INTERVAL_MS,
            distanceInterval: LOCATION_DISTANCE_INTERVAL_M,
            showsBackgroundLocationIndicator: true,
            foregroundService: {
              notificationTitle: 'Mode Jelajah Aktif · Sudirman Street Food',
              notificationBody:
                'Memantau tenant kuliner terdekat di Sudirman Street Food.',
              notificationColor: '#FF8316',
            },
          });
        }
      }
    } catch {
      // Di Expo Go / simulator tanpa background permission, cukup mengandalkan watchPosition + sticky notification
    }
  },

  /**
   * Mematikan Mode Jelajah:
   * 1. Menghentikan pelacakan lokasi (foreground watch & background task)
   * 2. Menghapus notifikasi permanen dari status bar
   */
  async stop(): Promise<void> {
    exploreSessionActive = false;
    notifiedForegroundPoiIds.clear();
    resetBackgroundGeofenceSession();

    // 1. Hentikan pelacakan lokasi foreground
    if (activeForegroundUnsubscribe) {
      try {
        activeForegroundUnsubscribe();
      } catch {
        // abaikan
      }
      activeForegroundUnsubscribe = null;
    }

    // 2. Hentikan pelacakan lokasi background jika aktif
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const started = await Location.hasStartedLocationUpdatesAsync(
        BACKGROUND_LOCATION_TASK,
      );
      if (started) {
        await Location.stopLocationUpdatesAsync(BACKGROUND_LOCATION_TASK);
      }
    } catch {
      // abaikan
    }

    // 3. Hapus notifikasi permanen Mode Jelajah
    await NotificationService.dismissPersistentExploreNotification();
  },
};
