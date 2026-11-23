import type { PageMeta } from '../../../core/http/api-envelope';

export type SortDirection = 'asc' | 'desc';

export interface SortState {
  readonly field: string;
  readonly direction: SortDirection;
}

/**
 * Server-side list state. Maps 1:1 onto the backend's ListQueryDto
 * (school-erp-backend common/pagination/list-query.dto.ts) via `toListParams`.
 */
export interface TableQuery {
  readonly page: number;
  readonly limit: number;
  readonly sort: SortState | null;
  readonly q: string;
  readonly filters: Readonly<Record<string, string>>;
}

/** Backend MAX_PAGE_SIZE / DEFAULT_PAGE_SIZE. */
export const MAX_PAGE_SIZE = 100;
export const DEFAULT_PAGE_SIZE = 20;

export const DEFAULT_QUERY: TableQuery = {
  page: 1,
  limit: DEFAULT_PAGE_SIZE,
  sort: null,
  q: '',
  filters: {},
};

export interface TableColumn<T> {
  /** Unique id; also the sort field sent to the backend when `sortable`. */
  readonly key: string;
  /** Translation key for the header. */
  readonly header: string;
  readonly sortable?: boolean;
  /** Plain-text value; use an `*appCell="key"` template for rich content. */
  readonly value?: (row: T) => string | number | null | undefined;
  readonly align?: 'start' | 'end' | 'center';
  /** Hide on narrower screens to keep tables readable. */
  readonly hideBelow?: 'tablet' | 'desktop';
  /** On phone cards: shown as the card title. One column should set this. */
  readonly primary?: boolean;
  readonly width?: string;
}

/** Query → HTTP params for a ListQueryDto endpoint. Empty values are omitted. */
export function toListParams(query: TableQuery): Record<string, string | number> {
  const params: Record<string, string | number> = {
    page: query.page,
    limit: Math.min(query.limit, MAX_PAGE_SIZE),
  };
  if (query.sort) {
    params['sort'] = `${query.sort.field}:${query.sort.direction}`;
  }
  const q = query.q.trim();
  if (q) {
    params['q'] = q;
  }
  for (const [key, value] of Object.entries(query.filters)) {
    if (value !== '') {
      params[key] = value;
    }
  }
  return params;
}

/** Total row count from page meta (cursor pages report what has been seen plus "more"). */
export function totalFromMeta(meta: PageMeta | undefined, loaded: number): number | null {
  if (!meta) {
    return null;
  }
  return meta.mode === 'offset' ? meta.total : meta.hasMore ? null : loaded;
}
