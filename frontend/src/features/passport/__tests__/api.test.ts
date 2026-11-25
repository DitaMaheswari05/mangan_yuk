import { getPoiById } from '@/features/poi';
import { loadSecure } from '@/storage/secure';
import { PassportReviewApi } from '../api';
import { INITIAL_PASSPORT_STATE } from '../index';

jest.mock('@/storage/secure', () => ({
  SECURE_KEYS: { ACCESS_TOKEN: 'access_token' },
  loadSecure: jest.fn(async () => null),
}));

const mockFetch = jest.fn();
globalThis.fetch = mockFetch as unknown as typeof fetch;

describe('PassportReviewApi', () => {
  beforeEach(async () => {
    jest.clearAllMocks();
    (loadSecure as jest.Mock).mockResolvedValue(null);
    await PassportReviewApi.saveLocalPassport(INITIAL_PASSPORT_STATE);
  });

  it('getPassport() dalam mode tamu/offline menghitung statistik dari penyimpanan lokal', async () => {
    const res = await PassportReviewApi.getPassport('http://api.test/v1');

    expect(mockFetch).not.toHaveBeenCalled();
    expect(res.ok).toBe(true);
    if (res.ok) {
      expect(res.data.stats.totalPois).toBeGreaterThan(0);
      expect(res.data.stats.stampedPoisCount).toBe(0);
      expect(res.data.stats.totalReviews).toBe(0);
    }
  });

  it('getPassport() mengambil data dari server saat token valid dan menyinkronkan ke lokal', async () => {
    (loadSecure as jest.Mock).mockResolvedValue('jwt_valid_token');
    const serverPayload = {
      stamps: {
        P01: { poiId: 'P01', firstStampedAt: '2026-11-20T10:00:00Z', lastStampedAt: '2026-11-20T10:00:00Z', visitCount: 1 },
      },
      unlockedBadgeIds: [],
      badges: [],
      trails: [],
      reviews: [],
      stats: {
        totalPois: 31,
        stampedPoisCount: 1,
        completionPercentage: 3,
        totalReviews: 0,
        totalMenuItemsTried: 0,
        unlockedBadgesCount: 0,
        totalBadges: 4,
      },
    };
    mockFetch.mockResolvedValueOnce({
      ok: true,
      json: async () => serverPayload,
    });

    const res = await PassportReviewApi.getPassport('http://api.test/v1');
    expect(res.ok).toBe(true);
    expect(mockFetch).toHaveBeenCalledWith(
      'http://api.test/v1/passport',
      expect.objectContaining({
        method: 'GET',
        headers: expect.objectContaining({ Authorization: 'Bearer jwt_valid_token' }),
      }),
    );
    const local = await PassportReviewApi.loadLocalPassport();
    expect(local.stamps.P01).toBeDefined();
  });

  it('getPassport() fallback ke data lokal jika fetch server gagal', async () => {
    (loadSecure as jest.Mock).mockResolvedValue('jwt_valid_token');
    mockFetch.mockRejectedValueOnce(new Error('Network down'));

    const res = await PassportReviewApi.getPassport('http://api.test/v1');
    expect(res.ok).toBe(true);
  });

  it('getPoiReviews() mengembalikan NOT_FOUND untuk poiId tidak dikenal', async () => {
    const res = await PassportReviewApi.getPoiReviews('P999', 'http://api.test/v1');
    expect(res.ok).toBe(false);
    if (!res.ok) expect(res.error.code).toBe('NOT_FOUND');
    expect(mockFetch).not.toHaveBeenCalled();
  });

  it('submitReview() memvalidasi rating, panjang ulasan, dan kepemilikan menu', async () => {
    const badRating = await PassportReviewApi.submitReview({ poiId: 'P01', rating: 6 as never });
    expect(badRating.ok).toBe(false);
    if (!badRating.ok) expect(badRating.error.code).toBe('VALIDATION_ERROR');

    const badDecimal = await PassportReviewApi.submitReview({ poiId: 'P01', rating: 4.5 as never });
    expect(badDecimal.ok).toBe(false);
    if (!badDecimal.ok) expect(badDecimal.error.code).toBe('VALIDATION_ERROR');

    const longText = await PassportReviewApi.submitReview({
      poiId: 'P01',
      rating: 5,
      reviewText: 'a'.repeat(1001),
    });
    expect(longText.ok).toBe(false);
    if (!longText.ok) expect(longText.error.code).toBe('VALIDATION_ERROR');

    const wrongMenu = await PassportReviewApi.submitReview({
      poiId: 'P01',
      rating: 5,
      menuItemIds: ['MENU-TIDAK-ADA'],
    });
    expect(wrongMenu.ok).toBe(false);
    if (!wrongMenu.ok) expect(wrongMenu.error.code).toBe('VALIDATION_ERROR');
  });

  it('submitReview() dalam mode offline mencatat review, stempel idempoten, dan statistik lokal', async () => {
    const poi = getPoiById('P01')!;
    const firstMenuId = poi.menu[0]?.id;

    const first = await PassportReviewApi.submitReview({
      poiId: 'P01',
      rating: 5,
      reviewText: 'Mantap sekali!',
      menuItemIds: firstMenuId ? [firstMenuId] : [],
    });

    expect(first.ok).toBe(true);
    if (first.ok) {
      expect(first.data.isNewStamp).toBe(true);
      expect(first.data.stamp.visitCount).toBe(1);
      expect(first.data.review.rating).toBe(5);
    }

    const second = await PassportReviewApi.submitReview({
      poiId: 'P01',
      rating: 4,
      reviewText: 'Datang lagi!',
    });

    expect(second.ok).toBe(true);
    if (second.ok) {
      expect(second.data.isNewStamp).toBe(false);
      expect(second.data.stamp.visitCount).toBe(2);
    }

    mockFetch.mockRejectedValueOnce(new Error('Offline'));
    const reviewsRes = await PassportReviewApi.getPoiReviews('P01', 'http://api.test/v1');
    expect(reviewsRes.ok).toBe(true);
    if (reviewsRes.ok) {
      expect(reviewsRes.data.reviews).toHaveLength(2);
      expect(reviewsRes.data.stats.averageRating).toBe(4.5);
    }
  });

  it('submitReview() memetakan kode error HTTP server dengan benar', async () => {
    (loadSecure as jest.Mock).mockResolvedValue('jwt_valid_token');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 401,
      json: async () => ({ error: { code: 'TOKEN_EXPIRED', message: 'Sesi habis' } }),
    });
    const expired = await PassportReviewApi.submitReview({ poiId: 'P01', rating: 5 }, 'http://api.test/v1');
    expect(expired.ok).toBe(false);
    if (!expired.ok) expect(expired.error.code).toBe('SESSION_EXPIRED');

    mockFetch.mockResolvedValueOnce({
      ok: false,
      status: 429,
      json: async () => ({ error: { code: 'RATE_LIMITED', message: 'Terlalu cepat' } }),
    });
    const limited = await PassportReviewApi.submitReview({ poiId: 'P01', rating: 5 }, 'http://api.test/v1');
    expect(limited.ok).toBe(false);
    if (!limited.ok) expect(limited.error.code).toBe('RATE_LIMITED');
  });
});
