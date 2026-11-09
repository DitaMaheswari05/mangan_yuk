// F03 — data & detail POI
import pois from '@/data/pois.json';
import type { MenuItem, Poi } from '@/types/content';

export const getPois = (): Poi[] => pois as Poi[];
export const getPoiById = (id: string): Poi | undefined => getPois().find((p) => p.id === id);

// F05 — filter per menu: tampilkan daftar menu dulu, lalu buka tenant lewat menu.poiId.
export const getAllMenuItems = (): MenuItem[] => getPois().flatMap((p) => p.menu);
