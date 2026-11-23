import type { MeAccessResponse, MePermissionDto } from '../app/api/generated';

/** Permission entry as /me/access returns it. */
export function perm(
  key: string,
  scope: MePermissionDto['scopes'][number] = 'SECTION' as never,
): MePermissionDto {
  return { key, scopes: [scope], orgWide: false, branchIds: [] };
}

/** Minimal /me/access payload for tests; override what the test cares about. */
export function meAccess(
  overrides: Partial<Omit<MeAccessResponse, 'modules' | 'permissions'>> & {
    modules?: readonly string[];
    permissions?: readonly (string | MePermissionDto)[];
  } = {},
): MeAccessResponse {
  const { modules = ['core', 'students', 'attendance'], permissions, ...rest } = overrides;
  return {
    user: {
      id: 'u1',
      type: 'STAFF' as MeAccessResponse['user']['type'],
      firstName: 'Ravi',
      lastName: 'Kumar',
      email: 'ravi@example.test',
      phone: null,
      twoFactorEnabled: false,
    },
    organization: { id: 'o1', code: 'demo', name: 'Greenwood', subdomain: 'demo' },
    activeBranchId: 'b1',
    branches: [{ id: 'b1', code: 'MAIN', name: 'Main' }],
    roles: [{ key: 'TEACHER', name: 'Teacher', branchId: null }],
    modules: modules.map((key) => ({
      key,
      name: key,
      isCore: key === 'core',
      plan: null,
      expiresAt: null,
    })),
    permissions: (permissions ?? ['students:student:view', 'attendance:student:mark']).map((p) =>
      typeof p === 'string' ? perm(p) : p,
    ),
    scope: {
      staffId: 'st1',
      studentId: null,
      sectionIds: ['sec1'],
      classTeacherSectionIds: [],
      classIds: ['c1'],
      childStudentIds: [],
    },
    twoFactorSetupRequired: false,
    ...rest,
  };
}
