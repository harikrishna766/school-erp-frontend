/*
 * Mirrors school-erp-backend `src/common/dto/api-response.ts` and
 * `src/common/pagination/page-meta.ts`. These are transport wrappers, not domain DTOs:
 * domain models come from the generated client in `src/app/api/generated`.
 *
 * The backend's OpenAPI document describes *unwrapped* bodies, so `envelopeInterceptor`
 * unwraps `{ success, data, meta }` before the generated client sees it, and list
 * `meta` is recoverable with `pageMetaOf(items)`.
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

const PAGE_META = new WeakMap<object, PageMeta>();

/** Pagination meta of a list returned by the API (see envelopeInterceptor). */
export function pageMetaOf(items: readonly unknown[]): PageMeta | undefined {
  return PAGE_META.get(items);
}

export function isApiSuccess(body: unknown): body is ApiSuccess<unknown> {
  return (
    typeof body === 'object' &&
    body !== null &&
    (body as { success?: unknown }).success === true &&
    'data' in body
  );
}

/** Unwraps an envelope body, remembering list meta. Non-envelope bodies pass through. */
export function unwrapEnvelope(body: unknown): unknown {
  if (!isApiSuccess(body)) {
    return body;
  }
  const { data, meta } = body;
  if (meta && typeof data === 'object' && data !== null) {
    PAGE_META.set(data, meta);
  }
  return data;
}
