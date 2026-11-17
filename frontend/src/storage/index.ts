import AsyncStorage from '@react-native-async-storage/async-storage';
import { clearAllSecureData } from './secure';

export * from './secure';

// Data lokal non-sensitif pengguna (preferensi tampilan, cache geofence, dsb.).
export async function load<T>(key: string, fallback: T): Promise<T> {
  const raw = await AsyncStorage.getItem(key);
  return raw ? (JSON.parse(raw) as T) : fallback;
}

export async function save<T>(key: string, value: T): Promise<void> {
  await AsyncStorage.setItem(key, JSON.stringify(value));
}

export async function remove(key: string): Promise<void> {
  await AsyncStorage.removeItem(key);
}

/**
 * OWASP M9 & M6: Menghapus seluruh data lokal pengguna (AsyncStorage & SecureStore)
 * saat logout atau permintaan pembersihan data privasi.
 */
export async function clearAllUserData(): Promise<void> {
  try {
    await AsyncStorage.clear();
  } catch {
    // Abaikan kegagalan storage
  }
  await clearAllSecureData();
}
