import { validate } from '../validator';
import { area, makePoi, validDataset } from '../__fixtures__/dataset';

const withPoi = (i: number, patch: Record<string, unknown>) => {
  const ds = validDataset();
  (ds.pois as unknown as Record<string, unknown>[])[i] = { ...ds.pois[i], ...patch };
  return ds;
};

const expectRule = (ds: unknown, rule: RegExp, poiId?: string) => {
  const r = validate(ds, 'PB04');
  expect(r.valid).toBe(false);
  expect(r.errors.some((e) => rule.test(e))).toBe(true);
  if (poiId) expect(r.invalidPoiIds).toContain(poiId);
  return r;
};

describe('DatasetValidator PB04', () => {
  it('dataset lengkap lolos', () => {
    expect(validate(validDataset(), 'PB04')).toEqual({ valid: true, errors: [], invalidPoiIds: [] });
  });

  it('input bukan object', () => {
    expect(validate(null, 'PB04').valid).toBe(false);
    expect(validate({ area, pois: 'x' }, 'PB04').valid).toBe(false);
  });

  it('area tidak valid', () => {
    expectRule({ ...validDataset(), area: undefined }, /^area: tidak ada/);
    expectRule({ ...validDataset(), area: { ...area, entryRadiusM: 0 } }, /^area: entryRadiusM/);
  });

  it('V1: kurang dari 10 POI', () => {
    const ds = validDataset();
    ds.pois.pop();
    const r = expectRule(ds, /V1/);
    expect(r.invalidPoiIds).toEqual([]);
  });

  it('V2: format id dan id duplikat', () => {
    expectRule(withPoi(0, { id: 'X1' }), /V2 id harus/, 'X1');
    expectRule(withPoi(1, { id: 'P01' }), /V2 id duplikat/, 'P01');
  });

  it('V2: menu id duplikat antar POI', () => {
    const ds = withPoi(1, { menu: [{ ...makePoi(1).menu[0] }] });
    expectRule(ds, /V2 menu id duplikat P01-M01/, 'P02');
  });

  it('V3: koordinat di luar rentang', () => {
    expectRule(withPoi(0, { latitude: -91 }), /V3 latitude/, 'P01');
    expectRule(withPoi(0, { longitude: 181 }), /V3 longitude/, 'P01');
  });

  it('V3: lebih dari entryRadiusM + 50 dari pusat', () => {
    // ±160 m ke utara
    expectRule(withPoi(0, { latitude: area.center.latitude + 0.00144 }), /V3 \d+ m dari pusat/, 'P01');
    // ±140 m masih boleh
    expect(validate(withPoi(0, { latitude: area.center.latitude + 0.00126 }), 'PB04').valid).toBe(true);
  });

  it('V4: menu kosong dan harga tidak valid', () => {
    expectRule(withPoi(0, { menu: [] }), /V4 menu kosong/, 'P01');
    const bad = (priceIdr: unknown) => withPoi(0, { menu: [{ ...makePoi(1).menu[0], priceIdr }] });
    expectRule(bad(0), /V4 .* priceIdr/);
    expectRule(bad(1500.5), /V4 .* priceIdr/);
    expectRule(bad('15000'), /V4 .* priceIdr/);
  });

  it('V5: jam buka kosong atau format salah', () => {
    expectRule(withPoi(0, { openingHours: [] }), /V5 openingHours kosong/, 'P01');
    expectRule(withPoi(0, { openingHours: [{ day: 7, open: '10:00', close: '20:00' }] }), /V5 .*day/);
    expectRule(withPoi(0, { openingHours: [{ day: 1, open: '24:00', close: '20:00' }] }), /V5 .*open/);
    expectRule(withPoi(0, { openingHours: [{ day: 1, open: '10:00', close: '9:00' }] }), /V5 .*close/);
    expectRule(withPoi(0, { openingHours: [{ day: 1, open: '10:00', close: '10:00' }] }), /V5 .*sama/);
  });

  it('V5: jam lewat tengah malam valid', () => {
    expect(validate(withPoi(0, { openingHours: [{ day: 5, open: '18:00', close: '02:00' }] }), 'PB04').valid).toBe(
      true,
    );
  });

  it('V6: taste tag dan type harus dari enum', () => {
    expectRule(withPoi(0, { tasteTags: [] }), /V6 tasteTags kosong/, 'P01');
    expectRule(withPoi(0, { tasteTags: ['asam'] }), /V6 tasteTag tidak dikenal: asam/);
    expectRule(withPoi(0, { type: 'snack' }), /V6 type tidak dikenal: snack/);
  });

  it('V7: triggerRadiusM dan avgVisitMin > 0', () => {
    expectRule(withPoi(0, { triggerRadiusM: 0 }), /V7 triggerRadiusM/, 'P01');
    expectRule(withPoi(0, { avgVisitMin: -1 }), /V7 avgVisitMin/, 'P01');
  });

  it('hanya POI yang rusak masuk invalidPoiIds', () => {
    const r = validate(withPoi(2, { menu: [] }), 'PB04');
    expect(r.invalidPoiIds).toEqual(['P03']);
  });
});

describe('DatasetValidator PB08', () => {
  const complete = (n: number) =>
    makePoi(n, {
      culturalStory: 'Cerita.',
      photos: (['food', 'tenant', 'ambience'] as const).map((kind, i) => ({
        assetKey: `poi-photos/P${n}/${i}.jpg`,
        kind,
        caption: null,
      })),
      audio: { assetKey: `poi-audio/P${n}.mp3`, durationSec: 60, transcript: 'Halo.' },
    });

  const dataset = () => {
    const pois = Array.from({ length: 10 }, (_, i) => complete(i + 1));
    const assetMap = Object.fromEntries(
      pois.flatMap((p) => [...p.photos.map((ph) => ph.assetKey), p.audio!.assetKey]).map((k) => [k, 1]),
    );
    return { area, pois, assetMap };
  };

  it('dataset lengkap lolos', () => {
    expect(validate(dataset(), 'PB08').valid).toBe(true);
  });

  it('dataset PB04 biasa gagal di PB08', () => {
    const r = validate(validDataset(), 'PB08');
    expect(r.errors).toEqual(
      expect.arrayContaining(['dataset: assetMap tidak ada', 'P01: PB08 foto 0 < 3', 'P01: PB08 audio tidak ada']),
    );
  });

  it('audio di luar 45–90 detik dan transkrip kosong', () => {
    const ds = dataset();
    ds.pois[0] = { ...ds.pois[0], audio: { ...ds.pois[0].audio!, durationSec: 44, transcript: ' ' } };
    const r = validate(ds, 'PB08');
    expect(r.errors).toEqual(
      expect.arrayContaining(['P01: PB08 audio durationSec harus 45–90', 'P01: PB08 transkrip audio kosong']),
    );
  });

  it('jenis foto wajib lengkap dan assetKey harus ada di assetMap', () => {
    const ds = dataset();
    ds.pois[0] = { ...ds.pois[0], photos: ds.pois[0].photos.map((p) => ({ ...p, kind: 'food' as const })) };
    delete (ds.assetMap as Record<string, unknown>)['poi-audio/P1.mp3'];
    const r = validate(ds, 'PB08');
    expect(r.errors).toEqual(
      expect.arrayContaining([
        'P01: PB08 foto jenis tenant tidak ada',
        'P01: PB08 assetKey tidak ada di assetMap: poi-audio/P1.mp3',
      ]),
    );
  });
});
