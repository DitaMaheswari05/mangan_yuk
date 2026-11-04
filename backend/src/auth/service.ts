import { randomUUID } from 'node:crypto';
import bcrypt from 'bcryptjs';
import type { Config } from '../config';
import { ApiError } from '../errors';
import type { Mailer } from '../mailer';
import { RateLimiter } from './rateLimit';
import { EmailTakenError, type AuthStore, type UserRecord } from './store';
import { generateOpaqueToken, hashToken, signAccessToken, verifyAccessToken } from './tokens';

const MIN = 60_000;

export interface PublicUser {
  id: string;
  email: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: string;
}

export interface TokenPair {
  accessToken: string;
  accessTokenExpiresIn: number;
  refreshToken: string;
  refreshTokenExpiresIn: number;
}

export interface AuthDeps {
  store: AuthStore;
  mailer: Mailer;
  config: Config;
  now?: () => Date;
}

export const toPublicUser = (u: UserRecord): PublicUser => ({
  id: u.id,
  email: u.email,
  displayName: u.displayName,
  emailVerified: u.emailVerified,
  createdAt: u.createdAt.toISOString(),
});

export class AuthService {
  private readonly store: AuthStore;
  private readonly mailer: Mailer;
  private readonly config: Config;
  private readonly now: () => Date;
  // Dibandingkan saat email tidak terdaftar supaya waktu respons login tidak membocorkan keberadaan akun.
  private readonly dummyHash: string;

  private readonly loginFailByEmail: RateLimiter;
  private readonly loginFailByIp: RateLimiter;
  private readonly registerByIp: RateLimiter;
  private readonly forgotByEmail: RateLimiter;

  constructor({ store, mailer, config, now = () => new Date() }: AuthDeps) {
    this.store = store;
    this.mailer = mailer;
    this.config = config;
    this.now = now;
    this.dummyHash = bcrypt.hashSync('dummy-password-0', config.bcryptCost);
    const ms = () => now().getTime();
    this.loginFailByEmail = new RateLimiter(5, 15 * MIN, ms);
    this.loginFailByIp = new RateLimiter(20, 15 * MIN, ms);
    this.registerByIp = new RateLimiter(10, 60 * MIN, ms);
    this.forgotByEmail = new RateLimiter(3, 60 * MIN, ms);
  }

  // AUTH-01
  async register(input: { email: string; password: string; displayName: string; deviceLabel?: string }, ip: string) {
    this.guard(this.registerByIp, ip);
    this.registerByIp.hit(ip);
    if (await this.store.findUserByEmail(input.email)) throw new ApiError('EMAIL_TAKEN');
    const passwordHash = await bcrypt.hash(input.password, this.config.bcryptCost);
    let user: UserRecord;
    try {
      user = await this.store.createUser({ email: input.email, passwordHash, displayName: input.displayName });
    } catch (e) {
      if (e instanceof EmailTakenError) throw new ApiError('EMAIL_TAKEN');
      throw e;
    }
    const tokens = await this.startSession(user.id, input.deviceLabel);
    return { user: toPublicUser(user), tokens };
  }

  // AUTH-02
  async login(input: { email: string; password: string; deviceLabel?: string }, ip: string) {
    this.guard(this.loginFailByEmail, input.email);
    this.guard(this.loginFailByIp, ip);
    const user = await this.store.findUserByEmail(input.email);
    const ok = await bcrypt.compare(input.password, user?.passwordHash ?? this.dummyHash);
    if (!user || !ok) {
      this.loginFailByEmail.hit(input.email);
      this.loginFailByIp.hit(ip);
      throw new ApiError('INVALID_CREDENTIALS');
    }
    this.loginFailByEmail.reset(input.email);
    const tokens = await this.startSession(user.id, input.deviceLabel);
    return { user: toPublicUser(user), tokens };
  }

  // AUTH-03
  async refresh(refreshToken: string): Promise<TokenPair> {
    const now = this.now();
    const current = await this.store.findRefreshToken(hashToken(refreshToken));
    if (!current) throw new ApiError('TOKEN_INVALID');
    if (current.replacedBy) {
      // Token yang sudah dirotasi dipakai lagi: kemungkinan dicuri. Matikan seluruh sesi.
      await this.store.revokeFamily(current.familyId, now);
      throw new ApiError('REFRESH_REUSE_DETECTED');
    }
    if (current.revokedAt || current.expiresAt <= now) throw new ApiError('TOKEN_INVALID');
    if (!(await this.store.findUserById(current.userId))) throw new ApiError('TOKEN_INVALID');

    const next = generateOpaqueToken('rt');
    const rotated = await this.store.rotateRefreshToken(
      current.id,
      {
        userId: current.userId,
        familyId: current.familyId,
        tokenHash: hashToken(next),
        expiresAt: new Date(now.getTime() + this.config.refreshTokenTtlSec * 1000),
      },
      now,
    );
    if (!rotated) {
      await this.store.revokeFamily(current.familyId, now);
      throw new ApiError('REFRESH_REUSE_DETECTED');
    }
    return this.tokenPair(current.userId, current.familyId, next);
  }

  // AUTH-04 — idempoten: token tak dikenal/sudah di-revoke tetap sukses.
  async logout(userId: string, refreshToken: string) {
    await this.store.revokeRefreshToken(hashToken(refreshToken), userId, this.now());
  }

  /** Dipakai middleware Bearer. Mengembalikan userId. */
  async authenticate(accessToken: string): Promise<string> {
    const now = this.now();
    const claims = verifyAccessToken(this.config.jwtSecret, accessToken, now);
    if (!(await this.store.isSessionActive(claims.sub, claims.sid, now))) throw new ApiError('TOKEN_INVALID');
    return claims.sub;
  }

  // AUTH-05
  async getMe(userId: string) {
    const user = await this.store.findUserById(userId);
    if (!user) throw new ApiError('TOKEN_INVALID');
    return toPublicUser(user);
  }

  // AUTH-06
  async updateMe(userId: string, displayName: string) {
    return toPublicUser(await this.store.updateDisplayName(userId, displayName));
  }

  // AUTH-07 — dari sisi klien selalu sukses (anti-enumerasi).
  async forgotPassword(email: string) {
    this.guard(this.forgotByEmail, email);
    this.forgotByEmail.hit(email);
    const user = await this.store.findUserByEmail(email);
    if (!user) return;
    const token = generateOpaqueToken('pr');
    await this.store.createResetToken({
      userId: user.id,
      tokenHash: hashToken(token),
      expiresAt: new Date(this.now().getTime() + this.config.resetTokenTtlSec * 1000),
    });
    const link = `${this.config.resetLinkBase}?token=${encodeURIComponent(token)}`;
    await this.mailer.sendPasswordReset(user.email, link);
  }

  // AUTH-08
  async resetPassword(token: string, newPassword: string) {
    const passwordHash = await bcrypt.hash(newPassword, this.config.bcryptCost);
    if (!(await this.store.resetPassword(hashToken(token), passwordHash, this.now()))) {
      throw new ApiError('TOKEN_INVALID');
    }
  }

  // AUTH-09
  async deleteMe(userId: string, password: string) {
    const user = await this.store.findUserById(userId);
    if (!user || !(await bcrypt.compare(password, user.passwordHash))) throw new ApiError('INVALID_CREDENTIALS');
    await this.store.deleteUser(userId, this.now());
  }

  private guard(limiter: RateLimiter, key: string) {
    const retryAfter = limiter.retryAfterSec(key);
    if (retryAfter > 0) throw new ApiError('RATE_LIMITED', [], retryAfter);
  }

  private async startSession(userId: string, deviceLabel?: string) {
    const familyId = randomUUID();
    const refreshToken = generateOpaqueToken('rt');
    await this.store.createRefreshToken({
      userId,
      familyId,
      tokenHash: hashToken(refreshToken),
      deviceLabel,
      expiresAt: new Date(this.now().getTime() + this.config.refreshTokenTtlSec * 1000),
    });
    return this.tokenPair(userId, familyId, refreshToken);
  }

  private tokenPair(userId: string, familyId: string, refreshToken: string): TokenPair {
    const { jwtSecret, accessTokenTtlSec, refreshTokenTtlSec } = this.config;
    return {
      accessToken: signAccessToken(jwtSecret, userId, familyId, accessTokenTtlSec, this.now()),
      accessTokenExpiresIn: accessTokenTtlSec,
      refreshToken,
      refreshTokenExpiresIn: refreshTokenTtlSec,
    };
  }
}
