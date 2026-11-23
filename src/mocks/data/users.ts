import type { RoleKey } from './backend-catalog/roles.catalog';

/** Mock account, shaped after the backend's User + user_roles (not an API type). */
export interface MockUser {
  readonly id: string;
  readonly type: 'PLATFORM' | 'STAFF' | 'PARENT' | 'STUDENT';
  readonly firstName: string;
  readonly lastName: string | null;
  readonly email: string | null;
  /** E.164 */
  readonly phone: string | null;
  /** null = OTP-only account (parents), as in the backend's User.passwordHash. */
  readonly password: string | null;
  readonly roles: readonly RoleKey[];
  /** null for platform users. */
  readonly orgCode: string | null;
  readonly twoFactorEnabled?: boolean;
  readonly status?: 'ACTIVE' | 'DISABLED';
  readonly childStudentIds?: readonly string[];
}

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_CODE = '123456';
export const DEMO_RECOVERY_CODE = 'ABCD-EFGH-1234';
export const DEMO_ORG = {
  id: '0193f1a0-0000-7000-8000-000000000001',
  code: 'demo',
  name: 'Greenwood International School',
  subdomain: 'demo',
};
export const DEMO_BRANCHES = [
  { id: '0193f1a0-0000-7000-8000-0000000000b1', code: 'MAIN', name: 'Main campus' },
  { id: '0193f1a0-0000-7000-8000-0000000000b2', code: 'NORTH', name: 'North campus' },
];

/** Mirrors the backend's AUTH_REQUIRE_2FA_ROLES (configured for the demo). */
export const REQUIRE_2FA_ROLES: readonly RoleKey[] = ['ORG_ADMIN'];

export const MOCK_USERS: readonly MockUser[] = [
  {
    id: 'u-principal',
    type: 'STAFF',
    firstName: 'Lakshmi',
    lastName: 'Narayanan',
    email: 'principal@greenwood.test',
    phone: '+919000000001',
    password: DEMO_PASSWORD,
    roles: ['PRINCIPAL'],
    orgCode: 'demo',
  },
  {
    id: 'u-orgadmin',
    type: 'STAFF',
    firstName: 'Meera',
    lastName: 'Iyer',
    email: 'admin@greenwood.test',
    phone: null,
    password: DEMO_PASSWORD,
    roles: ['ORG_ADMIN'],
    orgCode: 'demo',
  },
  {
    id: 'u-teacher',
    type: 'STAFF',
    firstName: 'Ravi',
    lastName: 'Kumar',
    email: 'teacher@greenwood.test',
    phone: '+919000000002',
    password: DEMO_PASSWORD,
    roles: ['TEACHER'],
    orgCode: 'demo',
  },
  {
    id: 'u-accounts',
    type: 'STAFF',
    firstName: 'Anjali',
    lastName: 'Rao',
    email: 'accounts@greenwood.test',
    phone: '+919000000003',
    password: DEMO_PASSWORD,
    roles: ['ACCOUNTANT'],
    orgCode: 'demo',
  },
  {
    id: 'u-student',
    type: 'STUDENT',
    firstName: 'Aarav',
    lastName: 'Reddy',
    email: 'student@greenwood.test',
    phone: null,
    password: DEMO_PASSWORD,
    roles: ['STUDENT'],
    orgCode: 'demo',
  },
  {
    id: 'u-parent',
    type: 'PARENT',
    firstName: 'Sita',
    lastName: 'Reddy',
    email: null,
    phone: '+919876543210',
    password: null,
    roles: ['PARENT'],
    orgCode: 'demo',
    childStudentIds: ['s-1', 's-2'],
  },
  {
    id: 'u-disabled',
    type: 'STAFF',
    firstName: 'Former',
    lastName: 'Staff',
    email: 'disabled@greenwood.test',
    phone: null,
    password: DEMO_PASSWORD,
    roles: ['TEACHER'],
    orgCode: 'demo',
    status: 'DISABLED',
  },
  {
    id: 'u-superadmin',
    type: 'PLATFORM',
    firstName: 'Platform',
    lastName: 'Admin',
    email: 'admin@platform.test',
    phone: null,
    password: DEMO_PASSWORD,
    roles: ['SUPER_ADMIN'],
    orgCode: null,
    twoFactorEnabled: true,
  },
];

/**
 * Modules the demo school licenses. Hostel and AI are deliberately NOT licensed, to
 * exercise moduleGuard (an admin with every permission still can't open them).
 */
export const DEMO_LICENSED_MODULES = [
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
  'inventory',
  'communication',
  'events',
  'reports',
] as const;
