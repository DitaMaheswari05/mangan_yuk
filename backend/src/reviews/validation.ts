// Aturan validasi field untuk fitur Ulasan (Review) Tenant & Gamifikasi Paspor Kuliner (F10).
// Mengikuti konvensi { field, rule } di backend/src/auth/validation.ts.

import { z } from 'zod';
import { parse } from '../auth/validation';

const str = () => z.string({ required_error: 'required', invalid_type_error: 'type' });

const POI_ID_RE = /^P\d{2}$/;
const MENU_ITEM_ID_RE = /^P\d{2}-M\d{2}$/;
const SAFE_STORAGE_PATH_RE = /^(?!\/)(?!\\)(?!.*\.\.)[A-Za-z0-9._/-]+$/;

export const poiId = str().trim().regex(POI_ID_RE, 'format');

export const reviewId = str().trim().uuid('format');

export const rating = z
  .number({ required_error: 'required', invalid_type_error: 'type' })
  .int('int')
  .min(1, 'min')
  .max(5, 'max');

export const reviewText = z
  .string({ invalid_type_error: 'type' })
  .trim()
  .max(1000, 'maxLength')
  .transform((v) => (v.length === 0 ? null : v))
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const photoPath = z
  .string({ invalid_type_error: 'type' })
  .trim()
  .max(500, 'maxLength')
  .transform((v) => (v.length === 0 ? null : v))
  .refine((v) => v === null || SAFE_STORAGE_PATH_RE.test(v), 'format')
  .nullable()
  .optional()
  .transform((v) => v ?? null);

export const menuItemId = str().trim().regex(MENU_ITEM_ID_RE, 'format');

export const menuItemIds = z
  .array(menuItemId, { invalid_type_error: 'type' })
  .max(50, 'maxItems')
  .optional()
  .default([])
  .transform((items) => Array.from(new Set(items)));

export const createReviewBody = z.object({
  poiId,
  rating,
  reviewText,
  photoPath,
  menuItemIds,
});

export const createPoiReviewBody = z.object({
  rating,
  reviewText,
  photoPath,
  menuItemIds,
});

export const updateReviewBody = z
  .object({
    rating: rating.optional(),
    reviewText: z
      .string({ invalid_type_error: 'type' })
      .trim()
      .max(1000, 'maxLength')
      .transform((v) => (v.length === 0 ? null : v))
      .nullable()
      .optional(),
    photoPath: z
      .string({ invalid_type_error: 'type' })
      .trim()
      .max(500, 'maxLength')
      .transform((v) => (v.length === 0 ? null : v))
      .refine((v) => v === null || SAFE_STORAGE_PATH_RE.test(v), 'format')
      .nullable()
      .optional(),
    menuItemIds: z
      .array(menuItemId, { invalid_type_error: 'type' })
      .max(50, 'maxItems')
      .transform((items) => Array.from(new Set(items)))
      .optional(),
  })
  .refine(
    (data) =>
      data.rating !== undefined ||
      data.reviewText !== undefined ||
      data.photoPath !== undefined ||
      data.menuItemIds !== undefined,
    { message: 'emptyUpdate', path: ['body'] },
  );

export const stampPoiBody = z.object({
  poiId,
});

export const poiParam = z.object({
  poiId,
});

export const reviewParam = z.object({
  reviewId,
});

export const listReviewsQuery = z.object({
  poiId: poiId.optional(),
  userId: str().trim().uuid('format').optional(),
});

export { parse };
