import { inject } from '@angular/core';
import { type CanMatchFn, Router, type UrlSegment } from '@angular/router';
import { AccessStore } from '../access/access.store';
import { AuthStore } from '../auth/auth.store';

function attemptedUrl(router: Router, segments: UrlSegment[]): string {
  const extracted = router.currentNavigation()?.extractedUrl;
  return extracted ? router.serializeUrl(extracted) : `/${segments.map((s) => s.path).join('/')}`;
}

/**
 * Signed-in users only. Waits for the startup session check, then makes sure
 * `/me/access` is loaded so every child guard and the menu can read it synchronously.
 * Anonymous users go to /login?returnUrl=… .
 */
export const authGuard: CanMatchFn = async (_route, segments) => {
  const auth = inject(AuthStore);
  const access = inject(AccessStore);
  const router = inject(Router);

  await auth.whenReady();
  if (!auth.isAuthenticated()) {
    const returnUrl = attemptedUrl(router, segments);
    return router.createUrlTree(['/login'], {
      queryParams: returnUrl && returnUrl !== '/' ? { returnUrl } : {},
    });
  }
  try {
    await access.ensureLoaded();
    return true;
  } catch {
    // Signed in but access couldn't be loaded (backend down, revoked session): start over.
    auth.endSession('expired');
    return false;
  }
};

/** Login pages: a signed-in user is sent to the app instead. */
export const guestGuard: CanMatchFn = async () => {
  const auth = inject(AuthStore);
  const router = inject(Router); // before the await: see access.guards.ts
  await auth.whenReady();
  return auth.isAuthenticated() ? router.createUrlTree(['/']) : true;
};
