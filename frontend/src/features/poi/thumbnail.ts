import { CONTENT_ASSETS } from '@/data/assets';
import type { Poi } from '@/types/content';

/** Foto thumbnail tenant: utamakan foto 'tenant', lalu foto apa pun; null bila belum ada. */
export function getPoiThumbnail(poi: Pick<Poi, 'photos'>): number | null {
  const ordered = [...poi.photos.filter((p) => p.kind === 'tenant'), ...poi.photos];
  for (const p of ordered) {
    const src = CONTENT_ASSETS[p.assetKey];
    if (src) return src;
  }
  return null;
}
