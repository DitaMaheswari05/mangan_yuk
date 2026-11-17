import request from 'supertest';
import jwt from 'jsonwebtoken';
import { beforeEach, describe, expect, it } from 'vitest';
import { createApp } from '../app';
import { AuthService } from '../auth/service';
import { MemoryAuthStore } from '../auth/store.memory';
import { loadConfig } from '../config';
import type { Mailer } from '../mailer';

const config = loadConfig({ JWT_SECRET: 'x'.repeat(32), BCRYPT_COST: '4' });
const user = { email: ' Dita@Example.com ', password: 'Rahasia123', displayName: 'Dita', deviceLabel: 'Pixel 7' };

let clock: Date;
let store: MemoryAuthStore;
let sentLinks: string[];
let api: ReturnType<typeof request>;

beforeEach(() => {
  clock = new Date('2026-11-04T08:00:00Z');
  store = new MemoryAuthStore();
  sentLinks = [];
  const mailer: Mailer = { sendPasswordReset: async (_to, link) => void sentLinks.push(link) };
  const auth = new AuthService({ store, mailer, config, now: () => clock });
  api = request(createApp({ auth }));
});

const advance = (ms: number) => (clock = new Date(clock.getTime() + ms));
const register = () => api.post('/v1/auth/register').send(user);
const bearer = (t: string) => ({ Authorization: `Bearer ${t}` });

describe('AUTH-01 register', () => {
  it('201 dengan user + tokens, email dinormalisasi', async () => {
    const res = await register().expect(201);
    expect(res.body.user).toMatchObject({ email: 'dita@example.com', displayName: 'Dita', emailVerified: false });
    expect(res.body.tokens).toMatchObject({ accessTokenExpiresIn: 900, refreshTokenExpiresIn: 2592000 });
    expect(res.body.tokens.refreshToken).toMatch(/^rt_/);
  });

  it('409 EMAIL_TAKEN', async () => {
    await register();
    const res = await register().expect(409);
    expect(res.body.error.code).toBe('EMAIL_TAKEN');
  });

  it('400 VALIDATION_ERROR dengan details { field, rule }', async () => {
    const res = await api
      .post('/v1/auth/register')
      .send({ email: 'bukan-email', password: 'abcdefgh', displayName: 'D' })
      .expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
    expect(res.body.error.details).toEqual(
      expect.arrayContaining([
        { field: 'email', rule: 'format' },
        { field: 'password', rule: 'digit' },
        { field: 'displayName', rule: 'minLength' },
      ]),
    );
  });

  it('400 untuk JSON rusak', async () => {
    const res = await api.post('/v1/auth/register').set('Content-Type', 'application/json').send('{').expect(400);
    expect(res.body.error.code).toBe('VALIDATION_ERROR');
  });
});

describe('AUTH-02 login', () => {
  it('200 dengan kredensial benar', async () => {
    await register();
    const res = await api.post('/v1/auth/login').send({ email: 'dita@example.com', password: 'Rahasia123' }).expect(200);
    expect(res.body.user.email).toBe('dita@example.com');
  });

  it('pesan sama untuk email tak terdaftar dan password salah', async () => {
    await register();
    const a = await api.post('/v1/auth/login').send({ email: 'dita@example.com', password: 'Salah1234' }).expect(401);
    const b = await api.post('/v1/auth/login').send({ email: 'x@example.com', password: 'Salah1234' }).expect(401);
    expect(a.body).toEqual(b.body);
    expect(a.body.error.code).toBe('INVALID_CREDENTIALS');
  });

  it('429 setelah 5 gagal per email, dengan Retry-After; pulih setelah 15 menit', async () => {
    await register();
    const fail = () => api.post('/v1/auth/login').send({ email: 'dita@example.com', password: 'Salah1234' });
    for (let i = 0; i < 5; i++) await fail().expect(401);
    const res = await api.post('/v1/auth/login').send({ email: 'dita@example.com', password: 'Rahasia123' }).expect(429);
    expect(res.body.error.code).toBe('RATE_LIMITED');
    expect(Number(res.headers['retry-after'])).toBeGreaterThan(0);
    advance(15 * 60_000 + 1);
    await api.post('/v1/auth/login').send({ email: 'dita@example.com', password: 'Rahasia123' }).expect(200);
  });

  it('429 setelah 20 gagal per IP lintas email', async () => {
    for (let i = 0; i < 20; i++) {
      await api.post('/v1/auth/login').send({ email: `u${i}@example.com`, password: 'Salah1234' }).expect(401);
    }
    await api.post('/v1/auth/login').send({ email: 'lain@example.com', password: 'Salah1234' }).expect(429);
  });
});

describe('AUTH-03 refresh', () => {
  it('rotasi: token baru valid, token lama ditandai revoked + replaced_by', async () => {
    const { tokens } = (await register()).body;
    const res = await api.post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(200);
    expect(res.body.tokens.refreshToken).not.toBe(tokens.refreshToken);
    const [old, fresh] = store.refreshTokens;
    expect(old.revokedAt).not.toBeNull();
    expect(old.replacedBy).toBe(fresh.id);
    await api.get('/v1/auth/me').set(bearer(res.body.tokens.accessToken)).expect(200);
  });

  it('reuse token lama → REFRESH_REUSE_DETECTED dan seluruh family di-revoke', async () => {
    const { tokens } = (await register()).body;
    const next = (await api.post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken })).body.tokens;
    const res = await api.post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(res.body.error.code).toBe('REFRESH_REUSE_DETECTED');
    expect(store.refreshTokens.every((t) => t.revokedAt)).toBe(true);
    const after = await api.post('/v1/auth/refresh').send({ refreshToken: next.refreshToken }).expect(401);
    expect(after.body.error.code).toBe('TOKEN_INVALID');
    await api.get('/v1/auth/me').set(bearer(next.accessToken)).expect(401);
  });

  it('TOKEN_INVALID untuk token tak dikenal dan kedaluwarsa', async () => {
    const unknown = await api.post('/v1/auth/refresh').send({ refreshToken: 'rt_ngawur' }).expect(401);
    expect(unknown.body.error.code).toBe('TOKEN_INVALID');
    const { tokens } = (await register()).body;
    advance(30 * 24 * 3600_000 + 1);
    const expired = await api.post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(expired.body.error.code).toBe('TOKEN_INVALID');
  });
});

describe('AUTH-04 logout', () => {
  it('204 dan sesi mati (access token dari sesi itu ikut tidak valid)', async () => {
    const { tokens } = (await register()).body;
    const logout = () =>
      api.post('/v1/auth/logout').set(bearer(tokens.accessToken)).send({ refreshToken: tokens.refreshToken });
    await logout().expect(204);
    expect((await logout().expect(401)).body.error.code).toBe('TOKEN_INVALID');
    const res = await api.post('/v1/auth/refresh').send({ refreshToken: tokens.refreshToken }).expect(401);
    expect(res.body.error.code).toBe('TOKEN_INVALID');
  });

  it('idempoten: refresh token yang sudah di-revoke tetap 204 selama Bearer valid', async () => {
    const { tokens } = (await register()).body;
    const second = (await api.post('/v1/auth/login').send(user)).body.tokens;
    await api.post('/v1/auth/logout').set(bearer(second.accessToken)).send({ refreshToken: second.refreshToken });
    await api
      .post('/v1/auth/logout')
      .set(bearer(tokens.accessToken))
      .send({ refreshToken: second.refreshToken })
      .expect(204);
  });
});

describe('AUTH-05/06 me', () => {
  it('GET mengembalikan user; tanpa token → TOKEN_INVALID; kedaluwarsa → TOKEN_EXPIRED', async () => {
    const { tokens } = (await register()).body;
    const me = await api.get('/v1/auth/me').set(bearer(tokens.accessToken)).expect(200);
    expect(me.body).toMatchObject({ email: 'dita@example.com', displayName: 'Dita' });
    expect((await api.get('/v1/auth/me').expect(401)).body.error.code).toBe('TOKEN_INVALID');
    advance(15 * 60_000 + 1000);
    const res = await api.get('/v1/auth/me').set(bearer(tokens.accessToken)).expect(401);
    expect(res.body.error.code).toBe('TOKEN_EXPIRED');

    const withoutExp = jwt.sign({ sub: 'some-user', sid: 'some-sid' }, config.jwtSecret, { algorithm: 'HS256' });
    const noExpRes = await api.get('/v1/auth/me').set(bearer(withoutExp)).expect(401);
    expect(noExpRes.body.error.code).toBe('TOKEN_INVALID');
  });

  it('PATCH hanya mengubah displayName', async () => {
    const { tokens } = (await register()).body;
    const res = await api
      .patch('/v1/auth/me')
      .set(bearer(tokens.accessToken))
      .send({ displayName: 'Dita M.', email: 'hack@example.com', emailVerified: true })
      .expect(200);
    expect(res.body).toMatchObject({ displayName: 'Dita M.', email: 'dita@example.com', emailVerified: false });
  });
});

describe('AUTH-07/08 lupa & reset password', () => {
  it('202 untuk email terdaftar maupun tidak; email hanya dikirim jika terdaftar', async () => {
    await register();
    await api.post('/v1/auth/password/forgot').send({ email: 'dita@example.com' }).expect(202);
    await api.post('/v1/auth/password/forgot').send({ email: 'x@example.com' }).expect(202);
    expect(sentLinks).toHaveLength(1);
    expect(sentLinks[0]).toMatch(/^manganyuk:\/\/reset\?token=pr_/);
  });

  it('429 setelah 3 permintaan per email per jam', async () => {
    for (let i = 0; i < 3; i++) await api.post('/v1/auth/password/forgot').send({ email: 'x@example.com' }).expect(202);
    await api.post('/v1/auth/password/forgot').send({ email: 'x@example.com' }).expect(429);
  });

  it('reset: password berganti, semua sesi di-revoke, token sekali pakai', async () => {
    const { tokens } = (await register()).body;
    await api.post('/v1/auth/password/forgot').send({ email: 'dita@example.com' });
    const token = new URL(sentLinks[0]).searchParams.get('token')!;
    await api.post('/v1/auth/password/reset').send({ token, newPassword: 'Baru12345' }).expect(204);
    await api.get('/v1/auth/me').set(bearer(tokens.accessToken)).expect(401);
    await api.post('/v1/auth/login').send({ email: 'dita@example.com', password: 'Baru12345' }).expect(200);
    const reuse = await api.post('/v1/auth/password/reset').send({ token, newPassword: 'Lagi12345' }).expect(401);
    expect(reuse.body.error.code).toBe('TOKEN_INVALID');
  });

  it('token reset kedaluwarsa setelah 30 menit', async () => {
    await register();
    await api.post('/v1/auth/password/forgot').send({ email: 'dita@example.com' });
    const token = new URL(sentLinks[0]).searchParams.get('token')!;
    advance(30 * 60_000 + 1);
    await api.post('/v1/auth/password/reset').send({ token, newPassword: 'Baru12345' }).expect(401);
  });
});

describe('AUTH-09 hapus akun', () => {
  it('password salah → INVALID_CREDENTIALS; benar → 204, sesi mati, email bisa dipakai lagi', async () => {
    const { tokens } = (await register()).body;
    const del = (password: string) => api.delete('/v1/auth/me').set(bearer(tokens.accessToken)).send({ password });
    expect((await del('Salah1234').expect(401)).body.error.code).toBe('INVALID_CREDENTIALS');
    await del('Rahasia123').expect(204);
    await api.get('/v1/auth/me').set(bearer(tokens.accessToken)).expect(401);
    await api.post('/v1/auth/login').send(user).expect(401);
    await register().expect(201);
  });
});

it('endpoint tak dikenal → 404 NOT_FOUND dengan format error seragam', async () => {
  const res = await api.get('/v1/nope').expect(404);
  expect(res.body).toEqual({ error: { code: 'NOT_FOUND', message: expect.any(String), details: [] } });
});
