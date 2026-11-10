import * as TaskManager from 'expo-task-manager';
import areaJson from '@/data/area.json';
import { defaultGeofenceEngine } from '@/features/geofence/engine';
import { NotificationService } from '@/features/notifications';
import { getPois } from '@/features/poi';
import type { UserPosition } from '@/lib/geo';
import type { AreaConfig } from '@/types/content';

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

const DEFAULT_AREA: AreaConfig = areaJson as AreaConfig;

export function resetBackgroundGeofenceSession(): void {
  defaultGeofenceEngine.resetSession();
}

// F02, PB-05, PB-06: dipanggil OS saat lokasi berubah di background ketika Mode Jelajah aktif.
try {
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    TaskManager.defineTask<BackgroundLocationPayload>(
      BACKGROUND_LOCATION_TASK,
      async ({ data, error }) => {
        if (error || !data?.locations?.length) return;

        const latest = data.locations[data.locations.length - 1];
        const userPosition: UserPosition = {
          coordinate: {
            latitude: latest.coords.latitude,
            longitude: latest.coords.longitude,
          },
          accuracyM:
            typeof latest.coords.accuracy === 'number' && latest.coords.accuracy >= 0
              ? latest.coords.accuracy
              : 0,
          timestamp: latest.timestamp ?? Date.now(),
        };

        const pois = getPois();
        const result = defaultGeofenceEngine.processPosition(
          userPosition,
          DEFAULT_AREA,
          pois,
        );

        if (result.discarded) return;

        // Pemicu Entry Event kawasan saat di background
        if (result.areaEvent === 'ENTRY') {
          await NotificationService.notifyAreaEntry(DEFAULT_AREA.name);
        }

        // Pemicu Proximity Event tenant saat di background
        for (const item of result.proximityPois) {
          await NotificationService.notifyNearbyPoi(item.poi, item.distanceM);
        }
      },
    );
  }
} catch {
  // Abaikan jika TaskManager belum siap di lingkungan test / web
}
