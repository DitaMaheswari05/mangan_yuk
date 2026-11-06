import { __setSourceForTest, getAll, getArea, getById, isOpenAt, load, priceBucket, withDerivedPrice } from '../index';
import { area, makePoi, validDataset } from '../__fixtures__/dataset';

// 2026-11-07 = Sabtu (day 6), 2026-11-08 = Minggu (day 0). Waktu lokal.
const at = (date: string, hhmm: string) => new Date(`${date}T${hhmm}:00`);

afterEach(() => __setSourceForTest());

describe('isOpenAt', () => {
  const sat = (open: string, close: string) => ({ openingHours: [{ day: 6, open, close }] });

  it('slot biasa: [open, close)', () => {
    const p = sat('17:00', '23:00');
    expect(isOpenAt(p, at('2026-11-07', '16:59'))).toBe(false);
    expect(isOpenAt(p, at('2026-11-07', '17:00'))).toBe(true);
    expect(isOpenAt(p, at('2026-11-07', '22:59'))).toBe(true);
    expect(isOpenAt(p, at('2026-11-07', '23:00'))).toBe(false);
    expect(isOpenAt(p, at('2026-11-08', '18:00'))).toBe(false); // Minggu
  });

  it('lewat tengah malam: Sabtu 18:00 – Minggu 02:00', () => {
    const p = sat('18:00', '02:00');
    expect(isOpenAt(p, at('2026-11-07', '23:30'))).toBe(true);
    expect(isOpenAt(p, at('2026-11-08', '01:59'))).toBe(true);
    expect(isOpenAt(p, at('2026-11-08', '02:00'))).toBe(false);
    expect(isOpenAt(p, at('2026-11-07', '01:00'))).toBe(false); // Sabtu dini hari ikut slot Jumat
  });

  it('Minggu malam berlanjut ke Senin dini hari', () => {
    const p = { openingHours: [{ day: 0, open: '20:00', close: '01:00' }] };
    expect(isOpenAt(p, at('2026-11-09', '00:30'))).toBe(true); // Senin dini hari
    expect(isOpenAt(p, at('2026-11-08', '00:30'))).toBe(false);
  });

  it('beberapa slot per hari', () => {
    const p = {
      openingHours: [
        { day: 6, open: '10:00', close: '14:00' },
        { day: 6, open: '17:00', close: '22:00' },
      ],
    };
    expect(isOpenAt(p, at('2026-11-07', '15:00'))).toBe(false);
    expect(isOpenAt(p, at('2026-11-07', '18:00'))).toBe(true);
  });

  it('tanpa jam buka → selalu tutup', () => {
    expect(isOpenAt({ openingHours: [] }, at('2026-11-07', '18:00'))).toBe(false);
  });
});

describe('harga turunan', () => {
  it.each([
    [14_999, 'under15k'],
    [15_000, '15to30k'],
    [30_000, '15to30k'],
    [30_001, 'over30k'],
  ] as const)('priceBucket(%i) = %s', (price, bucket) => {
    expect(priceBucket(price)).toBe(bucket);
  });

  it('min/max dari menu, bucket dari menu termurah', () => {
    const p = withDerivedPrice(
      makePoi(1, {
        menu: [
          { id: 'P01-M01', name: 'A', priceIdr: 35_000, tastes: [], isSignature: true },
          { id: 'P01-M02', name: 'B', priceIdr: 12_000, tastes: [], isSignature: false },
        ],
      }),
    );
    expect(p).toMatchObject({ priceMinIdr: 12_000, priceMaxIdr: 35_000, priceBucket: 'under15k' });
  });
});

describe('PoiRepository', () => {
  it('load dataset valid dengan harga turunan', async () => {
    __setSourceForTest(validDataset());
    const r = await load();
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.data.pois).toHaveLength(10);
    expect(r.data.pois[0].priceBucket).toBe('15to30k');
  });

  it('getById: ada dan NOT_FOUND', async () => {
    __setSourceForTest(validDataset());
    const found = await getById('P03');
    expect(found.ok && found.data.name).toBe('Tenant P03');
    const missing = await getById('P99');
    expect(missing).toEqual({ ok: false, error: { code: 'NOT_FOUND', message: 'Tenant tidak ditemukan.' } });
  });

  it('getAll dan getArea', async () => {
    __setSourceForTest(validDataset());
    const all = await getAll();
    expect(all.ok && all.data.length).toBe(10);
    const a = await getArea();
    expect(a.ok && a.data).toEqual(area);
  });

  it('dev build: dataset tidak valid → DATASET_INVALID', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const ds = validDataset();
    ds.pois[0] = makePoi(1, { menu: [] });
    __setSourceForTest(ds);
    const r = await load();
    expect(r.ok).toBe(false);
    if (!r.ok) {
      expect(r.error.code).toBe('DATASET_INVALID');
      expect(r.error.cause).toEqual(['P01: V4 menu kosong']);
    }
    warn.mockRestore();
  });

  it('release build: POI rusak disembunyikan, tidak gagal', async () => {
    const warn = jest.spyOn(console, 'warn').mockImplementation(() => {});
    const g = globalThis as { __DEV__?: boolean };
    const prev = g.__DEV__;
    g.__DEV__ = false;
    try {
      const ds = validDataset();
      ds.pois[0] = makePoi(1, { menu: [] });
      __setSourceForTest(ds);
      const r = await getAll();
      expect(r.ok && r.data.map((p) => p.id)).not.toContain('P01');
      expect(r.ok && r.data).toHaveLength(9);
    } finally {
      g.__DEV__ = prev;
      warn.mockRestore();
    }
  });
});
