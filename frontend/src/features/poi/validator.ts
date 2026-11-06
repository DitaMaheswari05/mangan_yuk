// DatasetValidator — aturan V1–V7 (PB04) dan tambahan PB08, lihat docs/api/client-contracts.yaml.
// Input sengaja `unknown`: yang dicek adalah JSON hasil export, bukan tipe TypeScript-nya.
import { haversineM } from '@/lib/geo';
import { FOOD_TYPES, PHOTO_KINDS, TASTE_TAGS } from '@/types/content';

export type ValidationPhase = 'PB04' | 'PB08';

export type ValidationResult = {
  valid: boolean;
  /** Format: '<POI id | area | dataset>: <aturan> <pesan>'. */
  errors: string[];
  /** POI yang punya minimal satu error; di release build POI ini disembunyikan. */
  invalidPoiIds: string[];
};

const POI_ID = /^P\d{2}$/;
const HHMM = /^([01]\d|2[0-3]):[0-5]\d$/;
const MIN_POIS = 10;
const AREA_TOLERANCE_M = 50;

type Obj = Record<string, unknown>;
const isObj = (v: unknown): v is Obj => typeof v === 'object' && v !== null && !Array.isArray(v);
const isNum = (v: unknown): v is number => typeof v === 'number' && Number.isFinite(v);
const isStr = (v: unknown): v is string => typeof v === 'string';
const nonEmpty = (v: unknown) => isStr(v) && v.trim().length > 0;
const inRange = (v: unknown, min: number, max: number) => isNum(v) && v >= min && v <= max;
const includes = <T extends string>(list: readonly T[], v: unknown): v is T =>
  isStr(v) && (list as readonly string[]).includes(v);

export function validate(ds: unknown, phase: ValidationPhase): ValidationResult {
  const errors: string[] = [];
  const invalid = new Set<string>();

  if (!isObj(ds)) return { valid: false, errors: ['dataset: bukan object'], invalidPoiIds: [] };

  // --- area ---------------------------------------------------------------
  const area = ds.area;
  let center: { latitude: number; longitude: number } | null = null;
  let entryRadiusM = 0;
  if (!isObj(area)) {
    errors.push('area: tidak ada');
  } else {
    const c = area.center;
    if (isObj(c) && inRange(c.latitude, -90, 90) && inRange(c.longitude, -180, 180)) {
      center = { latitude: c.latitude as number, longitude: c.longitude as number };
    } else {
      errors.push('area: center tidak valid');
    }
    if (isNum(area.entryRadiusM) && area.entryRadiusM > 0) entryRadiusM = area.entryRadiusM;
    else errors.push('area: entryRadiusM harus > 0');
    if (!(isNum(area.exitHysteresisM) && area.exitHysteresisM >= 0))
      errors.push('area: exitHysteresisM harus ≥ 0');
  }

  // --- POI ----------------------------------------------------------------
  const pois = ds.pois;
  if (!Array.isArray(pois)) {
    errors.push('dataset: pois bukan array');
    return { valid: false, errors, invalidPoiIds: [] };
  }

  // V1
  if (pois.length < MIN_POIS) errors.push(`dataset: V1 jumlah POI ${pois.length} < ${MIN_POIS}`);

  const assetMap = isObj(ds.assetMap) ? ds.assetMap : null;
  if (phase === 'PB08' && !assetMap) errors.push('dataset: assetMap tidak ada');

  const seenPoiIds = new Set<string>();
  const seenMenuIds = new Set<string>();

  pois.forEach((p, i) => {
    const label = isObj(p) && isStr(p.id) ? p.id : `#${i}`;
    const add = (msg: string) => {
      errors.push(`${label}: ${msg}`);
      invalid.add(label);
    };
    if (!isObj(p)) return add('bukan object');

    // V2
    if (!isStr(p.id) || !POI_ID.test(p.id)) add('V2 id harus berformat P00');
    else if (seenPoiIds.has(p.id)) add('V2 id duplikat');
    else seenPoiIds.add(p.id);

    // V3
    const latOk = inRange(p.latitude, -90, 90);
    const lngOk = inRange(p.longitude, -180, 180);
    if (!latOk) add('V3 latitude di luar [-90, 90]');
    if (!lngOk) add('V3 longitude di luar [-180, 180]');
    if (latOk && lngOk && center && entryRadiusM > 0) {
      const d = haversineM({ latitude: p.latitude as number, longitude: p.longitude as number }, center);
      const max = entryRadiusM + AREA_TOLERANCE_M;
      if (d > max) add(`V3 ${Math.round(d)} m dari pusat kawasan (maks ${max} m)`);
    }

    // V4
    if (!Array.isArray(p.menu) || p.menu.length === 0) {
      add('V4 menu kosong');
    } else {
      p.menu.forEach((m, j) => {
        if (!isObj(m)) return add(`V4 menu[${j}] bukan object`);
        if (!nonEmpty(m.id)) add(`V2 menu[${j}].id kosong`);
        else if (seenMenuIds.has(m.id as string)) add(`V2 menu id duplikat ${m.id}`);
        else seenMenuIds.add(m.id as string);
        if (!nonEmpty(m.name)) add(`V4 menu ${m.id ?? j} nama kosong`);
        if (!(Number.isInteger(m.priceIdr) && (m.priceIdr as number) > 0))
          add(`V4 menu ${m.id ?? j} priceIdr harus integer > 0`);
      });
    }

    // V5
    if (!Array.isArray(p.openingHours) || p.openingHours.length === 0) {
      add('V5 openingHours kosong');
    } else {
      p.openingHours.forEach((s, j) => {
        if (!isObj(s) || !Number.isInteger(s.day) || !inRange(s.day, 0, 6))
          return add(`V5 openingHours[${j}].day harus 0–6`);
        if (!isStr(s.open) || !HHMM.test(s.open)) add(`V5 openingHours[${j}].open bukan HH:mm`);
        if (!isStr(s.close) || !HHMM.test(s.close)) add(`V5 openingHours[${j}].close bukan HH:mm`);
        else if (s.open === s.close) add(`V5 openingHours[${j}] open sama dengan close`);
      });
    }

    // V6
    if (!Array.isArray(p.tasteTags) || p.tasteTags.length === 0) add('V6 tasteTags kosong');
    else
      p.tasteTags.forEach((t) => {
        if (!includes(TASTE_TAGS, t)) add(`V6 tasteTag tidak dikenal: ${String(t)}`);
      });
    if (!includes(FOOD_TYPES, p.type)) add(`V6 type tidak dikenal: ${String(p.type)}`);

    // V7
    if (!(isNum(p.triggerRadiusM) && p.triggerRadiusM > 0)) add('V7 triggerRadiusM harus > 0');
    if (!(isNum(p.avgVisitMin) && p.avgVisitMin > 0)) add('V7 avgVisitMin harus > 0');

    if (phase === 'PB08') validatePb08(p, add, assetMap);
  });

  return { valid: errors.length === 0, errors, invalidPoiIds: [...invalid] };
}

function validatePb08(p: Obj, add: (msg: string) => void, assetMap: Obj | null) {
  const keys: unknown[] = [];

  const photos = Array.isArray(p.photos) ? p.photos.filter(isObj) : [];
  if (photos.length < 3) add(`PB08 foto ${photos.length} < 3`);
  for (const kind of PHOTO_KINDS) {
    if (!photos.some((ph) => ph.kind === kind)) add(`PB08 foto jenis ${kind} tidak ada`);
  }
  photos.forEach((ph) => keys.push(ph.assetKey));

  const audio = p.audio;
  if (!isObj(audio)) {
    add('PB08 audio tidak ada');
  } else {
    if (!inRange(audio.durationSec, 45, 90)) add('PB08 audio durationSec harus 45–90');
    if (!nonEmpty(audio.transcript)) add('PB08 transkrip audio kosong');
    keys.push(audio.assetKey);
  }

  if (!nonEmpty(p.culturalStory)) add('PB08 culturalStory kosong');

  if (assetMap) {
    keys.forEach((k) => {
      if (!isStr(k) || !(k in assetMap)) add(`PB08 assetKey tidak ada di assetMap: ${String(k)}`);
    });
  }
}
