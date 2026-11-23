// Endpoint HTTP untuk Gamifikasi Paspor Kuliner & Ulasan Tenant/Menu (F10).

import { Router, type NextFunction, type Request, type Response } from 'express';
import type { AuthService } from '../auth/service';
import { ApiError } from '../errors';
import type { ReviewService } from './service';
import * as v from './validation';

function createRequireAuth(auth: AuthService) {
  return async (req: Request, _res: Response, next: NextFunction) => {
    const [scheme, token] = (req.headers.authorization ?? '').split(' ');
    if (scheme !== 'Bearer' || !token) throw new ApiError('TOKEN_INVALID');
    req.userId = await auth.authenticate(token);
    next();
  };
}

export function reviewsRouter(auth: AuthService, reviews: ReviewService): Router {
  const r = Router();
  const requireAuth = createRequireAuth(auth);

  // REV-01: Daftar ulasan (publik), mendukung filter ?poiId=P01&userId=<uuid>
  r.get('/', async (req, res) => {
    const query = v.parse(v.listReviewsQuery, req.query);
    res.json(await reviews.listReviews(query));
  });

  // REV-02: Daftar ulasan milik pengguna yang sedang login
  r.get('/me', requireAuth, async (req, res) => {
    res.json(await reviews.getUserReviews(req.userId!));
  });

  // REV-03: Buat ulasan tenant + daftar menu yang dicicipi (otomatis catat stempel paspor)
  r.post('/', requireAuth, async (req, res) => {
    const body = v.parse(v.createReviewBody, req.body);
    const result = await reviews.createReview(req.userId!, body);
    res.status(201).json(result);
  });

  // REV-04: Detail satu ulasan
  r.get('/:reviewId', async (req, res) => {
    const { reviewId } = v.parse(v.reviewParam, req.params);
    const review = await reviews.getReviewById(reviewId);
    res.json({ review });
  });

  // REV-05: Ubah ulasan milik sendiri
  r.patch('/:reviewId', requireAuth, async (req, res) => {
    const { reviewId } = v.parse(v.reviewParam, req.params);
    const patch = v.parse(v.updateReviewBody, req.body);
    res.json(await reviews.updateReview(req.userId!, reviewId, patch));
  });

  // REV-06: Hapus ulasan milik sendiri
  r.delete('/:reviewId', requireAuth, async (req, res) => {
    const { reviewId } = v.parse(v.reviewParam, req.params);
    await reviews.deleteReview(req.userId!, reviewId);
    res.status(204).end();
  });

  return r;
}

export function poiReviewsRouter(auth: AuthService, reviews: ReviewService): Router {
  const r = Router();
  const requireAuth = createRequireAuth(auth);

  // REV-07: Ambil semua ulasan + statistik rating & menu populer untuk satu POI
  r.get('/:poiId/reviews', async (req, res) => {
    const { poiId } = v.parse(v.poiParam, req.params);
    res.json(await reviews.getPoiReviews(poiId));
  });

  // REV-08: Buat ulasan langsung pada endpoint POI (/v1/pois/:poiId/reviews)
  r.post('/:poiId/reviews', requireAuth, async (req, res) => {
    const { poiId } = v.parse(v.poiParam, req.params);
    const body = v.parse(v.createPoiReviewBody, req.body);
    const result = await reviews.createReview(req.userId!, { ...body, poiId });
    res.status(201).json(result);
  });

  return r;
}

export function passportRouter(auth: AuthService, reviews: ReviewService): Router {
  const r = Router();
  const requireAuth = createRequireAuth(auth);

  // GAM-01: Ambil state Paspor Kuliner lengkap (stamps, trails, badges, reviews, stats)
  r.get('/', requireAuth, async (req, res) => {
    res.json(await reviews.getPassport(req.userId!));
  });

  // GAM-02: Catat stempel kunjungan tenant secara idempoten (dwell / QR / manual)
  r.post('/stamps', requireAuth, async (req, res) => {
    const { poiId } = v.parse(v.stampPoiBody, req.body);
    const result = await reviews.recordStamp(req.userId!, poiId);
    res.status(result.isNewStamp ? 201 : 200).json(result);
  });

  // GAM-03: Ambil riwayat ulasan pengguna dari konteks paspor
  r.get('/reviews', requireAuth, async (req, res) => {
    res.json(await reviews.getUserReviews(req.userId!));
  });

  return r;
}
