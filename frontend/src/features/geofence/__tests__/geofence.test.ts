import {
  AREA_ENTRY_RADIUS_M,
  AREA_EXIT_HYSTERESIS_M,
  DEFAULT_TENANT_TRIGGER_RADIUS_M,
  DWELL_DURATION_MS,
  GeofenceEngine,
  isInsideGeofence,
  POI_COOLDOWN_MS,
  TENANT_EXIT_HYSTERESIS_M,
} from '../index';
import type { AreaConfig, Poi } from '@/types/content';

const M_PER_DEG_LAT = (Math.PI / 180) * 6_371_000;
const offsetNorth = (lat: number, meters: number) => lat + meters / M_PER_DEG_LAT;

const testArea: AreaConfig = {
  id: 'sudirman-street-food',
  name: 'Sudirman Street Food',
  center: { latitude: -6.92089, longitude: 107.600574 },
  entryRadiusM: AREA_ENTRY_RADIUS_M, // 100 m
  exitHysteresisM: AREA_EXIT_HYSTERESIS_M, // 10 m
  googleMapsQuery: 'Sudirman Street Food',
};

const makeMockPoi = (id: string, name: string, offsetM = 0): Poi => ({
  id,
  name,
  slug: id.toLowerCase(),
  type: 'makanan',
  categoryLabel: 'Kuliner',
  tasteTags: ['gurih'],
  isHalal: true,
  zone: 'A',
  latitude: offsetNorth(testArea.center.latitude, offsetM),
  longitude: testArea.center.longitude,
  triggerRadiusM: DEFAULT_TENANT_TRIGGER_RADIUS_M, // 15 m
  avgVisitMin: 15,
  description: 'Test POI',
  culturalStory: null,
  photos: [],
  audio: null,
  menu: [],
  openingHours: [],
  peakHours: [],
  searchKeywords: [],
  qrCode: null,
  priceMinIdr: 10000,
  priceMaxIdr: 25000,
  priceBucket: 'under15k',
});

describe('Geofence - Jarak & isInsideGeofence', () => {
  const center = testArea.center;

  it('true jika pengguna tepat di POI', () => {
    expect(isInsideGeofence(center, center)).toBe(true);
  });

  it('radius default: masuk jika jarak <= radius, tidak jika di luar', () => {
    const inside = { ...center, latitude: offsetNorth(center.latitude, 8) };
    const outside = { ...center, latitude: offsetNorth(center.latitude, 18) };
    expect(isInsideGeofence(inside, center, 15)).toBe(true);
    expect(isInsideGeofence(outside, center, 15)).toBe(false);
  });
});

describe('SB-2.2: Modul Filter GPS Jitter & Logika Cooldown', () => {
  let engine: GeofenceEngine;
  const poi1 = makeMockPoi('P01', 'Tenant Sedap', 0);

  beforeEach(() => {
    engine = new GeofenceEngine();
  });

  it('mengabaikan pembacaan GPS dengan akurasi >30 m (filter jitter)', () => {
    const jitteryPosition = {
      coordinate: testArea.center,
      accuracyM: 35, // > 30 m
      timestamp: 1000,
    };

    const res = engine.processPosition(jitteryPosition, testArea, [poi1]);
    expect(res.discarded).toBe(true);
    expect(res.discardReason).toBe('GPS_JITTER_ACCURACY_TOO_LOW');
    expect(res.proximityPois).toHaveLength(0);
  });

  it('memproses pembacaan GPS dengan akurasi valid (<=30 m)', () => {
    const validPosition = {
      coordinate: testArea.center,
      accuracyM: 15, // <= 30 m
      timestamp: 1000,
    };

    const res = engine.processPosition(validPosition, testArea, [poi1]);
    expect(res.discarded).toBe(false);
    expect(res.proximityPois).toHaveLength(1);
    expect(res.proximityPois[0].poi.id).toBe('P01');
  });

  it('menerapkan cooldown 30 menit per POI: tidak memicu ulang dalam masa cooldown', () => {
    const t0 = 100_000;
    const pos = {
      coordinate: testArea.center,
      accuracyM: 10,
      timestamp: t0,
    };

    // Trigger pertama kali -> lolos proximity
    const res1 = engine.processPosition(pos, testArea, [poi1]);
    expect(res1.proximityPois).toHaveLength(1);
    expect(engine.isPoiInCooldown('P01', t0)).toBe(true);

    // Trigger 5 menit kemudian (t0 + 5 menit) -> cooldown aktif, tidak memicu proximity ulang
    const t1 = t0 + 5 * 60 * 1000;
    const posLater = { ...pos, timestamp: t1 };
    const res2 = engine.processPosition(posLater, testArea, [poi1]);
    expect(res2.proximityPois).toHaveLength(0);

    // Trigger 31 menit kemudian (t0 + 31 menit) -> cooldown habis, memicu proximity kembali
    const t2 = t0 + POI_COOLDOWN_MS + 1000;
    const posAfterCooldown = { ...pos, timestamp: t2 };
    const res3 = engine.processPosition(posAfterCooldown, testArea, [poi1]);
    expect(res3.proximityPois).toHaveLength(1);
  });
});

describe('SB-2.3: Entry Event Kawasan (100 m) & Proximity Event Tenant (<15 m)', () => {
  let engine: GeofenceEngine;
  const onAreaEntry = jest.fn();
  const onAreaExit = jest.fn();
  const onPoiProximity = jest.fn();
  const poi1 = makeMockPoi('P01', 'Tenant A', 0);

  beforeEach(() => {
    onAreaEntry.mockClear();
    onAreaExit.mockClear();
    onPoiProximity.mockClear();
    engine = new GeofenceEngine({
      onAreaEntry,
      onAreaExit,
      onPoiProximity,
    });
  });

  it('memicu Entry event kawasan saat pengguna memasuki radius 100 m', () => {
    // Pengguna berjarak ~80 m dari pusat kawasan
    const pos80m = {
      coordinate: {
        latitude: offsetNorth(testArea.center.latitude, 80),
        longitude: testArea.center.longitude,
      },
      accuracyM: 10,
      timestamp: 1000,
    };

    const res = engine.processPosition(pos80m, testArea, [poi1]);
    expect(res.areaEvent).toBe('ENTRY');
    expect(res.isInsideArea).toBe(true);
    expect(onAreaEntry).toHaveBeenCalledTimes(1);
  });

  it('memicu Proximity event tenant saat pengguna berada <15 m', () => {
    const posNearby = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 10), // 10 m dari tenant (<15 m)
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: 1000,
    };

    const res = engine.processPosition(posNearby, testArea, [poi1]);
    expect(res.proximityPois).toHaveLength(1);
    expect(res.proximityPois[0].poi.id).toBe('P01');
    expect(onPoiProximity).toHaveBeenCalledWith(poi1, expect.any(Number));
  });
});

describe('SB-2.4: Dwell Event (≥3 menit) & Exit Event (Hysteresis 10 m)', () => {
  let engine: GeofenceEngine;
  const onPoiDwell = jest.fn();
  const onPoiExit = jest.fn();
  const onAreaExit = jest.fn();
  const poi1 = makeMockPoi('P01', 'Tenant Dwell', 0);

  beforeEach(() => {
    onPoiDwell.mockClear();
    onPoiExit.mockClear();
    onAreaExit.mockClear();
    engine = new GeofenceEngine({
      onPoiDwell,
      onPoiExit,
      onAreaExit,
    });
  });

  it('mendeteksi Dwell event hanya setelah pengguna diam ≥3 menit di tenant', () => {
    const t0 = 500_000;
    const posAtTenant = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 5), // 5 m dari tenant
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: t0,
    };

    // t0: baru tiba
    engine.processPosition(posAtTenant, testArea, [poi1]);
    expect(onPoiDwell).not.toHaveBeenCalled();
    expect(engine.isPoiVisited('P01')).toBe(false);

    // t0 + 2 menit (120 detik): belum mencapai 3 menit, dwell belum terpicu
    const pos2Min = { ...posAtTenant, timestamp: t0 + 2 * 60 * 1000 };
    engine.processPosition(pos2Min, testArea, [poi1]);
    expect(onPoiDwell).not.toHaveBeenCalled();
    expect(engine.isPoiVisited('P01')).toBe(false);

    // t0 + 3 menit (180 detik): mencapai 3 menit -> Dwell event terpicu & tercatat dikunjungi
    const pos3Min = { ...posAtTenant, timestamp: t0 + DWELL_DURATION_MS };
    const res = engine.processPosition(pos3Min, testArea, [poi1]);
    expect(res.dwellPois).toHaveLength(1);
    expect(onPoiDwell).toHaveBeenCalledTimes(1);
    expect(engine.isPoiVisited('P01')).toBe(true);

    // t0 + 4 menit: tidak memicu dwell berulang dalam kunjungan yang sama
    const pos4Min = { ...posAtTenant, timestamp: t0 + 4 * 60 * 1000 };
    const res4 = engine.processPosition(pos4Min, testArea, [poi1]);
    expect(res4.dwellPois).toHaveLength(0);
    expect(onPoiDwell).toHaveBeenCalledTimes(1);
  });

  it('pengguna yang hanya lewat (<3 menit) lalu pergi tidak tercatat berkunjung', () => {
    const t0 = 500_000;
    const posAtTenant = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 5),
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: t0,
    };

    // Tiba di tenant
    engine.processPosition(posAtTenant, testArea, [poi1]);

    // Hanya 1 menit kemudian, pengguna berjalan menjauh ke jarak 30 m (> radius 15m + hysteresis 10m = 25m)
    const posExit = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 30),
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: t0 + 60 * 1000,
    };

    const res = engine.processPosition(posExit, testArea, [poi1]);
    expect(res.exitPois).toHaveLength(1);
    expect(onPoiExit).toHaveBeenCalledWith(poi1, expect.any(Number));
    expect(onPoiDwell).not.toHaveBeenCalled();
    expect(engine.isPoiVisited('P01')).toBe(false);
  });

  it('menerapkan hysteresis 10 m saat Exit: tidak memicu exit jika berada di antara radius dan hysteresis', () => {
    const t0 = 500_000;
    const posInside = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 5),
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: t0,
    };

    // Masuk proximity
    engine.processPosition(posInside, testArea, [poi1]);

    // Bergeser ke 18 m (antara 15 m trigger radius dan 25 m hysteresis boundary)
    const posHysteresis = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 18),
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: t0 + 30 * 1000,
    };
    const resHysteresis = engine.processPosition(posHysteresis, testArea, [poi1]);
    expect(resHysteresis.exitPois).toHaveLength(0);
    expect(onPoiExit).not.toHaveBeenCalled();

    // Bergeser ke 27 m (> 25 m) -> Exit event terpicu!
    const posOutside = {
      coordinate: {
        latitude: offsetNorth(poi1.latitude, 27),
        longitude: poi1.longitude,
      },
      accuracyM: 8,
      timestamp: t0 + 60 * 1000,
    };
    const resOutside = engine.processPosition(posOutside, testArea, [poi1]);
    expect(resOutside.exitPois).toHaveLength(1);
    expect(onPoiExit).toHaveBeenCalledTimes(1);
  });

  it('memicu Exit event kawasan saat keluar melewati 110 m (100 m + hysteresis 10 m)', () => {
    // Masuk kawasan dahulu
    const posIn = {
      coordinate: testArea.center,
      accuracyM: 5,
      timestamp: 1000,
    };
    engine.processPosition(posIn, testArea, [poi1]);
    expect(engine.getIsInsideArea()).toBe(true);

    // Di 105 m (zona hysteresis kawasan) -> masih inside
    const pos105m = {
      coordinate: {
        latitude: offsetNorth(testArea.center.latitude, 105),
        longitude: testArea.center.longitude,
      },
      accuracyM: 5,
      timestamp: 2000,
    };
    const res105 = engine.processPosition(pos105m, testArea, [poi1]);
    expect(res105.areaEvent).toBeNull();
    expect(engine.getIsInsideArea()).toBe(true);

    // Di 115 m (> 110 m) -> EXIT kawasan
    const pos115m = {
      coordinate: {
        latitude: offsetNorth(testArea.center.latitude, 115),
        longitude: testArea.center.longitude,
      },
      accuracyM: 5,
      timestamp: 3000,
    };
    const res115 = engine.processPosition(pos115m, testArea, [poi1]);
    expect(res115.areaEvent).toBe('EXIT');
    expect(res115.isInsideArea).toBe(false);
    expect(onAreaExit).toHaveBeenCalledTimes(1);
  });
});
