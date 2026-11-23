import { filterByHalalPreference } from '@/features/poi';

const pois = [
  { id: 'A', isHalal: true },
  { id: 'B', isHalal: false },
  { id: 'C', isHalal: null },
];

describe('filterByHalalPreference', () => {
  it('preferensi halal aktif → hanya tenant terverifikasi halal', () => {
    expect(filterByHalalPreference(pois, true).map((p) => p.id)).toEqual(['A']);
  });

  it('preferensi halal nonaktif → semua tenant tetap tampil', () => {
    expect(filterByHalalPreference(pois, false)).toBe(pois);
  });
});
