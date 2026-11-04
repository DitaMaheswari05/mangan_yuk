// AuthStore di memori untuk test. Perilakunya mengikuti store.prisma.ts.
import { randomUUID } from 'node:crypto';
import { EmailTakenError, type AuthStore, type NewRefreshToken, type RefreshTokenRecord, type UserRecord } from './store';

type User = UserRecord & { deletedAt: Date | null };
type Refresh = RefreshTokenRecord & { tokenHash: string };
type Reset = { userId: string; tokenHash: string; expiresAt: Date; usedAt: Date | null };

export class MemoryAuthStore implements AuthStore {
  users: User[] = [];
  refreshTokens: Refresh[] = [];
  resetTokens: Reset[] = [];

  private active = (u: User | undefined) => (u && !u.deletedAt ? { ...u } : null);

  async findUserByEmail(email: string) {
    return this.active(this.users.find((u) => u.email === email && !u.deletedAt));
  }

  async findUserById(id: string) {
    return this.active(this.users.find((u) => u.id === id));
  }

  async createUser(input: { email: string; passwordHash: string; displayName: string }) {
    if (await this.findUserByEmail(input.email)) throw new EmailTakenError();
    const user: User = { id: randomUUID(), emailVerified: false, createdAt: new Date(), deletedAt: null, ...input };
    this.users.push(user);
    return { ...user };
  }

  async updateDisplayName(userId: string, displayName: string) {
    const u = this.users.find((x) => x.id === userId)!;
    u.displayName = displayName;
    return { ...u };
  }

  async deleteUser(userId: string, now: Date) {
    this.users.find((u) => u.id === userId)!.deletedAt = now;
    for (const t of this.refreshTokens) if (t.userId === userId) t.revokedAt ??= now;
  }

  async createRefreshToken(t: NewRefreshToken) {
    this.refreshTokens.push({ id: randomUUID(), revokedAt: null, replacedBy: null, ...t });
  }

  async findRefreshToken(tokenHash: string) {
    const t = this.refreshTokens.find((x) => x.tokenHash === tokenHash);
    return t ? { ...t } : null;
  }

  async rotateRefreshToken(oldId: string, next: NewRefreshToken, now: Date) {
    const old = this.refreshTokens.find((t) => t.id === oldId)!;
    if (old.revokedAt) return false;
    const id = randomUUID();
    this.refreshTokens.push({ id, revokedAt: null, replacedBy: null, ...next });
    old.revokedAt = now;
    old.replacedBy = id;
    return true;
  }

  async revokeRefreshToken(tokenHash: string, userId: string, now: Date) {
    const t = this.refreshTokens.find((x) => x.tokenHash === tokenHash && x.userId === userId);
    if (t) t.revokedAt ??= now;
  }

  async revokeFamily(familyId: string, now: Date) {
    for (const t of this.refreshTokens) if (t.familyId === familyId) t.revokedAt ??= now;
  }

  async isSessionActive(userId: string, familyId: string, now: Date) {
    if (!(await this.findUserById(userId))) return false;
    return this.refreshTokens.some(
      (t) => t.userId === userId && t.familyId === familyId && !t.revokedAt && t.expiresAt > now,
    );
  }

  async createResetToken(t: { userId: string; tokenHash: string; expiresAt: Date }) {
    this.resetTokens.push({ ...t, usedAt: null });
  }

  async resetPassword(tokenHash: string, passwordHash: string, now: Date) {
    const t = this.resetTokens.find((x) => x.tokenHash === tokenHash);
    const user = t && this.users.find((u) => u.id === t.userId && !u.deletedAt);
    if (!t || !user || t.usedAt || t.expiresAt <= now) return false;
    t.usedAt = now;
    user.passwordHash = passwordHash;
    for (const r of this.refreshTokens) if (r.userId === user.id) r.revokedAt ??= now;
    return true;
  }
}
