// ReviewStore di memori untuk unit test & pengembangan lokal tanpa database.
// Perilaku validasi menu per-tenant & integrasi otomatis passport_stamps mengikuti
// trigger SQL di migrations/20261117000000_gamification_reviews.sql.

import { randomUUID } from 'node:crypto';
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

export const DEFAULT_SEED_POIS: PoiCatalogRecord[] = [
  {
    id: 'P01',
    name: 'Traditional Fried Food from West Borneo',
    categoryLabel: 'Gorengan / Manis-Gurih',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P01-M01', poiId: 'P01', name: 'Pisang Goreng Kipas Khas Pontianak', priceIdr: 5000, isSignature: true },
      { id: 'P01-M02', poiId: 'P01', name: 'Pisang Tanduk Madu', priceIdr: 5000, isSignature: false },
      { id: 'P01-M03', poiId: 'P01', name: 'Gandasturi / Gandas Kacang Hijau', priceIdr: 5000, isSignature: false },
      { id: 'P01-M04', poiId: 'P01', name: 'Tape Goreng Madu', priceIdr: 5000, isSignature: false },
      { id: 'P01-M05', poiId: 'P01', name: 'Bakwan Pontianak', priceIdr: 7000, isSignature: true },
    ],
  },
  {
    id: 'P03',
    name: 'Swike Asli JTW',
    categoryLabel: 'Swike / Gurih',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P03-M01', poiId: 'P03', name: 'Swike Kuah Tauco', priceIdr: 40000, isSignature: true },
      { id: 'P03-M02', poiId: 'P03', name: 'Swike Goreng Tepung', priceIdr: 45000, isSignature: true },
    ],
  },
  {
    id: 'P04',
    name: 'Bebek Gober Bumbu Hitam',
    categoryLabel: 'Bebek / Gurih-Pedas',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P04-M01', poiId: 'P04', name: 'Paket Nasi Bebek Bumbu Hitam', priceIdr: 35000, isSignature: true },
      { id: 'P04-M02', poiId: 'P04', name: 'Paket Nasi Ayam Bumbu Hitam', priceIdr: 28000, isSignature: false },
    ],
  },
  {
    id: 'P05',
    name: 'Pigbull',
    categoryLabel: 'Nasi Campur / Gurih-Manis',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P05-M01', poiId: 'P05', name: 'Nasi Campur Pigbull Spesial', priceIdr: 55000, isSignature: true },
      { id: 'P05-M02', poiId: 'P05', name: 'Samcan Crispy Porsi', priceIdr: 45000, isSignature: false },
    ],
  },
  {
    id: 'P13',
    name: 'Pandu Baso Goreng Tenggiri',
    categoryLabel: 'Bakso Goreng / Gurih',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P13-M01', poiId: 'P13', name: 'Baso Goreng Tenggiri', priceIdr: 10000, isSignature: true },
    ],
  },
  {
    id: 'P16',
    name: 'Hau’s Tea',
    categoryLabel: 'Cakue & Bakso / Gurih',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P16-M01', poiId: 'P16', name: 'Cakue Isi Udang Ayam', priceIdr: 25000, isSignature: true },
      { id: 'P16-M02', poiId: 'P16', name: 'Mie Kocok Spesial', priceIdr: 35000, isSignature: false },
    ],
  },
  {
    id: 'P17',
    name: 'Kuo Tie Kelenteng',
    categoryLabel: 'Kuo Tie / Gurih',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P17-M01', poiId: 'P17', name: 'Kuo Tie Panggang (10 pcs)', priceIdr: 50000, isSignature: true },
      { id: 'P17-M02', poiId: 'P17', name: 'Kuo Tie Goreng (10 pcs)', priceIdr: 50000, isSignature: false },
    ],
  },
  {
    id: 'P19',
    name: 'Jazz Coffee',
    categoryLabel: 'Kopi / Aromatik-Manis',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P19-M01', poiId: 'P19', name: 'Es Kopi Susu Jazz', priceIdr: 22000, isSignature: true },
      { id: 'P19-M02', poiId: 'P19', name: 'Matcha Latte', priceIdr: 25000, isSignature: false },
    ],
  },
  {
    id: 'P22',
    name: 'Susu Mbok Darmi',
    categoryLabel: 'Susu / Manis',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P22-M01', poiId: 'P22', name: 'Susu Murni Cokelat (Monster)', priceIdr: 18000, isSignature: true },
      { id: 'P22-M02', poiId: 'P22', name: 'Susu Murni Stroberi (Tiny)', priceIdr: 13000, isSignature: false },
    ],
  },
  {
    id: 'P27',
    name: 'Rainbow Juice',
    categoryLabel: 'Jus / Segar-Manis',
    zone: 'Sudirman Street Food',
    menuItems: [
      { id: 'P27-M01', poiId: 'P27', name: 'Jus Alpukat Mentega', priceIdr: 18000, isSignature: true },
      { id: 'P27-M02', poiId: 'P27', name: 'Sop Buah Segar', priceIdr: 20000, isSignature: true },
    ],
  },
];

export const DEFAULT_SEED_TRAILS: TrailRecord[] = [
  {
    id: 'jejak-jajanan-sudirman',
    name: 'Jejak Jajanan Sudirman',
    description: 'Eksplorasi aneka jajanan dan gorengan khas di Sudirman Street Food.',
    badgeName: 'Penjelajah Jajanan Sudirman',
    badgeIcon: 'badge_jajanan.png',
    poiIds: ['P01', 'P13', 'P17'],
  },
  {
    id: 'manis-manis-sudirman',
    name: 'Manis-manis Sudirman',
    description: 'Rute khusus penikmat minuman manis dan pelepas dahaga.',
    badgeName: 'Pemburu Manis Sudirman',
    badgeIcon: 'badge_manis.png',
    poiIds: ['P16', 'P22', 'P27'],
  },
];

export interface MemoryReviewStoreOptions {
  pois?: PoiCatalogRecord[];
  trails?: TrailRecord[];
  /** Fungsi opsional untuk mengambil displayName pengguna dari AuthStore. */
  resolveDisplayName?: (userId: string) => Promise<string | null> | string | null;
}

export class MemoryReviewStore implements ReviewStore {
  pois: PoiCatalogRecord[];
  trails: TrailRecord[];
  reviews: ReviewRecord[] = [];
  stamps: PassportStampRecord[] = [];
  private readonly resolveDisplayName?: (userId: string) => Promise<string | null> | string | null;

  constructor(options: MemoryReviewStoreOptions = {}) {
    this.pois = (options.pois ?? DEFAULT_SEED_POIS).map((p) => ({
      ...p,
      menuItems: p.menuItems.map((m) => ({ ...m })),
    }));
    this.trails = (options.trails ?? DEFAULT_SEED_TRAILS).map((t) => ({
      ...t,
      poiIds: [...t.poiIds],
    }));
    this.resolveDisplayName = options.resolveDisplayName;
  }

  async findPoiById(poiId: string): Promise<PoiCatalogRecord | null> {
    const p = this.pois.find((x) => x.id === poiId);
    if (!p) return null;
    return { ...p, menuItems: p.menuItems.map((m) => ({ ...m })) };
  }

  async listAllPoiIds(): Promise<string[]> {
    return this.pois.map((p) => p.id);
  }

  async listTrails(): Promise<TrailRecord[]> {
    return this.trails.map((t) => ({ ...t, poiIds: [...t.poiIds] }));
  }

  private assertValidMenuItems(poi: PoiCatalogRecord, menuItemIds: string[]) {
    const allowedIds = new Set(poi.menuItems.map((m) => m.id));
    const invalid = menuItemIds.filter((id) => !allowedIds.has(id));
    if (invalid.length > 0) {
      throw new PoiMenuMismatchError(poi.id, invalid);
    }
  }

  async createReview(input: NewReviewInput): Promise<{
    review: ReviewRecord;
    stamp: PassportStampRecord;
    isNewStamp: boolean;
  }> {
    const poi = await this.findPoiById(input.poiId);
    if (!poi) {
      throw new PoiMenuMismatchError(input.poiId, input.menuItemIds);
    }

    const uniqueMenuIds = Array.from(new Set(input.menuItemIds));
    if (uniqueMenuIds.length > 0) {
      this.assertValidMenuItems(poi, uniqueMenuIds);
    }

    const resolvedName = (await this.resolveDisplayName?.(input.userId)) ?? 'Kuliner Explorer';
    const review: ReviewRecord = {
      id: randomUUID(),
      userId: input.userId,
      userDisplayName: resolvedName,
      poiId: input.poiId,
      rating: input.rating,
      reviewText: input.reviewText,
      photoPath: input.photoPath,
      menuItemIds: uniqueMenuIds,
      createdAt: input.now,
      updatedAt: input.now,
    };

    this.reviews.push(review);

    // Trigger ekuivalen `sync_passport_stamp_on_review` (idempoten pada passport_stamps)
    const { stamp, isNewStamp } = await this.upsertStamp(input.userId, input.poiId, input.now);

    return {
      review: { ...review, menuItemIds: [...review.menuItemIds] },
      stamp: { ...stamp },
      isNewStamp,
    };
  }

  async findReviewById(reviewId: string): Promise<ReviewRecord | null> {
    const r = this.reviews.find((x) => x.id === reviewId);
    return r ? { ...r, menuItemIds: [...r.menuItemIds] } : null;
  }

  async listReviewsByPoi(poiId: string): Promise<ReviewRecord[]> {
    return this.reviews
      .filter((r) => r.poiId === poiId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({ ...r, menuItemIds: [...r.menuItemIds] }));
  }

  async listReviewsByUser(userId: string): Promise<ReviewRecord[]> {
    return this.reviews
      .filter((r) => r.userId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
      .map((r) => ({ ...r, menuItemIds: [...r.menuItemIds] }));
  }

  async updateReview(reviewId: string, input: UpdateReviewInput): Promise<ReviewRecord | null> {
    const existing = this.reviews.find((x) => x.id === reviewId);
    if (!existing) return null;

    if (input.menuItemIds !== undefined) {
      const poi = await this.findPoiById(existing.poiId);
      if (!poi) throw new PoiMenuMismatchError(existing.poiId, input.menuItemIds);
      const uniqueMenuIds = Array.from(new Set(input.menuItemIds));
      if (uniqueMenuIds.length > 0) {
        this.assertValidMenuItems(poi, uniqueMenuIds);
      }
      existing.menuItemIds = uniqueMenuIds;
    }

    if (input.rating !== undefined) existing.rating = input.rating;
    if (input.reviewText !== undefined) existing.reviewText = input.reviewText;
    if (input.photoPath !== undefined) existing.photoPath = input.photoPath;
    existing.updatedAt = input.now;

    return { ...existing, menuItemIds: [...existing.menuItemIds] };
  }

  async deleteReview(reviewId: string): Promise<boolean> {
    const idx = this.reviews.findIndex((x) => x.id === reviewId);
    if (idx === -1) return false;
    this.reviews.splice(idx, 1);
    return true;
  }

  async upsertStamp(
    userId: string,
    poiId: string,
    now: Date,
  ): Promise<{ stamp: PassportStampRecord; isNewStamp: boolean }> {
    const existing = this.stamps.find((s) => s.userId === userId && s.poiId === poiId);
    if (existing) {
      existing.lastStampedAt = now > existing.lastStampedAt ? now : existing.lastStampedAt;
      existing.visitCount += 1;
      return { stamp: { ...existing }, isNewStamp: false };
    }

    const created: PassportStampRecord = {
      userId,
      poiId,
      stampedAt: now,
      lastStampedAt: now,
      visitCount: 1,
    };
    this.stamps.push(created);
    return { stamp: { ...created }, isNewStamp: true };
  }

  async listStampsByUser(userId: string): Promise<PassportStampRecord[]> {
    return this.stamps
      .filter((s) => s.userId === userId)
      .sort((a, b) => a.stampedAt.getTime() - b.stampedAt.getTime())
      .map((s) => ({ ...s }));
  }
}
