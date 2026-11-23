import type { Routes } from '@angular/router';

/** Lazy entry for the transport module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.transport',
    data: { labelKey: 'nav.transport', icon: 'directions_bus' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
