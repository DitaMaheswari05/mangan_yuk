// F02, F04 – Notifikasi lokal saat Mode Jelajah aktif (permanen/ongoing) & saat masuk geofence POI.
import { Platform } from 'react-native';
import type { Poi } from '@/types/content';

export const EXPLORE_CHANNEL_ID = 'manganyuk-explore-mode';
export const GEOFENCE_CHANNEL_ID = 'manganyuk-geofence-poi';
export const EXPLORE_NOTIFICATION_ID = 'manganyuk-explore-active-notification';

// F04 – Notifikasi proximity punya tombol aksi agar bisa direspons dari lock screen.
export const POI_PROXIMITY_CATEGORY = 'poi-proximity';
export const ACTION_LISTEN = 'LISTEN';
export const ACTION_SKIP = 'SKIP';

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
        // PUBLIC: isi & tombol Dengar/Lewati tampil penuh di lock screen.
        // Catatan: setelan channel Android tidak berubah untuk channel yang sudah terlanjur dibuat;
        // perangkat lama perlu clear data / install ulang agar nilai ini berlaku.
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });
    }

    await Notifications.setNotificationCategoryAsync(POI_PROXIMITY_CATEGORY, [
      {
        identifier: ACTION_LISTEN,
        buttonTitle: 'Dengar',
        options: { opensAppToForeground: false },
      },
      {
        identifier: ACTION_SKIP,
        buttonTitle: 'Lewati',
        options: { opensAppToForeground: false, isDestructive: true },
      },
    ]);
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
 * F02 proximity event: pengguna masuk radius geofence tenant. Ketuk → buka kartu POI.
 */
export async function notifyNearbyPoi(
  poi: Poi,
  distanceM: number,
  options?: { autoPlaying?: boolean },
): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await ensureNotificationSetup();

    const bodyText = options?.autoPlaying
      ? `${poi.categoryLabel} · ~${distanceM} m. Memutar narasi otomatis (Mode Jalan).`
      : `${poi.categoryLabel} · ~${distanceM} m. Mau dengar ceritanya?`;

    await Notifications.scheduleNotificationAsync({
      identifier: `poi-nearby-${poi.id}`,
      content: {
        title: `Kamu mendekati ${poi.name}`,
        body: bodyText,
        color: '#FF8316',
        categoryIdentifier: POI_PROXIMITY_CATEGORY,
        data: {
          type: 'poi-geofence-enter',
          poiId: poi.id,
          url: `/poi/${poi.id}`,
          autoPlaying: options?.autoPlaying ?? false,
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
 * F02 entry event: pengguna masuk radius kawasan (mis. 100 m dari pusat Sudirman Street Food).
 */
export async function notifyAreaEntry(areaName: string): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await ensureNotificationSetup();

    await Notifications.scheduleNotificationAsync({
      identifier: 'area-entry',
      content: {
        title: `Selamat datang di ${areaName}!`,
        body: 'Rencanakan trail kulinermu atau jelajah bebas. Kami kabari saat kamu dekat tenant.',
        color: '#FF8316',
        data: { type: 'area-entry', url: '/(tabs)' },
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
