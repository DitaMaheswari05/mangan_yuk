// OWASP M9 / MASVS-STORAGE-1: Penyimpanan terenkripsi untuk token JWT dan data sensitif
import * as SecureStore from 'expo-secure-store';

export const SECURE_KEYS = {
  ACCESS_TOKEN: 'manganyuk_access_token',
  REFRESH_TOKEN: 'manganyuk_refresh_token',
  USER_SESSION: 'manganyuk_user_session',
} as const;

export async function saveSecure(key: string, value: string): Promise<void> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.setItemAsync(key, value, {
        keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
      });
    }
  } catch {
    // Abaikan kegagalan platform jika SecureStore tidak didukung di lingkungan web/test
  }
}

export async function loadSecure(key: string): Promise<string | null> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (!isAvailable) return null;
    return await SecureStore.getItemAsync(key);
  } catch {
    return null;
  }
}

export async function deleteSecure(key: string): Promise<void> {
  try {
    const isAvailable = await SecureStore.isAvailableAsync();
    if (isAvailable) {
      await SecureStore.deleteItemAsync(key);
    }
  } catch {
    // Abaikan kegagalan platform
  }
}

export async function clearAllSecureData(): Promise<void> {
  await Promise.all([
    deleteSecure(SECURE_KEYS.ACCESS_TOKEN),
    deleteSecure(SECURE_KEYS.REFRESH_TOKEN),
    deleteSecure(SECURE_KEYS.USER_SESSION),
  ]);
}
