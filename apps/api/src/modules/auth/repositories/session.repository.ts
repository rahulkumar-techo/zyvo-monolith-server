import type { PrismaClient, Session, User } from '@zyvo/database';

export interface CreateSessionData {
  userId: string;
  refreshToken: string;
  deviceId?: string | null;
  userAgent?: string | null;
  ipAddress?: string | null;
  expiresAt: Date;
}

export class SessionRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async create(data: CreateSessionData): Promise<Session> {
    return this.prisma.session.create({
      data: {
        userId: data.userId,
        refreshToken: data.refreshToken,
        deviceId: data.deviceId ?? null,
        userAgent: data.userAgent ?? null,
        ipAddress: data.ipAddress ?? null,
        expiresAt: data.expiresAt,
      },
    });
  }

  async findByToken(refreshToken: string): Promise<(Session & { user: User }) | null> {
    return this.prisma.session.findUnique({
      where: { refreshToken },
      include: { user: true },
    });
  }

  async findById(id: string): Promise<Session | null> {
    return this.prisma.session.findUnique({
      where: { id },
    });
  }

  async updateToken(id: string, newRefreshToken: string, expiresAt: Date): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: {
        refreshToken: newRefreshToken,
        expiresAt,
        updatedAt: new Date(),
      },
    });
  }

  async revoke(id: string): Promise<Session> {
    return this.prisma.session.update({
      where: { id },
      data: { isRevoked: true },
    });
  }

  async revokeByToken(refreshToken: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { refreshToken, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async revokeAllByUserId(userId: string): Promise<void> {
    await this.prisma.session.updateMany({
      where: { userId, isRevoked: false },
      data: { isRevoked: true },
    });
  }

  async findActiveByUserId(userId: string): Promise<Session[]> {
    return this.prisma.session.findMany({
      where: {
        userId,
        isRevoked: false,
        expiresAt: { gt: new Date() },
      },
      orderBy: { createdAt: 'desc' },
    });
  }
}
