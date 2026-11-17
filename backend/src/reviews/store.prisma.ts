// Implementasi ReviewStore menggunakan Prisma Client (PostgreSQL / Supabase).

import { Prisma, type PrismaClient } from '@prisma/client';
import {
  PoiMenuMismatchError,
  type NewReviewInput,
  type PassportStampRecord,
  type PoiCatalogRecord,
  type ReviewRecord,
  type ReviewStore,
  type TrailRecord,
  type UpdateReviewInput,
} from './store';

const reviewInclude = {
  user: { select: { displayName: true } },
  menuItems: { select: { menuItemId: true }, orderBy: { menuItemId: 'asc' } },
} as const;

type ReviewRow = Prisma.ReviewGetPayload<{ include: typeof reviewInclude }>;

const toReviewRecord = (r: ReviewRow): ReviewRecord => ({
  id: r.id,
  userId: r.userId,
  userDisplayName: r.user?.displayName ?? 'Kuliner Explorer',
  poiId: r.poiId,
  rating: r.rating,
  reviewText: r.reviewText,
  photoPath: r.photoPath,
  menuItemIds: r.menuItems.map((m) => m.menuItemId),
  createdAt: r.createdAt,
  updatedAt: r.updatedAt,
});

export class PrismaReviewStore implements ReviewStore {
  constructor(private readonly db: PrismaClient) {}

  async findPoiById(poiId: string): Promise<PoiCatalogRecord | null> {
    const poi = await this.db.poi.findUnique({
      where: { id: poiId },
      select: {
        id: true,
        name: true,
        categoryLabel: true,
        zone: true,
        menuItems: {
          select: { id: true, poiId: true, name: true, priceIdr: true, isSignature: true },
          orderBy: { position: 'asc' },
        },
      },
    });
    return poi;
  }

  async listAllPoiIds(): Promise<string[]> {
    const rows = await this.db.poi.findMany({
      select: { id: true },
      orderBy: { id: 'asc' },
    });
    return rows.map((r) => r.id);
  }

  async listTrails(): Promise<TrailRecord[]> {
    const rows = await this.db.trail.findMany({
      include: {
        trailPois: {
          select: { poiId: true, position: true },
          orderBy: { position: 'asc' },
        },
      },
      orderBy: { id: 'asc' },
    });
    return rows.map((t) => ({
      id: t.id,
      name: t.name,
      description: t.description,
      badgeName: t.badgeName,
      badgeIcon: t.badgeIcon,
      poiIds: t.trailPois.map((tp) => tp.poiId),
    }));
  }

  async createReview(input: NewReviewInput): Promise<{
    review: ReviewRecord;
    stamp: PassportStampRecord;
    isNewStamp: boolean;
  }> {
    const uniqueMenuIds = Array.from(new Set(input.menuItemIds));

    return this.db.$transaction(async (tx) => {
      if (uniqueMenuIds.length > 0) {
        const validMenus = await tx.menuItem.findMany({
          where: { poiId: input.poiId, id: { in: uniqueMenuIds } },
          select: { id: true },
        });
        const validSet = new Set(validMenus.map((m) => m.id));
        const invalid = uniqueMenuIds.filter((id) => !validSet.has(id));
        if (invalid.length > 0) {
          throw new PoiMenuMismatchError(input.poiId, invalid);
        }
      }

      const existingStamp = await tx.passportStamp.findUnique({
        where: { userId_poiId: { userId: input.userId, poiId: input.poiId } },
      });

      const created = await tx.review.create({
        data: {
          userId: input.userId,
          poiId: input.poiId,
          rating: input.rating,
          reviewText: input.reviewText,
          photoPath: input.photoPath,
          createdAt: input.now,
          updatedAt: input.now,
          menuItems:
            uniqueMenuIds.length > 0
              ? { create: uniqueMenuIds.map((menuItemId) => ({ menuItemId })) }
              : undefined,
        },
        include: reviewInclude,
      });

      // Trigger SQL sync_passport_stamp_on_review otomatis menambah passport_stamps,
      // namun upsert eksplisit menjamin konsistensi apabila trigger belum dipasang.
      const stampRow = await tx.passportStamp.upsert({
        where: { userId_poiId: { userId: input.userId, poiId: input.poiId } },
        create: { userId: input.userId, poiId: input.poiId, stampedAt: input.now },
        update: {},
      });

      const userPoiReviewCount = await tx.review.count({
        where: { userId: input.userId, poiId: input.poiId },
      });

      const stamp: PassportStampRecord = {
        userId: stampRow.userId,
        poiId: stampRow.poiId,
        stampedAt: stampRow.stampedAt,
        lastStampedAt: input.now > stampRow.stampedAt ? input.now : stampRow.stampedAt,
        visitCount: Math.max(userPoiReviewCount, 1),
      };

      return {
        review: toReviewRecord(created),
        stamp,
        isNewStamp: !existingStamp,
      };
    });
  }

  async findReviewById(reviewId: string): Promise<ReviewRecord | null> {
    const row = await this.db.review.findUnique({
      where: { id: reviewId },
      include: reviewInclude,
    });
    return row ? toReviewRecord(row) : null;
  }

  async listReviewsByPoi(poiId: string): Promise<ReviewRecord[]> {
    const rows = await this.db.review.findMany({
      where: { poiId },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toReviewRecord);
  }

  async listReviewsByUser(userId: string): Promise<ReviewRecord[]> {
    const rows = await this.db.review.findMany({
      where: { userId },
      include: reviewInclude,
      orderBy: { createdAt: 'desc' },
    });
    return rows.map(toReviewRecord);
  }

  async updateReview(reviewId: string, input: UpdateReviewInput): Promise<ReviewRecord | null> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.review.findUnique({
        where: { id: reviewId },
        select: { id: true, poiId: true },
      });
      if (!existing) return null;

      if (input.menuItemIds !== undefined) {
        const uniqueMenuIds = Array.from(new Set(input.menuItemIds));
        if (uniqueMenuIds.length > 0) {
          const validMenus = await tx.menuItem.findMany({
            where: { poiId: existing.poiId, id: { in: uniqueMenuIds } },
            select: { id: true },
          });
          const validSet = new Set(validMenus.map((m) => m.id));
          const invalid = uniqueMenuIds.filter((id) => !validSet.has(id));
          if (invalid.length > 0) {
            throw new PoiMenuMismatchError(existing.poiId, invalid);
          }
        }

        await tx.reviewMenuItem.deleteMany({ where: { reviewId } });
        if (uniqueMenuIds.length > 0) {
          await tx.reviewMenuItem.createMany({
            data: uniqueMenuIds.map((menuItemId) => ({ reviewId, menuItemId })),
          });
        }
      }

      const updated = await tx.review.update({
        where: { id: reviewId },
        data: {
          ...(input.rating !== undefined ? { rating: input.rating } : {}),
          ...(input.reviewText !== undefined ? { reviewText: input.reviewText } : {}),
          ...(input.photoPath !== undefined ? { photoPath: input.photoPath } : {}),
          updatedAt: input.now,
        },
        include: reviewInclude,
      });

      return toReviewRecord(updated);
    });
  }

  async deleteReview(reviewId: string): Promise<boolean> {
    const { count } = await this.db.review.deleteMany({ where: { id: reviewId } });
    return count > 0;
  }

  async upsertStamp(
    userId: string,
    poiId: string,
    now: Date,
  ): Promise<{ stamp: PassportStampRecord; isNewStamp: boolean }> {
    return this.db.$transaction(async (tx) => {
      const existing = await tx.passportStamp.findUnique({
        where: { userId_poiId: { userId, poiId } },
      });

      const stampRow = existing
        ? existing
        : await tx.passportStamp.create({
            data: { userId, poiId, stampedAt: now },
          });

      const reviewCount = await tx.review.count({ where: { userId, poiId } });
      const baseVisits = existing ? Math.max(reviewCount, 2) : Math.max(reviewCount, 1);

      return {
        stamp: {
          userId: stampRow.userId,
          poiId: stampRow.poiId,
          stampedAt: stampRow.stampedAt,
          lastStampedAt: existing ? (now > stampRow.stampedAt ? now : stampRow.stampedAt) : stampRow.stampedAt,
          visitCount: baseVisits,
        },
        isNewStamp: !existing,
      };
    });
  }

  async listStampsByUser(userId: string): Promise<PassportStampRecord[]> {
    const [stampRows, reviewAggs] = await Promise.all([
      this.db.passportStamp.findMany({
        where: { userId },
        orderBy: { stampedAt: 'asc' },
      }),
      this.db.review.groupBy({
        by: ['poiId'],
        where: { userId },
        _count: { _all: true },
        _max: { createdAt: true },
      }),
    ]);

    const aggMap = new Map(
      reviewAggs.map((a) => [a.poiId, { count: a._count._all, lastReviewAt: a._max.createdAt }]),
    );

    return stampRows.map((s) => {
      const agg = aggMap.get(s.poiId);
      const lastAt =
        agg?.lastReviewAt && agg.lastReviewAt > s.stampedAt ? agg.lastReviewAt : s.stampedAt;
      return {
        userId: s.userId,
        poiId: s.poiId,
        stampedAt: s.stampedAt,
        lastStampedAt: lastAt,
        visitCount: Math.max(agg?.count ?? 0, 1),
      };
    });
  }
}
