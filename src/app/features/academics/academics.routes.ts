import type { Routes } from '@angular/router';

/** Lazy entry for the academics module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.academics',
    data: { labelKey: 'nav.academics', icon: 'menu_book' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
