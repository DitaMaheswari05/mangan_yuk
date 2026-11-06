import type { AreaConfig, PoiRecord } from '@/types/content';

export const area: AreaConfig = {
  id: 'sudirman-street-food',
  name: 'Sudirman Street Food',
  center: { latitude: -6.92089, longitude: 107.600574 },
  entryRadiusM: 100,
  exitHysteresisM: 10,
  googleMapsQuery: 'Sudirman Street Food Bandung',
};

export function makePoi(n: number, overrides: Partial<PoiRecord> = {}): PoiRecord {
  const id = `P${String(n).padStart(2, '0')}`;
  return {
    id,
    name: `Tenant ${id}`,
    slug: `tenant-${n}`,
    type: 'makanan',
    categoryLabel: 'Uji / Gurih',
    tasteTags: ['gurih'],
    isHalal: null,
    zone: 'Zone Uji',
    latitude: area.center.latitude + n * 0.00001,
    longitude: area.center.longitude,
    triggerRadiusM: 10,
    avgVisitMin: 15,
    description: 'Deskripsi.',
    culturalStory: null,
    photos: [],
    audio: null,
    menu: [{ id: `${id}-M01`, name: 'Menu', priceIdr: 20000, tastes: ['gurih'], isSignature: true }],
    openingHours: [{ day: 6, open: '17:00', close: '23:00' }],
    peakHours: [],
    searchKeywords: [],
    qrCode: null,
    ...overrides,
  };
}

export const validDataset = () => ({
  area,
  pois: Array.from({ length: 10 }, (_, i) => makePoi(i + 1)),
});
