// Port penyimpanan untuk AuthService. Implementasi: store.prisma.ts (Postgres) dan
// store.memory.ts (test). Operasi yang harus atomik dibuat satu method supaya implementasi
// Postgres bisa menjalankannya dalam satu transaksi.

export interface UserRecord {
  id: string;
  email: string;
  passwordHash: string;
  displayName: string;
  emailVerified: boolean;
  createdAt: Date;
}

export interface RefreshTokenRecord {
  id: string;
  userId: string;
  familyId: string;
  expiresAt: Date;
  revokedAt: Date | null;
  replacedBy: string | null;
}

export interface NewRefreshToken {
  userId: string;
  familyId: string;
  tokenHash: string;
  deviceLabel?: string;
  expiresAt: Date;
}

export class EmailTakenError extends Error {}

export interface AuthStore {
  /** Hanya akun yang belum dihapus. */
  findUserByEmail(email: string): Promise<UserRecord | null>;
  findUserById(id: string): Promise<UserRecord | null>;
  /** Melempar EmailTakenError jika email sudah dipakai akun aktif. */
  createUser(input: { email: string; passwordHash: string; displayName: string }): Promise<UserRecord>;
  updateDisplayName(userId: string, displayName: string): Promise<UserRecord>;
  /** Soft delete + revoke semua refresh token. */
  deleteUser(userId: string, now: Date): Promise<void>;

  createRefreshToken(t: NewRefreshToken): Promise<void>;
  findRefreshToken(tokenHash: string): Promise<RefreshTokenRecord | null>;
  /**
   * Revoke token lama (replaced_by = token baru) dan simpan token baru, atomik.
   * false jika token lama ternyata sudah di-revoke (request refresh paralel / reuse).
   */
  rotateRefreshToken(oldId: string, next: NewRefreshToken, now: Date): Promise<boolean>;
  revokeRefreshToken(tokenHash: string, userId: string, now: Date): Promise<void>;
  revokeFamily(familyId: string, now: Date): Promise<void>;
  /** true jika family masih punya token aktif dan pemiliknya belum dihapus. */
  isSessionActive(userId: string, familyId: string, now: Date): Promise<boolean>;

  createResetToken(t: { userId: string; tokenHash: string; expiresAt: Date }): Promise<void>;
  /**
   * Jika token valid (ada, belum dipakai, belum kedaluwarsa): tandai used_at, ganti password,
   * revoke semua refresh token user. false jika token tidak valid.
   */
  resetPassword(tokenHash: string, passwordHash: string, now: Date): Promise<boolean>;
}
