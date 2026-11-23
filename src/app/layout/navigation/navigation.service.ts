import { Injectable, computed, inject } from '@angular/core';
import {
  MODULE_REGISTRY,
  NAV_GROUP_ORDER,
  type ModuleDef,
  type NavGroup,
} from '../../core/modules/module-def';

export interface NavItem {
  readonly id: string;
  /** Absolute router link. */
  readonly link: string;
  readonly labelKey: string;
  readonly icon: string;
}

export interface NavSection {
  readonly group: NavGroup;
  readonly labelKey: string;
  readonly items: readonly NavItem[];
}

/** Phone bottom bar: Home + this many modules + "More" (Material: 3–5 destinations). */
export const BOTTOM_BAR_MODULES = 3;

export const HOME_ITEM: NavItem = {
  id: 'dashboard',
  link: '/dashboard',
  labelKey: 'nav.dashboard',
  icon: 'space_dashboard',
};

function toItem(def: ModuleDef): NavItem {
  return { id: def.id, link: `/${def.path}`, labelKey: def.labelKey, icon: def.icon };
}

/**
 * Builds every navigation surface (side nav sections, phone bottom bar) from the module
 * registry. Menus are never hand-written in templates.
 */
@Injectable({ providedIn: 'root' })
export class NavigationService {
  private readonly registry = inject(MODULE_REGISTRY);

  /**
   * Modules the current user may see. Deliverable 2 narrows this with the AccessStore
   * (enabled modules ∩ `viewPermission`); every surface below derives from it.
   */
  private readonly visible = computed<readonly ModuleDef[]>(() => this.registry);

  readonly sections = computed<readonly NavSection[]>(() =>
    NAV_GROUP_ORDER.map((group) => ({
      group,
      labelKey: `navGroup.${group}`,
      items: this.visible()
        .filter((m) => m.group === group)
        .map(toItem),
    })).filter((section) => section.items.length > 0),
  );

  readonly bottomBar = computed<readonly NavItem[]>(() => [
    HOME_ITEM,
    ...this.visible()
      .filter((m) => m.mobilePriority !== undefined)
      .sort((a, b) => (a.mobilePriority ?? 0) - (b.mobilePriority ?? 0))
      .slice(0, BOTTOM_BAR_MODULES)
      .map(toItem),
  ]);
}
