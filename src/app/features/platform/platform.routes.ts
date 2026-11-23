import type { Routes } from '@angular/router';

/** Lazy entry for the platform module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.platform',
    data: { labelKey: 'nav.platform', icon: 'admin_panel_settings' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
