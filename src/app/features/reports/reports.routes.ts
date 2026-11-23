import type { Routes } from '@angular/router';

/** Lazy entry for the reports module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.reports',
    data: { labelKey: 'nav.reports', icon: 'monitoring' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
