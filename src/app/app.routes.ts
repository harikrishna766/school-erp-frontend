import type { Route, Routes } from '@angular/router';
import { moduleGuard, permissionGuard } from './core/guards/access.guards';
import { authGuard, enrolmentGuard, guestGuard } from './core/guards/auth.guards';
import type { ModuleDef } from './core/modules/module-def';
import { APP_MODULES } from './module-registry';

/**
 * One lazy route per registered module, guarded exactly as the brief specifies:
 * `canMatch: [moduleGuard(id), permissionGuard(viewPermissions)]`. Because these are
 * canMatch guards, a module the user can't use is never downloaded. Feature routes add
 * their own per-screen `permissionGuard`s inside their routes file.
 */
function moduleRoute(def: ModuleDef): Route {
  return {
    path: def.path,
    canMatch: [moduleGuard(def.id), permissionGuard(def.viewPermissions)],
    loadChildren: def.loadChildren,
  };
}

export const routes: Routes = [
  {
    path: 'login',
    title: 'auth.title',
    canMatch: [guestGuard],
    loadComponent: () => import('./layout/auth/login-page').then((m) => m.LoginPage),
  },
  {
    path: 'security/two-factor',
    title: 'twoFactor.title',
    canMatch: [enrolmentGuard],
    loadComponent: () =>
      import('./layout/auth/two-factor-setup-page').then((m) => m.TwoFactorSetupPage),
  },
  {
    path: '',
    canMatch: [authGuard],
    loadComponent: () => import('./layout/shell/shell').then((m) => m.Shell),
    children: [
      { path: '', pathMatch: 'full', redirectTo: 'dashboard' },
      {
        path: 'dashboard',
        title: 'nav.dashboard',
        loadComponent: () =>
          import('./layout/dashboards/dashboard-page').then((m) => m.DashboardPage),
      },
      ...APP_MODULES.map(moduleRoute),
      {
        path: 'forbidden',
        title: 'forbidden.title',
        loadComponent: () =>
          import('./layout/forbidden/forbidden-page').then((m) => m.ForbiddenPage),
      },
      {
        path: '**',
        title: 'notFound.heading',
        loadComponent: () =>
          import('./layout/not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
  // Only reached if authGuard returned false (it normally redirects).
  { path: '**', redirectTo: 'login' },
];
