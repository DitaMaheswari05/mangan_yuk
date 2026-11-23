// ============================================================================
// Unit Test Backend: Gamifikasi Paspor Kuliner & Ulasan Tenant/Menu (F10 / PB-16)
// Menguji: Validasi input, pembuatan ulasan + menu, integrasi otomatis stempel
// paspor idempoten, progres trail, evaluasi badge, statistik rating/menu populer,
// serta otorisasi edit/hapus ulasan.
// ============================================================================

import { beforeEach, describe, expect, it } from 'vitest';
import { ApiError } from '../errors';
import {
  calculateTrailProgress,
  computePoiReviewStats,
  DEFAULT_SEED_POIS,
  DEFAULT_SEED_TRAILS,
  evaluateBadges,
  MemoryReviewStore,
  ReviewService,
} from '../reviews';
import * as v from '../reviews/validation';

const USER_A = '11111111-1111-4111-8111-111111111111';
const USER_B = '22222222-2222-4222-8222-222222222222';

let clock: Date;
let store: MemoryReviewStore;
let service: ReviewService;

beforeEach(() => {
  clock = new Date('2026-11-17T10:00:00Z');
  store = new MemoryReviewStore({
    pois: DEFAULT_SEED_POIS,
    trails: DEFAULT_SEED_TRAILS,
    resolveDisplayName: (uid) => (uid === USER_A ? 'Dita Explorer' : uid === USER_B ? 'Bram Foodie' : 'Tamu'),
  });
  service = new ReviewService({ store, now: () => clock });
});

const advance = (ms: number) => {
  clock = new Date(clock.getTime() + ms);
};

describe('REV-VAL: Validasi Schema Input Review & Stempel', () => {
  it('menerima payload createReviewBody yang valid dan menormalisasi duplikat menuItemIds', () => {
    const parsed = v.parse(v.createReviewBody, {
      poiId: ' P01 ',
      rating: 5,
      reviewText: '  Pisang goreng kipasnya renyah banget!  ',
      photoPath: 'p01/review-1.jpg',
      menuItemIds: ['P01-M01', 'P01-M02', 'P01-M01'],
    });

    expect(parsed).toEqual({
      poiId: 'P01',
      rating: 5,
      reviewText: 'Pisang goreng kipasnya renyah banget!',
      photoPath: 'p01/review-1.jpg',
      menuItemIds: ['P01-M01', 'P01-M02'],
    });
  });

  it('mengubah reviewText dan photoPath kosong menjadi null', () => {
    const parsed = v.parse(v.createReviewBody, {
      poiId: 'P01',
      rating: 4,
      reviewText: '   ',
      photoPath: '',
    });

    expect(parsed.reviewText).toBeNull();
    expect(parsed.photoPath).toBeNull();
    expect(parsed.menuItemIds).toEqual([]);
  });

  it('menolak rating di luar rentang 1..5, bukan integer, atau format poiId/menuItemIds salah', () => {
    expect(() =>
      v.parse(v.createReviewBody, {
        poiId: 'salah-id',
        rating: 6,
        photoPath: '../rahasia.jpg',
        menuItemIds: ['MENU-NGACO'],
      }),
    ).toThrowError(ApiError);

    try {
      v.parse(v.createReviewBody, {
        poiId: 'salah-id',
        rating: 0,
        photoPath: '../rahasia.jpg',
        menuItemIds: ['MENU-NGACO'],
      });
    } catch (e) {
      const err = e as ApiError;
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual(
        expect.arrayContaining([
          { field: 'poiId', rule: 'format' },
          { field: 'rating', rule: 'min' },
          { field: 'photoPath', rule: 'format' },
          { field: 'menuItemIds.0', rule: 'format' },
        ]),
      );
    }
  });

  it('menolak updateReviewBody kosong tanpa field perubahan', () => {
    try {
      v.parse(v.updateReviewBody, {});
      expect.fail('Seharusnya melempar VALIDATION_ERROR');
    } catch (e) {
      const err = e as ApiError;
      expect(err.code).toBe('VALIDATION_ERROR');
      expect(err.details).toEqual([{ field: 'body', rule: 'emptyUpdate' }]);
    }
  });
});

describe('REV-01/03: Pembuatan Ulasan Tenant & Validasi Kepemilikan Menu', () => {
  it('berhasil membuat review beserta menuItemIds yang sesuai dan mencatat stempel paspor otomatis', async () => {
    const res = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 5,
      reviewText: 'Pisang goreng kipas Pontianak juara!',
      photoPath: 'user-a/p01-kipas.jpg',
      menuItemIds: ['P01-M01', 'P01-M03'],
    });

    expect(res.review).toMatchObject({
      userId: USER_A,
      userDisplayName: 'Dita Explorer',
      poiId: 'P01',
      rating: 5,
      reviewText: 'Pisang goreng kipas Pontianak juara!',
      photoPath: 'user-a/p01-kipas.jpg',
      menuItemIds: ['P01-M01', 'P01-M03'],
    });
    expect(res.isNewStamp).toBe(true);
    expect(res.stamp).toEqual({
      poiId: 'P01',
      firstStampedAt: '2026-11-17T10:00:00.000Z',
      lastStampedAt: '2026-11-17T10:00:00.000Z',
      visitCount: 1,
    });
    expect(res.passport.stats.stampedPoisCount).toBe(1);
    expect(res.passport.stats.totalMenuItemsTried).toBe(2);
  });

  it('menolak review jika menuItemId bukan milik tenant yang sedang direview (poiMismatch)', async () => {
    await expect(
      service.createReview(USER_A, {
        poiId: 'P01',
        rating: 4,
        reviewText: 'Coba masukin menu Swike P03 ke review P01',
        menuItemIds: ['P01-M01', 'P03-M01'], // P03-M01 milik P03!
      }),
    ).rejects.toMatchObject({
      code: 'VALIDATION_ERROR',
      status: 400,
      details: [{ field: 'menuItemIds', rule: 'poiMismatch' }],
    });

    // Pastikan tidak ada review maupun stempel yang bocor tersimpan
    const passport = await service.getPassport(USER_A);
    expect(passport.reviews).toHaveLength(0);
    expect(Object.keys(passport.stamps)).toHaveLength(0);
  });

  it('melempar 404 NOT_FOUND jika poiId tidak terdaftar di katalog', async () => {
    await expect(
      service.createReview(USER_A, {
        poiId: 'P99',
        rating: 5,
      }),
    ).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });

  it('bersifat idempoten pada stempel paspor saat pengguna mereview tenant yang sama berulang kali', async () => {
    const first = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 4,
      menuItemIds: ['P01-M01'],
    });
    expect(first.isNewStamp).toBe(true);

    advance(2 * 3600_000); // 2 jam kemudian

    const second = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 5,
      menuItemIds: ['P01-M02'],
    });
    expect(second.isNewStamp).toBe(false);
    expect(Object.keys(second.passport.stamps)).toEqual(['P01']);
    expect(second.stamp).toEqual({
      poiId: 'P01',
      firstStampedAt: '2026-11-17T10:00:00.000Z',
      lastStampedAt: '2026-11-17T12:00:00.000Z',
      visitCount: 2,
    });
    expect(second.passport.stats.totalReviews).toBe(2);
    expect(second.passport.stats.totalMenuItemsTried).toBe(2);
  });
});

describe('REV-07: Statistik Rating Tenant & Menu Terpopuler', () => {
  it('menghitung rata-rata rating, distribusi bintang 1..5, dan urutan menu populer dengan akurat', async () => {
    await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 5,
      reviewText: 'Mantap!',
      menuItemIds: ['P01-M01', 'P01-M03'],
    });

    advance(60_000);

    await service.createReview(USER_B, {
      poiId: 'P01',
      rating: 4,
      reviewText: 'Enak dimakan hangat.',
      menuItemIds: ['P01-M01', 'P01-M02'],
    });

    const poiReviews = await service.getPoiReviews('P01');

    expect(poiReviews.poiId).toBe('P01');
    expect(poiReviews.reviews).toHaveLength(2);
    // Urutan terbaru di atas (USER_B dulu, baru USER_A)
    expect(poiReviews.reviews[0].userId).toBe(USER_B);
    expect(poiReviews.reviews[1].userId).toBe(USER_A);

    expect(poiReviews.stats.totalReviews).toBe(2);
    expect(poiReviews.stats.averageRating).toBe(4.5);
    expect(poiReviews.stats.ratingBreakdown).toEqual({
      1: 0,
      2: 0,
      3: 0,
      4: 1,
      5: 1,
    });

    // P01-M01 dipilih 2 kali, P01-M02 dan P01-M03 masing-masing 1 kali
    expect(poiReviews.stats.popularMenus[0]).toMatchObject({
      menuItemId: 'P01-M01',
      name: 'Pisang Goreng Kipas Khas Pontianak',
      reviewCount: 2,
    });
    expect(poiReviews.stats.popularMenus).toHaveLength(3);
  });

  it('mengembalikan rata-rata 0 dan popularMenus kosong jika belum ada ulasan pada POI', async () => {
    const res = await service.getPoiReviews('P03');
    expect(res.stats).toEqual({
      totalReviews: 0,
      averageRating: 0,
      ratingBreakdown: { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 },
      popularMenus: [],
    });
    expect(res.reviews).toEqual([]);
  });
});

describe('REV-05/06: Update & Hapus Ulasan beserta Otorisasi Pemilik', () => {
  it('mengizinkan pemilik mengubah rating, teks, dan daftar menu ulasannya sendiri', async () => {
    const { review } = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 3,
      reviewText: 'Lumayan',
      menuItemIds: ['P01-M01'],
    });

    advance(120_000);

    const updated = await service.updateReview(USER_A, review.id, {
      rating: 5,
      reviewText: 'Setelah coba lagi ternyata enak banget!',
      menuItemIds: ['P01-M01', 'P01-M05'],
    });

    expect(updated.review.rating).toBe(5);
    expect(updated.review.reviewText).toBe('Setelah coba lagi ternyata enak banget!');
    expect(updated.review.menuItemIds).toEqual(['P01-M01', 'P01-M05']);
    expect(updated.review.updatedAt).toBe('2026-11-17T10:02:00.000Z');
  });

  it('menolak update/delete jika dilakukan oleh pengguna lain (403 FORBIDDEN)', async () => {
    const { review } = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 5,
    });

    await expect(
      service.updateReview(USER_B, review.id, { rating: 1 }),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });

    await expect(
      service.deleteReview(USER_B, review.id),
    ).rejects.toMatchObject({
      code: 'FORBIDDEN',
      status: 403,
    });
  });

  it('berhasil menghapus ulasan milik sendiri dan mengembalikan 404 saat diakses ulang', async () => {
    const { review } = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 5,
    });

    await service.deleteReview(USER_A, review.id);

    await expect(service.getReviewById(review.id)).rejects.toMatchObject({
      code: 'NOT_FOUND',
      status: 404,
    });
  });
});

describe('GAM-01/02: Progres Trail Tematik & Evaluasi Lencana (Badge) Paspor Kuliner', () => {
  it('membuka badge baru tepat saat seluruh tenant dalam trail selesai dikunjungi/direview', async () => {
    // Trail 'jejak-jajanan-sudirman' membutuhkan P01, P13, P17
    const r1 = await service.createReview(USER_A, {
      poiId: 'P01',
      rating: 5,
      menuItemIds: ['P01-M01'],
    });
    expect(r1.newlyUnlockedBadges).toHaveLength(0);

    advance(60_000);
    const r2 = await service.recordStamp(USER_A, 'P13');
    expect(r2.newlyUnlockedBadges).toHaveLength(0);

    const trailMid = r2.passport.trails.find((t) => t.trailId === 'jejak-jajanan-sudirman')!;
    expect(trailMid.visitedCount).toBe(2);
    expect(trailMid.percentage).toBe(67);
    expect(trailMid.isCompleted).toBe(false);

    advance(60_000);
    // Tenant terakhir di trail jejak-jajanan-sudirman
    const r3 = await service.createReview(USER_A, {
      poiId: 'P17',
      rating: 5,
      reviewText: 'Kuo tie panggangnya mantap!',
      menuItemIds: ['P17-M01'],
    });

    expect(r3.newlyUnlockedBadges).toHaveLength(1);
    expect(r3.newlyUnlockedBadges[0]).toMatchObject({
      id: 'jejak-jajanan-sudirman',
      name: 'Penjelajah Jajanan Sudirman',
      trailId: 'jejak-jajanan-sudirman',
      unlockedAt: '2026-11-17T10:02:00.000Z',
    });
    expect(r3.passport.unlockedBadgeIds).toContain('jejak-jajanan-sudirman');

    // Kunjungan ulang ke P17 tidak boleh memicu newlyUnlockedBadges duplikat
    advance(60_000);
    const r4 = await service.recordStamp(USER_A, 'P17');
    expect(r4.newlyUnlockedBadges).toHaveLength(0);
    expect(r4.passport.unlockedBadgeIds).toEqual(['jejak-jajanan-sudirman']);
  });

  it('trail kosong tidak dianggap selesai dan tidak membuka badge', () => {
    const emptyProgress = calculateTrailProgress(
      {
        id: 'empty-trail',
        name: 'Trail Kosong',
        description: '',
        badgeName: 'Badge Kosong',
        badgeIcon: null,
        poiIds: [],
      },
      ['P01'],
    );
    expect(emptyProgress.totalPois).toBe(0);
    expect(emptyProgress.percentage).toBe(0);
    expect(emptyProgress.isCompleted).toBe(false);

    const evalResult = evaluateBadges([
      {
        id: 'empty-trail',
        name: 'Trail Kosong',
        description: '',
        badgeName: 'Badge Kosong',
        badgeIcon: null,
        poiIds: [],
      },
    ], {});
    expect(evalResult.unlockedBadgeIds).toHaveLength(0);
  });

  it('computePoiReviewStats menangani pembulatan 1 desimal dengan presisi', () => {
    const stats = computePoiReviewStats([
      {
        id: '1',
        userId: USER_A,
        userDisplayName: 'A',
        poiId: 'P01',
        rating: 5,
        reviewText: null,
        photoPath: null,
        menuItemIds: [],
        createdAt: clock.toISOString(),
        updatedAt: clock.toISOString(),
      },
      {
        id: '2',
        userId: USER_B,
        userDisplayName: 'B',
        poiId: 'P01',
        rating: 4,
        reviewText: null,
        photoPath: null,
        menuItemIds: [],
        createdAt: clock.toISOString(),
        updatedAt: clock.toISOString(),
      },
      {
        id: '3',
        userId: USER_A,
        userDisplayName: 'A',
        poiId: 'P01',
        rating: 4,
        reviewText: null,
        photoPath: null,
        menuItemIds: [],
        createdAt: clock.toISOString(),
        updatedAt: clock.toISOString(),
      },
    ]);

    // (5 + 4 + 4) / 3 = 4.333... -> 4.3
    expect(stats.averageRating).toBe(4.3);
    expect(stats.totalReviews).toBe(3);
  });
});
