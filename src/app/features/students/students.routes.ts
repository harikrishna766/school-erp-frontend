import type { Routes } from '@angular/router';

/** Lazy entry for the students module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.students',
    data: { labelKey: 'nav.students', icon: 'school' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
