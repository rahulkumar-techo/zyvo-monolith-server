import { z } from 'zod';

export const e164Regex = /^\+[1-9]\d{6,14}$/;

export const otpRequestSchema = z.object({
  phone: z.string().regex(e164Regex, 'Phone number must be in E.164 format (e.g., +919876543210)'),
  purpose: z.enum(['LOGIN', 'REGISTER']).optional(),
});

export const otpVerifySchema = z.object({
  phone: z.string().regex(e164Regex, 'Phone number must be in E.164 format (e.g., +919876543210)'),
  code: z.string().regex(/^\d{6}$/, 'OTP code must be a 6-digit numeric string'),
  deviceId: z.string().max(255).optional(),
});

export const registerSchema = z
  .object({
    name: z.string().min(1, 'Name is required').max(100),
    email: z.string().email('Invalid email address').optional(),
    phone: z.string().regex(e164Regex, 'Phone number must be in E.164 format').optional(),
    password: z.string().min(8, 'Password must be at least 8 characters').optional(),
  })
  .refine((data) => data.email || data.phone, {
    message: 'Either email or phone number must be provided for registration',
    path: ['email'],
  });

export const loginSchema = z.object({
  email: z.string().email('Invalid email address'),
  password: z.string().min(1, 'Password is required'),
});

export const refreshTokenSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .nullish();

export const logoutSchema = z
  .object({
    refreshToken: z.string().optional(),
  })
  .nullish();

export const sessionParamSchema = z.object({
  sessionId: z.string().min(1, 'Session ID is required'),
});

export type OtpRequestInput = z.infer<typeof otpRequestSchema>;
export type OtpVerifyInput = z.infer<typeof otpVerifySchema>;
export type RegisterInput = z.infer<typeof registerSchema>;
export type LoginInput = z.infer<typeof loginSchema>;
export type RefreshTokenInput = z.infer<typeof refreshTokenSchema>;
export type LogoutInput = z.infer<typeof logoutSchema>;
export type SessionParamInput = z.infer<typeof sessionParamSchema>;
