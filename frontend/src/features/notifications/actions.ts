// F04 – Respons tombol notifikasi proximity (Dengar / Lewati), dipakai bersama oleh listener di
// root layout (app terbuka) dan background notification task (app di background / di-kill, Android).
import * as Notifications from 'expo-notifications';
import { AudioQueue, playNarration } from '@/features/audio';
import { getPoiById } from '@/features/poi';
import { isValidInternalRoute, sanitizePoiId } from '@/lib/validation';
import { ACTION_LISTEN, ACTION_SKIP } from './index';

export type NotificationResponseResult =
  | { kind: 'listen'; poiId: string }
  | { kind: 'skip'; poiId: string }
  | { kind: 'open'; url: string }
  | { kind: 'ignored' };

// Saat app di background tapi proses masih hidup, task dan listener bisa menerima respons yang
// sama. Kunci respons yang sudah ditangani supaya narasi tidak diputar dua kali.
const handled = new Set<string>();
const MAX_HANDLED = 50;

function responseKey(r: Notifications.NotificationResponse): string {
  return `${r.notification.request.identifier}|${r.notification.date}|${r.actionIdentifier}`;
}

async function dismiss(r: Notifications.NotificationResponse): Promise<void> {
  try {
    await Notifications.dismissNotificationAsync(r.notification.request.identifier);
  } catch {
    // abaikan
  }
}

export async function handleNotificationResponse(
  response: Notifications.NotificationResponse | null | undefined,
  opts: { allowActions?: boolean } = {},
): Promise<NotificationResponseResult> {
  if (!response) return { kind: 'ignored' };
  const { allowActions = true } = opts;
  const data = response.notification.request.content.data ?? {};
  const action = response.actionIdentifier;

  if (action === ACTION_LISTEN || action === ACTION_SKIP) {
    if (!allowActions) return { kind: 'ignored' };
    const key = responseKey(response);
    if (handled.has(key)) return { kind: 'ignored' };
    handled.add(key);
    if (handled.size > MAX_HANDLED) handled.delete(handled.values().next().value as string);

    const poiId = sanitizePoiId(data.poiId);
    await dismiss(response);
    if (!poiId) return { kind: 'ignored' };

    if (action === ACTION_SKIP) {
      await AudioQueue.stop();
      return { kind: 'skip', poiId };
    }

    const poi = getPoiById(poiId);
    if (poi) await playNarration(poi);
    return { kind: 'listen', poiId };
  }

  if (action === Notifications.DEFAULT_ACTION_IDENTIFIER && isValidInternalRoute(data.url)) {
    return { kind: 'open', url: data.url };
  }
  return { kind: 'ignored' };
}
