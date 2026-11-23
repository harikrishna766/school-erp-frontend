import type { Routes } from '@angular/router';

/** Lazy entry for the exams module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.exams',
    data: { labelKey: 'nav.exams', icon: 'grading' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
