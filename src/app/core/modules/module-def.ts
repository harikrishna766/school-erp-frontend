import { InjectionToken } from '@angular/core';
import type { LoadChildren } from '@angular/router';

/** Licensable feature modules. Ids match the backend's module keys (`GET /me/access`). */
export const MODULE_IDS = [
  'admissions',
  'students',
  'staff',
  'attendance',
  'timetable',
  'academics',
  'exams',
  'fees',
  'transport',
  'library',
  'hostel',
  'inventory',
  'communication',
  'events',
  'reports',
  'settings',
  'ai-assistant',
] as const;

export type ModuleId = (typeof MODULE_IDS)[number];

export type NavGroup =
  'people' | 'academics' | 'finance' | 'operations' | 'engagement' | 'administration';

export const NAV_GROUP_ORDER: readonly NavGroup[] = [
  'people',
  'academics',
  'finance',
  'operations',
  'engagement',
  'administration',
];

/**
 * Static metadata for one feature module. The router and the navigation menu are both
 * generated from the registry, so a module is added in exactly one place.
 */
export interface ModuleDef {
  readonly id: ModuleId;
  /** URL segment under the shell, e.g. `fees` → `/fees`. */
  readonly path: string;
  /** ngx-translate key for the menu label and page title. */
  readonly labelKey: string;
  /** Material Symbols ligature. Must also be listed in index.html's icon subset. */
  readonly icon: string;
  readonly group: NavGroup;
  /** Permission needed to see the module's entry point, e.g. `fees:invoice:view`. */
  readonly viewPermission: string;
  /**
   * Position in the phone bottom bar (lower = earlier). Modules without one are only
   * reachable from the "More" drawer.
   */
  readonly mobilePriority?: number;
  readonly loadChildren: LoadChildren;
}

/** The app's module registry, provided in `app.config.ts` from `module-registry.ts`. */
export const MODULE_REGISTRY = new InjectionToken<readonly ModuleDef[]>('MODULE_REGISTRY');
