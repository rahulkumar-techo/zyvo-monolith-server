import crypto from 'node:crypto';

export interface TokenServiceJwt {
  sign: (payload: object, options?: object) => string;
  verify: <T extends object>(token: string) => Promise<T>;
}

export class TokenService {
  private readonly defaultAccessTtl = 900; // 15 minutes
  private readonly defaultRefreshTtlDays = 30; // 30 days

  constructor(private readonly jwt: TokenServiceJwt) {}

  generateRefreshToken(): string {
    return crypto.randomBytes(32).toString('hex');
  }

  calculateExpiryDate(days: number = this.defaultRefreshTtlDays): Date {
    const date = new Date();
    date.setDate(date.getDate() + days);
    return date;
  }

  signAccessToken(
    userId: string,
    sessionId: string,
    role: string,
    expiresInSeconds: number = this.defaultAccessTtl
  ): string {
    return this.jwt.sign(
      {
        sub: userId,
        sessionId,
        role,
      },
      { expiresIn: `${expiresInSeconds}s` }
    );
  }

  async verifyAccessToken<T extends object>(token: string): Promise<T> {
    return this.jwt.verify<T>(token);
  }

  get accessTtlSeconds(): number {
    return this.defaultAccessTtl;
  }

  get refreshTtlDays(): number {
    return this.defaultRefreshTtlDays;
  }
}
