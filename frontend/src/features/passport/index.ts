// F10 / PB-16 – Paspor Kuliner & Gamifikasi: stempel digital, progres trail, dan badge penghargaan.
import type { Trail } from '@/types/content';

export type StampRecord = {
  poiId: string;
  firstStampedAt: string;
  lastStampedAt: string;
  visitCount: number;
};

/**
 * Data ulasan (review) tenant pada Paspor Kuliner & Gamifikasi.
 * Selaras dengan tabel `public.reviews` dan `public.review_menu_items` di Supabase/Prisma.
 */
export type PoiReview = {
  id: string;
  userId?: string;
  poiId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText: string | null;
  /** Path atau URI gambar dokumentasi yang diunggah pengguna (opsional). */
  photoPath: string | null;
  /** Daftar ID menu dari tenant tersebut yang dimakan oleh pengguna (mis. ['P01-M01', 'P01-M02']). */
  menuItemIds: string[];
  createdAt: string;
  updatedAt: string;
};

export type PassportState = {
  stamps: Record<string, StampRecord>;
  unlockedBadgeIds: string[];
  reviews?: PoiReview[];
};

export type TrailProgress = {
  trailId: string;
  trailName: string;
  totalPois: number;
  visitedCount: number;
  percentage: number;
  isCompleted: boolean;
};

export type UnlockedBadge = {
  id: string;
  name: string;
  icon: string | null;
  trailId: string;
  unlockedAt: string;
};

export const INITIAL_PASSPORT_STATE: PassportState = {
  stamps: {},
  unlockedBadgeIds: [],
};

/**
 * Mencatat stempel POI ke paspor kuliner.
 * Bersifat IDEMPOTEN: kunjungan berulang tidak membuat duplikat ID, melainkan menaikkan visitCount.
 */
export function recordStamp(
  state: PassportState,
  poiId: string,
  timestampMs: number = Date.now(),
): PassportState {
  const iso = new Date(timestampMs).toISOString();
  const existing = state.stamps[poiId];

  const updatedStamp: StampRecord = existing
    ? {
        ...existing,
        lastStampedAt: iso,
        visitCount: existing.visitCount + 1,
      }
    : {
        poiId,
        firstStampedAt: iso,
        lastStampedAt: iso,
        visitCount: 1,
      };

  return {
    ...state,
    stamps: {
      ...state.stamps,
      [poiId]: updatedStamp,
    },
  };
}

/**
 * Menghitung progres penyelesaian trail tematik berdasarkan POI yang sudah distempel.
 */
export function calculateTrailProgress(
  trail: Trail,
  stampedPoiIds: Set<string> | string[],
): TrailProgress {
  const stampedSet = stampedPoiIds instanceof Set ? stampedPoiIds : new Set(stampedPoiIds);
  const totalPois = trail.poiIds.length;

  if (totalPois === 0) {
    return {
      trailId: trail.id,
      trailName: trail.name,
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
    totalPois,
    visitedCount,
    percentage,
    isCompleted,
  };
}

/**
 * Memeriksa dan memberikan badge penghargaan jika seluruh tenant pada suatu trail telah selesai dikunjungi.
 */
export function evaluateBadges(
  trails: Trail[],
  passportState: PassportState,
  timestampMs: number = Date.now(),
): { updatedState: PassportState; newlyUnlockedBadges: UnlockedBadge[] } {
  const stampedPoiIds = new Set(Object.keys(passportState.stamps));
  const currentUnlocked = new Set(passportState.unlockedBadgeIds);
  const newlyUnlockedBadges: UnlockedBadge[] = [];

  for (const trail of trails) {
    const progress = calculateTrailProgress(trail, stampedPoiIds);
    if (progress.isCompleted && !currentUnlocked.has(trail.id)) {
      currentUnlocked.add(trail.id);
      newlyUnlockedBadges.push({
        id: trail.id,
        name: trail.badgeName,
        icon: trail.badgeIcon,
        trailId: trail.id,
        unlockedAt: new Date(timestampMs).toISOString(),
      });
    }
  }

  return {
    updatedState: {
      ...passportState,
      unlockedBadgeIds: [...currentUnlocked],
    },
    newlyUnlockedBadges,
  };
}

export type CreatePoiReviewInput = {
  id?: string;
  userId?: string;
  poiId: string;
  rating: 1 | 2 | 3 | 4 | 5;
  reviewText?: string | null;
  photoPath?: string | null;
  menuItemIds?: string[];
};

/**
 * Mencatat ulasan (review) beserta daftar menu yang dimakan dari suatu tenant,
 * sekaligus otomatis mencatat/memperbarui stempel kunjungan di Paspor Kuliner.
 */
export function recordReview(
  state: PassportState,
  input: CreatePoiReviewInput,
  timestampMs: number = Date.now(),
): { updatedState: PassportState; review: PoiReview } {
  const iso = new Date(timestampMs).toISOString();
  const stampedState = recordStamp(state, input.poiId, timestampMs);

  const review: PoiReview = {
    id: input.id ?? `rev-${input.poiId}-${timestampMs}`,
    userId: input.userId,
    poiId: input.poiId,
    rating: input.rating,
    reviewText: input.reviewText?.trim() ? input.reviewText.trim() : null,
    photoPath: input.photoPath ?? null,
    menuItemIds: input.menuItemIds ? Array.from(new Set(input.menuItemIds)) : [],
    createdAt: iso,
    updatedAt: iso,
  };

  const existingReviews = stampedState.reviews ?? [];

  return {
    updatedState: {
      ...stampedState,
      reviews: [review, ...existingReviews],
    },
    review,
  };
}
