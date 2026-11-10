// F02 / PB07 – Riwayat kunjungan tenant, dicatat otomatis oleh dwell event.
// Disimpan di AsyncStorage sehingga tetap ada walau dwell terjadi saat app di background.

import { useEffect, useState } from 'react';
import { load, save } from '@/storage';

export type VisitRecord = {
  poiId: string;
  /** Kunjungan pertama (ISO). */
  firstVisitedAt: string;
  /** Kunjungan terakhir (ISO). */
  lastVisitedAt: string;
  count: number;
};

type VisitMap = Record<string, VisitRecord>;

const KEY = 'visits.v1';
const listeners = new Set<(visits: VisitMap) => void>();

async function getAll(): Promise<VisitMap> {
  try {
    return await load<VisitMap>(KEY, {});
  } catch {
    return {};
  }
}

async function markVisited(poiId: string, at: number = Date.now()): Promise<VisitRecord> {
  const visits = await getAll();
  const iso = new Date(at).toISOString();
  const prev = visits[poiId];
  const record: VisitRecord = prev
    ? { ...prev, lastVisitedAt: iso, count: prev.count + 1 }
    : { poiId, firstVisitedAt: iso, lastVisitedAt: iso, count: 1 };
  const next = { ...visits, [poiId]: record };
  await save(KEY, next);
  listeners.forEach((l) => l(next));
  return record;
}

async function isVisited(poiId: string): Promise<boolean> {
  return poiId in (await getAll());
}

async function clear(): Promise<void> {
  await save(KEY, {});
  listeners.forEach((l) => l({}));
}

export const VisitRepository = { getAll, markVisited, isVisited, clear };

/** Set ID POI yang sudah dikunjungi; ikut ter-update saat dwell event tercatat. */
export function useVisitedPoiIds(): Set<string> {
  const [ids, setIds] = useState<Set<string>>(() => new Set());

  useEffect(() => {
    let active = true;
    const apply = (v: VisitMap) => {
      if (active) setIds(new Set(Object.keys(v)));
    };
    void getAll().then(apply);
    listeners.add(apply);
    return () => {
      active = false;
      listeners.delete(apply);
    };
  }, []);

  return ids;
}
