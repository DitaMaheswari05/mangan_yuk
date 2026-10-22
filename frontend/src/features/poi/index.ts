// F03 – data & detail POI
import pois from '@/data/pois.json';
import type { Poi } from '@/types/content';

export const getPois = (): Poi[] => pois as Poi[];
export const getPoiById = (id: string): Poi | undefined => getPois().find((p) => p.id === id);
