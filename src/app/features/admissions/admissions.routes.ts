import type { Routes } from '@angular/router';

/** Lazy entry for the admissions module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.admissions',
    data: { labelKey: 'nav.admissions', icon: 'how_to_reg' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
