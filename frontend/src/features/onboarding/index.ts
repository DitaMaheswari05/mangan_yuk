// PB01 & PB02 – Onboarding state, PermissionService, AppStateRepository, PreferenceRepository
// Lihat docs/api/client-contracts.yaml (PB01_navigation, PB02_permissions_and_state).

import { fail, ok, type Result } from '@/lib/result';
import { load, save } from '@/storage';
import type { FoodType, TasteTag } from '@/types/content';

export type PermStatus = 'undetermined' | 'granted' | 'denied';

export type OnboardingStep =
  | 'intro'
  | 'locationRationale'
  | 'locationDenied'
  | 'notification'
  | 'preference';

export type OnboardingState = {
  completed: boolean;
  step: OnboardingStep;
  completedAt?: string;
};

export type PermissionSnapshot = {
  locationForeground: PermStatus;
  notification: PermStatus;
  updatedAt: string;
};

export type UserPreferences = {
  tasteTags: TasteTag[];
  foodTypes: FoodType[];
  halalOnly: boolean;
  skipped: boolean;
  updatedAt: string;
};

export const STORAGE_KEYS = {
  ONBOARDING: 'manganyuk:onboarding',
  PERMISSIONS: 'manganyuk:permissions',
  PREFERENCES: 'manganyuk:preferences',
} as const;

export const DEFAULT_ONBOARDING_STATE: OnboardingState = {
  completed: false,
  step: 'intro',
};

export const DEFAULT_PERMISSION_SNAPSHOT: PermissionSnapshot = {
  locationForeground: 'undetermined',
  notification: 'undetermined',
  updatedAt: new Date(0).toISOString(),
};

export const DEFAULT_USER_PREFERENCES: UserPreferences = {
  tasteTags: [],
  foodTypes: [],
  halalOnly: false,
  skipped: false,
  updatedAt: new Date(0).toISOString(),
};

export function stepToHref(
  step: OnboardingStep,
):
  | '/onboarding/welcome'
  | '/onboarding/location'
  | '/onboarding/no-location'
  | '/onboarding/notification'
  | '/onboarding/preferences' {
  switch (step) {
    case 'intro':
      return '/onboarding/welcome';
    case 'locationRationale':
      return '/onboarding/location';
    case 'locationDenied':
      return '/onboarding/no-location';
    case 'notification':
      return '/onboarding/notification';
    case 'preference':
      return '/onboarding/preferences';
  }
}

function mapPermissionStatus(status: string | undefined): PermStatus {
  if (status === 'granted') return 'granted';
  if (status === 'denied') return 'denied';
  return 'undetermined';
}

export const PermissionService = {
  async getLocationStatus(): Promise<PermStatus> {
    try {
      // Lazy require agar tidak crash di Expo Go bila ada perbedaan modul native
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const res = await Location.getForegroundPermissionsAsync();
      return mapPermissionStatus(res.status);
    } catch {
      return 'undetermined';
    }
  },

  /**
   * Wajib dipanggil SETELAH layar LocationRationale tampil (F09-AC1).
   */
  async requestLocationForeground(): Promise<Result<PermStatus>> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      const res = await Location.requestForegroundPermissionsAsync();
      return ok(mapPermissionStatus(res.status));
    } catch (e) {
      return fail('LOCATION_UNAVAILABLE', 'Gagal meminta izin lokasi.', e);
    }
  },

  async requestNotification(): Promise<Result<PermStatus>> {
    try {
      // PENTING untuk Expo Go di Android:
      // Jangan require barrel utama 'expo-notifications' karena memuat 'TopicSubscriptionModule'
      // yang memanggil requireNativeModule('ExpoTopicSubscriptionModule') secara top-level
      // dan crash/throw uncaught error karena tidak di-compile di binary Expo Go.
      // Langsung impor NotificationPermissions secara terisolasi.
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const NotificationPermissions = require('expo-notifications/build/NotificationPermissions') as {
        requestPermissionsAsync: () => Promise<{ granted?: boolean; status?: string }>;
      };
      const res = await NotificationPermissions.requestPermissionsAsync();
      const status =
        res.granted || res.status === 'granted'
          ? 'granted'
          : res.status === 'denied'
            ? 'denied'
            : 'undetermined';
      return ok(status);
    } catch {
      // Jika di Expo Go Android modul native notifikasi tidak tersedia sama sekali,
      // tangani dengan graceful fallback agar onboarding tetap bisa lanjut
      return ok('denied');
    }
  },

  async openAppSettings(): Promise<void> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Linking = require('expo-linking') as typeof import('expo-linking');
      await Linking.openSettings();
    } catch {
      // Abaikan jika perangkat tidak mendukung openSettings
    }
  },

  async isLocationServicesEnabled(): Promise<boolean> {
    try {
      // eslint-disable-next-line @typescript-eslint/no-require-imports
      const Location = require('expo-location') as typeof import('expo-location');
      return await Location.hasServicesEnabledAsync();
    } catch {
      return false;
    }
  },
};

export const AppStateRepository = {
  async getOnboarding(): Promise<Result<OnboardingState>> {
    try {
      const state = await load<OnboardingState>(
        STORAGE_KEYS.ONBOARDING,
        DEFAULT_ONBOARDING_STATE,
      );
      return ok(state);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal membaca status onboarding.', e);
    }
  },

  async setOnboardingStep(step: OnboardingStep): Promise<Result<void>> {
    try {
      const current = await load<OnboardingState>(
        STORAGE_KEYS.ONBOARDING,
        DEFAULT_ONBOARDING_STATE,
      );
      await save<OnboardingState>(STORAGE_KEYS.ONBOARDING, {
        ...current,
        step,
      });
      return ok(undefined);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal menyimpan langkah onboarding.', e);
    }
  },

  async completeOnboarding(): Promise<Result<void>> {
    try {
      await save<OnboardingState>(STORAGE_KEYS.ONBOARDING, {
        completed: true,
        step: 'preference',
        completedAt: new Date().toISOString(),
      });
      return ok(undefined);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal menyelesaikan onboarding.', e);
    }
  },

  async resetOnboarding(): Promise<Result<void>> {
    try {
      await save<OnboardingState>(
        STORAGE_KEYS.ONBOARDING,
        DEFAULT_ONBOARDING_STATE,
      );
      return ok(undefined);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal mereset status onboarding.', e);
    }
  },

  async getPermissions(): Promise<Result<PermissionSnapshot>> {
    try {
      const snapshot = await load<PermissionSnapshot>(
        STORAGE_KEYS.PERMISSIONS,
        DEFAULT_PERMISSION_SNAPSHOT,
      );
      return ok(snapshot);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal membaca status izin.', e);
    }
  },

  async savePermissions(
    p: Partial<Omit<PermissionSnapshot, 'updatedAt'>>,
  ): Promise<Result<void>> {
    try {
      const current = await load<PermissionSnapshot>(
        STORAGE_KEYS.PERMISSIONS,
        DEFAULT_PERMISSION_SNAPSHOT,
      );
      await save<PermissionSnapshot>(STORAGE_KEYS.PERMISSIONS, {
        ...current,
        ...p,
        updatedAt: new Date().toISOString(),
      });
      return ok(undefined);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal menyimpan status izin.', e);
    }
  },
};

export const PreferenceRepository = {
  async get(): Promise<Result<UserPreferences>> {
    try {
      const prefs = await load<UserPreferences>(
        STORAGE_KEYS.PREFERENCES,
        DEFAULT_USER_PREFERENCES,
      );
      return ok({
        ...DEFAULT_USER_PREFERENCES,
        ...prefs,
      });
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal membaca preferensi pengguna.', e);
    }
  },

  async save(
    p: Omit<UserPreferences, 'updatedAt' | 'halalOnly' | 'skipped'> & {
      halalOnly?: boolean;
      skipped?: boolean;
    },
  ): Promise<Result<void>> {
    try {
      await save<UserPreferences>(STORAGE_KEYS.PREFERENCES, {
        tasteTags: p.tasteTags,
        foodTypes: p.foodTypes,
        halalOnly: p.halalOnly ?? false,
        skipped: p.skipped ?? false,
        updatedAt: new Date().toISOString(),
      });
      return ok(undefined);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal menyimpan preferensi pengguna.', e);
    }
  },

  async skip(): Promise<Result<void>> {
    try {
      await save<UserPreferences>(STORAGE_KEYS.PREFERENCES, {
        tasteTags: [],
        foodTypes: [],
        halalOnly: false,
        skipped: true,
        updatedAt: new Date().toISOString(),
      });
      return ok(undefined);
    } catch (e) {
      return fail('STORAGE_ERROR', 'Gagal melewati preferensi pengguna.', e);
    }
  },
};
