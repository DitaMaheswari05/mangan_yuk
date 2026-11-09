// F03 / PB04 – PoiRepository: load + validasi + turunan harga, di-cache.
// Data dibundel di app (offline, F03); tidak ada request jaringan.
import areaJson from '@/data/area.json';
import poisJson from '@/data/pois.json';
import { fail, ok, type Result } from '@/lib/result';
import type { AreaConfig, Poi, PoiDataset, PoiRecord, PriceBucket } from '@/types/content';
import { validate, type ValidationResult } from './validator';

export { validate } from './validator';

type Loaded = { dataset: PoiDataset; validation: ValidationResult };

let cache: Loaded | null = null;

export function priceBucket(minPriceIdr: number): PriceBucket {
  if (minPriceIdr < 15_000) return 'under15k';
  if (minPriceIdr <= 30_000) return '15to30k';
  return 'over30k';
}

export function withDerivedPrice(p: PoiRecord): Poi {
  const prices = p.menu.map((m) => m.priceIdr);
  const priceMinIdr = prices.length ? Math.min(...prices) : 0;
  const priceMaxIdr = prices.length ? Math.max(...prices) : 0;
  return { ...p, priceMinIdr, priceMaxIdr, priceBucket: priceBucket(priceMinIdr) };
}

/** Untuk test: kosongkan cache dan, opsional, ganti sumber data. */
let source: { area: unknown; pois: unknown } = { area: areaJson, pois: poisJson };
export function __setSourceForTest(next?: { area: unknown; pois: unknown }) {
  source = next ?? { area: areaJson, pois: poisJson };
  cache = null;
}

function build(): Loaded {
  if (cache) return cache;
  const validation = validate(source, 'PB04');
  if (!validation.valid) {
    console.warn(`[PoiRepository] dataset tidak valid:\n- ${validation.errors.join('\n- ')}`);
  }
  // Release: POI rusak disembunyikan jika masih ada POI valid, atau gunakan fallback dataset asli agar marker tetap tampil
  const hidden = new Set(validation.invalidPoiIds);
  const records = Array.isArray(source.pois) ? (source.pois as PoiRecord[]) : [];
  const filtered = records.filter((p) => !hidden.has(p.id));
  const validRecords = filtered.length > 0 ? filtered : records;
  const pois = validRecords.map(withDerivedPrice);
  cache = { dataset: { area: source.area as AreaConfig, pois }, validation };
  return cache;
}

export async function load(): Promise<Result<PoiDataset>> {
  try {
    const { dataset, validation } = build();
    if (__DEV__ && !validation.valid && dataset.pois.length === 0) {
      return fail('DATASET_INVALID', 'Dataset POI tidak valid.', validation.errors);
    }
    return ok(dataset);
  } catch (e) {
    return fail('DATASET_INVALID', 'Dataset POI gagal dibaca.', e);
  }
}

export async function getAll(): Promise<Result<Poi[]>> {
  const r = await load();
  return r.ok ? ok(r.data.pois) : r;
}

export async function getById(id: string): Promise<Result<Poi>> {
  const r = await load();
  if (!r.ok) return r;
  const poi = r.data.pois.find((p) => p.id === id);
  return poi ? ok(poi) : fail('NOT_FOUND', 'Tenant tidak ditemukan.');
}

export async function getArea(): Promise<Result<AreaConfig>> {
  const r = await load();
  return r.ok ? ok(r.data.area) : r;
}

const toMin = (hhmm: string) => {
  const [h, m] = hhmm.split(':').map(Number);
  return h * 60 + m;
};

/** Buka pada `date` (waktu lokal perangkat)? Slot dengan close < open dianggap lewat tengah malam. */
export function isOpenAt(poi: Pick<PoiRecord, 'openingHours'>, date: Date): boolean {
  const day = date.getDay();
  const prevDay = (day + 6) % 7;
  const t = date.getHours() * 60 + date.getMinutes();
  return poi.openingHours.some((s) => {
    const open = toMin(s.open);
    const close = toMin(s.close);
    if (close > open) return s.day === day && t >= open && t < close;
    return (s.day === day && t >= open) || (s.day === prevDay && t < close);
  });
}

/** Versi sinkron untuk komponen peta lama. POI tidak valid sudah disembunyikan. */
export const getPois = (): Poi[] => build().dataset.pois;
export const getPoiById = (id: string): Poi | undefined => getPois().find((p) => p.id === id);
