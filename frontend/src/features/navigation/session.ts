// Tenant tujuan navigasi aktif, dibaca geofence runtime untuk membungkam audio proximity selama
// navigasi. Hanya di memori: tanpa layar navigasi terbuka, tidak ada yang perlu dibungkam.

// Event proximity tujuan bisa datang sesaat setelah layar navigasi ditutup oleh kedatangan.
const ARRIVAL_GRACE_MS = 60_000;

let targetPoiId: string | null = null;
let arrivedPoiId: string | null = null;
let arrivedUntil = 0;

export const NavigationSession = {
  start(poiId: string): void {
    targetPoiId = poiId;
  },

  end(poiId: string): void {
    if (targetPoiId === poiId) targetPoiId = null;
  },

  markArrived(poiId: string, now: number = Date.now()): void {
    arrivedPoiId = poiId;
    arrivedUntil = now + ARRIVAL_GRACE_MS;
  },

  isNavigating(): boolean {
    return targetPoiId !== null;
  },

  isDestination(poiId: string, now: number = Date.now()): boolean {
    return poiId === targetPoiId || (poiId === arrivedPoiId && now < arrivedUntil);
  },

  /** Hanya untuk test. */
  __reset(): void {
    targetPoiId = null;
    arrivedPoiId = null;
    arrivedUntil = 0;
  },
};
