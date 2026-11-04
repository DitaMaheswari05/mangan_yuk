// Aturan validasi field (kontrak 2.1). Pesan setiap issue = nama rule, jadi details bisa langsung
// dibentuk { field, rule } tanpa menerjemahkan pesan zod.
import { z } from 'zod';
import { ApiError } from '../errors';

const str = () => z.string({ required_error: 'required', invalid_type_error: 'type' });

// RFC 5322 versi sederhana: satu @, tanpa spasi, domain punya titik.
const EMAIL_RE = /^[^\s@"(),:;<>[\\\]]+@[^\s@"(),:;<>[\\\]]+\.[^\s@"(),:;<>[\\\]]+$/;

export const email = str().trim().toLowerCase().max(254, 'maxLength').regex(EMAIL_RE, 'format');

export const newPassword = str()
  .min(8, 'minLength')
  .max(72, 'maxLength')
  .regex(/[A-Za-z]/, 'letter')
  .regex(/\d/, 'digit');

/** Saat login/hapus akun, password lama tidak dicek ulang aturannya, cukup tidak kosong. */
export const anyPassword = str().min(1, 'required').max(72, 'maxLength');

export const displayName = str().trim().min(2, 'minLength').max(50, 'maxLength');

const deviceLabel = str().trim().max(100, 'maxLength').optional();
const token = str().min(1, 'required').max(200, 'maxLength');

export const registerBody = z.object({ email, password: newPassword, displayName, deviceLabel });
export const loginBody = z.object({ email, password: anyPassword, deviceLabel });
export const refreshBody = z.object({ refreshToken: token });
export const updateMeBody = z.object({ displayName });
export const forgotBody = z.object({ email });
export const resetBody = z.object({ token, newPassword });
export const deleteMeBody = z.object({ password: anyPassword });

export function parse<T extends z.ZodTypeAny>(schema: T, body: unknown): z.infer<T> {
  const result = schema.safeParse(body ?? {});
  if (result.success) return result.data;
  throw new ApiError(
    'VALIDATION_ERROR',
    result.error.issues.map((i) => ({
      field: i.path.join('.') || 'body',
      rule: i.code === 'invalid_type' && i.received === 'undefined' ? 'required' : i.message,
    })),
  );
}
