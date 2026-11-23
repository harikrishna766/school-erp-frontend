import type { Routes } from '@angular/router';

/** Lazy entry for the events module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.events',
    data: { labelKey: 'nav.events', icon: 'event' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
