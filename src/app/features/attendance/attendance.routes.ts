import type { Routes } from '@angular/router';

/** Lazy entry for the attendance module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.attendance',
    data: { labelKey: 'nav.attendance', icon: 'fact_check' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
