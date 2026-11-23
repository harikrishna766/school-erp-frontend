import type { Routes } from '@angular/router';

/** Lazy entry for the communication module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.communication',
    data: { labelKey: 'nav.communication', icon: 'forum' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
