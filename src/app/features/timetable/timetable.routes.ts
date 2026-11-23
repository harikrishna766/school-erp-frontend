import type { Routes } from '@angular/router';

/** Lazy entry for the timetable module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.timetable',
    data: { labelKey: 'nav.timetable', icon: 'calendar_view_week' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
