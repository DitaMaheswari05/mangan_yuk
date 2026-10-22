import * as TaskManager from 'expo-task-manager';

export const BACKGROUND_LOCATION_TASK = 'background-location';

// F02: dipanggil OS saat lokasi berubah di background; cek geofence di sini.
TaskManager.defineTask(BACKGROUND_LOCATION_TASK, async ({ data, error }) => {
  if (error || !data) return;
  // TODO: ambil lokasi dari `data`, panggil isInsideGeofence, kirim notifikasi.
});
