// Trail aktif disimpan di AsyncStorage agar dwell event dan pengingat overstay dari background
// task (layar terkunci) tetap mengubah trail yang sama dengan yang tampil di UI.

import { useEffect, useState } from 'react';
import { load, remove, save } from '@/storage';
import type { TrailSession } from './progress';

const KEY = 'trail.session.v1';

let cache: TrailSession | null | undefined;
let queue: Promise<unknown> = Promise.resolve();
const listeners = new Set<(s: TrailSession | null) => void>();

async function read(): Promise<TrailSession | null> {
  if (cache === undefined) {
    try {
      cache = await load<TrailSession | null>(KEY, null);
    } catch {
      cache = null;
    }
  }
  return cache;
}

async function write(next: TrailSession | null): Promise<void> {
  cache = next;
  try {
    if (next) await save(KEY, next);
    else await remove(KEY);
  } catch {
    // Gagal simpan tidak boleh menghentikan trail; state di memori tetap dipakai.
  }
  listeners.forEach((l) => l(next));
}

/** Panggilan diserialkan supaya update dari background dan UI tidak saling menimpa. */
function enqueue<T>(job: () => Promise<T>): Promise<T> {
  const run = queue.then(job);
  queue = run.catch(() => {});
  return run;
}

export const TrailSessionStore = {
  get(): Promise<TrailSession | null> {
    return enqueue(read);
  },

  start(session: TrailSession): Promise<void> {
    return enqueue(() => write(session));
  },

  /** `fn` mengembalikan objek yang sama jika tidak ada perubahan; tidak ada penulisan. */
  update(fn: (s: TrailSession) => TrailSession): Promise<TrailSession | null> {
    return enqueue(async () => {
      const current = await read();
      if (!current) return null;
      const next = fn(current);
      if (next !== current) await write(next);
      return next;
    });
  },

  end(): Promise<void> {
    return enqueue(() => write(null));
  },

  subscribe(listener: (s: TrailSession | null) => void): () => void {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },

  /** Hanya untuk test. */
  __reset(): void {
    cache = undefined;
    queue = Promise.resolve();
    listeners.clear();
  },
};

/** `undefined` selama masih memuat dari storage. */
export function useTrailSession(): TrailSession | null | undefined {
  const [session, setSession] = useState<TrailSession | null | undefined>(cache);
  useEffect(() => {
    let active = true;
    const unsub = TrailSessionStore.subscribe((s) => active && setSession(s));
    void TrailSessionStore.get().then((s) => active && setSession(s));
    return () => {
      active = false;
      unsub();
    };
  }, []);
  return session;
}
