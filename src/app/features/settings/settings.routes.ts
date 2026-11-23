import type { Routes } from '@angular/router';

/** Lazy entry for the settings module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.settings',
    data: { labelKey: 'nav.settings', icon: 'settings' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
