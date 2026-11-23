import type { Routes } from '@angular/router';

/** Lazy entry for the library module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.library',
    data: { labelKey: 'nav.library', icon: 'local_library' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
