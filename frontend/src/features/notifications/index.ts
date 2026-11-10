// F02, F04 – Notifikasi lokal saat Mode Jelajah aktif (permanen/ongoing) & saat masuk geofence POI.
import { Platform } from 'react-native';
import type { Poi } from '@/types/content';

export const EXPLORE_CHANNEL_ID = 'manganyuk-explore-mode';
export const GEOFENCE_CHANNEL_ID = 'manganyuk-geofence-poi';
export const EXPLORE_NOTIFICATION_ID = 'manganyuk-explore-active-notification';

let handlerConfigured = false;
let activeExploreNotifId: string | null = null;

function getNotificationsModule(): typeof import('expo-notifications') | null {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('expo-notifications') as typeof import('expo-notifications');
  } catch {
    return null;
  }
}

/**
 * Inisialisasi handler & Android channel agar notifikasi tampil di foreground maupun status bar.
 */
export async function ensureNotificationSetup(): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    if (!handlerConfigured) {
      Notifications.setNotificationHandler({
        handleNotification: async () => ({
          shouldShowAlert: true,
          shouldPlaySound: false,
          shouldSetBadge: false,
          shouldShowBanner: true,
          shouldShowList: true,
        }),
      });
      handlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      await Notifications.setNotificationChannelAsync(EXPLORE_CHANNEL_ID, {
        name: 'Mode Jelajah',
        description: 'Notifikasi permanen saat Mode Jelajah aktif memantau lokasi kuliner',
        importance: Notifications.AndroidImportance.LOW,
        vibrationPattern: [0],
        enableVibrate: false,
        showBadge: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      await Notifications.setNotificationChannelAsync(GEOFENCE_CHANNEL_ID, {
        name: 'Kuliner Terdekat',
        description: 'Notifikasi saat kamu berada di dekat tenant kuliner Sudirman Street Food',
        importance: Notifications.AndroidImportance.HIGH,
      });
    }
  } catch {
    // Abaikan jika dijalankan di lingkungan tanpa dukungan penuh notifikasi native
  }
}

/**
 * Menampilkan (atau memperbarui) notifikasi permanen/ongoing selama Mode Jelajah aktif.
 */
export async function showPersistentExploreNotification(opts?: {
  nearestPoiName?: string;
  distanceM?: number;
}): Promise<string | null> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return null;

  try {
    await ensureNotificationSetup();

    const perm = await Notifications.getPermissionsAsync();
    if (perm.status !== 'granted') {
      await Notifications.requestPermissionsAsync();
    }

    // Hapus notifikasi permanen sebelumnya jika ada agar tidak menumpuk saat di-update
    if (activeExploreNotifId) {
      try {
        await Notifications.dismissNotificationAsync(activeExploreNotifId);
      } catch {
        // abaikan
      }
    }

    const bodyText =
      opts?.nearestPoiName && typeof opts.distanceM === 'number'
        ? `Di dekat ${opts.nearestPoiName} (~${opts.distanceM}m) · Ketuk untuk membuka peta`
        : 'Memantau tenant kuliner terdekat di Sudirman Street Food secara real-time.';

    const id = await Notifications.scheduleNotificationAsync({
      identifier: EXPLORE_NOTIFICATION_ID,
      content: {
        title: 'Mode Jelajah Aktif · Sudirman Street Food',
        body: bodyText,
        sticky: true,
        autoDismiss: false,
        color: '#FF8316',
        data: {
          type: 'explore-mode-persistent',
          nearestPoiName: opts?.nearestPoiName ?? null,
        },
        ...(Platform.OS === 'android' ? { channelId: EXPLORE_CHANNEL_ID } : {}),
      },
      trigger: null,
    });

    activeExploreNotifId = id || EXPLORE_NOTIFICATION_ID;
    return activeExploreNotifId;
  } catch {
    activeExploreNotifId = EXPLORE_NOTIFICATION_ID;
    return activeExploreNotifId;
  }
}

/**
 * Menghapus notifikasi permanen Mode Jelajah ketika Mode Jelajah dimatikan.
 */
export async function dismissPersistentExploreNotification(): Promise<void> {
  const Notifications = getNotificationsModule();
  const idToDismiss = activeExploreNotifId ?? EXPLORE_NOTIFICATION_ID;
  activeExploreNotifId = null;

  if (!Notifications) return;

  try {
    await Notifications.dismissNotificationAsync(idToDismiss);
  } catch {
    // abaikan
  }

  try {
    await Notifications.dismissNotificationAsync(EXPLORE_NOTIFICATION_ID);
  } catch {
    // abaikan
  }

  try {
    await Notifications.cancelScheduledNotificationAsync(idToDismiss);
  } catch {
    // abaikan
  }
}

/**
 * Mengirim notifikasi lokal ketika pengguna masuk ke dalam radius geofence salah satu POI.
 */
export async function notifyNearbyPoi(poi: Poi, distanceM: number): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await ensureNotificationSetup();

    await Notifications.scheduleNotificationAsync({
      identifier: `poi-nearby-${poi.id}`,
      content: {
        title: `Kamu Lagi di ${poi.name}!`,
        body: `${poi.categoryLabel} (~${distanceM}m). Dengarkan cerita kuliner khasnya sekarang!`,
        color: '#FF8316',
        data: {
          type: 'poi-geofence-enter',
          poiId: poi.id,
        },
        ...(Platform.OS === 'android' ? { channelId: GEOFENCE_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch {
    // abaikan
  }
}

/**
 * Mengirim notifikasi lokal selamat datang saat pengguna memasuki kawasan kuliner (Entry event 100 m).
 */
export async function notifyAreaEntry(areaName = 'Sudirman Street Food'): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await ensureNotificationSetup();

    await Notifications.scheduleNotificationAsync({
      identifier: 'area-entry-welcome',
      content: {
        title: `Selamat Datang di ${areaName}!`,
        body: 'Kamu telah memasuki kawasan Sudirman Street Food. Aktifkan Mode Jelajah untuk mendengar cerita kuliner!',
        color: '#FF8316',
        data: {
          type: 'area-entry-welcome',
        },
        ...(Platform.OS === 'android' ? { channelId: GEOFENCE_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
  } catch {
    // abaikan
  }
}

export const NotificationService = {
  ensureNotificationSetup,
  showPersistentExploreNotification,
  dismissPersistentExploreNotification,
  notifyNearbyPoi,
  notifyAreaEntry,
};
