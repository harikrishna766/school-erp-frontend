import { HttpContext } from '@angular/common/http';
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
import { MeService } from '../../api/generated/api/me.service';
import { SKIP_ERROR_TOAST } from '../http/http-context';
import type { ModuleDef } from '../modules/module-def';
import { BranchContext } from '../tenant/branch-context';
import type { DataScope, EffectivePermission, MeAccess } from './access.model';
import { checkPermissions, type PermissionMode } from './permission';

interface AccessState {
  readonly access: MeAccess | null;
  readonly status: 'idle' | 'loading' | 'loaded' | 'error';
}

const initialState: AccessState = { access: null, status: 'idle' };

/**
 * What the signed-in user may see and do, from GET /me/access: enabled modules,
 * effective permissions (with scopes and branch limits), roles, branches and the
 * user's relations (sections taught, children). Guards, `*hasPermission` and menus all
 * read from here; nothing else calls /me/access.
 */
export const AccessStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withComputed(({ access }) => ({
    user: computed(() => access()?.user ?? null),
    organization: computed(() => access()?.organization ?? null),
    roles: computed(() => access()?.roles ?? []),
    branches: computed(() => access()?.branches ?? []),
    relations: computed(() => access()?.scope ?? null),
    twoFactorSetupRequired: computed(() => access()?.twoFactorSetupRequired === true),
    enabledModules: computed(() => new Set((access()?.modules ?? []).map((m) => m.key))),
    permissions: computed(
      () =>
        new Map<string, EffectivePermission>(
          (access()?.permissions ?? []).map((p) => [p.key, p] as const),
        ),
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
      return checkPermissions(store.permissions().keys(), required, mode);
    },

    /** Data scopes granted for an exact permission key (e.g. SECTION vs BRANCH). */
    scopesOf(key: string): readonly DataScope[] {
      return (store.permissions().get(key)?.scopes ?? []) as readonly DataScope[];
    },

    /** Licensed AND the user holds at least one of the module's entry permissions. */
    canUse(def: Pick<ModuleDef, 'id' | 'viewPermissions'>): boolean {
      return (
        store.enabledModules().has(def.id) &&
        checkPermissions(store.permissions().keys(), def.viewPermissions)
      );
    },
  })),
  withMethods((store, me = inject(MeService), branch = inject(BranchContext)) => {
    /** Loads once per session; concurrent callers share the request. Rejects on failure. */
    const ensureLoaded = (): Promise<void> => {
      if (store.status() === 'loaded') {
        return Promise.resolve();
      }
      store._pending.promise ??= (async () => {
        patchState(store, { status: 'loading' });
        try {
          const access = await firstValueFrom(
            me.meControllerAccessV1('body', false, {
              context: new HttpContext().set(SKIP_ERROR_TOAST, true),
            }),
          );
          // Keep the chosen branch if still allowed; else adopt the server's default.
          const chosen = branch.id();
          if (!chosen || !access.branches.some((b) => b.id === chosen)) {
            branch.set(access.activeBranchId ?? null);
          }
          patchState(store, { access, status: 'loaded' });
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
      /** Re-fetch, e.g. after switching branch or an admin changing roles/licensing. */
      async reload(): Promise<void> {
        patchState(store, { status: 'idle' });
        await ensureLoaded();
      },
      /** Switch the active branch (sent as x-branch-id) and reload access for it. */
      async switchBranch(id: string): Promise<void> {
        branch.set(id);
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
