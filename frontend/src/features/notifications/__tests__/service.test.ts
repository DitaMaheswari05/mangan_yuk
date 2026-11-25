import type { Poi } from '@/types/content';
import {
  ACTION_LISTEN,
  ACTION_SKIP,
  dismissPersistentExploreNotification,
  ensureNotificationSetup,
  EXPLORE_CHANNEL_ID,
  EXPLORE_NOTIFICATION_ID,
  GEOFENCE_CHANNEL_ID,
  notifyAreaEntry,
  notifyNearbyPoi,
  notifyRecommendations,
  notifyTrailOverstay,
  POI_PROXIMITY_CATEGORY,
  showPersistentExploreNotification,
} from '../index';

const mockSetNotificationHandler = jest.fn((..._args: unknown[]) => {});
const mockSetNotificationChannelAsync = jest.fn(async (..._args: unknown[]) => {});
const mockSetNotificationCategoryAsync = jest.fn(async (..._args: unknown[]) => {});
const mockGetPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
const mockRequestPermissionsAsync = jest.fn(async () => ({ status: 'granted' }));
const mockScheduleNotificationAsync = jest.fn(async (..._args: unknown[]) => 'notif-id-1');
const mockDismissNotificationAsync = jest.fn(async (..._args: unknown[]) => {});
const mockCancelScheduledNotificationAsync = jest.fn(async (..._args: unknown[]) => {});

jest.mock('react-native', () => ({
  Platform: { OS: 'android' },
}));

jest.mock('expo-notifications', () => ({
  AndroidImportance: { DEFAULT: 3, MAX: 5 },
  AndroidNotificationVisibility: { PUBLIC: 1 },
  AndroidNotificationPriority: { MAX: 'max' },
  setNotificationHandler: (...args: unknown[]) => mockSetNotificationHandler(...args),
  setNotificationChannelAsync: (...args: unknown[]) => mockSetNotificationChannelAsync(...args),
  setNotificationCategoryAsync: (...args: unknown[]) => mockSetNotificationCategoryAsync(...args),
  getPermissionsAsync: () => mockGetPermissionsAsync(),
  requestPermissionsAsync: () => mockRequestPermissionsAsync(),
  scheduleNotificationAsync: (...args: unknown[]) => mockScheduleNotificationAsync(...args),
  dismissNotificationAsync: (...args: unknown[]) => mockDismissNotificationAsync(...args),
  cancelScheduledNotificationAsync: (...args: unknown[]) => mockCancelScheduledNotificationAsync(...args),
}));

const samplePoi = {
  id: 'P01',
  name: 'Pisang Goreng Kipas',
  categoryLabel: 'Camilan',
} as Poi;

describe('NotificationService', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetPermissionsAsync.mockResolvedValue({ status: 'granted' });
    mockRequestPermissionsAsync.mockResolvedValue({ status: 'granted' });
  });

  it('ensureNotificationSetup mengatur handler, channel Android publik/heads-up, dan kategori aksi', async () => {
    await ensureNotificationSetup();

    expect(mockSetNotificationHandler).toHaveBeenCalledTimes(1);
    const handlerArg = mockSetNotificationHandler.mock.calls[0][0] as {
      handleNotification: (n: { request: { content: { data?: { type?: string } } } }) => Promise<{
        shouldShowAlert: boolean;
        shouldPlaySound: boolean;
      }>;
    };

    const persistentBehavior = await handlerArg.handleNotification({
      request: { content: { data: { type: 'explore-mode-persistent' } } },
    });
    expect(persistentBehavior.shouldPlaySound).toBe(false);

    const alertBehavior = await handlerArg.handleNotification({
      request: { content: { data: { type: 'poi-geofence-enter' } } },
    });
    expect(alertBehavior.shouldPlaySound).toBe(true);
    expect(alertBehavior.shouldShowAlert).toBe(true);

    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      EXPLORE_CHANNEL_ID,
      expect.objectContaining({
        importance: 3,
        lockscreenVisibility: 1,
        enableVibrate: false,
      }),
    );
    expect(mockSetNotificationChannelAsync).toHaveBeenCalledWith(
      GEOFENCE_CHANNEL_ID,
      expect.objectContaining({
        importance: 5,
        sound: 'default',
        enableVibrate: true,
        lockscreenVisibility: 1,
      }),
    );
    expect(mockSetNotificationCategoryAsync).toHaveBeenCalledWith(
      POI_PROXIMITY_CATEGORY,
      expect.arrayContaining([
        expect.objectContaining({ identifier: ACTION_LISTEN }),
        expect.objectContaining({ identifier: ACTION_SKIP }),
      ]),
    );
  });

  it('notifyNearbyPoi menjadwalkan heads-up notification dengan payload & mode autoPlaying', async () => {
    await notifyNearbyPoi(samplePoi, 12, { autoPlaying: true });

    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'poi-nearby-P01',
        content: expect.objectContaining({
          title: 'Kamu mendekati Pisang Goreng Kipas',
          body: expect.stringContaining('Memutar narasi otomatis (Mode Jalan)'),
          priority: 'max',
          interruptionLevel: 'timeSensitive',
          channelId: GEOFENCE_CHANNEL_ID,
          categoryIdentifier: POI_PROXIMITY_CATEGORY,
          data: expect.objectContaining({
            type: 'poi-geofence-enter',
            poiId: 'P01',
            url: '/poi/P01',
            autoPlaying: true,
          }),
        }),
      }),
    );
  });

  it('notifyNearbyPoi tidak menjadwalkan notifikasi bila izin ditolak', async () => {
    mockGetPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });
    mockRequestPermissionsAsync.mockResolvedValueOnce({ status: 'denied' });

    await notifyNearbyPoi(samplePoi, 10);

    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();
  });

  it('notifyAreaEntry & notifyTrailOverstay memformat pesan sisa stop tunggal vs banyak', async () => {
    await notifyAreaEntry('Sudirman Street Food');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'area-entry',
        content: expect.objectContaining({ title: 'Selamat datang di Sudirman Street Food!' }),
      }),
    );

    await notifyTrailOverstay({
      poiId: 'P01',
      poiName: 'Pisang Goreng Kipas',
      dwellMin: 16,
      remainingMin: 30,
      remainingStops: 2,
    });
    expect(mockScheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: 'Sisa waktumu 30 menit, masih ada 2 tenant lagi.',
        }),
      }),
    );

    await notifyTrailOverstay({
      poiId: 'P02',
      poiName: 'Soto Bandung',
      dwellMin: 20,
      remainingMin: 5,
      remainingStops: 0,
    });
    expect(mockScheduleNotificationAsync).toHaveBeenLastCalledWith(
      expect.objectContaining({
        content: expect.objectContaining({
          body: 'Sisa waktumu 5 menit, ini tenant terakhir di trailmu.',
        }),
      }),
    );
  });

  it('notifyRecommendations mengabaikan daftar kosong dan memformat daftar rekomendasi', async () => {
    await notifyRecommendations({ fromPoiId: 'P01', fromPoiName: 'A', items: [] });
    expect(mockScheduleNotificationAsync).not.toHaveBeenCalled();

    await notifyRecommendations({
      fromPoiId: 'P01',
      fromPoiName: 'Pisang Goreng',
      items: [
        { poiName: 'Sate', distanceM: 15 },
        { poiName: 'Es Campur', distanceM: 30 },
      ],
    });
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: 'exit-recommendation',
        content: expect.objectContaining({
          title: 'Selesai di Pisang Goreng? Coba ini berikutnya',
          body: 'Sate (~15 m), Es Campur (~30 m)',
        }),
      }),
    );
  });

  it('showPersistentExploreNotification & dismissPersistentExploreNotification mengelola notifikasi permanen', async () => {
    const id = await showPersistentExploreNotification({ nearestPoiName: 'Batagor', distanceM: 18 });
    expect(id).toBe('notif-id-1');
    expect(mockScheduleNotificationAsync).toHaveBeenCalledWith(
      expect.objectContaining({
        identifier: EXPLORE_NOTIFICATION_ID,
        content: expect.objectContaining({
          sticky: true,
          autoDismiss: false,
          body: expect.stringContaining('Di dekat Batagor (~18m)'),
          channelId: EXPLORE_CHANNEL_ID,
        }),
      }),
    );

    await dismissPersistentExploreNotification();
    expect(mockDismissNotificationAsync).toHaveBeenCalledWith('notif-id-1');
    expect(mockDismissNotificationAsync).toHaveBeenCalledWith(EXPLORE_NOTIFICATION_ID);
    expect(mockCancelScheduledNotificationAsync).toHaveBeenCalledWith('notif-id-1');
  });
});
