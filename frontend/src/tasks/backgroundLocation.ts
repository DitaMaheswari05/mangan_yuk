import * as TaskManager from 'expo-task-manager';
import { GeofenceRuntime } from '@/features/geofence/runtime';

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

// F02 / PB05: dipanggil OS (lewat foreground service "Mode Jelajah") saat lokasi berubah, termasuk
// ketika app di background atau layar terkunci. Semua logika event ada di GeofenceRuntime.
try {
  if (!TaskManager.isTaskDefined(BACKGROUND_LOCATION_TASK)) {
    TaskManager.defineTask<BackgroundLocationPayload>(
      BACKGROUND_LOCATION_TASK,
      async ({ data, error }) => {
        if (error || !data?.locations?.length) return;

        // OS bisa mengirim beberapa lokasi sekaligus (batch); proses berurutan agar timer dwell benar.
        const sorted = [...data.locations].sort((a, b) => a.timestamp - b.timestamp);
        for (const loc of sorted) {
          await GeofenceRuntime.processPosition({
            coordinate: { latitude: loc.coords.latitude, longitude: loc.coords.longitude },
            // Akurasi tidak diketahui → anggap tidak akurat agar tidak memicu trigger palsu.
            accuracyM: typeof loc.coords.accuracy === 'number' ? loc.coords.accuracy : Infinity,
            timestamp: loc.timestamp,
          });
        }
      },
    );
  }
} catch {
  // Abaikan jika TaskManager belum siap di lingkungan test / web
}
