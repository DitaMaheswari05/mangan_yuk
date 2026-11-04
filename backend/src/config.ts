import 'dotenv/config';

export interface Config {
  port: number;
  jwtSecret: string;
  accessTokenTtlSec: number;
  refreshTokenTtlSec: number;
  resetTokenTtlSec: number;
  bcryptCost: number;
  /** Jumlah proxy di depan server (untuk req.ip). 0 = langsung. */
  trustProxy: number;
  /** Basis link reset di email; token ditambahkan sebagai ?token=. */
  resetLinkBase: string;
}

export function loadConfig(env: NodeJS.ProcessEnv = process.env): Config {
  const jwtSecret = env.JWT_SECRET ?? '';
  if (jwtSecret.length < 32) throw new Error('JWT_SECRET wajib diisi (minimal 32 karakter) di backend/.env');
  return {
    port: Number(env.PORT ?? 3000),
    jwtSecret,
    accessTokenTtlSec: 15 * 60,
    refreshTokenTtlSec: 30 * 24 * 60 * 60,
    resetTokenTtlSec: 30 * 60,
    bcryptCost: Number(env.BCRYPT_COST ?? 12),
    trustProxy: Number(env.TRUST_PROXY ?? 0),
    resetLinkBase: env.RESET_LINK_BASE ?? 'manganyuk://reset',
  };
}
