import crypto from 'node:crypto';
import type { Redis } from 'ioredis';
import { AppError, ErrorCodes, UnprocessableEntityError } from '@zyvo/shared';

export interface SmsProvider {
  sendSms(phone: string, message: string): Promise<void>;
}

export class ConsoleSmsProvider implements SmsProvider {
  async sendSms(_phone: string, _message: string): Promise<void> {
    // In production, integrate with Twilio/AWS SNS/MessageBird.
    // In development and test, structured log or no-op.
  }
}

export class OtpService {
  private readonly otpTtlSeconds = 300; // 5 minutes
  private readonly otpCooldownSeconds = 60; // 1 minute
  private readonly maxOtpAttempts = 3;

  constructor(
    private readonly redis: Redis,
    private readonly secret: string,
    private readonly smsProvider: SmsProvider = new ConsoleSmsProvider()
  ) {}

  private hashOtp(code: string): string {
    return crypto.createHmac('sha256', this.secret).update(code).digest('hex');
  }

  async requestOtp(phone: string, purpose = 'LOGIN'): Promise<{ message: string; expiresIn: number }> {
    const cooldownKey = `otp:cooldown:${phone}`;
    const isCoolingDown = await this.redis.get(cooldownKey);

    if (isCoolingDown) {
      throw new AppError(
        'Too many OTP requests. Please wait before requesting another code.',
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED
      );
    }

    const code = Math.floor(100000 + Math.random() * 900000).toString();
    const codeHash = this.hashOtp(code);

    const otpData = {
      codeHash,
      attempts: 0,
      maxAttempts: this.maxOtpAttempts,
      purpose,
      createdAt: new Date().toISOString(),
    };

    const otpKey = `otp:${phone}`;
    await this.redis.set(otpKey, JSON.stringify(otpData), 'EX', this.otpTtlSeconds);
    await this.redis.set(cooldownKey, '1', 'EX', this.otpCooldownSeconds);

    await this.smsProvider.sendSms(
      phone,
      `Your ZYVO verification code is ${code}. Valid for 5 minutes.`
    );

    // Store generated OTP in test mode for automated integration test assertions
    if (process.env.NODE_ENV === 'test') {
      await this.redis.set(`otp:test:${phone}`, code, 'EX', this.otpTtlSeconds);
    }

    return {
      message: 'OTP sent successfully',
      expiresIn: this.otpTtlSeconds,
    };
  }

  async verifyOtp(phone: string, code: string): Promise<void> {
    const otpKey = `otp:${phone}`;
    const rawOtp = await this.redis.get(otpKey);

    if (!rawOtp) {
      throw new UnprocessableEntityError('Invalid or expired OTP code');
    }

    const otpData = JSON.parse(rawOtp) as {
      codeHash: string;
      attempts: number;
      maxAttempts: number;
      purpose: string;
    };

    if (otpData.attempts >= otpData.maxAttempts) {
      await this.redis.del(otpKey);
      throw new AppError(
        'Too many failed attempts. Please request a new OTP.',
        429,
        ErrorCodes.RATE_LIMIT_EXCEEDED
      );
    }

    const inputHash = this.hashOtp(code);
    if (inputHash !== otpData.codeHash) {
      otpData.attempts += 1;
      const ttl = await this.redis.ttl(otpKey);
      if (ttl > 0) {
        await this.redis.set(otpKey, JSON.stringify(otpData), 'EX', ttl);
      }
      throw new UnprocessableEntityError('Invalid OTP code');
    }

    // Successfully verified, clean up Redis keys
    await this.redis.del(otpKey);
    await this.redis.del(`otp:cooldown:${phone}`);
  }
}
