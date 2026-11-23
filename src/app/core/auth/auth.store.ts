import { computed, inject } from '@angular/core';
import { Router } from '@angular/router';
import {
  patchState,
  signalStore,
  withComputed,
  withHooks,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import type { LoginResponse, TokensResponse } from '../../api/generated';
import { AccessStore } from '../access/access.store';
import { ToastService } from '../notify/toast.service';
import { TenantContext } from '../tenant/tenant-context';
import { AuthApi } from './auth.api';
import { SessionSync } from './session-sync';
import { TokenStorage } from './token-storage';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

export type LoginOutcome =
  | { readonly kind: 'authenticated' }
  | { readonly kind: 'two-factor'; readonly challengeToken: string };

export type SecondFactor = { readonly code: string } | { readonly recoveryCode: string };

interface AuthState {
  /** `unknown` until the startup session check settles. */
  readonly status: AuthStatus;
  /** Kept in memory only. */
  readonly accessToken: string | null;
  readonly expiresAt: number | null;
  readonly sessionId: string | null;
}

/** Refresh this long before expiry so in-flight requests don't race the deadline. */
export const EXPIRY_SKEW_MS = 30_000;

const anonymous: AuthState = {
  status: 'anonymous',
  accessToken: null,
  expiresAt: null,
  sessionId: null,
};

/** Thrown when an action needs a school (tenant) but none is known. */
export class MissingSchoolError extends Error {
  constructor() {
    super('School code required');
  }
}

/**
 * The OpenAPI `LoginResponse` merges both outcomes, so token fields are optional in the
 * type. Validate instead of casting.
 */
export function tokensFromLogin(res: LoginResponse): TokensResponse {
  const { accessToken, accessTokenExpiresAt, refreshToken, refreshTokenExpiresAt, sessionId } = res;
  if (
    !accessToken ||
    !accessTokenExpiresAt ||
    !refreshToken ||
    !refreshTokenExpiresAt ||
    !sessionId
  ) {
    throw new Error('Login response is missing tokens');
  }
  return {
    tokenType: 'Bearer' as TokensResponse['tokenType'],
    accessToken,
    accessTokenExpiresAt,
    refreshToken,
    refreshTokenExpiresAt,
    sessionId,
  };
}

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ ...anonymous, status: 'unknown' }),
  withComputed(({ status }) => ({
    isAuthenticated: computed(() => status() === 'authenticated'),
  })),
  withProps(() => ({
    _refresh: { promise: null as Promise<string> | null },
    _ready: { promise: null as Promise<void> | null },
  })),
  withMethods(
    (
      store,
      api = inject(AuthApi),
      storage = inject(TokenStorage),
      access = inject(AccessStore),
      tenant = inject(TenantContext),
      sync = inject(SessionSync),
      router = inject(Router),
      toast = inject(ToastService),
    ) => {
      const adopt = (tokens: TokensResponse): void => {
        const expiresAt = Date.parse(tokens.accessTokenExpiresAt);
        storage.write(tokens);
        patchState(store, {
          status: 'authenticated',
          accessToken: tokens.accessToken,
          expiresAt,
          sessionId: tokens.sessionId,
        });
        sync.publish({
          type: 'token',
          accessToken: tokens.accessToken,
          expiresAt,
          sessionId: tokens.sessionId,
        });
      };

      const isFresh = (): boolean => {
        const exp = store.expiresAt();
        return store.accessToken() !== null && exp !== null && exp - Date.now() > EXPIRY_SKEW_MS;
      };

      /** Clears local state and sends the user to login, remembering where they were. */
      const endSession = (reason: 'logout' | 'expired'): void => {
        storage.clear();
        patchState(store, anonymous);
        access.clear();
        if (reason === 'expired') {
          toast.error('auth.sessionExpired');
        }
        const current = router.url;
        if (!current.startsWith('/login')) {
          const returnUrl = reason === 'expired' && current !== '/' ? current : undefined;
          void router.navigate(['/login'], { queryParams: returnUrl ? { returnUrl } : {} });
        }
      };

      const completeLogin = async (tokens: TokensResponse): Promise<void> => {
        access.clear();
        adopt(tokens);
        await access.ensureLoaded();
      };

      /**
       * Rotates the refresh token. Serialized across tabs: inside the lock the latest
       * stored refresh token is re-read, so a token another tab already rotated is never
       * presented twice (the backend would revoke the session family: REFRESH_TOKEN_REUSED).
       */
      const refresh = (): Promise<string> => {
        store._refresh.promise ??= sync
          .withRefreshLock(async () => {
            if (isFresh()) {
              return store.accessToken() as string;
            }
            const stored = storage.read();
            if (!stored) {
              throw new Error('No refresh token');
            }
            const tokens = await firstValueFrom(api.refresh(stored.refreshToken));
            adopt(tokens);
            return tokens.accessToken;
          })
          .finally(() => {
            store._refresh.promise = null;
          });
        return store._refresh.promise;
      };

      const orgCode = (): string => {
        const slug = tenant.slug();
        if (!slug) {
          throw new MissingSchoolError();
        }
        return slug;
      };

      return {
        endSession,
        refresh,
        isFresh,

        /** Startup: resume a stored session. No network call when there is none. */
        restore(): Promise<void> {
          store._ready.promise ??= storage.read()
            ? refresh().then(
                () => undefined,
                () => {
                  storage.clear();
                  patchState(store, anonymous);
                },
              )
            : Promise.resolve(patchState(store, anonymous));
          return store._ready.promise;
        },

        /** Resolves once the startup session check has settled (guards await this). */
        whenReady(): Promise<void> {
          return store._ready.promise ?? Promise.resolve();
        },

        /** Staff/students. `platform` = super-admin sign-in without a school. */
        async loginWithPassword(
          email: string,
          password: string,
          options: { platform?: boolean } = {},
        ): Promise<LoginOutcome> {
          const res = await firstValueFrom(
            api.login(
              email.trim().toLowerCase(),
              password,
              options.platform ? undefined : orgCode(),
            ),
          );
          if (res.twoFactorRequired) {
            if (!res.challengeToken) {
              throw new Error('Two-factor challenge missing');
            }
            return { kind: 'two-factor', challengeToken: res.challengeToken };
          }
          await completeLogin(tokensFromLogin(res));
          return { kind: 'authenticated' };
        },

        async verifyTwoFactor(challengeToken: string, factor: SecondFactor): Promise<void> {
          await completeLogin(await firstValueFrom(api.verifyTwoFactor(challengeToken, factor)));
        },

        /** Parents. Returns the code's lifetime in seconds. */
        async requestOtp(phone: string): Promise<number> {
          const res = await firstValueFrom(api.requestOtp(orgCode(), phone));
          return res.expiresInSec ?? 300;
        },

        async verifyOtp(phone: string, code: string): Promise<void> {
          await completeLogin(await firstValueFrom(api.verifyOtp(orgCode(), phone, code)));
        },

        async logout(): Promise<void> {
          try {
            await firstValueFrom(api.logout());
          } catch {
            // The server session may already be gone; local logout must still happen.
          }
          sync.publish({ type: 'logout' });
          endSession('logout');
        },
      };
    },
  ),
  withHooks({
    onInit(store, sync = inject(SessionSync), access = inject(AccessStore)) {
      sync.subscribe((message) => {
        if (message.type === 'token') {
          patchState(store, {
            status: 'authenticated',
            accessToken: message.accessToken,
            expiresAt: message.expiresAt,
            sessionId: message.sessionId,
          });
        } else if (store.isAuthenticated()) {
          // The originating tab already cleared shared storage and told the server.
          patchState(store, anonymous);
          access.clear();
          store.endSession('logout');
        }
      });
    },
  }),
);

export type AuthStore = InstanceType<typeof AuthStore>;
