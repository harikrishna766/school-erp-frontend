import { type Signal, computed, signal } from '@angular/core';
import { takeUntilDestroyed, toObservable } from '@angular/core/rxjs-interop';
import {
  type Observable,
  catchError,
  debounce,
  distinctUntilChanged,
  map,
  of,
  pairwise,
  startWith,
  switchMap,
  timer,
} from 'rxjs';
import { pageMetaOf } from '../../../core/http/api-envelope';
import { DEFAULT_QUERY, type TableQuery, totalFromMeta } from './table.model';

export type SourceStatus = 'loading' | 'loaded' | 'error';

export interface ServerTableSource<T> {
  readonly query: Signal<TableQuery>;
  readonly rows: Signal<readonly T[]>;
  readonly total: Signal<number | null>;
  readonly status: Signal<SourceStatus>;
  readonly error: Signal<unknown>;
  readonly isEmpty: Signal<boolean>;
  setQuery(next: TableQuery): void;
  patchQuery(patch: Partial<TableQuery>): void;
  reload(): void;
}

const SEARCH_DEBOUNCE_MS = 300;

/**
 * Server-driven list state for <app-data-table>. Must be created in an injection context
 * (a component field initializer). Typing in search is debounced; every other change
 * (page, sort, filters) loads immediately; a newer query cancels the older request.
 *
 * `loader` returns the generated client's list call; the envelope's `meta` is read with
 * pageMetaOf(), so totals work without extra plumbing.
 */
export function createServerTableSource<T>(
  loader: (query: TableQuery) => Observable<readonly T[]>,
  initial: Partial<TableQuery> = {},
): ServerTableSource<T> {
  const query = signal<TableQuery>({ ...DEFAULT_QUERY, ...initial });
  const reloadTick = signal(0);
  const rows = signal<readonly T[]>([]);
  const total = signal<number | null>(null);
  const status = signal<SourceStatus>('loading');
  const error = signal<unknown>(null);

  const request = computed(() => ({ query: query(), tick: reloadTick() }));

  toObservable(request)
    .pipe(
      startWith(null),
      pairwise(),
      // Debounce only when the search text changed; paging/sorting is immediate.
      debounce(([prev, next]) =>
        prev && next && prev.query.q !== next.query.q ? timer(SEARCH_DEBOUNCE_MS) : of(0),
      ),
      map(([, next]) => next),
      distinctUntilChanged(),
      switchMap((req) => {
        status.set('loading');
        return loader((req as { query: TableQuery }).query).pipe(
          map((items) => ({ ok: true as const, items })),
          catchError((err: unknown) => of({ ok: false as const, err })),
        );
      }),
      takeUntilDestroyed(),
    )
    .subscribe((result) => {
      if (result.ok) {
        rows.set(result.items);
        total.set(totalFromMeta(pageMetaOf(result.items), result.items.length));
        error.set(null);
        status.set('loaded');
      } else {
        error.set(result.err);
        status.set('error');
      }
    });

  return {
    query: query.asReadonly(),
    rows: rows.asReadonly(),
    total: total.asReadonly(),
    status: status.asReadonly(),
    error: error.asReadonly(),
    isEmpty: computed(() => status() === 'loaded' && rows().length === 0),
    setQuery: (next) => query.set(next),
    patchQuery: (patch) =>
      query.update((current) => ({
        ...current,
        ...patch,
        // Any change other than paging goes back to page 1.
        page: patch.page ?? (Object.keys(patch).length ? 1 : current.page),
      })),
    reload: () => reloadTick.update((n) => n + 1),
  };
}
