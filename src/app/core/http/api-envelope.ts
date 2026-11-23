import { type OperatorFunction, map } from 'rxjs';

/*
 * Mirrors school-erp-backend `src/common/dto/api-response.ts` and
 * `src/common/pagination/page-meta.ts`. These are transport wrappers, not domain DTOs —
 * domain models come from the generated client in `src/app/api/generated`.
 */

export interface OffsetPageMeta {
  readonly mode: 'offset';
  readonly page: number;
  readonly limit: number;
  readonly total: number;
  readonly totalPages: number;
}

export interface CursorPageMeta {
  readonly mode: 'cursor';
  readonly limit: number;
  readonly nextCursor: string | null;
  readonly hasMore: boolean;
}

export type PageMeta = OffsetPageMeta | CursorPageMeta;

export interface ApiSuccess<T> {
  readonly success: true;
  readonly data: T;
  readonly meta?: PageMeta;
  readonly requestId?: string;
}

export interface ApiErrorBody {
  /** Stable machine code (`VALIDATION_FAILED`, `FORBIDDEN`, …). Branch on this, never on message. */
  readonly code: string;
  readonly message: string;
  readonly details?: unknown;
}

export interface ApiFailure {
  readonly success: false;
  readonly error: ApiErrorBody;
  readonly requestId?: string;
  readonly path: string;
  readonly timestamp: string;
}

export interface Page<T> {
  readonly items: T[];
  readonly meta: PageMeta;
}

export function isApiFailure(body: unknown): body is ApiFailure {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === false &&
    typeof (body as { error?: unknown }).error === 'object'
  );
}

export function unwrap<T>(): OperatorFunction<ApiSuccess<T>, T> {
  return map((envelope) => envelope.data);
}

export function unwrapPage<T>(): OperatorFunction<ApiSuccess<T[]>, Page<T>> {
  return map((envelope) => ({
    items: envelope.data,
    meta: envelope.meta ?? {
      mode: 'offset',
      page: 1,
      limit: envelope.data.length,
      total: envelope.data.length,
      totalPages: 1,
    },
  }));
}
