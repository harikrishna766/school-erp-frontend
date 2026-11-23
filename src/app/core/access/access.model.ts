/*
 * PROVISIONAL transport types for GET /me/access. The backend has the catalog
 * (school-erp-backend/src/modules/access/catalog) but no endpoint yet. When it ships,
 * replace these with the generated models; AccessStore's public API stays the same.
 * Contract: docs/backend-contract.md.
 */

/** Mirrors the backend's Prisma `DataScope` enum. */
export type DataScope = 'ALL' | 'BRANCH' | 'CLASS' | 'SECTION' | 'SELF' | 'OWN_CHILDREN';

/** Mirrors the backend's Prisma `UserType` enum. */
export type UserType = 'PLATFORM' | 'STAFF' | 'PARENT' | 'STUDENT';

export interface AccessUser {
  readonly id: string;
  readonly type: UserType;
  readonly firstName: string;
  readonly lastName: string | null;
  readonly email: string | null;
  readonly phone: string | null;
  readonly avatarUrl: string | null;
}

export interface EffectivePermission {
  /** `module:resource:action`. Expanded server-side, though `*` segments are tolerated. */
  readonly key: string;
  readonly scope: DataScope;
}

export interface AccessChild {
  readonly studentId: string;
  readonly name: string;
  readonly className: string;
  readonly sectionName: string;
  readonly photoUrl: string | null;
}

export interface MeAccess {
  readonly user: AccessUser;
  readonly org: { readonly id: string; readonly name: string } | null;
  readonly activeBranchId: string | null;
  readonly branches: readonly { readonly id: string; readonly name: string }[];
  readonly roles: readonly { readonly key: string; readonly name: string }[];
  /** Module keys enabled (licensed) for the user's organization. */
  readonly modules: readonly string[];
  readonly permissions: readonly EffectivePermission[];
  /** Backend-driven feature flags (the brief: "feature flags read from backend"). */
  readonly featureFlags: Readonly<Record<string, boolean>>;
  /** Parents only: wards the user may switch between. */
  readonly children: readonly AccessChild[];
}
