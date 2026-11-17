// Client API & Repository Paspor Kuliner & Ulasan Tenant (F10).
// Menghubungkan Frontend ke endpoint Backend (/v1/reviews, /v1/pois/:poiId/reviews, /v1/passport)
// dengan fallback offline otomatis ke penyimpanan lokal (AsyncStorage).

import { getPoiById, getPois } from '@/features/poi';
import { fail, ok, type ErrorCode, type Result } from '@/lib/result';
import { load, save } from '@/storage';
import { loadSecure, SECURE_KEYS } from '@/storage/secure';
import type { Trail } from '@/types/content';
import {
  calculateTrailProgress,
  computePoiReviewStats,
  evaluateBadges,
  INITIAL_PASSPORT_STATE,
  recordReview,
  recordStamp,
  validateReviewMenuItems,
  type CreatePoiReviewInput,
  type PassportState,
  type PoiReview,
  type PoiReviewStats,
  type StampRecord,
  type TrailProgress,
  type UnlockedBadge,
  type UpdatePoiReviewInput,
} from './index';

const PASSPORT_STORAGE_KEY = 'passport.v1';

const DEFAULT_API_BASE_URL =
  process.env.EXPO_PUBLIC_API_URL?.replace(/\/+$/, '') ?? 'http://localhost:3000/v1';

export type PassportSummaryResponse = {
  stamps: Record<string, StampRecord>;
  unlockedBadgeIds: string[];
  badges: UnlockedBadge[];
  trails: TrailProgress[];
  reviews: PoiReview[];
  stats: {
    totalPois: number;
    stampedPoisCount: number;
    completionPercentage: number;
    totalReviews: number;
    totalMenuItemsTried: number;
    unlockedBadgesCount: number;
    totalBadges: number;
  };
};

export type SubmitReviewResult = {
  review: PoiReview;
  stamp: StampRecord;
  isNewStamp: boolean;
  newlyUnlockedBadges: UnlockedBadge[];
  passport: PassportState;
};

export type PoiReviewsResult = {
  poiId: string;
  poiName: string;
  stats: PoiReviewStats;
  reviews: PoiReview[];
};

function mapHttpErrorCode(code?: string): ErrorCode {
  switch (code) {
    case 'VALIDATION_ERROR':
      return 'VALIDATION_ERROR';
    case 'NOT_FOUND':
      return 'NOT_FOUND';
    case 'FORBIDDEN':
      return 'PERMISSION_DENIED';
    case 'RATE_LIMITED':
      return 'RATE_LIMITED';
    case 'TOKEN_EXPIRED':
    case 'TOKEN_INVALID':
    case 'REFRESH_REUSE_DETECTED':
      return 'SESSION_EXPIRED';
    default:
      return 'NETWORK_ERROR';
  }
}

async function getAuthHeaders(): Promise<Record<string, string>> {
  const token = await loadSecure(SECURE_KEYS.ACCESS_TOKEN);
  return {
    'Content-Type': 'application/json',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  };
}

function loadBundledTrails(): Trail[] {
  try {
    // eslint-disable-next-line @typescript-eslint/no-require-imports
    return require('@/data/trails.json') as Trail[];
  } catch {
    return [];
  }
}

export const PassportReviewApi = {
  /**
   * Memuat state Paspor Kuliner lokal dari AsyncStorage.
   */
  async loadLocalPassport(): Promise<PassportState> {
    const saved = await load<PassportState>(PASSPORT_STORAGE_KEY, INITIAL_PASSPORT_STATE);
    return {
      stamps: saved.stamps ?? {},
      unlockedBadgeIds: saved.unlockedBadgeIds ?? [],
      reviews: saved.reviews ?? [],
    };
  },

  /**
   * Menyimpan state Paspor Kuliner ke AsyncStorage.
   */
  async saveLocalPassport(state: PassportState): Promise<void> {
    await save(PASSPORT_STORAGE_KEY, state);
  },

  /**
   * Mengambil data lengkap Paspor Kuliner dari Backend (`GET /v1/passport`),
   * atau menghitungnya secara lokal jika sedang offline / mode tamu.
   */
  async getPassport(apiBaseUrl: string = DEFAULT_API_BASE_URL): Promise<Result<PassportSummaryResponse>> {
    try {
      const headers = await getAuthHeaders();
      if (headers.Authorization && !headers.Authorization.endsWith('_local')) {
        const res = await fetch(`${apiBaseUrl}/passport`, { method: 'GET', headers });
        if (res.ok) {
          const data = (await res.json()) as PassportSummaryResponse;
          await this.saveLocalPassport({
            stamps: data.stamps,
            unlockedBadgeIds: data.unlockedBadgeIds,
            reviews: data.reviews,
          });
          return ok(data);
        }
      }
    } catch {
      // Fallback ke data lokal bila jaringan tidak tersedia
    }

    const local = await this.loadLocalPassport();
    const trails = loadBundledTrails();
    const pois = getPois();
    const { updatedState } = evaluateBadges(trails, local);
    const stampedPoiIds = Object.keys(updatedState.stamps);
    const trailProgress = trails.map((t) => calculateTrailProgress(t, stampedPoiIds));
    const reviews = updatedState.reviews ?? [];
    const triedMenus = new Set(reviews.flatMap((r) => r.menuItemIds));

    return ok({
      stamps: updatedState.stamps,
      unlockedBadgeIds: updatedState.unlockedBadgeIds,
      badges: trails
        .filter((t) => updatedState.unlockedBadgeIds.includes(t.id))
        .map((t) => ({
          id: t.id,
          name: t.badgeName,
          icon: t.badgeIcon,
          trailId: t.id,
          unlockedAt: new Date().toISOString(),
        })),
      trails: trailProgress,
      reviews,
      stats: {
        totalPois: pois.length,
        stampedPoisCount: stampedPoiIds.length,
        completionPercentage:
          pois.length > 0 ? Math.round((stampedPoiIds.length / pois.length) * 100) : 0,
        totalReviews: reviews.length,
        totalMenuItemsTried: triedMenus.size,
        unlockedBadgesCount: updatedState.unlockedBadgeIds.length,
        totalBadges: trails.length,
      },
    });
  },

  /**
   * Mengambil seluruh ulasan & statistik rating untuk satu POI (`GET /v1/pois/:poiId/reviews`),
   * dengan fallback ke ulasan lokal jika offline.
   */
  async getPoiReviews(
    poiId: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL,
  ): Promise<Result<PoiReviewsResult>> {
    const poi = getPoiById(poiId);
    if (!poi) {
      return fail('NOT_FOUND', `Tenant ${poiId} tidak ditemukan.`);
    }

    try {
      const res = await fetch(`${apiBaseUrl}/pois/${encodeURIComponent(poiId)}/reviews`, {
        method: 'GET',
        headers: { 'Content-Type': 'application/json' },
      });
      if (res.ok) {
        const data = (await res.json()) as PoiReviewsResult;
        return ok(data);
      }
      if (res.status === 404) {
        return fail('NOT_FOUND', `Tenant ${poiId} tidak ditemukan.`);
      }
    } catch {
      // Fallback ke ulasan yang tersimpan di perangkat
    }

    const local = await this.loadLocalPassport();
    const poiReviews = (local.reviews ?? []).filter((r) => r.poiId === poiId);
    const stats = computePoiReviewStats(poiReviews, poi.menu);

    return ok({
      poiId: poi.id,
      poiName: poi.name,
      stats,
      reviews: poiReviews,
    });
  },

  /**
   * Mengirim ulasan baru beserta daftar menu yang dimakan (`POST /v1/reviews`),
   * otomatis mencatat stempel paspor & mengevaluasi lencana baru.
   */
  async submitReview(
    input: CreatePoiReviewInput,
    apiBaseUrl: string = DEFAULT_API_BASE_URL,
  ): Promise<Result<SubmitReviewResult>> {
    const poi = getPoiById(input.poiId);
    if (!poi) {
      return fail('NOT_FOUND', `Tenant ${input.poiId} tidak ditemukan.`);
    }

    if (input.rating < 1 || input.rating > 5 || !Number.isInteger(input.rating)) {
      return fail('VALIDATION_ERROR', 'Rating harus berupa angka bulat antara 1 sampai 5.');
    }

    if (input.reviewText && input.reviewText.trim().length > 1000) {
      return fail('VALIDATION_ERROR', 'Teks ulasan maksimal 1000 karakter.');
    }

    if (input.menuItemIds && input.menuItemIds.length > 0) {
      const menuCheck = validateReviewMenuItems(poi, input.menuItemIds);
      if (!menuCheck.valid) {
        return fail(
          'VALIDATION_ERROR',
          `Menu [${menuCheck.invalidMenuItemIds.join(', ')}] bukan milik tenant ${poi.name}.`,
        );
      }
    }

    try {
      const headers = await getAuthHeaders();
      if (headers.Authorization && !headers.Authorization.endsWith('_local')) {
        const res = await fetch(`${apiBaseUrl}/reviews`, {
          method: 'POST',
          headers,
          body: JSON.stringify({
            poiId: input.poiId,
            rating: input.rating,
            reviewText: input.reviewText ?? null,
            photoPath: input.photoPath ?? null,
            menuItemIds: input.menuItemIds ?? [],
          }),
        });

        if (res.ok) {
          const data = (await res.json()) as {
            review: PoiReview;
            stamp: StampRecord;
            isNewStamp: boolean;
            newlyUnlockedBadges: UnlockedBadge[];
            passport: PassportSummaryResponse;
          };
          const syncedState: PassportState = {
            stamps: data.passport.stamps,
            unlockedBadgeIds: data.passport.unlockedBadgeIds,
            reviews: data.passport.reviews,
          };
          await this.saveLocalPassport(syncedState);
          return ok({
            review: data.review,
            stamp: data.stamp,
            isNewStamp: data.isNewStamp,
            newlyUnlockedBadges: data.newlyUnlockedBadges,
            passport: syncedState,
          });
        }

        const errBody = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        return fail(
          mapHttpErrorCode(errBody?.error?.code),
          errBody?.error?.message ?? 'Gagal menyimpan ulasan ke server.',
        );
      }
    } catch {
      // Lanjutkan ke penyimpanan offline bila jaringan terputus
    }

    const current = await this.loadLocalPassport();
    const isNewStamp = !(input.poiId in current.stamps);
    const { updatedState: afterReview, review } = recordReview(current, input);
    const trails = loadBundledTrails();
    const { updatedState: afterBadges, newlyUnlockedBadges } = evaluateBadges(trails, afterReview);

    await this.saveLocalPassport(afterBadges);

    return ok({
      review,
      stamp: afterBadges.stamps[input.poiId],
      isNewStamp,
      newlyUnlockedBadges,
      passport: afterBadges,
    });
  },

  /**
   * Memperbarui ulasan milik pengguna (`PATCH /v1/reviews/:reviewId`).
   */
  async updateReview(
    reviewId: string,
    patch: UpdatePoiReviewInput,
    apiBaseUrl: string = DEFAULT_API_BASE_URL,
  ): Promise<Result<PoiReview>> {
    try {
      const headers = await getAuthHeaders();
      if (headers.Authorization && !headers.Authorization.endsWith('_local')) {
        const res = await fetch(`${apiBaseUrl}/reviews/${encodeURIComponent(reviewId)}`, {
          method: 'PATCH',
          headers,
          body: JSON.stringify(patch),
        });
        if (res.ok) {
          const data = (await res.json()) as { review: PoiReview };
          return ok(data.review);
        }
        const errBody = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        return fail(
          mapHttpErrorCode(errBody?.error?.code),
          errBody?.error?.message ?? 'Gagal memperbarui ulasan.',
        );
      }
    } catch {
      // Fallback ke update di penyimpanan lokal
    }

    const current = await this.loadLocalPassport();
    const reviews = current.reviews ?? [];
    const idx = reviews.findIndex((r) => r.id === reviewId);
    if (idx === -1) {
      return fail('NOT_FOUND', 'Ulasan tidak ditemukan.');
    }

    const existing = reviews[idx];
    if (patch.menuItemIds) {
      const poi = getPoiById(existing.poiId);
      if (poi) {
        const check = validateReviewMenuItems(poi, patch.menuItemIds);
        if (!check.valid) {
          return fail(
            'VALIDATION_ERROR',
            `Menu [${check.invalidMenuItemIds.join(', ')}] bukan milik tenant ${poi.name}.`,
          );
        }
      }
    }

    const updated: PoiReview = {
      ...existing,
      ...(patch.rating !== undefined ? { rating: patch.rating } : {}),
      ...(patch.reviewText !== undefined
        ? { reviewText: patch.reviewText?.trim() ? patch.reviewText.trim() : null }
        : {}),
      ...(patch.photoPath !== undefined
        ? { photoPath: patch.photoPath?.trim() ? patch.photoPath.trim() : null }
        : {}),
      ...(patch.menuItemIds !== undefined
        ? { menuItemIds: Array.from(new Set(patch.menuItemIds)) }
        : {}),
      updatedAt: new Date().toISOString(),
    };

    const nextReviews = [...reviews];
    nextReviews[idx] = updated;
    await this.saveLocalPassport({ ...current, reviews: nextReviews });

    return ok(updated);
  },

  /**
   * Menghapus ulasan milik pengguna (`DELETE /v1/reviews/:reviewId`).
   */
  async deleteReview(
    reviewId: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL,
  ): Promise<Result<void>> {
    try {
      const headers = await getAuthHeaders();
      if (headers.Authorization && !headers.Authorization.endsWith('_local')) {
        const res = await fetch(`${apiBaseUrl}/reviews/${encodeURIComponent(reviewId)}`, {
          method: 'DELETE',
          headers,
        });
        if (res.ok || res.status === 204) {
          const current = await this.loadLocalPassport();
          await this.saveLocalPassport({
            ...current,
            reviews: (current.reviews ?? []).filter((r) => r.id !== reviewId),
          });
          return ok(undefined);
        }
        const errBody = (await res.json().catch(() => null)) as {
          error?: { code?: string; message?: string };
        } | null;
        return fail(
          mapHttpErrorCode(errBody?.error?.code),
          errBody?.error?.message ?? 'Gagal menghapus ulasan.',
        );
      }
    } catch {
      // Fallback ke hapus lokal
    }

    const current = await this.loadLocalPassport();
    const reviews = current.reviews ?? [];
    if (!reviews.some((r) => r.id === reviewId)) {
      return fail('NOT_FOUND', 'Ulasan tidak ditemukan.');
    }

    await this.saveLocalPassport({
      ...current,
      reviews: reviews.filter((r) => r.id !== reviewId),
    });
    return ok(undefined);
  },

  /**
   * Mencatat stempel kunjungan tenant secara idempoten (`POST /v1/passport/stamps`).
   */
  async stampPoi(
    poiId: string,
    apiBaseUrl: string = DEFAULT_API_BASE_URL,
  ): Promise<
    Result<{
      stamp: StampRecord;
      isNewStamp: boolean;
      newlyUnlockedBadges: UnlockedBadge[];
      passport: PassportState;
    }>
  > {
    const poi = getPoiById(poiId);
    if (!poi) {
      return fail('NOT_FOUND', `Tenant ${poiId} tidak ditemukan.`);
    }

    try {
      const headers = await getAuthHeaders();
      if (headers.Authorization && !headers.Authorization.endsWith('_local')) {
        const res = await fetch(`${apiBaseUrl}/passport/stamps`, {
          method: 'POST',
          headers,
          body: JSON.stringify({ poiId }),
        });
        if (res.ok) {
          const data = (await res.json()) as {
            stamp: StampRecord;
            isNewStamp: boolean;
            newlyUnlockedBadges: UnlockedBadge[];
            passport: PassportSummaryResponse;
          };
          const syncedState: PassportState = {
            stamps: data.passport.stamps,
            unlockedBadgeIds: data.passport.unlockedBadgeIds,
            reviews: data.passport.reviews,
          };
          await this.saveLocalPassport(syncedState);
          return ok({
            stamp: data.stamp,
            isNewStamp: data.isNewStamp,
            newlyUnlockedBadges: data.newlyUnlockedBadges,
            passport: syncedState,
          });
        }
      }
    } catch {
      // Fallback ke penyimpanan lokal
    }

    const current = await this.loadLocalPassport();
    const isNewStamp = !(poiId in current.stamps);
    const afterStamp = recordStamp(current, poiId);
    const trails = loadBundledTrails();
    const { updatedState: afterBadges, newlyUnlockedBadges } = evaluateBadges(trails, afterStamp);

    await this.saveLocalPassport(afterBadges);

    return ok({
      stamp: afterBadges.stamps[poiId],
      isNewStamp,
      newlyUnlockedBadges,
      passport: afterBadges,
    });
  },
};
