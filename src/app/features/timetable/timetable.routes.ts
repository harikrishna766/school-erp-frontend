import type { Routes } from '@angular/router';
import { permissionGuard } from '../../core/guards/access.guards';
import { TimetableStore } from './data/timetable.store';

/**
 * Timetable feature. The module route itself is guarded by
 * `moduleGuard('timetable') + permissionGuard(viewPermissions)` (app.routes.ts); each
 * screen adds its own permission guard. TimetableStore is provided here: one instance
 * per visit to the feature, created lazily with it.
 */
export default [
  {
    path: '',
    providers: [TimetableStore],
    children: [
      {
        path: '',
        title: 'timetable.title',
        canMatch: [permissionGuard('timetable:version:view')],
        loadComponent: () =>
          import('./pages/timetable-viewer.page').then((m) => m.TimetableViewerPage),
      },
    ],
  },
] satisfies Routes;
