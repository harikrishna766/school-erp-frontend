import type { Routes } from '@angular/router';

/** Lazy entry for the hostel module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.hostel',
    data: { labelKey: 'nav.hostel', icon: 'hotel' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
