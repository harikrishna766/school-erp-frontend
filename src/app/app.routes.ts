import type { Route, Routes } from '@angular/router';
import type { ModuleDef } from './core/modules/module-def';
import { APP_MODULES } from './module-registry';

/**
 * One lazy route per registered module. Deliverable 2 adds
 * `canMatch: [moduleGuard(def.id), permissionGuard(def.viewPermission)]` here, so a
 * disabled module's chunk is never requested.
 */
function moduleRoute(def: ModuleDef): Route {
  return { path: def.path, loadChildren: def.loadChildren };
}

export const routes: Routes = [
  {
    path: '',
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
        path: '**',
        title: 'notFound.heading',
        loadComponent: () =>
          import('./layout/not-found/not-found-page').then((m) => m.NotFoundPage),
      },
    ],
  },
];
