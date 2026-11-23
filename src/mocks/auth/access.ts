import type { MeAccessResponse, MePermissionDto } from '../../app/api/generated';
import { MODULES } from '../data/backend-catalog/modules.catalog';
import { ROLE_TEMPLATES, resolveRoleGrants } from '../data/backend-catalog/roles.catalog';
import {
  DEMO_BRANCHES,
  DEMO_LICENSED_MODULES,
  DEMO_ORG,
  REQUIRE_2FA_ROLES,
  type MockUser,
} from '../data/users';
import { isTwoFactorEnabled } from './session-store';

/** Builds GET /me/access the way the backend's MeController does, from its catalog. */
export function buildAccess(user: MockUser, activeBranchId: string | null): MeAccessResponse {
  const grants = new Map<string, Set<string>>();
  for (const roleKey of user.roles) {
    const template = ROLE_TEMPLATES.find((r) => r.key === roleKey);
    if (template) {
      for (const [key, scope] of resolveRoleGrants(template)) {
        if (!grants.has(key)) grants.set(key, new Set());
        grants.get(key)?.add(scope);
      }
    }
  }
  const platform = user.type === 'PLATFORM';
  const moduleKeys = platform
    ? MODULES.map((m) => m.key)
    : [...MODULES.filter((m) => m.isCore).map((m) => m.key), ...DEMO_LICENSED_MODULES];
  const twoFactorEnabled = isTwoFactorEnabled(user.id, user.twoFactorEnabled === true);
  const branches = platform ? [] : DEMO_BRANCHES;

  return {
    user: {
      id: user.id,
      type: user.type as MeAccessResponse['user']['type'],
      firstName: user.firstName,
      lastName: user.lastName,
      email: user.email,
      phone: user.phone,
      twoFactorEnabled,
    },
    organization: platform ? null : DEMO_ORG,
    activeBranchId: platform
      ? null
      : (branches.find((b) => b.id === activeBranchId)?.id ?? branches[0].id),
    branches,
    roles: user.roles.map((key) => ({
      key,
      name: ROLE_TEMPLATES.find((r) => r.key === key)?.name ?? key,
      branchId: null,
    })),
    modules: moduleKeys.map((key) => {
      const def = MODULES.find((m) => m.key === key);
      return {
        key,
        name: def?.name ?? key,
        isCore: def?.isCore ?? false,
        plan: null,
        expiresAt: null,
      };
    }),
    permissions: [...grants]
      .map(([key, scopes]): MePermissionDto => ({
        key,
        scopes: [...scopes].sort() as MePermissionDto['scopes'],
        orgWide: scopes.has('ALL'),
        branchIds: [],
      }))
      .sort((a, b) => a.key.localeCompare(b.key)),
    scope: {
      staffId: user.type === 'STAFF' ? `staff-${user.id}` : null,
      studentId: user.type === 'STUDENT' ? 's-1' : null,
      sectionIds: user.roles.includes('TEACHER') ? ['sec-7a', 'sec-8b'] : [],
      classTeacherSectionIds: [],
      classIds: user.roles.includes('TEACHER') ? ['cls-7', 'cls-8'] : [],
      childStudentIds: [...(user.childStudentIds ?? [])],
    },
    twoFactorSetupRequired:
      !twoFactorEnabled && user.roles.some((r) => REQUIRE_2FA_ROLES.includes(r)),
  };
}
