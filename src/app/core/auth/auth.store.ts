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
import { AccessStore } from '../access/access.store';
import { ToastService } from '../notify/toast.service';
import { AuthApi } from './auth.api';
import type { OtpChallengeResponse, TokenResponse } from './auth.model';
import { deviceId } from './device-id';
import { SessionSync } from './session-sync';

export type AuthStatus = 'unknown' | 'authenticated' | 'anonymous';

export type LoginOutcome =
  | { readonly kind: 'authenticated' }
  | { readonly kind: 'two-factor'; readonly challengeId: string };

interface AuthState {
  /** `unknown` until the startup refresh attempt settles. */
  readonly status: AuthStatus;
  /** Kept in memory only: never in storage, so an XSS payload can't lift it from disk. */
  readonly accessToken: string | null;
  readonly expiresAt: number | null;
}

/** Refresh this long before expiry so in-flight requests don't race the deadline. */
export const EXPIRY_SKEW_MS = 30_000;

const anonymous: AuthState = { status: 'anonymous', accessToken: null, expiresAt: null };

export const AuthStore = signalStore(
  { providedIn: 'root' },
  withState<AuthState>({ status: 'unknown', accessToken: null, expiresAt: null }),
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
      access = inject(AccessStore),
      sync = inject(SessionSync),
      router = inject(Router),
      toast = inject(ToastService),
    ) => {
      const adopt = (tokens: TokenResponse, broadcast = true): void => {
        const expiresAt = Date.now() + tokens.expiresIn * 1000;
        patchState(store, { status: 'authenticated', accessToken: tokens.accessToken, expiresAt });
        if (broadcast) {
          sync.publish({ type: 'token', accessToken: tokens.accessToken, expiresAt });
        }
      };

      const isFresh = (): boolean => {
        const exp = store.expiresAt();
        return store.accessToken() !== null && exp !== null && exp - Date.now() > EXPIRY_SKEW_MS;
      };

      /** Clears local state and sends the user to login, remembering where they were. */
      const endSession = (reason: 'logout' | 'expired'): void => {
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

      const completeLogin = async (tokens: TokenResponse): Promise<void> => {
        access.clear();
        adopt(tokens);
        await access.ensureLoaded();
      };

      const refresh = (): Promise<string> => {
        store._refresh.promise ??= sync
          .withRefreshLock(async () => {
            // Another tab may have refreshed while we waited for the lock.
            if (isFresh()) {
              return store.accessToken() as string;
            }
            const tokens = await firstValueFrom(api.refresh());
            adopt(tokens);
            return tokens.accessToken;
          })
          .finally(() => {
            store._refresh.promise = null;
          });
        return store._refresh.promise;
      };

      return {
        endSession,
        refresh,
        isFresh,

        /** Startup: resume a session from the refresh cookie, if there is one. */
        restore(): Promise<void> {
          store._ready.promise ??= refresh().then(
            () => undefined,
            () => patchState(store, anonymous),
          );
          return store._ready.promise;
        },

        /** Resolves once the startup session check has settled (guards await this). */
        whenReady(): Promise<void> {
          return store._ready.promise ?? Promise.resolve();
        },

        async loginWithPassword(identifier: string, password: string): Promise<LoginOutcome> {
          const res = await firstValueFrom(
            api.login({ identifier: identifier.trim(), password, deviceId: deviceId() }),
          );
          if (res.status === 'TWO_FACTOR_REQUIRED') {
            return { kind: 'two-factor', challengeId: res.challengeId };
          }
          await completeLogin(res);
          return { kind: 'authenticated' };
        },

        async verifyTwoFactor(challengeId: string, code: string): Promise<void> {
          await completeLogin(
            await firstValueFrom(api.verifyTwoFactor({ challengeId, code, deviceId: deviceId() })),
          );
        },

        requestOtp(phone: string): Promise<OtpChallengeResponse> {
          return firstValueFrom(api.requestOtp({ phone, channel: 'SMS' }));
        },

        async verifyOtp(challengeId: string, code: string): Promise<void> {
          await completeLogin(
            await firstValueFrom(api.verifyOtp({ challengeId, code, deviceId: deviceId() })),
          );
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
    onInit(store, sync = inject(SessionSync)) {
      sync.subscribe((message) => {
        if (message.type === 'token') {
          patchState(store, {
            status: 'authenticated',
            accessToken: message.accessToken,
            expiresAt: message.expiresAt,
          });
        } else if (store.isAuthenticated()) {
          store.endSession('logout');
        }
      });
    },
  }),
);

export type AuthStore = InstanceType<typeof AuthStore>;
