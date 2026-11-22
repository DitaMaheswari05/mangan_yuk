import { formatRelativeTime } from '@/lib/time';

const NOW = new Date('2026-11-22T12:00:00Z').getTime();
const ago = (ms: number) => new Date(NOW - ms).toISOString();
const HOUR = 60 * 60 * 1000;
const DAY = 24 * HOUR;

describe('formatRelativeTime', () => {
  it.each([
    [ago(10 * 60 * 1000), 'Baru saja'],
    [ago(3 * HOUR), '3 jam lalu'],
    [ago(DAY + HOUR), 'Kemarin'],
    [ago(5 * DAY), '5 hari lalu'],
    [ago(65 * DAY), '2 bulan lalu'],
  ])('%s → %s', (iso, expected) => {
    expect(formatRelativeTime(iso, NOW)).toBe(expected);
  });

  it('tanggal tidak valid tidak membuat error', () => {
    expect(formatRelativeTime('bukan-tanggal', NOW)).toBe('Beberapa hari lalu');
  });
});
