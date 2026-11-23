import { TestBed } from '@angular/core/testing';
import { AccessStore } from '../../core/access/access.store';
import { MODULE_REGISTRY, type ModuleDef } from '../../core/modules/module-def';
import { HOME_ITEM, NavigationService } from './navigation.service';

const load = () => Promise.resolve([]);
const def = (
  id: ModuleDef['id'],
  group: ModuleDef['group'],
  mobilePriority?: number,
): ModuleDef => ({
  id,
  path: id,
  labelKey: `nav.${id}`,
  icon: 'circle',
  group,
  viewPermissions: [`${id}:x:view`],
  mobilePriority,
  loadChildren: load,
});

function setup(registry: ModuleDef[], usable = (_def: ModuleDef) => true): NavigationService {
  TestBed.configureTestingModule({
    providers: [
      { provide: MODULE_REGISTRY, useValue: registry },
      { provide: AccessStore, useValue: { canUse: usable } },
    ],
  });
  return TestBed.inject(NavigationService);
}

describe('NavigationService', () => {
  it('groups modules into sections in NAV_GROUP_ORDER and drops empty groups', () => {
    const nav = setup([
      def('core', 'administration'),
      def('fees', 'finance'),
      def('students', 'people'),
    ]);
    expect(nav.sections().map((s) => s.group)).toEqual(['people', 'finance', 'administration']);
    expect(nav.sections()[1]).toEqual({
      group: 'finance',
      labelKey: 'navGroup.finance',
      items: [{ id: 'fees', link: '/fees', labelKey: 'nav.fees', icon: 'circle' }],
    });
  });

  it('builds the phone bar from Home plus the top three prioritised modules', () => {
    const nav = setup([
      def('library', 'operations'),
      def('fees', 'finance', 3),
      def('communication', 'engagement', 4),
      def('attendance', 'academics', 1),
      def('students', 'people', 2),
    ]);
    expect(nav.bottomBar().map((i) => i.id)).toEqual([
      HOME_ITEM.id,
      'attendance',
      'students',
      'fees',
    ]);
  });

  it('shows only modules the user can use (licensed + entry permission)', () => {
    const nav = setup(
      [def('fees', 'finance', 3), def('students', 'people', 2), def('hostel', 'operations')],
      (m) => m.id !== 'fees',
    );
    expect(nav.sections().flatMap((s) => s.items.map((i) => i.id))).toEqual(['students', 'hostel']);
    expect(nav.bottomBar().map((i) => i.id)).toEqual([HOME_ITEM.id, 'students']);
  });

  it('still offers Home when no module is visible', () => {
    const nav = setup([]);
    expect(nav.sections()).toEqual([]);
    expect(nav.bottomBar()).toEqual([HOME_ITEM]);
  });
});
