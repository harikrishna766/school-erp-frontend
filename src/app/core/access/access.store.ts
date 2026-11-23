import { HttpClient } from '@angular/common/http';
import { computed, inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withComputed,
  withMethods,
  withProps,
  withState,
} from '@ngrx/signals';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import type { ApiSuccess } from '../http/api-envelope';
import type { ModuleDef } from '../modules/module-def';
import type { DataScope, MeAccess } from './access.model';
import { checkPermissions, type PermissionMode } from './permission';

interface AccessState {
  readonly access: MeAccess | null;
  readonly status: 'idle' | 'loading' | 'loaded' | 'error';
}

const initialState: AccessState = { access: null, status: 'idle' };

/**
 * What the signed-in user may see and do: enabled modules, effective permissions (+ data
 * scope), roles, feature flags and, for parents, their children. Everything that gates UI
 * (guards, `*hasPermission`, menus) reads from here; nothing else calls `/me/access`.
 */
export const AccessStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ access }) => ({
    user: computed(() => access()?.user ?? null),
    roles: computed(() => access()?.roles ?? []),
    children: computed(() => access()?.children ?? []),
    enabledModules: computed(() => new Set(access()?.modules ?? [])),
    /** Permission key → scope. Keys may contain `*` (tolerated, matched like the backend). */
    scopes: computed(
      () => new Map((access()?.permissions ?? []).map((p) => [p.key, p.scope] as const)),
    ),
  })),
  withProps(() => ({
    /** Single in-flight load shared by guards that run concurrently. */
    _pending: { promise: null as Promise<void> | null },
  })),
  withMethods((store) => ({
    hasModule(id: string): boolean {
      return store.enabledModules().has(id);
    },

    can(required: string | readonly string[], mode: PermissionMode = 'any'): boolean {
      return checkPermissions(store.scopes().keys(), required, mode);
    },

    /** Scope of an exact permission key, e.g. to choose "my sections" vs "whole branch". */
    scopeOf(key: string): DataScope | null {
      return store.scopes().get(key) ?? null;
    },

    flag(name: string): boolean {
      return store.access()?.featureFlags[name] === true;
    },

    /** Licensed AND the user holds at least one of the module's entry permissions. */
    canUse(def: Pick<ModuleDef, 'id' | 'viewPermissions'>): boolean {
      return (
        store.enabledModules().has(def.id) &&
        checkPermissions(store.scopes().keys(), def.viewPermissions)
      );
    },
  })),
  withMethods((store, http = inject(HttpClient), config = inject(APP_CONFIG)) => {
    /** Loads once per session; concurrent callers share the request. Rejects on failure. */
    const ensureLoaded = (): Promise<void> => {
      if (store.status() === 'loaded') {
        return Promise.resolve();
      }
      store._pending.promise ??= (async () => {
        patchState(store, { status: 'loading' });
        try {
          const res = await firstValueFrom(
            http.get<ApiSuccess<MeAccess>>(`${config.apiBaseUrl}/me/access`),
          );
          patchState(store, { access: res.data, status: 'loaded' });
        } catch (error) {
          patchState(store, { status: 'error' });
          throw error;
        } finally {
          store._pending.promise = null;
        }
      })();
      return store._pending.promise;
    };

    return {
      ensureLoaded,
      /** Re-fetch, e.g. after an admin changes this user's roles or licensing. */
      async reload(): Promise<void> {
        patchState(store, { status: 'idle' });
        await ensureLoaded();
      },
      clear(): void {
        patchState(store, initialState);
      },
    };
  }),
);

export type AccessStore = InstanceType<typeof AccessStore>;
