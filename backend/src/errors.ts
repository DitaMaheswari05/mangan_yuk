export type ApiErrorCode =
  | 'VALIDATION_ERROR'
  | 'INVALID_CREDENTIALS'
  | 'TOKEN_EXPIRED'
  | 'TOKEN_INVALID'
  | 'REFRESH_REUSE_DETECTED'
  | 'EMAIL_TAKEN'
  | 'NOT_FOUND'
  | 'RATE_LIMITED'
  | 'INTERNAL_ERROR';

export interface ValidationDetail {
  field: string;
  rule: string;
}

const STATUS: Record<ApiErrorCode, number> = {
  VALIDATION_ERROR: 400,
  INVALID_CREDENTIALS: 401,
  TOKEN_EXPIRED: 401,
  TOKEN_INVALID: 401,
  REFRESH_REUSE_DETECTED: 401,
  NOT_FOUND: 404,
  EMAIL_TAKEN: 409,
  RATE_LIMITED: 429,
  INTERNAL_ERROR: 500,
};

const MESSAGE: Record<ApiErrorCode, string> = {
  VALIDATION_ERROR: 'Data yang dikirim tidak valid.',
  INVALID_CREDENTIALS: 'Email atau password salah.',
  TOKEN_EXPIRED: 'Sesi kedaluwarsa.',
  TOKEN_INVALID: 'Token tidak valid.',
  REFRESH_REUSE_DETECTED: 'Sesi tidak aman terdeteksi, silakan masuk lagi.',
  NOT_FOUND: 'Endpoint tidak ditemukan.',
  EMAIL_TAKEN: 'Email sudah terdaftar.',
  RATE_LIMITED: 'Terlalu banyak percobaan, coba lagi nanti.',
  INTERNAL_ERROR: 'Terjadi kesalahan pada server.',
};

export class ApiError extends Error {
  readonly status: number;

  constructor(
    readonly code: ApiErrorCode,
    readonly details: ValidationDetail[] = [],
    /** Detik sampai boleh mencoba lagi; hanya untuk RATE_LIMITED. */
    readonly retryAfterSec?: number,
  ) {
    super(MESSAGE[code]);
    this.status = STATUS[code];
  }

  toBody() {
    return { error: { code: this.code, message: this.message, details: this.details } };
  }
}
