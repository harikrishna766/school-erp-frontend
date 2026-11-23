import { inject } from '@angular/core';
import { type CanMatchFn, Router } from '@angular/router';
import { AccessStore } from '../access/access.store';
import type { PermissionMode } from '../access/permission';

/*
 * Every inject() happens before the first `await`: after an await the code is no longer
 * in an injection context and inject() throws NG0203.
 */

/**
 * `canMatch` (not `canActivate`) on purpose: when it fails, the router never evaluates
 * `loadChildren`, so a module the school hasn't licensed is not even downloaded.
 * Failures redirect to /forbidden with a reason, rather than falling through to 404.
 */
export function moduleGuard(moduleId: string): CanMatchFn {
  return async () => {
    const access = inject(AccessStore);
    const router = inject(Router);
    await access.ensureLoaded();
    return access.hasModule(moduleId)
      ? true
      : router.createUrlTree(['/forbidden'], {
          queryParams: { reason: 'module', module: moduleId },
        });
  };
}

/** Passes if the user holds any (default) or all of the given permissions. */
export function permissionGuard(
  required: string | readonly string[],
  mode: PermissionMode = 'any',
): CanMatchFn {
  return async () => {
    const access = inject(AccessStore);
    const router = inject(Router);
    await access.ensureLoaded();
    return access.can(required, mode)
      ? true
      : router.createUrlTree(['/forbidden'], { queryParams: { reason: 'permission' } });
  };
}
