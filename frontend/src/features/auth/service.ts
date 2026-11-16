import { SECURE_KEYS, deleteSecure, loadSecure, saveSecure } from '@/storage/secure';
import type { AuthSession, AuthUser, LoginCredentials, RegisterCredentials } from './types';

const USER_SESSION_KEY = SECURE_KEYS.USER_SESSION;
const ACCESS_TOKEN_KEY = SECURE_KEYS.ACCESS_TOKEN;
const REFRESH_TOKEN_KEY = SECURE_KEYS.REFRESH_TOKEN;
const REMEMBER_ME_EMAIL_KEY = 'manganyuk_remember_me_email';

export const AuthService = {
  /**
   * Mengambil sesi login tersimpan dari SecureStore.
   */
  async getStoredSession(): Promise<AuthSession | null> {
    try {
      const sessionRaw = await loadSecure(USER_SESSION_KEY);
      if (!sessionRaw) return null;
      return JSON.parse(sessionRaw) as AuthSession;
    } catch {
      return null;
    }
  },

  /**
   * Mengambil email yang disimpan untuk opsi 'Ingat Saya'.
   */
  async getSavedEmail(): Promise<string | null> {
    try {
      return await loadSecure(REMEMBER_ME_EMAIL_KEY);
    } catch {
      return null;
    }
  },

  /**
   * Login pengguna (offline-first & backend-ready).
   */
  async login(credentials: LoginCredentials): Promise<AuthSession> {
    const trimmedEmail = credentials.email.trim().toLowerCase();
    const displayName = trimmedEmail.split('@')[0] || 'User';

    const session: AuthSession = {
      user: {
        id: `usr_${Date.now()}`,
        email: trimmedEmail,
        displayName: displayName.charAt(0).toUpperCase() + displayName.slice(1),
        createdAt: new Date().toISOString(),
      },
      tokens: {
        accessToken: `at_${Date.now()}_local`,
        refreshToken: `rt_${Date.now()}_local`,
      },
      rememberMe: credentials.rememberMe ?? false,
    };

    await saveSecure(USER_SESSION_KEY, JSON.stringify(session));
    if (session.tokens) {
      await saveSecure(ACCESS_TOKEN_KEY, session.tokens.accessToken);
      await saveSecure(REFRESH_TOKEN_KEY, session.tokens.refreshToken);
    }

    if (credentials.rememberMe) {
      await saveSecure(REMEMBER_ME_EMAIL_KEY, trimmedEmail);
    } else {
      await deleteSecure(REMEMBER_ME_EMAIL_KEY);
    }

    return session;
  },

  /**
   * Pendaftaran akun baru pengguna.
   */
  async register(credentials: RegisterCredentials): Promise<AuthSession> {
    const trimmedEmail = credentials.email.trim().toLowerCase();
    const trimmedUsername = credentials.username.trim();

    const session: AuthSession = {
      user: {
        id: `usr_${Date.now()}`,
        email: trimmedEmail,
        displayName: trimmedUsername,
        createdAt: new Date().toISOString(),
      },
      tokens: {
        accessToken: `at_${Date.now()}_local`,
        refreshToken: `rt_${Date.now()}_local`,
      },
      rememberMe: true,
    };

    await saveSecure(USER_SESSION_KEY, JSON.stringify(session));
    if (session.tokens) {
      await saveSecure(ACCESS_TOKEN_KEY, session.tokens.accessToken);
      await saveSecure(REFRESH_TOKEN_KEY, session.tokens.refreshToken);
    }

    return session;
  },

  /**
   * Logout dan hapus sesi pengguna.
   */
  async logout(): Promise<void> {
    await deleteSecure(USER_SESSION_KEY);
    await deleteSecure(ACCESS_TOKEN_KEY);
    await deleteSecure(REFRESH_TOKEN_KEY);
  },
};
