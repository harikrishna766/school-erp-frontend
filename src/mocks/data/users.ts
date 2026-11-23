import type { AccessChild, UserType } from '../../app/core/access/access.model';
import type { RoleKey } from './backend-catalog/roles.catalog';

export interface MockUser {
  readonly id: string;
  readonly type: UserType;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly email: string | null;
  /** E.164 */
  readonly phone: string | null;
  /** null = OTP-only account (parents), as in the backend's User.passwordHash. */
  readonly password: string | null;
  readonly roles: readonly RoleKey[];
  readonly twoFactor?: boolean;
  readonly status?: 'ACTIVE' | 'DISABLED';
  readonly children?: readonly AccessChild[];
}

export const DEMO_PASSWORD = 'demo1234';
export const DEMO_CODE = '123456';

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
    children: [
      {
        studentId: 's-1',
        name: 'Aarav Reddy',
        className: 'Class 7',
        sectionName: 'A',
        photoUrl: null,
      },
      {
        studentId: 's-2',
        name: 'Diya Reddy',
        className: 'Class 3',
        sectionName: 'B',
        photoUrl: null,
      },
    ],
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
    twoFactor: true,
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
