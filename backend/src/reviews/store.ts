// Port penyimpanan untuk ReviewService (Gamifikasi & Paspor Kuliner F10).
// Implementasi: store.prisma.ts (Postgres) dan store.memory.ts (unit test / in-memory).

export interface MenuCatalogItem {
  id: string;
  poiId: string;
  name: string;
  priceIdr: number;
  isSignature: boolean;
}

export interface PoiCatalogRecord {
  id: string;
  name: string;
  categoryLabel: string;
  zone: string;
  menuItems: MenuCatalogItem[];
}

export interface TrailRecord {
  id: string;
  name: string;
  description: string;
  badgeName: string;
  badgeIcon: string | null;
  poiIds: string[];
}

export interface PassportStampRecord {
  userId: string;
  poiId: string;
  stampedAt: Date;
  lastStampedAt: Date;
  visitCount: number;
}

export interface ReviewRecord {
  id: string;
  userId: string;
  userDisplayName: string;
  poiId: string;
  rating: number;
  reviewText: string | null;
  photoPath: string | null;
  menuItemIds: string[];
  createdAt: Date;
  updatedAt: Date;
}

export interface NewReviewInput {
  userId: string;
  poiId: string;
  rating: number;
  reviewText: string | null;
  photoPath: string | null;
  menuItemIds: string[];
  now: Date;
}

export interface UpdateReviewInput {
  rating?: number;
  reviewText?: string | null;
  photoPath?: string | null;
  menuItemIds?: string[];
  now: Date;
}

/** Dilempar saat ada menuItemId yang bukan milik tenant (poiId) yang direview. */
export class PoiMenuMismatchError extends Error {
  constructor(
    readonly poiId: string,
    readonly invalidMenuItemIds: string[],
  ) {
    super(`Menu item [${invalidMenuItemIds.join(', ')}] bukan milik tenant ${poiId}`);
  }
}

export interface ReviewStore {
  /** Cari tenant beserta daftar menunya untuk validasi review & gamifikasi. */
  findPoiById(poiId: string): Promise<PoiCatalogRecord | null>;
  /** Ambil daftar seluruh ID POI yang tersedia untuk perhitungan persentase jelajah. */
  listAllPoiIds(): Promise<string[]>;
  /** Ambil seluruh trail tematik beserta urutan POI di dalamnya. */
  listTrails(): Promise<TrailRecord[]>;

  /**
   * Simpan review baru beserta daftar menu yang dimakan (`review_menu_items`),
   * sekaligus otomatis mencatat stempel kunjungan di `passport_stamps` (idempoten).
   * Melempar PoiMenuMismatchError bila ada menuItemId yang bukan milik poiId.
   */
  createReview(input: NewReviewInput): Promise<{
    review: ReviewRecord;
    stamp: PassportStampRecord;
    isNewStamp: boolean;
  }>;

  findReviewById(reviewId: string): Promise<ReviewRecord | null>;
  /** Urut dari terbaru (`createdAt DESC`). */
  listReviewsByPoi(poiId: string): Promise<ReviewRecord[]>;
  /** Urut dari terbaru (`createdAt DESC`). */
  listReviewsByUser(userId: string): Promise<ReviewRecord[]>;

  /**
   * Perbarui review yang sudah ada.
   * Melempar PoiMenuMismatchError bila ada menuItemId baru yang bukan milik poiId review tersebut.
   */
  updateReview(reviewId: string, input: UpdateReviewInput): Promise<ReviewRecord | null>;
  deleteReview(reviewId: string): Promise<boolean>;

  /**
   * Catat stempel kunjungan secara idempoten (untuk dwell / scan QR / review).
   * Jika sudah pernah distempel, mempertahankan `stampedAt` pertama dan memperbarui `lastStampedAt` & `visitCount`.
   */
  upsertStamp(
    userId: string,
    poiId: string,
    now: Date,
  ): Promise<{ stamp: PassportStampRecord; isNewStamp: boolean }>;

  listStampsByUser(userId: string): Promise<PassportStampRecord[]>;
}
