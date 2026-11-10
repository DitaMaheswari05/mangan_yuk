// ============================================================================
// Unit Test: 10-onboarding-and-permissions.test.ts
// Terkait: PB-01, PB-02, F01, F09, Onboarding Flow, PermissionService, & Repositories
// ============================================================================

import AsyncStorage from '@react-native-async-storage/async-storage';
import * as Linking from 'expo-linking';
import * as Location from 'expo-location';
import * as Notifications from 'expo-notifications';
import {
  AppStateRepository,
  DEFAULT_ONBOARDING_STATE,
  PermissionService,
  PreferenceRepository,
  stepToHref,
} from '@/features/onboarding';

jest.mock('@react-native-async-storage/async-storage', () => {
  const store = new Map<string, string>();
  return {
    __esModule: true,
    default: {
      getItem: jest.fn(async (k: string) => store.get(k) ?? null),
      setItem: jest.fn(async (k: string, v: string) => {
        store.set(k, v);
      }),
      clear: jest.fn(async () => {
        store.clear();
      }),
    },
  };
});

jest.mock('expo-location', () => ({
  getForegroundPermissionsAsync: jest.fn(),
  requestForegroundPermissionsAsync: jest.fn(),
  hasServicesEnabledAsync: jest.fn(),
}));

jest.mock('expo-notifications', () => ({
  requestPermissionsAsync: jest.fn(),
}));

jest.mock('expo-linking', () => ({
  openSettings: jest.fn(),
}));

describe('Kategori 1: Alur Navigasi Onboarding (stepToHref)', () => {
  it('memetakan semua OnboardingStep ke route expo-router yang benar', () => {
    expect(stepToHref('intro')).toBe('/onboarding/welcome');
    expect(stepToHref('locationRationale')).toBe('/onboarding/location');
    expect(stepToHref('locationDenied')).toBe('/onboarding/no-location');
    expect(stepToHref('notification')).toBe('/onboarding/notification');
    expect(stepToHref('preference')).toBe('/onboarding/preferences');
  });
});

describe('Kategori 2: Penyimpanan Status Onboarding (AppStateRepository)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('mengembalikan default state saat belum ada data di storage', async () => {
    const res = await AppStateRepository.getOnboarding();
    expect(res).toEqual({ ok: true, data: DEFAULT_ONBOARDING_STATE });
  });

  it('menyimpan perubahan step dan menyelesaikan onboarding (completeOnboarding)', async () => {
    await AppStateRepository.setOnboardingStep('locationRationale');
    const stepRes = await AppStateRepository.getOnboarding();
    expect(stepRes.ok && stepRes.data.step).toBe('locationRationale');
    expect(stepRes.ok && stepRes.data.completed).toBe(false);

    await AppStateRepository.completeOnboarding();
    const doneRes = await AppStateRepository.getOnboarding();
    expect(doneRes.ok && doneRes.data.completed).toBe(true);
    expect(doneRes.ok && doneRes.data.step).toBe('preference');
  });

  it('menyimpan dan membaca PermissionSnapshot secara konsisten', async () => {
    await AppStateRepository.savePermissions({ locationForeground: 'granted' });
    await AppStateRepository.savePermissions({ notification: 'denied' });
    const permRes = await AppStateRepository.getPermissions();
    expect(permRes.ok).toBe(true);
    if (permRes.ok) {
      expect(permRes.data.locationForeground).toBe('granted');
      expect(permRes.data.notification).toBe('denied');
    }
  });
});

describe('Kategori 3: Preferensi Kuliner Pengguna (PreferenceRepository)', () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    jest.clearAllMocks();
  });

  it('menyimpan preferensi rasa, jenis makanan, dan halalOnly', async () => {
    await PreferenceRepository.save({
      tasteTags: ['pedas', 'manis'],
      foodTypes: ['makanan'],
      halalOnly: true,
    });
    const res = await PreferenceRepository.get();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.tasteTags).toEqual(['pedas', 'manis']);
      expect(res.data.foodTypes).toEqual(['makanan']);
      expect(res.data.halalOnly).toBe(true);
      expect(res.data.skipped).toBe(false);
    }
  });

  it('skip() mengosongkan pilihan dan menandai skipped=true', async () => {
    await PreferenceRepository.skip();
    const res = await PreferenceRepository.get();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.tasteTags).toEqual([]);
      expect(res.data.foodTypes).toEqual([]);
      expect(res.data.skipped).toBe(true);
    }
  });
});

describe('Kategori 4: Layanan Izin Perangkat (PermissionService)', () => {
  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('requestLocationForeground mengembalikan status granted atau denied sesuai respon sistem', async () => {
    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'granted',
    });
    const r1 = await PermissionService.requestLocationForeground();
    expect(r1).toEqual({ ok: true, data: 'granted' });

    (Location.requestForegroundPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
    });
    const r2 = await PermissionService.requestLocationForeground();
    expect(r2).toEqual({ ok: true, data: 'denied' });
  });

  it('requestNotification tidak gagal / throw error walaupun izin ditolak sistem', async () => {
    (Notifications.requestPermissionsAsync as jest.Mock).mockResolvedValueOnce({
      status: 'denied',
      granted: false,
    });
    const res = await PermissionService.requestNotification();
    expect(res).toEqual({ ok: true, data: 'denied' });
  });

  it('openAppSettings memanggil fungsi native Linking.openSettings()', async () => {
    await PermissionService.openAppSettings();
    expect(Linking.openSettings).toHaveBeenCalledTimes(1);
  });
});
