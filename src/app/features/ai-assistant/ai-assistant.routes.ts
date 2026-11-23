import type { Routes } from '@angular/router';

/** Lazy entry for the ai-assistant module. Replaced with real pages when the feature is built. */
export default [
  {
    path: '',
    title: 'nav.aiAssistant',
    data: { labelKey: 'nav.aiAssistant', icon: 'auto_awesome' },
    loadComponent: () =>
      import('../../shared/ui/module-placeholder/module-placeholder-page').then(
        (m) => m.ModulePlaceholderPage,
      ),
  },
] satisfies Routes;
