import type { Routes } from '@angular/router';

/** Lazy entry for the inventory module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.inventory',
    data: { labelKey: 'nav.inventory', icon: 'inventory_2' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
