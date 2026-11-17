import * as Notifications from 'expo-notifications';
import * as TaskManager from 'expo-task-manager';
import { handleNotificationResponse } from '@/features/notifications/actions';

export const NOTIFICATION_ACTION_TASK = 'notification-action';

// F04: di Android, task ini dijalankan OS saat tombol aksi notifikasi (Dengar / Lewati) ditekan
// ketika app di background atau sudah di-kill, sehingga narasi bisa diputar tanpa membuka app.
// Saat app terbuka, respons ditangani listener di root layout (duplikat dicegah di handler).
try {
  if (!TaskManager.isTaskDefined(NOTIFICATION_ACTION_TASK)) {
    TaskManager.defineTask<Notifications.NotificationTaskPayload>(
      NOTIFICATION_ACTION_TASK,
      async ({ data, error }) => {
        if (error || !data || !('actionIdentifier' in data)) return;
        await handleNotificationResponse(data);
      },
    );
  }
  void Notifications.registerTaskAsync(NOTIFICATION_ACTION_TASK).catch(() => {});
} catch {
  // Abaikan jika TaskManager / modul notifikasi native belum siap (test / web / Expo Go)
}
