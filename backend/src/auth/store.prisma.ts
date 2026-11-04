import { Prisma, type PrismaClient } from '@prisma/client';
import { EmailTakenError, type AuthStore, type NewRefreshToken, type UserRecord } from './store';

const withProfile = { profile: { select: { displayName: true } } } as const;
type UserRow = Prisma.UserGetPayload<{ include: typeof withProfile }>;

const toUser = (u: UserRow): UserRecord => ({
  id: u.id,
  email: u.email,
  passwordHash: u.passwordHash,
  displayName: u.profile?.displayName ?? '',
  emailVerified: u.emailVerified,
  createdAt: u.createdAt,
});

class LostRotationRace extends Error {}

export class PrismaAuthStore implements AuthStore {
  constructor(private readonly db: PrismaClient) {}

  async findUserByEmail(email: string) {
    const u = await this.db.user.findFirst({ where: { email, deletedAt: null }, include: withProfile });
    return u && toUser(u);
  }

  async findUserById(id: string) {
    const u = await this.db.user.findFirst({ where: { id, deletedAt: null }, include: withProfile });
    return u && toUser(u);
  }

  async createUser(input: { email: string; passwordHash: string; displayName: string }) {
    try {
      const u = await this.db.user.create({
        data: {
          email: input.email,
          passwordHash: input.passwordHash,
          profile: { create: { displayName: input.displayName } },
        },
        include: withProfile,
      });
      return toUser(u);
    } catch (e) {
      // Unique index users_email_active_key (register paralel dengan email sama).
      if (e instanceof Prisma.PrismaClientKnownRequestError && e.code === 'P2002') throw new EmailTakenError();
      throw e;
    }
  }

  async updateDisplayName(userId: string, displayName: string) {
    await this.db.profile.update({ where: { id: userId }, data: { displayName } });
    return (await this.findUserById(userId))!;
  }

  async deleteUser(userId: string, now: Date) {
    await this.db.$transaction([
      this.db.user.update({ where: { id: userId }, data: { deletedAt: now } }),
      this.db.refreshToken.updateMany({ where: { userId, revokedAt: null }, data: { revokedAt: now } }),
    ]);
  }

  async createRefreshToken(t: NewRefreshToken) {
    await this.db.refreshToken.create({ data: t });
  }

  findRefreshToken(tokenHash: string) {
    return this.db.refreshToken.findUnique({
      where: { tokenHash },
      select: { id: true, userId: true, familyId: true, expiresAt: true, revokedAt: true, replacedBy: true },
    });
  }

  async rotateRefreshToken(oldId: string, next: NewRefreshToken, now: Date) {
    try {
      await this.db.$transaction(async (tx) => {
        const created = await tx.refreshToken.create({ data: next, select: { id: true } });
        // Kondisi revokedAt: null membuat hanya satu dari beberapa request paralel yang menang;
        // yang kalah melempar sehingga token barunya ikut di-rollback.
        const { count } = await tx.refreshToken.updateMany({
          where: { id: oldId, revokedAt: null },
          data: { revokedAt: now, replacedBy: created.id },
        });
        if (count === 0) throw new LostRotationRace();
      });
      return true;
    } catch (e) {
      if (e instanceof LostRotationRace) return false;
      throw e;
    }
  }

  async revokeRefreshToken(tokenHash: string, userId: string, now: Date) {
    await this.db.refreshToken.updateMany({ where: { tokenHash, userId, revokedAt: null }, data: { revokedAt: now } });
  }

  async revokeFamily(familyId: string, now: Date) {
    await this.db.refreshToken.updateMany({ where: { familyId, revokedAt: null }, data: { revokedAt: now } });
  }

  async isSessionActive(userId: string, familyId: string, now: Date) {
    const active = await this.db.refreshToken.count({
      where: { userId, familyId, revokedAt: null, expiresAt: { gt: now }, user: { deletedAt: null } },
    });
    return active > 0;
  }

  async createResetToken(t: { userId: string; tokenHash: string; expiresAt: Date }) {
    await this.db.passwordResetToken.create({ data: t });
  }

  resetPassword(tokenHash: string, passwordHash: string, now: Date) {
    return this.db.$transaction(async (tx) => {
      const token = await tx.passwordResetToken.findUnique({ where: { tokenHash } });
      if (!token) return false;
      const { count } = await tx.passwordResetToken.updateMany({
        where: { id: token.id, usedAt: null, expiresAt: { gt: now }, user: { deletedAt: null } },
        data: { usedAt: now },
      });
      if (count === 0) return false;
      await tx.user.update({ where: { id: token.userId }, data: { passwordHash } });
      await tx.refreshToken.updateMany({ where: { userId: token.userId, revokedAt: null }, data: { revokedAt: now } });
      return true;
    });
  }
}
