// F10 / PB-16 – Paspor Kuliner & Gamifikasi: stempel digital, progres trail, dan badge penghargaan.
import type { Trail } from '@/types/content';

export type StampRecord = {
  poiId: string;
  firstStampedAt: string;
  lastStampedAt: string;
  visitCount: number;
};

export type PassportState = {
  stamps: Record<string, StampRecord>;
  unlockedBadgeIds: string[];
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
