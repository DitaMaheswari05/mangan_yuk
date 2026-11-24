// F02, F04 – Notifikasi lokal saat Mode Jelajah aktif (permanen/ongoing) & saat masuk geofence POI.
import { Platform } from 'react-native';
import type { Poi } from '@/types/content';

export const EXPLORE_CHANNEL_ID = 'manganyuk-explore-mode-v2';
export const GEOFENCE_CHANNEL_ID = 'manganyuk-geofence-poi-v2';
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
        handleNotification: async (notification) => {
          const isPersistent =
            notification.request.content.data?.type === 'explore-mode-persistent';
          return {
            shouldShowAlert: true,
            shouldPlaySound: !isPersistent,
            shouldSetBadge: false,
            shouldShowBanner: true,
            shouldShowList: true,
          };
        },
      });
      handlerConfigured = true;
    }

    if (Platform.OS === 'android') {
      // DEFAULT (bukan LOW) agar notifikasi Mode Jelajah tetap terlihat di lock screen,
      // tanpa suara/getar tiap kali posisi diperbarui.
      await Notifications.setNotificationChannelAsync(EXPLORE_CHANNEL_ID, {
        name: 'Mode Jelajah',
        description: 'Notifikasi permanen saat Mode Jelajah aktif memantau lokasi kuliner',
        importance: Notifications.AndroidImportance.DEFAULT,
        sound: null,
        vibrationPattern: [0],
        enableVibrate: false,
        showBadge: false,
        lockscreenVisibility: Notifications.AndroidNotificationVisibility.PUBLIC,
      });

      // MAX + sound + vibrate wajib di banyak perangkat Android agar muncul sebagai pop-up (heads-up)
      // sekaligus tampil penuh di lock screen dan panel notifikasi.
      await Notifications.setNotificationChannelAsync(GEOFENCE_CHANNEL_ID, {
        name: 'Kuliner Terdekat',
        description: 'Notifikasi saat kamu berada di dekat tenant kuliner Sudirman Street Food',
        importance: Notifications.AndroidImportance.MAX,
        sound: 'default',
        enableVibrate: true,
        vibrationPattern: [0, 250, 250, 250],
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

    const granted = await ensureNotificationPermission(Notifications);
    if (!granted) return null;

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

async function ensureNotificationPermission(
  Notifications: typeof import('expo-notifications'),
): Promise<boolean> {
  const perm = await Notifications.getPermissionsAsync();
  if (perm.status === 'granted') return true;
  const req = await Notifications.requestPermissionsAsync();
  return req.status === 'granted';
}

async function scheduleAlertNotification(opts: {
  identifier: string;
  title: string;
  body: string;
  data: Record<string, unknown>;
  categoryIdentifier?: string;
}): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications) return;

  try {
    await ensureNotificationSetup();
    const granted = await ensureNotificationPermission(Notifications);
    if (!granted) return;

    const maxPriority = Notifications.AndroidNotificationPriority?.MAX ?? 'max';

    await Notifications.scheduleNotificationAsync({
      identifier: opts.identifier,
      content: {
        title: opts.title,
        body: opts.body,
        sound: 'default',
        vibrate: [0, 250, 250, 250],
        color: '#FF8316',
        priority: maxPriority,
        interruptionLevel: 'timeSensitive',
        ...(opts.categoryIdentifier ? { categoryIdentifier: opts.categoryIdentifier } : {}),
        data: opts.data,
        ...(Platform.OS === 'android' ? { channelId: GEOFENCE_CHANNEL_ID } : {}),
      },
      trigger: null,
    });
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
  const bodyText = options?.autoPlaying
    ? `${poi.categoryLabel} · ~${distanceM} m. Memutar narasi otomatis (Mode Jalan).`
    : `${poi.categoryLabel} · ~${distanceM} m. Mau dengar ceritanya?`;

  await scheduleAlertNotification({
    identifier: `poi-nearby-${poi.id}`,
    title: `Kamu mendekati ${poi.name}`,
    body: bodyText,
    categoryIdentifier: POI_PROXIMITY_CATEGORY,
    data: {
      type: 'poi-geofence-enter',
      poiId: poi.id,
      url: `/poi/${poi.id}`,
      autoPlaying: options?.autoPlaying ?? false,
    },
  });
}

/**
 * F02 entry event: pengguna masuk radius kawasan (mis. 100 m dari pusat Sudirman Street Food).
 */
export async function notifyAreaEntry(areaName: string): Promise<void> {
  await scheduleAlertNotification({
    identifier: 'area-entry',
    title: `Selamat datang di ${areaName}!`,
    body: 'Rencanakan trail kulinermu atau jelajah bebas. Kami kabari saat kamu dekat tenant.',
    data: { type: 'area-entry', url: '/(tabs)' },
  });
}

/** F08: pengguna berdiam di tenant trail melebihi alokasi + 5 menit. Ketuk → buka itinerary. */
export async function notifyTrailOverstay(alert: {
  poiId: string;
  poiName: string;
  dwellMin: number;
  remainingMin: number;
  remainingStops: number;
}): Promise<void> {
  const next =
    alert.remainingStops > 0
      ? `masih ada ${alert.remainingStops} tenant lagi.`
      : 'ini tenant terakhir di trailmu.';

  await scheduleAlertNotification({
    identifier: `trail-overstay-${alert.poiId}`,
    title: `Sudah ${alert.dwellMin} menit di ${alert.poiName}`,
    body: `Sisa waktumu ${alert.remainingMin} menit, ${next}`,
    data: { type: 'trail-overstay', poiId: alert.poiId, url: '/trail/itinerary' },
  });
}

/** F07 exit event: 3 tenant berikutnya setelah selesai di satu tenant. Ketuk → peta dengan sheet rekomendasi. */
export async function notifyRecommendations(rec: {
  fromPoiId: string;
  fromPoiName: string;
  items: { poiName: string; distanceM: number }[];
}): Promise<void> {
  const Notifications = getNotificationsModule();
  if (!Notifications || rec.items.length === 0) return;

  const list = rec.items.map((i) => `${i.poiName} (~${i.distanceM} m)`).join(', ');

  try {
    await ensureNotificationSetup();

    await Notifications.scheduleNotificationAsync({
      identifier: 'exit-recommendation',
      content: {
        title: `Selesai di ${rec.fromPoiName}? Coba ini berikutnya`,
        body: list,
        color: '#FF8316',
        data: { type: 'exit-recommendation', poiId: rec.fromPoiId, url: '/(tabs)' },
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
  notifyTrailOverstay,
  notifyRecommendations,
};
