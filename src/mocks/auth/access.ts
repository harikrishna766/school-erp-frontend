import type { EffectivePermission, MeAccess } from '../../app/core/access/access.model';
import { MODULES } from '../data/backend-catalog/modules.catalog';
import { ROLE_TEMPLATES, resolveRoleGrants } from '../data/backend-catalog/roles.catalog';
import { DEMO_LICENSED_MODULES, type MockUser } from '../data/users';

/** Builds /me/access exactly as the backend would from its catalog. */
export function buildAccess(user: MockUser): MeAccess {
  const effective = new Map<string, EffectivePermission['scope']>();
  for (const roleKey of user.roles) {
    const template = ROLE_TEMPLATES.find((r) => r.key === roleKey);
    if (template) {
      for (const [key, scope] of resolveRoleGrants(template)) {
        effective.set(key, scope);
      }
    }
  }
  const core = MODULES.filter((m) => m.isCore).map((m) => m.key);
  const modules =
    user.type === 'PLATFORM' ? MODULES.map((m) => m.key) : [...core, ...DEMO_LICENSED_MODULES];

  return {
    user: {
      id: user.id,
      type: user.type,
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      avatarUrl: null,
    },
    org:
      user.type === 'PLATFORM'
        ? null
        : { id: 'org-greenwood', name: 'Greenwood International School' },
    activeBranchId: user.type === 'PLATFORM' ? null : 'br-main',
    branches: user.type === 'PLATFORM' ? [] : [{ id: 'br-main', name: 'Main campus' }],
    roles: user.roles.map((key) => ({
      key,
      name: ROLE_TEMPLATES.find((r) => r.key === key)?.name ?? key,
    })),
    modules,
    permissions: [...effective].map(([key, scope]) => ({ key, scope })),
    featureFlags: { offlineAttendance: true, aiRemarks: false },
    children: user.children ?? [],
  };
}
