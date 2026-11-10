// F02, PB-06, PB-07: Mesin Geofence (Entry, Proximity, Dwell, Exit) dengan Hysteresis, Cooldown, dan Filter Jitter.
import {
  DEFAULT_TRIGGER_RADIUS_M,
  MAX_ACCURACY_M,
} from '@/constants/config';
import { haversineM, type LatLng, type UserPosition } from '@/lib/geo';
import { load as loadStorage, save as saveStorage } from '@/storage';
import type { AreaConfig, Poi } from '@/types/content';

/** Cooldown per POI: 30 menit (SB-2.2 / PRD F02) */
export const POI_COOLDOWN_MS = 30 * 60 * 1000;

/** Radius trigger proximity tenant: 15 m (SB-2.3 / PRD Change Log v1.1) */
export const DEFAULT_TENANT_TRIGGER_RADIUS_M = 15;

/** Hysteresis exit tenant: 10 m (SB-2.4 / PRD F02: exit jika jarak > radius + 10 m = >25 m) */
export const TENANT_EXIT_HYSTERESIS_M = 10;

/** Ambang batas dwell time tenant: ≥3 menit (SB-2.4 / PRD F02: 180.000 ms) */
export const DWELL_DURATION_MS = 3 * 60 * 1000;

/** Radius entry kawasan: 100 m (SB-2.3 / PRD F02) */
export const AREA_ENTRY_RADIUS_M = 100;

/** Hysteresis exit kawasan: 10 m (PRD F02: exit jika jarak > 100 + 10 = >110 m) */
export const AREA_EXIT_HYSTERESIS_M = 10;

export const STORAGE_KEY_VISITED_POIS = 'manganyuk_visited_poi_ids';

export type DwellTrackingState = {
  enterTimestamp: number;
  hasFiredDwell: boolean;
  lastDistanceM: number;
};

export type GeofenceCallbacks = {
  onAreaEntry?: (area: AreaConfig, distanceM: number) => void;
  onAreaExit?: (area: AreaConfig, distanceM: number) => void;
  onPoiProximity?: (poi: Poi, distanceM: number) => void;
  onPoiDwell?: (poi: Poi, dwellDurationMs: number) => void;
  onPoiExit?: (poi: Poi, distanceM: number) => void;
  onPositionUpdate?: (pos: UserPosition) => void;
};

export type GeofenceProcessResult = {
  discarded: boolean;
  discardReason?: 'GPS_JITTER_ACCURACY_TOO_LOW' | 'INVALID_COORDINATES';
  areaEvent?: 'ENTRY' | 'EXIT' | null;
  proximityPois: Array<{ poi: Poi; distanceM: number }>;
  dwellPois: Array<{ poi: Poi; dwellDurationMs: number }>;
  exitPois: Array<{ poi: Poi; distanceM: number }>;
  distanceToAreaCenterM: number;
  isInsideArea: boolean;
};

export class GeofenceEngine {
  private isInsideArea = false;
  private poiCooldowns = new Map<string, number>();
  private activeDwells = new Map<string, DwellTrackingState>();
  private visitedPoiIds = new Set<string>();
  private callbacks: GeofenceCallbacks = {};
  private storageLoaded = false;

  constructor(callbacks?: GeofenceCallbacks) {
    if (callbacks) {
      this.callbacks = callbacks;
    }
  }

  public setCallbacks(callbacks: GeofenceCallbacks): void {
    this.callbacks = { ...this.callbacks, ...callbacks };
  }

  public clearCallbacks(): void {
    this.callbacks = {};
  }

  /**
   * Muat riwayat POI yang telah dikunjungi dari penyimpanan lokal.
   */
  public async loadVisitedPois(): Promise<void> {
    try {
      const stored = await loadStorage<string[]>(STORAGE_KEY_VISITED_POIS, []);
      this.visitedPoiIds = new Set(stored);
      this.storageLoaded = true;
    } catch {
      this.storageLoaded = true;
    }
  }

  /**
   * Periksa apakah suatu POI sudah dikunjungi (tercatat dari dwell event).
   */
  public isPoiVisited(poiId: string): boolean {
    return this.visitedPoiIds.has(poiId);
  }

  /**
   * Tandai POI sebagai dikunjungi dan simpan ke penyimpanan lokal.
   */
  public async markPoiVisited(poiId: string): Promise<void> {
    this.visitedPoiIds.add(poiId);
    try {
      await saveStorage(STORAGE_KEY_VISITED_POIS, Array.from(this.visitedPoiIds));
    } catch {
      // Abaikan kegagalan I/O pada runtime terbatas
    }
  }

  public getVisitedPoiIds(): string[] {
    return Array.from(this.visitedPoiIds);
  }

  public async resetVisitedPois(): Promise<void> {
    this.visitedPoiIds.clear();
    try {
      await saveStorage(STORAGE_KEY_VISITED_POIS, []);
    } catch {
      // Abaikan
    }
  }

  /**
   * Logika Cooldown per POI (30 menit).
   * Memeriksa apakah POI sedang dalam masa cooldown agar tidak memicu prompt/notifikasi berulang.
   */
  public isPoiInCooldown(poiId: string, now = Date.now()): boolean {
    const expiry = this.poiCooldowns.get(poiId);
    if (!expiry) return false;
    if (now >= expiry) {
      this.poiCooldowns.delete(poiId);
      return false;
    }
    return true;
  }

  public setPoiCooldown(
    poiId: string,
    durationMs = POI_COOLDOWN_MS,
    now = Date.now(),
  ): void {
    this.poiCooldowns.set(poiId, now + durationMs);
  }

  public clearPoiCooldown(poiId: string): void {
    this.poiCooldowns.delete(poiId);
  }

  public resetCooldowns(): void {
    this.poiCooldowns.clear();
  }

  public getActiveDwell(poiId: string): DwellTrackingState | undefined {
    return this.activeDwells.get(poiId);
  }

  public getAllActiveDwells(): Map<string, DwellTrackingState> {
    return new Map(this.activeDwells);
  }

  public getIsInsideArea(): boolean {
    return this.isInsideArea;
  }

  /**
   * Membersihkan sesi geofence (dwell tracking dan status area), namun mempertahankan cooldown & visited jika tidak diminta reset.
   */
  public resetSession(options?: { resetCooldowns?: boolean }): void {
    this.isInsideArea = false;
    this.activeDwells.clear();
    if (options?.resetCooldowns) {
      this.poiCooldowns.clear();
    }
  }

  /**
   * Pemrosesan utama setiap pembaruan koordinat GPS pengguna.
   * Melakukan:
   * 1. Filter jitter GPS (abaikan jika accuracy > 30 m)
   * 2. Evaluasi Entry & Exit event kawasan (radius 100 m, exit hysteresis 10 m)
   * 3. Evaluasi Proximity event tenant (<15 m, dengan cooldown 30 menit)
   * 4. Evaluasi Dwell event tenant (diam di tenant ≥3 menit)
   * 5. Evaluasi Exit event tenant (keluar radius + hysteresis 10 m, i.e. > 25 m)
   */
  public processPosition(
    pos: UserPosition,
    area: AreaConfig,
    pois: Poi[],
  ): GeofenceProcessResult {
    // 1. Modul filter GPS jitter (SB-2.2 / PRD F02: abaikan akurasi >30 m)
    if (
      typeof pos.accuracyM === 'number' &&
      (pos.accuracyM > MAX_ACCURACY_M || Number.isNaN(pos.accuracyM))
    ) {
      return {
        discarded: true,
        discardReason: 'GPS_JITTER_ACCURACY_TOO_LOW',
        areaEvent: null,
        proximityPois: [],
        dwellPois: [],
        exitPois: [],
        distanceToAreaCenterM: 0,
        isInsideArea: this.isInsideArea,
      };
    }

    if (
      Number.isNaN(pos.coordinate.latitude) ||
      Number.isNaN(pos.coordinate.longitude)
    ) {
      return {
        discarded: true,
        discardReason: 'INVALID_COORDINATES',
        areaEvent: null,
        proximityPois: [],
        dwellPois: [],
        exitPois: [],
        distanceToAreaCenterM: 0,
        isInsideArea: this.isInsideArea,
      };
    }

    const now = pos.timestamp || Date.now();
    this.callbacks.onPositionUpdate?.(pos);

    // 2. Evaluasi status kawasan (Entry & Exit event kawasan)
    const entryRadius = area.entryRadiusM > 0 ? area.entryRadiusM : AREA_ENTRY_RADIUS_M;
    const exitHysteresis =
      area.exitHysteresisM >= 0 ? area.exitHysteresisM : AREA_EXIT_HYSTERESIS_M;
    const distToAreaCenter = haversineM(pos.coordinate, area.center);

    let areaEvent: 'ENTRY' | 'EXIT' | null = null;

    if (distToAreaCenter <= entryRadius) {
      if (!this.isInsideArea) {
        this.isInsideArea = true;
        areaEvent = 'ENTRY';
        this.callbacks.onAreaEntry?.(area, Math.round(distToAreaCenter));
      }
    } else if (distToAreaCenter > entryRadius + exitHysteresis) {
      if (this.isInsideArea) {
        this.isInsideArea = false;
        areaEvent = 'EXIT';
        this.callbacks.onAreaExit?.(area, Math.round(distToAreaCenter));
      }
    }

    const proximityPois: Array<{ poi: Poi; distanceM: number }> = [];
    const dwellPois: Array<{ poi: Poi; dwellDurationMs: number }> = [];
    const exitPois: Array<{ poi: Poi; distanceM: number }> = [];

    // 3. Evaluasi per tenant: Proximity, Dwell, dan Exit
    for (const poi of pois) {
      const poiCoord: LatLng = { latitude: poi.latitude, longitude: poi.longitude };
      const distM = haversineM(pos.coordinate, poiCoord);
      const roundedDistM = Math.round(distM);

      const triggerRadius =
        poi.triggerRadiusM > 0 ? poi.triggerRadiusM : DEFAULT_TENANT_TRIGGER_RADIUS_M;
      const exitRadius = triggerRadius + TENANT_EXIT_HYSTERESIS_M;

      const isInsideTrigger = distM <= triggerRadius;
      const isInsideHysteresis = distM <= exitRadius;
      const dwellState = this.activeDwells.get(poi.id);

      // A. Masuk ke radius proximity tenant (<15 m)
      if (isInsideTrigger) {
        // Mulai dwell tracking jika belum aktif
        if (!dwellState) {
          this.activeDwells.set(poi.id, {
            enterTimestamp: now,
            hasFiredDwell: false,
            lastDistanceM: roundedDistM,
          });
        }

        // Cek cooldown 30 menit sebelum memicu event proximity (kartu/notifikasi)
        if (!this.isPoiInCooldown(poi.id, now)) {
          this.setPoiCooldown(poi.id, POI_COOLDOWN_MS, now);
          proximityPois.push({ poi, distanceM: roundedDistM });
          this.callbacks.onPoiProximity?.(poi, roundedDistM);
        }
      }

      // B. Evaluasi Dwell event (diam di tenant ≥3 menit)
      if (dwellState && isInsideHysteresis) {
        dwellState.lastDistanceM = roundedDistM;
        const elapsedMs = now - dwellState.enterTimestamp;

        if (!dwellState.hasFiredDwell && elapsedMs >= DWELL_DURATION_MS) {
          dwellState.hasFiredDwell = true;
          void this.markPoiVisited(poi.id);
          dwellPois.push({ poi, dwellDurationMs: elapsedMs });
          this.callbacks.onPoiDwell?.(poi, elapsedMs);
        }
      }

      // C. Evaluasi Exit event (keluar radius + hysteresis 10 m, i.e. > 25 m)
      if (dwellState && !isInsideHysteresis) {
        this.activeDwells.delete(poi.id);
        exitPois.push({ poi, distanceM: roundedDistM });
        this.callbacks.onPoiExit?.(poi, roundedDistM);
      }
    }

    return {
      discarded: false,
      areaEvent,
      proximityPois,
      dwellPois,
      exitPois,
      distanceToAreaCenterM: Math.round(distToAreaCenter),
      isInsideArea: this.isInsideArea,
    };
  }
}

export const defaultGeofenceEngine = new GeofenceEngine();
