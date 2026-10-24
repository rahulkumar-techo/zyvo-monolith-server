import type { PrismaClient, User, Session } from '@zyvo/database';
import { UserRepository, type CreateUserData } from './user.repository.js';
import { SessionRepository, type CreateSessionData } from './session.repository.js';

export * from './user.repository.js';
export * from './session.repository.js';

export class AuthRepository {
  public readonly users: UserRepository;
  public readonly sessions: SessionRepository;

  constructor(prisma: PrismaClient) {
    this.users = new UserRepository(prisma);
    this.sessions = new SessionRepository(prisma);
  }

  // Delegations for direct compatibility
  findUserById(id: string): Promise<User | null> {
    return this.users.findById(id);
  }

  findUserByPhone(phone: string): Promise<User | null> {
    return this.users.findByPhone(phone);
  }

  findUserByEmail(email: string): Promise<User | null> {
    return this.users.findByEmail(email);
  }

  createUser(data: CreateUserData): Promise<User> {
    return this.users.create(data);
  }

  createSession(data: CreateSessionData): Promise<Session> {
    return this.sessions.create(data);
  }

  findSessionByToken(refreshToken: string): Promise<(Session & { user: User }) | null> {
    return this.sessions.findByToken(refreshToken);
  }

  findSessionById(id: string): Promise<Session | null> {
    return this.sessions.findById(id);
  }

  updateSessionToken(id: string, newRefreshToken: string, expiresAt: Date): Promise<Session> {
    return this.sessions.updateToken(id, newRefreshToken, expiresAt);
  }

  revokeSession(id: string): Promise<Session> {
    return this.sessions.revoke(id);
  }

  revokeSessionByToken(refreshToken: string): Promise<void> {
    return this.sessions.revokeByToken(refreshToken);
  }

  revokeAllUserSessions(userId: string): Promise<void> {
    return this.sessions.revokeAllByUserId(userId);
  }

  findActiveSessionsByUserId(userId: string): Promise<Session[]> {
    return this.sessions.findActiveByUserId(userId);
  }
}
