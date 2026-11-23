import { Injectable } from '@angular/core';
import type { TokensResponse } from '../../api/generated';

export interface StoredSession {
  readonly refreshToken: string;
  readonly refreshTokenExpiresAt: string;
  readonly sessionId: string;
}

const KEY = 'erp.session';

/**
 * Persists the refresh token. The backend returns it in the response body and expects it
 * back in `POST /auth/refresh`, so it must live in JS-readable storage; localStorage is
 * used so sessions survive reloads and are shared by tabs (refreshes are serialized
 * across tabs, see SessionSync).
 *
 * Risk accepted with mitigations: an XSS payload could read it. Mitigations are a strict
 * CSP (autoCsp hashes, no inline handlers), short-lived access tokens kept only in
 * memory, rotation on every refresh, and backend reuse detection that revokes the whole
 * session family. An httpOnly-cookie variant (or a BFF) remains the stronger option;
 * see docs/backend-contract.md. On Capacitor this moves to secure device storage.
 */
@Injectable({ providedIn: 'root' })
export class TokenStorage {
  read(): StoredSession | null {
    try {
      const raw = localStorage.getItem(KEY);
      if (!raw) {
        return null;
      }
      const value = JSON.parse(raw) as StoredSession;
      if (!value.refreshToken || Date.parse(value.refreshTokenExpiresAt) <= Date.now()) {
        this.clear();
        return null;
      }
      return value;
    } catch {
      return null;
    }
  }

  write(tokens: TokensResponse): void {
    const value: StoredSession = {
      refreshToken: tokens.refreshToken,
      refreshTokenExpiresAt: tokens.refreshTokenExpiresAt,
      sessionId: tokens.sessionId,
    };
    try {
      localStorage.setItem(KEY, JSON.stringify(value));
    } catch {
      /* storage unavailable: session lasts for this page only */
    }
  }

  clear(): void {
    try {
      localStorage.removeItem(KEY);
    } catch {
      /* ignore */
    }
  }
}
