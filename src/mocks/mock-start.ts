import type { Provider } from '@angular/core';

/**
 * Production/dev stub. The `mock` build configuration swaps this file for
 * `mock-start.mock.ts` (angular.json fileReplacements), so MSW and mock providers are
 * never compiled into a real build.
 */
export async function startMocks(): Promise<Provider[]> {
  return [];
}
