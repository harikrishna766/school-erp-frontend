import type { MeAccess } from '../app/core/access/access.model';

/** Minimal /me/access payload for tests; override what the test cares about. */
export function meAccess(overrides: Partial<MeAccess> = {}): MeAccess {
  return {
    user: {
      id: 'u1',
      type: 'STAFF',
      firstName: 'Ravi',
      lastName: 'Kumar',
      email: 'ravi@example.test',
      phone: null,
      avatarUrl: null,
    },
    org: { id: 'o1', name: 'Greenwood' },
    activeBranchId: 'b1',
    branches: [{ id: 'b1', name: 'Main' }],
    roles: [{ key: 'TEACHER', name: 'Teacher' }],
    modules: ['core', 'students', 'attendance'],
    permissions: [
      { key: 'students:student:view', scope: 'SECTION' },
      { key: 'attendance:student:mark', scope: 'SECTION' },
    ],
    featureFlags: { offlineAttendance: true },
    children: [],
    ...overrides,
  };
}
