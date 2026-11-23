import type { MeAccessResponse, MePermissionDto } from '../../api/generated';

/*
 * /me/access types come from the generated client (OpenAPI). These aliases only give
 * the app stable, readable names.
 */
export type MeAccess = MeAccessResponse;
export type EffectivePermission = MePermissionDto;

/** Backend DataScope enum values (MePermissionDto.scopes). */
export type DataScope = `${MePermissionDto['scopes'][number]}`;

/** Backend UserType values. */
export type UserType = 'PLATFORM' | 'STAFF' | 'PARENT' | 'STUDENT';
