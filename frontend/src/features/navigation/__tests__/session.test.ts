import { NavigationSession } from '../session';

describe('NavigationSession', () => {
  beforeEach(() => {
    NavigationSession.__reset();
  });

  it('start() menandai navigasi aktif dan menetapkan tujuan', () => {
    expect(NavigationSession.isNavigating()).toBe(false);
    expect(NavigationSession.isDestination('P01')).toBe(false);

    NavigationSession.start('P01');

    expect(NavigationSession.isNavigating()).toBe(true);
    expect(NavigationSession.isDestination('P01')).toBe(true);
    expect(NavigationSession.isDestination('P02')).toBe(false);
  });

  it('end() hanya mengakhiri navigasi jika poiId cocok dengan tujuan aktif', () => {
    NavigationSession.start('P01');
    NavigationSession.end('P02');
    expect(NavigationSession.isNavigating()).toBe(true);
    expect(NavigationSession.isDestination('P01')).toBe(true);

    NavigationSession.end('P01');
    expect(NavigationSession.isNavigating()).toBe(false);
    expect(NavigationSession.isDestination('P01')).toBe(false);
  });

  it('markArrived() mempertahankan isDestination selama masa tenggang 60 detik meski navigasi sudah berakhir', () => {
    const t0 = 1_000_000;
    NavigationSession.start('P01');
    NavigationSession.markArrived('P01', t0);
    NavigationSession.end('P01');

    expect(NavigationSession.isNavigating()).toBe(false);
    expect(NavigationSession.isDestination('P01', t0)).toBe(true);
    expect(NavigationSession.isDestination('P01', t0 + 59_999)).toBe(true);
    // Tepat di batas 60 detik, masa tenggang habis
    expect(NavigationSession.isDestination('P01', t0 + 60_000)).toBe(false);
    expect(NavigationSession.isDestination('P02', t0 + 1_000)).toBe(false);
  });

  it('__reset() menghapus status tujuan aktif dan masa tenggang kedatangan', () => {
    const t0 = 1_000_000;
    NavigationSession.start('P01');
    NavigationSession.markArrived('P02', t0);

    NavigationSession.__reset();

    expect(NavigationSession.isNavigating()).toBe(false);
    expect(NavigationSession.isDestination('P01', t0)).toBe(false);
    expect(NavigationSession.isDestination('P02', t0)).toBe(false);
  });
});
