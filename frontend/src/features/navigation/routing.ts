// F06 / PB-11 – Rute jalan kaki mengikuti jalan (OSRM, data OpenStreetMap).
// Jika jaringan/servis gagal, pemanggil memakai fallback garis lurus.
import { useEffect, useRef, useState } from 'react';
import { haversineM, type LatLng } from '@/lib/geo';

/** Server OSRM publik FOSSGIS dengan profil pejalan kaki. */
export const OSRM_FOOT_URL = 'https://routing.openstreetmap.de/routed-foot/route/v1/foot';

/** Jarak maksimum dari garis rute sebelum rute dihitung ulang. */
export const OFF_ROUTE_THRESHOLD_M = 25;
/** Jeda minimum antar-permintaan rute agar tidak membanjiri server. */
const REFETCH_COOLDOWN_MS = 15_000;
const FETCH_TIMEOUT_MS = 8_000;

/**
 * Meminta rute jalan kaki dari OSRM. Mengembalikan daftar titik dari `from` ke `to`
 * (titik asal & tujuan asli ikut disambungkan, karena OSRM men-snap ke jalan terdekat),
 * atau `null` jika gagal.
 */
export async function fetchWalkingRoute(from: LatLng, to: LatLng): Promise<LatLng[] | null> {
  const coords = `${from.longitude},${from.latitude};${to.longitude},${to.latitude}`;
  const url = `${OSRM_FOOT_URL}/${coords}?overview=full&geometries=geojson`;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  try {
    const res = await fetch(url, { signal: controller.signal });
    if (!res.ok) return null;
    const json = (await res.json()) as {
      code?: string;
      routes?: { geometry?: { coordinates?: [number, number][] } }[];
    };
    const line = json.routes?.[0]?.geometry?.coordinates;
    if (json.code !== 'Ok' || !line || line.length < 2) return null;
    return [from, ...line.map(([lon, lat]) => ({ latitude: lat, longitude: lon })), to];
  } catch {
    return null;
  } finally {
    clearTimeout(timer);
  }
}

export type RouteProjection = {
  /** Indeks segmen [segmentIndex, segmentIndex + 1] tempat titik terdekat berada. */
  segmentIndex: number;
  /** Titik terdekat di garis rute. */
  point: LatLng;
  /** Jarak pengguna ke garis rute (meter). */
  offRouteM: number;
};

// Proyeksi ekuirektangular lokal (cukup akurat untuk skala ratusan meter).
const M_PER_DEG_LAT = 111_320;
function toXY(p: LatLng, refLat: number) {
  return {
    x: p.longitude * M_PER_DEG_LAT * Math.cos((refLat * Math.PI) / 180),
    y: p.latitude * M_PER_DEG_LAT,
  };
}

/** Mencari titik terdekat di polyline rute dari posisi pengguna. */
export function projectOntoRoute(route: LatLng[], user: LatLng): RouteProjection | null {
  if (route.length < 2) return null;
  const u = toXY(user, user.latitude);
  let best: RouteProjection | null = null;
  for (let i = 0; i < route.length - 1; i++) {
    const a = route[i];
    const b = route[i + 1];
    const pa = toXY(a, user.latitude);
    const pb = toXY(b, user.latitude);
    const dx = pb.x - pa.x;
    const dy = pb.y - pa.y;
    const len2 = dx * dx + dy * dy;
    const t = len2 === 0 ? 0 : Math.max(0, Math.min(1, ((u.x - pa.x) * dx + (u.y - pa.y) * dy) / len2));
    const point = {
      latitude: a.latitude + (b.latitude - a.latitude) * t,
      longitude: a.longitude + (b.longitude - a.longitude) * t,
    };
    const d = haversineM(user, point);
    if (!best || d < best.offRouteM) best = { segmentIndex: i, point, offRouteM: d };
  }
  return best;
}

/** Panjang total polyline (meter). */
export function routeLengthM(route: LatLng[]): number {
  let total = 0;
  for (let i = 0; i < route.length - 1; i++) total += haversineM(route[i], route[i + 1]);
  return total;
}

/**
 * Sisa rute dari posisi pengguna: [posisi pengguna, titik proyeksi, ...titik rute berikutnya].
 * Bagian rute yang sudah dilewati dibuang supaya garis di peta "habis" seiring berjalan.
 */
export function remainingRoute(route: LatLng[], user: LatLng): LatLng[] {
  const proj = projectOntoRoute(route, user);
  if (!proj) return route;
  return [user, proj.point, ...route.slice(proj.segmentIndex + 1)];
}

/**
 * Titik di sepanjang rute sejauh `aheadM` meter dari awal polyline.
 * Dipakai sebagai arah panah kompas (mengikuti belokan jalan, bukan garis lurus ke tujuan).
 */
export function pointAlongRoute(route: LatLng[], aheadM: number): LatLng {
  let remaining = aheadM;
  for (let i = 0; i < route.length - 1; i++) {
    const seg = haversineM(route[i], route[i + 1]);
    if (seg >= remaining && seg > 0) {
      const t = remaining / seg;
      return {
        latitude: route[i].latitude + (route[i + 1].latitude - route[i].latitude) * t,
        longitude: route[i].longitude + (route[i + 1].longitude - route[i].longitude) * t,
      };
    }
    remaining -= seg;
  }
  return route[route.length - 1];
}

/**
 * Hook rute jalan kaki ke tujuan. Rute diambil sekali di awal, lalu diambil ulang
 * hanya jika pengguna menyimpang > OFF_ROUTE_THRESHOLD_M dari rute (dengan cooldown).
 * `route` bernilai null selama belum ada rute (pemanggil memakai garis lurus).
 */
export function useWalkingRoute(user: LatLng | null, target: LatLng | null): {
  route: LatLng[] | null;
  isLoading: boolean;
} {
  const [route, setRoute] = useState<LatLng[] | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const lastFetchRef = useRef(0);
  const inFlightRef = useRef(false);

  const targetKey = target ? `${target.latitude},${target.longitude}` : null;
  // Kunci tujuan aktif; hasil fetch untuk tujuan lama / setelah unmount diabaikan.
  const activeKeyRef = useRef<string | null>(targetKey);

  // Tujuan berganti → buang rute lama.
  useEffect(() => {
    activeKeyRef.current = targetKey;
    setRoute(null);
    lastFetchRef.current = 0;
    return () => {
      activeKeyRef.current = null;
    };
  }, [targetKey]);

  useEffect(() => {
    if (!user || !target || inFlightRef.current) return;

    const proj = route ? projectOntoRoute(route, user) : null;
    const needsRoute = !route || (proj !== null && proj.offRouteM > OFF_ROUTE_THRESHOLD_M);
    if (!needsRoute) return;
    if (Date.now() - lastFetchRef.current < REFETCH_COOLDOWN_MS) return;

    const requestKey = targetKey;
    inFlightRef.current = true;
    lastFetchRef.current = Date.now();
    setIsLoading(true);
    void fetchWalkingRoute(user, target).then((result) => {
      inFlightRef.current = false;
      if (activeKeyRef.current !== requestKey) return;
      setIsLoading(false);
      if (result) setRoute(result);
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.latitude, user?.longitude, targetKey, route]);

  return { route, isLoading };
}
