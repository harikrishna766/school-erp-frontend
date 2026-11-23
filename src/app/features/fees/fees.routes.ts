import type { Routes } from '@angular/router';

/** Lazy entry for the fees module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.fees',
    data: { labelKey: 'nav.fees', icon: 'payments' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
