import { createHash, randomBytes, randomUUID } from 'node:crypto';
import jwt from 'jsonwebtoken';
import { ApiError } from '../errors';

export interface AccessClaims {
  sub: string;
  /** family_id refresh token; access token ikut mati saat sesinya di-revoke. */
  sid: string;
  jti: string;
  iat: number;
  exp: number;
}

export function signAccessToken(secret: string, userId: string, familyId: string, ttlSec: number, now: Date) {
  const iat = Math.floor(now.getTime() / 1000);
  return jwt.sign({ sub: userId, sid: familyId, jti: randomUUID(), iat, exp: iat + ttlSec }, secret, {
    algorithm: 'HS256',
  });
}

export function verifyAccessToken(secret: string, token: string, now: Date): AccessClaims {
  let claims: string | jwt.JwtPayload;
  try {
    claims = jwt.verify(token, secret, {
      algorithms: ['HS256'],
      clockTimestamp: Math.floor(now.getTime() / 1000),
    });
  } catch (e) {
    throw new ApiError(e instanceof jwt.TokenExpiredError ? 'TOKEN_EXPIRED' : 'TOKEN_INVALID');
  }
  if (typeof claims === 'string' || !claims.sub || typeof claims.sid !== 'string') {
    throw new ApiError('TOKEN_INVALID');
  }
  return claims as AccessClaims;
}

/** Token opaque 256-bit, mis. rt_… (refresh) atau pr_… (reset password). */
export function generateOpaqueToken(prefix: 'rt' | 'pr'): string {
  return `${prefix}_${randomBytes(32).toString('base64url')}`;
}

/** Hanya hash yang disimpan di DB, jadi bocornya tabel tidak membocorkan token yang bisa dipakai. */
export function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex');
}
