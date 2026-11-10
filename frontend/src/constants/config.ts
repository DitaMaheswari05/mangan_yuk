// Angka-angka dari PRD. Nilai per kawasan/POI (radius entry, hysteresis, trigger radius) ada di data,
// bukan di sini — lihat src/data/area.json dan pois.json.

/** F01: pembaruan lokasi tiap ±3 detik atau perpindahan ≥5 m. */
export const LOCATION_TIME_INTERVAL_MS = 3000;
export const LOCATION_DISTANCE_INTERVAL_M = 5;

/** F01-AC1: posisi tampil ≤10 detik setelah app dibuka. */
export const FIRST_FIX_TIMEOUT_MS = 10_000;

/** F02: pembacaan dengan akurasi lebih buruk dari ini diabaikan. */
export const MAX_ACCURACY_M = 30;

/** Fallback radius trigger POI jika data tidak punya triggerRadiusM (change log v1.1: 10 m). */
export const DEFAULT_TRIGGER_RADIUS_M = 10;

/** F02: proximity POI yang sama tidak dipicu ulang selama ini (PRD F02, PB06). */
export const POI_COOLDOWN_MS = 30 * 60_000;

/** F02: berada di geofence tenant selama ini → kunjungan tercatat (dwell event, PB07). */
export const DWELL_MIN_MS = 3 * 60_000;

/** F02: exit tenant tercatat jika jarak > triggerRadiusM + ini (hysteresis, cegah flapping). */
export const POI_EXIT_HYSTERESIS_M = 10;

/**
 * Interval pembaruan lokasi selama Mode Jelajah. distanceInterval 0 disengaja: saat pengguna diam
 * di tenant, OS tetap mengirim lokasi sehingga timer dwell bisa jalan di background.
 */
export const EXPLORE_TIME_INTERVAL_MS = 5000;

export const WALKING_SPEED_MPS = 1.3;
