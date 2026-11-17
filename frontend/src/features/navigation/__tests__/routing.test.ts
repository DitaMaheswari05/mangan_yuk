// Unit Test: rute jalan kaki mengikuti jalan (F06 / PB-11)
import {
  computeRouteNavigationStatus,
  fetchWalkingRoute,
  pointAlongRoute,
  projectOntoRoute,
  remainingRoute,
  routeLengthM,
} from '@/features/navigation';
import type { LatLng } from '@/lib/geo';

const M_PER_DEG = (Math.PI / 180) * 6_371_000;
// Titik di sekitar ekuator: x = timur (m), y = utara (m)
const pt = (x: number, y: number): LatLng => ({ latitude: y / M_PER_DEG, longitude: x / M_PER_DEG });

// Rute berbentuk L: 50 m ke utara, lalu 50 m ke timur.
const L_ROUTE = [pt(0, 0), pt(0, 50), pt(50, 50)];

describe('Geometri rute', () => {
  it('menghitung panjang rute polyline', () => {
    expect(Math.round(routeLengthM(L_ROUTE))).toBe(100);
  });

  it('memproyeksikan posisi ke segmen terdekat', () => {
    const proj = projectOntoRoute(L_ROUTE, pt(5, 20))!;
    expect(proj.segmentIndex).toBe(0);
    expect(Math.round(proj.offRouteM)).toBe(5);
  });

  it('membuang bagian rute yang sudah dilewati', () => {
    const rest = remainingRoute(L_ROUTE, pt(20, 50));
    // [user, titik proyeksi, ujung rute]
    expect(rest).toHaveLength(3);
    expect(Math.round(routeLengthM(rest))).toBe(30);
  });

  it('mengambil titik di depan sepanjang rute, termasuk melewati belokan', () => {
    const p = pointAlongRoute(L_ROUTE, 60);
    expect(Math.round(p.longitude * M_PER_DEG)).toBe(10);
    expect(Math.round(p.latitude * M_PER_DEG)).toBe(50);
  });
});

describe('Status navigasi mengikuti rute', () => {
  it('panah menunjuk arah jalan (utara), bukan garis lurus ke tujuan (timur laut)', () => {
    const user = pt(0, 0);
    const target = pt(50, 50);
    const status = computeRouteNavigationStatus(user, 0, target, remainingRoute(L_ROUTE, user));
    expect(status.bearingDeg).toBe(0);
    expect(status.isOnTarget).toBe(true);
    expect(status.distanceM).toBe(100);
    expect(status.hasArrived).toBe(false);
  });

  it('kedatangan tetap terdeteksi saat ≤10 m dari tenant', () => {
    const user = pt(45, 50);
    const status = computeRouteNavigationStatus(user, 0, pt(50, 50), remainingRoute(L_ROUTE, user));
    expect(status.hasArrived).toBe(true);
  });
});

describe('fetchWalkingRoute', () => {
  const originalFetch = globalThis.fetch;
  afterEach(() => {
    globalThis.fetch = originalFetch;
  });

  it('mengubah geometri OSRM menjadi LatLng dan menyambung titik asal & tujuan', async () => {
    globalThis.fetch = jest.fn().mockResolvedValue({
      ok: true,
      json: async () => ({
        code: 'Ok',
        routes: [{ geometry: { coordinates: [[107.6, -6.92], [107.601, -6.921]] } }],
      }),
    }) as unknown as typeof fetch;
    const from = { latitude: -6.9199, longitude: 107.5999 };
    const to = { latitude: -6.9211, longitude: 107.6011 };
    const route = await fetchWalkingRoute(from, to);
    expect(route).toEqual([
      from,
      { latitude: -6.92, longitude: 107.6 },
      { latitude: -6.921, longitude: 107.601 },
      to,
    ]);
  });

  it('mengembalikan null saat jaringan gagal (fallback garis lurus)', async () => {
    globalThis.fetch = jest.fn().mockRejectedValue(new Error('offline')) as unknown as typeof fetch;
    expect(await fetchWalkingRoute(pt(0, 0), pt(10, 10))).toBeNull();
  });
});
