import * as TaskManager from 'expo-task-manager';
import { DEFAULT_TRIGGER_RADIUS_M } from '@/constants/config';
import { NotificationService } from '@/features/notifications';
import { getPois } from '@/features/poi';
import { haversineM } from '@/lib/geo';

export const BACKGROUND_LOCATION_TASK = 'background-location';

type BackgroundLocationPayload = {
  locations?: Array<{
    coords: {
      latitude: number;
      longitude: number;
      accuracy: number | null;
    };
    timestamp: number;
  }>;
};

const notifiedPoiIdsInSession = new Set<string>();

export function resetBackgroundGeofenceSession(): void {
  notifiedPoiIdsInSession.clear();
}

// F02: dipanggil OS saat lokasi berubah di background ketika Mode Jelajah aktif; cek geofence di sini.
try {
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    TaskManager.defineTask<BackgroundLocationPayload>(
      BACKGROUND_LOCATION_TASK,
      async ({ data, error }) => {
        if (error || !data?.locations?.length) return;

        const latest = data.locations[data.locations.length - 1];
        const userCoord = {
          latitude: latest.coords.latitude,
          longitude: latest.coords.longitude,
        };

        const pois = getPois();
        for (const poi of pois) {
          const poiCoord = { latitude: poi.latitude, longitude: poi.longitude };
          const distM = haversineM(userCoord, poiCoord);
          const radius = poi.triggerRadiusM > 0 ? poi.triggerRadiusM : DEFAULT_TRIGGER_RADIUS_M;

          if (distM <= radius && !notifiedPoiIdsInSession.has(poi.id)) {
            notifiedPoiIdsInSession.add(poi.id);
            await NotificationService.notifyNearbyPoi(poi, Math.round(distM));
          }
        }
      },
    );
  }
} catch {
  // Abaikan jika TaskManager belum siap di lingkungan test / web
}
