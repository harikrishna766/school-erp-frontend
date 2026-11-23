import type { Routes } from '@angular/router';

/** Lazy entry for the staff module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.staff',
    data: { labelKey: 'nav.staff', icon: 'badge' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
