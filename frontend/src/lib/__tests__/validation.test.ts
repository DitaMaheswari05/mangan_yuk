import {
  isValidInternalRoute,
  isValidPoiId,
  sanitizeNumber,
  sanitizePoiId,
  sanitizeTastes,
} from '../validation';

describe('validation & sanitization (OWASP M4)', () => {
  describe('isValidPoiId & sanitizePoiId', () => {
    it('menerima format POI ID yang valid (P01..P99)', () => {
      expect(isValidPoiId('P01')).toBe(true);
      expect(isValidPoiId('p10')).toBe(true);
      expect(sanitizePoiId('p05')).toBe('P05');
      expect(sanitizePoiId(['p07'])).toBe('P07');
    });

    it('menolak format POI ID yang tidak valid atau serangan traversal/injeksi', () => {
      expect(isValidPoiId('P1')).toBe(false);
      expect(isValidPoiId('P100')).toBe(false);
      expect(isValidPoiId('../P01')).toBe(false);
      expect(isValidPoiId('P01;DROP TABLE')).toBe(false);
      expect(sanitizePoiId('invalid')).toBeNull();
      expect(sanitizePoiId(null)).toBeNull();
      expect(sanitizePoiId(undefined)).toBeNull();
    });
  });

  describe('isValidInternalRoute', () => {
    it('mengizinkan rute internal yang terdaftar', () => {
      expect(isValidInternalRoute('/(tabs)')).toBe(true);
      expect(isValidInternalRoute('/(tabs)/search')).toBe(true);
      expect(isValidInternalRoute('/poi/P01')).toBe(true);
      expect(isValidInternalRoute('/navigate/P05')).toBe(true);
      expect(isValidInternalRoute('/trail/itinerary')).toBe(true);
      expect(isValidInternalRoute('/onboarding/location')).toBe(true);
    });

    it('menolak rute eksternal, open redirect, atau traversal', () => {
      expect(isValidInternalRoute('https://malicious.com')).toBe(false);
      expect(isValidInternalRoute('//malicious.com')).toBe(false);
      expect(isValidInternalRoute('/unknown-secret-route')).toBe(false);
      expect(isValidInternalRoute('/poi/../../hack')).toBe(false);
      expect(isValidInternalRoute(null)).toBe(false);
    });
  });

  describe('sanitizeNumber', () => {
    it('membersihkan nilai angka dan menerapkan batas min/max', () => {
      expect(sanitizeNumber('50000', 10000, 15000, 100000)).toBe(50000);
      expect(sanitizeNumber('5000', 10000, 15000, 100000)).toBe(15000);
      expect(sanitizeNumber('500000', 10000, 15000, 100000)).toBe(100000);
      expect(sanitizeNumber('invalid', 20000)).toBe(20000);
    });
  });

  describe('sanitizeTastes', () => {
    it('hanya menyisakan taste tag yang valid', () => {
      expect(sanitizeTastes('pedas,gurih,unknown')).toEqual(['pedas', 'gurih']);
      expect(sanitizeTastes(['manis', 'hacked'])).toEqual(['manis']);
      expect(sanitizeTastes(null, ['gurih'])).toEqual(['gurih']);
    });
  });
});
