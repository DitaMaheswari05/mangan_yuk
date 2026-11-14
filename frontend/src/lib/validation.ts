// OWASP M4: Insufficient Input/Output Validation
// Modul validasi dan sanitasi input untuk parameter deep link, notifikasi, dan rute.

import type { TasteTag } from '@/types/content';

const POI_ID_REGEX = /^P[0-9]{2}$/i;

const ALLOWED_INTERNAL_ROUTE_PATTERNS = [
  /^\/\(tabs\)(\/.*)?$/,
  /^\/poi\/P[0-9]{2}$/i,
  /^\/navigate\/P[0-9]{2}$/i,
  /^\/trail\/(itinerary|planner|summary)$/,
  /^\/onboarding\/(welcome|location|no-location|notification|preferences)$/,
];

const VALID_TASTES: Set<TasteTag> = new Set(['pedas', 'manis', 'gurih', 'segar', 'aromatik']);

/**
 * Memeriksa apakah suatu string merupakan format POI ID yang valid (P01..P99).
 */
export function isValidPoiId(id: unknown): id is string {
  if (typeof id !== 'string') return false;
  return POI_ID_REGEX.test(id.trim());
}

/**
 * Mensanitasi POI ID: mengembalikan ID dalam huruf besar (mis. 'P01') atau null jika format tidak valid.
 */
export function sanitizePoiId(id: unknown): string | null {
  if (Array.isArray(id)) id = id[0];
  if (!isValidPoiId(id)) return null;
  return id.trim().toUpperCase();
}

/**
 * OWASP M4 / MASVS-PLATFORM-2: Memvalidasi rute navigasi dari notifikasi/deep link
 * untuk mencegah open redirect atau navigasi ke path tak dikenal / arbitrer.
 */
export function isValidInternalRoute(url: unknown): url is string {
  if (typeof url !== 'string') return false;
  const cleanUrl = url.trim().split('?')[0];
  return ALLOWED_INTERNAL_ROUTE_PATTERNS.some((pattern) => pattern.test(cleanUrl));
}

/**
 * Mensanitasi angka dengan batas minimum dan maksimum serta nilai fallback aman.
 */
export function sanitizeNumber(
  val: unknown,
  fallback: number,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
): number {
  if (Array.isArray(val)) val = val[0];
  if (typeof val === 'number' && !isNaN(val)) {
    return Math.max(min, Math.min(max, val));
  }
  if (typeof val === 'string') {
    const parsed = parseInt(val.replace(/\D/g, ''), 10);
    if (!isNaN(parsed)) {
      return Math.max(min, Math.min(max, parsed));
    }
  }
  return fallback;
}

/**
 * Mensanitasi daftar label rasa kuliner (TasteTag).
 */
export function sanitizeTastes(val: unknown, fallback: TasteTag[] = ['gurih']): TasteTag[] {
  if (Array.isArray(val)) {
    const filtered = val.filter((t): t is TasteTag => typeof t === 'string' && VALID_TASTES.has(t as TasteTag));
    return filtered.length > 0 ? filtered : fallback;
  }
  if (typeof val === 'string') {
    const list = val.split(',').map((s) => s.trim().toLowerCase());
    const filtered = list.filter((t): t is TasteTag => VALID_TASTES.has(t as TasteTag));
    return filtered.length > 0 ? filtered : fallback;
  }
  return fallback;
}
