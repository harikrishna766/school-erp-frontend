import type { Routes } from '@angular/router';

/** Lazy entry for the users module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.users',
    data: { labelKey: 'nav.users', icon: 'manage_accounts' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
