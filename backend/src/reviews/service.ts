// Logic bisnis Gamifikasi Paspor Kuliner & Ulasan Tenant/Menu (F10 / PB-16).

import { ApiError } from '../errors';
import {
  PoiMenuMismatchError,
  type MenuCatalogItem,
  type PassportStampRecord,
  type ReviewRecord,
  type ReviewStore,
  type TrailRecord,
} from './store';

export interface PublicReview {
  id: string;
  userId: string;
  userDisplayName: string;
  poiId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText: string | null;
  photoPath: string | null;
  menuItemIds: string[];
  createdAt: string;
  updatedAt: string;
}

export interface PublicStamp {
  poiId: string;
  firstStampedAt: string;
  lastStampedAt: string;
  visitCount: number;
}

export interface TrailProgressDto {
  trailId: string;
  trailName: string;
  description: string;
  badgeName: string;
  badgeIcon: string | null;
  poiIds: string[];
  totalPois: number;
  visitedCount: number;
  percentage: number;
  isCompleted: boolean;
}

export interface UnlockedBadgeDto {
  id: string;
  name: string;
  icon: string | null;
  trailId: string;
  unlockedAt: string;
}

export interface PopularMenuStatDto {
  menuItemId: string;
  name: string;
  description?: string | null;
  priceIdr: number;
  isSignature: boolean;
  reviewCount: number;
}

export interface PoiReviewStatsDto {
  totalReviews: number;
  averageRating: number;
  ratingBreakdown: {
    1: number;
    2: number;
    3: number;
    4: number;
    5: number;
  };
  popularMenus: PopularMenuStatDto[];
}

export interface PassportStatsDto {
  totalPois: number;
  stampedPoisCount: number;
  completionPercentage: number;
  totalReviews: number;
  totalMenuItemsTried: number;
  unlockedBadgesCount: number;
  totalBadges: number;
}

export interface PassportSummaryDto {
  stamps: Record<string, PublicStamp>;
  unlockedBadgeIds: string[];
  badges: UnlockedBadgeDto[];
  trails: TrailProgressDto[];
  reviews: PublicReview[];
  stats: PassportStatsDto;
}

export interface CreateReviewInput {
  poiId: string;
  rating: number;
  reviewText?: string | null;
  photoPath?: string | null;
  menuItemIds?: string[];
}

export interface UpdateReviewPatch {
  rating?: number;
  reviewText?: string | null;
  photoPath?: string | null;
  menuItemIds?: string[];
}

export interface ReviewDeps {
  store: ReviewStore;
  now?: () => Date;
}

export const toPublicReview = (r: ReviewRecord): PublicReview => ({
  id: r.id,
  userId: r.userId,
  userDisplayName: r.userDisplayName,
  poiId: r.poiId,
  rating: r.rating as 1 | 2 | 3 | 4 | 5,
  reviewText: r.reviewText,
  photoPath: r.photoPath,
  menuItemIds: [...r.menuItemIds],
  createdAt: r.createdAt.toISOString(),
  updatedAt: r.updatedAt.toISOString(),
});

/**
 * Menghitung progres penyelesaian satu trail tematik berdasarkan himpunan POI yang sudah distempel.
 */
export function calculateTrailProgress(
  trail: TrailRecord,
  stampedPoiIds: ReadonlySet<string> | string[],
): TrailProgressDto {
  const stampedSet = stampedPoiIds instanceof Set ? stampedPoiIds : new Set(stampedPoiIds);
  const totalPois = trail.poiIds.length;

  if (totalPois === 0) {
    return {
      trailId: trail.id,
      trailName: trail.name,
      description: trail.description,
      badgeName: trail.badgeName,
      badgeIcon: trail.badgeIcon,
      poiIds: [...trail.poiIds],
      totalPois: 0,
      visitedCount: 0,
      percentage: 100,
      isCompleted: true,
    };
  }

  const visitedCount = trail.poiIds.filter((id) => stampedSet.has(id)).length;
  const percentage = Math.round((visitedCount / totalPois) * 100);
  const isCompleted = visitedCount === totalPois;

  return {
    trailId: trail.id,
    trailName: trail.name,
    description: trail.description,
    badgeName: trail.badgeName,
    badgeIcon: trail.badgeIcon,
    poiIds: [...trail.poiIds],
    totalPois,
    visitedCount,
    percentage,
    isCompleted,
  };
}

/**
 * Mengevaluasi seluruh trail dan menentukan lencana (badge) mana saja yang telah terbuka.
 * Waktu `unlockedAt` pada suatu badge diambil dari waktu stempel terakhir di antara POI syarat trail tersebut.
 */
export function evaluateBadges(
  trails: TrailRecord[],
  stamps: Record<string, PublicStamp>,
  fallbackNowIso: string = new Date().toISOString(),
): {
  trails: TrailProgressDto[];
  unlockedBadgeIds: string[];
  badges: UnlockedBadgeDto[];
} {
  const stampedSet = new Set(Object.keys(stamps));
  const trailProgressList: TrailProgressDto[] = [];
  const unlockedBadgeIds: string[] = [];
  const badges: UnlockedBadgeDto[] = [];

  for (const trail of trails) {
    const progress = calculateTrailProgress(trail, stampedSet);
    trailProgressList.push(progress);

    if (progress.isCompleted && trail.poiIds.length > 0) {
      unlockedBadgeIds.push(trail.id);

      // Tentukan kapan trail selesai: timestamp firstStampedAt paling akhir dari seluruh POI di trail ini
      let latestFirstStampMs = 0;
      for (const poiId of trail.poiIds) {
        const s = stamps[poiId];
        if (s) {
          const ms = new Date(s.firstStampedAt).getTime();
          if (ms > latestFirstStampMs) latestFirstStampMs = ms;
        }
      }

      badges.push({
        id: trail.id,
        name: trail.badgeName,
        icon: trail.badgeIcon,
        trailId: trail.id,
        unlockedAt: latestFirstStampMs > 0 ? new Date(latestFirstStampMs).toISOString() : fallbackNowIso,
      });
    }
  }

  return {
    trails: trailProgressList,
    unlockedBadgeIds,
    badges,
  };
}

/**
 * Menghitung statistik agregat ulasan suatu tenant: rata-rata rating (1 desimal),
 * distribusi bintang 1..5, serta menu yang paling sering dicicipi/direview.
 */
export function computePoiReviewStats(
  reviews: PublicReview[],
  menuCatalog: MenuCatalogItem[] = [],
): PoiReviewStatsDto {
  const breakdown: PoiReviewStatsDto['ratingBreakdown'] = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
  let sum = 0;
  const menuCounts = new Map<string, number>();

  for (const r of reviews) {
    const star = r.rating as 1 | 2 | 3 | 4 | 5;
    if (breakdown[star] !== undefined) {
      breakdown[star] += 1;
    }
    sum += r.rating;

    for (const menuId of r.menuItemIds) {
      menuCounts.set(menuId, (menuCounts.get(menuId) ?? 0) + 1);
    }
  }

  const totalReviews = reviews.length;
  const averageRating = totalReviews > 0 ? Math.round((sum / totalReviews) * 10) / 10 : 0;

  const catalogMap = new Map(menuCatalog.map((m) => [m.id, m]));
  const popularMenus: PopularMenuStatDto[] = [];

  for (const [menuItemId, reviewCount] of menuCounts.entries()) {
    const info = catalogMap.get(menuItemId);
    popularMenus.push({
      menuItemId,
      name: info?.name ?? menuItemId,
      description: info?.description ?? null,
      priceIdr: info?.priceIdr ?? 0,
      isSignature: info?.isSignature ?? false,
      reviewCount,
    });
  }

  popularMenus.sort((a, b) => b.reviewCount - a.reviewCount || a.menuItemId.localeCompare(b.menuItemId));

  return {
    totalReviews,
    averageRating,
    ratingBreakdown: breakdown,
    popularMenus,
  };
}

/**
 * Menggabungkan catatan stempel (`passport_stamps`) dan riwayat ulasan (`reviews`) milik pengguna
 * menjadi peta `Record<poiId, PublicStamp>`.
 */
export function buildStampMap(
  stampRecords: PassportStampRecord[],
  userReviews: ReviewRecord[],
): Record<string, PublicStamp> {
  const reviewsByPoi = new Map<string, ReviewRecord[]>();
  for (const r of userReviews) {
    const list = reviewsByPoi.get(r.poiId) ?? [];
    list.push(r);
    reviewsByPoi.set(r.poiId, list);
  }

  const stamps: Record<string, PublicStamp> = {};

  for (const s of stampRecords) {
    const poiReviews = reviewsByPoi.get(s.poiId) ?? [];
    let firstMs = s.stampedAt.getTime();
    let lastMs = s.lastStampedAt.getTime();

    for (const r of poiReviews) {
      const t = r.createdAt.getTime();
      if (t < firstMs) firstMs = t;
      if (t > lastMs) lastMs = t;
    }

    stamps[s.poiId] = {
      poiId: s.poiId,
      firstStampedAt: new Date(firstMs).toISOString(),
      lastStampedAt: new Date(lastMs).toISOString(),
      visitCount: Math.max(s.visitCount, poiReviews.length, 1),
    };
  }

  return stamps;
}

export class ReviewService {
  private readonly store: ReviewStore;
  private readonly now: () => Date;

  constructor({ store, now = () => new Date() }: ReviewDeps) {
    this.store = store;
    this.now = now;
  }

  /**
   * Membuat ulasan baru untuk suatu tenant beserta daftar menu yang dimakan,
   * mencatat stempel paspor otomatis (idempoten), dan mengevaluasi badge baru yang terbuka.
   */
  async createReview(userId: string, input: CreateReviewInput) {
    const poi = await this.store.findPoiById(input.poiId);
    if (!poi) {
      throw new ApiError('NOT_FOUND', [{ field: 'poiId', rule: 'notFound' }]);
    }

    const beforePassport = await this.getPassport(userId);
    const beforeBadges = new Set(beforePassport.unlockedBadgeIds);

    const trimmedText = input.reviewText?.trim() ? input.reviewText.trim() : null;
    const trimmedPhoto = input.photoPath?.trim() ? input.photoPath.trim() : null;
    const uniqueMenuIds = input.menuItemIds ? Array.from(new Set(input.menuItemIds)) : [];

    let created: { review: ReviewRecord; stamp: PassportStampRecord; isNewStamp: boolean };
    try {
      created = await this.store.createReview({
        userId,
        poiId: input.poiId,
        rating: input.rating,
        reviewText: trimmedText,
        photoPath: trimmedPhoto,
        menuItemIds: uniqueMenuIds,
        now: this.now(),
      });
    } catch (e) {
      if (e instanceof PoiMenuMismatchError) {
        throw new ApiError('VALIDATION_ERROR', [{ field: 'menuItemIds', rule: 'poiMismatch' }]);
      }
      throw e;
    }

    const passport = await this.getPassport(userId);
    const newlyUnlockedBadges = passport.badges.filter((b) => !beforeBadges.has(b.id));

    return {
      review: toPublicReview(created.review),
      stamp: passport.stamps[input.poiId],
      isNewStamp: created.isNewStamp,
      newlyUnlockedBadges,
      passport,
    };
  }

  /**
   * Mengambil seluruh ulasan publik untuk suatu tenant beserta ringkasan rating & menu terpopuler.
   */
  async getPoiReviews(poiId: string) {
    const poi = await this.store.findPoiById(poiId);
    if (!poi) {
      throw new ApiError('NOT_FOUND', [{ field: 'poiId', rule: 'notFound' }]);
    }

    const rows = await this.store.listReviewsByPoi(poiId);
    const reviews = rows.map(toPublicReview);
    const stats = computePoiReviewStats(reviews, poi.menuItems);

    return {
      poiId: poi.id,
      poiName: poi.name,
      stats,
      reviews,
    };
  }

  /**
   * Mengambil daftar ulasan dengan filter opsional `poiId` atau `userId`.
   */
  async listReviews(filter: { poiId?: string; userId?: string } = {}) {
    if (filter.poiId) {
      const poi = await this.store.findPoiById(filter.poiId);
      if (!poi) {
        throw new ApiError('NOT_FOUND', [{ field: 'poiId', rule: 'notFound' }]);
      }
      const rows = await this.store.listReviewsByPoi(filter.poiId);
      const filtered = filter.userId ? rows.filter((r) => r.userId === filter.userId) : rows;
      const reviews = filtered.map(toPublicReview);
      return {
        reviews,
        stats: computePoiReviewStats(reviews, poi.menuItems),
      };
    }

    if (filter.userId) {
      const rows = await this.store.listReviewsByUser(filter.userId);
      return { reviews: rows.map(toPublicReview) };
    }

    // Jika tanpa filter, kumpulkan ulasan dari seluruh POI urut terbaru
    const poiIds = await this.store.listAllPoiIds();
    const allLists = await Promise.all(poiIds.map((id) => this.store.listReviewsByPoi(id)));
    const all = allLists
      .flat()
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map(toPublicReview);
    return { reviews: all };
  }

  /**
   * Mengambil satu ulasan berdasarkan ID.
   */
  async getReviewById(reviewId: string): Promise<PublicReview> {
    const row = await this.store.findReviewById(reviewId);
    if (!row) throw new ApiError('NOT_FOUND');
    return toPublicReview(row);
  }

  /**
   * Mengambil seluruh ulasan yang dibuat oleh pengguna yang sedang login.
   */
  async getUserReviews(userId: string) {
    const rows = await this.store.listReviewsByUser(userId);
    return { reviews: rows.map(toPublicReview) };
  }

  /**
   * Memperbarui ulasan milik pengguna sendiri.
   */
  async updateReview(userId: string, reviewId: string, patch: UpdateReviewPatch) {
    const existing = await this.store.findReviewById(reviewId);
    if (!existing) throw new ApiError('NOT_FOUND');
    if (existing.userId !== userId) throw new ApiError('FORBIDDEN');

    let updated: ReviewRecord | null;
    try {
      updated = await this.store.updateReview(reviewId, {
        rating: patch.rating,
        reviewText:
          patch.reviewText !== undefined
            ? patch.reviewText?.trim()
              ? patch.reviewText.trim()
              : null
            : undefined,
        photoPath:
          patch.photoPath !== undefined
            ? patch.photoPath?.trim()
              ? patch.photoPath.trim()
              : null
            : undefined,
        menuItemIds:
          patch.menuItemIds !== undefined ? Array.from(new Set(patch.menuItemIds)) : undefined,
        now: this.now(),
      });
    } catch (e) {
      if (e instanceof PoiMenuMismatchError) {
        throw new ApiError('VALIDATION_ERROR', [{ field: 'menuItemIds', rule: 'poiMismatch' }]);
      }
      throw e;
    }

    if (!updated) throw new ApiError('NOT_FOUND');
    return { review: toPublicReview(updated) };
  }

  /**
   * Menghapus ulasan milik pengguna sendiri.
   */
  async deleteReview(userId: string, reviewId: string): Promise<void> {
    const existing = await this.store.findReviewById(reviewId);
    if (!existing) throw new ApiError('NOT_FOUND');
    if (existing.userId !== userId) throw new ApiError('FORBIDDEN');

    await this.store.deleteReview(reviewId);
  }

  /**
   * Mencatat stempel kunjungan tenant secara idempoten (mis. dari dwell geofence atau QR scan)
   * dan mengevaluasi pembukaan badge trail baru.
   */
  async recordStamp(userId: string, poiId: string) {
    const poi = await this.store.findPoiById(poiId);
    if (!poi) {
      throw new ApiError('NOT_FOUND', [{ field: 'poiId', rule: 'notFound' }]);
    }

    const beforePassport = await this.getPassport(userId);
    const beforeBadges = new Set(beforePassport.unlockedBadgeIds);

    const { isNewStamp } = await this.store.upsertStamp(userId, poiId, this.now());

    const passport = await this.getPassport(userId);
    const newlyUnlockedBadges = passport.badges.filter((b) => !beforeBadges.has(b.id));

    return {
      stamp: passport.stamps[poiId],
      isNewStamp,
      newlyUnlockedBadges,
      passport,
    };
  }

  /**
   * Mengambil state Paspor Kuliner lengkap milik pengguna:
   * - `stamps`: peta stempel per POI (idempoten dengan `visitCount`, `firstStampedAt`, `lastStampedAt`)
   * - `unlockedBadgeIds` & `badges`: daftar lencana trail yang sudah terbuka
   * - `trails`: progres penyelesaian tiap trail tematik (0–100%)
   * - `reviews`: riwayat ulasan pengguna
   * - `stats`: statistik capaian gamifikasi pengguna
   */
  async getPassport(userId: string): Promise<PassportSummaryDto> {
    const [allPoiIds, trails, stampRecords, userReviewRows] = await Promise.all([
      this.store.listAllPoiIds(),
      this.store.listTrails(),
      this.store.listStampsByUser(userId),
      this.store.listReviewsByUser(userId),
    ]);

    const stamps = buildStampMap(stampRecords, userReviewRows);
    const nowIso = this.now().toISOString();
    const { trails: trailProgressList, unlockedBadgeIds, badges } = evaluateBadges(
      trails,
      stamps,
      nowIso,
    );

    const reviews = userReviewRows.map(toPublicReview);
    const uniqueTriedMenus = new Set<string>();
    for (const r of userReviewRows) {
      for (const menuId of r.menuItemIds) {
        uniqueTriedMenus.add(menuId);
      }
    }

    const totalPois = allPoiIds.length;
    const stampedPoisCount = Object.keys(stamps).length;
    const completionPercentage =
      totalPois > 0 ? Math.round((stampedPoisCount / totalPois) * 100) : 0;

    return {
      stamps,
      unlockedBadgeIds,
      badges,
      trails: trailProgressList,
      reviews,
      stats: {
        totalPois,
        stampedPoisCount,
        completionPercentage,
        totalReviews: reviews.length,
        totalMenuItemsTried: uniqueTriedMenus.size,
        unlockedBadgesCount: unlockedBadgeIds.length,
        totalBadges: trails.length,
      },
    };
  }
}
