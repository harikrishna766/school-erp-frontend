import { InjectionToken } from '@angular/core';
import type { LoadChildren } from '@angular/router';

/**
 * Module keys, identical to school-erp-backend `MODULES` (access/catalog/modules.catalog.ts).
 * They are the first segment of every permission key and what `GET /me/access` returns
 * in `modules`. The registry test fails if a key is missing or unknown.
 */
export const MODULE_IDS = [
  'platform',
  'core',
  'users',
  'admissions',
  'students',
  'hr',
  'attendance',
  'timetable',
  'academics',
  'exam',
  'fees',
  'transport',
  'library',
  'hostel',
  'inventory',
  'communication',
  'events',
  'reports',
  'ai',
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
  /**
   * The module's entry point is visible (and its route matchable) if the user holds ANY of
   * these. Lists let self-service users in: a teacher with only `hr:leave:view` still
   * gets Staff & HR for their own leave.
   */
  readonly viewPermissions: readonly string[];
  /**
   * Position in the phone bottom bar (lower = earlier). Modules without one are only
   * reachable from the "More" drawer.
   */
  readonly mobilePriority?: number;
  readonly loadChildren: LoadChildren;
}

/** The app's module registry, provided in `app.config.ts` from `module-registry.ts`. */
export const MODULE_REGISTRY = new InjectionToken<readonly ModuleDef[]>('MODULE_REGISTRY');
