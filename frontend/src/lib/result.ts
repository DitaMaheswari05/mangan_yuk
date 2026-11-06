// Result<T> dan ErrorCode — lihat docs/api/client-contracts.yaml (conventions, types).
// Service tidak melempar exception ke UI; kegagalan dikembalikan sebagai { ok: false, error }.

export type ErrorCode =
  // core
  | 'PERMISSION_DENIED'
  | 'LOCATION_UNAVAILABLE'
  | 'LOCATION_TIMEOUT'
  | 'SERVICES_DISABLED'
  | 'STORAGE_ERROR'
  | 'DATASET_INVALID'
  | 'NOT_FOUND'
  // auth
  | 'INVALID_CREDENTIALS'
  | 'EMAIL_TAKEN'
  | 'VALIDATION_ERROR'
  | 'RATE_LIMITED'
  | 'SESSION_EXPIRED'
  | 'NETWORK_ERROR';

export type AppError = { code: ErrorCode; message: string; cause?: unknown };

export type Result<T> = { ok: true; data: T } | { ok: false; error: AppError };

export const ok = <T>(data: T): Result<T> => ({ ok: true, data });

export const fail = <T = never>(code: ErrorCode, message: string, cause?: unknown): Result<T> => ({
  ok: false,
  error: { code, message, ...(cause === undefined ? {} : { cause }) },
});
