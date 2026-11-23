import { TestBed } from '@angular/core/testing';
import { type Observable, Subject, of, throwError } from 'rxjs';
import { unwrapEnvelope } from '../../../core/http/api-envelope';
import { createServerTableSource } from './table-source';
import type { TableQuery } from './table.model';

interface Row {
  id: number;
}

describe('createServerTableSource', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  function create(loader: (q: TableQuery) => Observable<readonly Row[]>) {
    return TestBed.runInInjectionContext(() => createServerTableSource<Row>(loader));
  }

  it('loads immediately and reads the total from envelope meta', async () => {
    const page = unwrapEnvelope({
      success: true,
      data: [{ id: 1 }, { id: 2 }],
      meta: { mode: 'offset', page: 1, limit: 20, total: 42, totalPages: 3 },
    }) as Row[];
    const source = create(() => of(page));
    TestBed.tick();
    await vi.runAllTimersAsync();
    expect(source.status()).toBe('loaded');
    expect(source.rows()).toEqual([{ id: 1 }, { id: 2 }]);
    expect(source.total()).toBe(42);
  });

  it('debounces search but pages immediately, resetting to page 1 on search', async () => {
    const loader = vi.fn((q: TableQuery) => of([{ id: q.page }]));
    const source = create(loader);
    TestBed.tick();
    await vi.runAllTimersAsync();
    loader.mockClear();

    source.patchQuery({ q: 'r' });
    TestBed.tick();
    source.patchQuery({ q: 'ra' });
    TestBed.tick();
    source.patchQuery({ q: 'rav' });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(100);
    expect(loader).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(300);
    expect(loader).toHaveBeenCalledTimes(1);
    expect(loader.mock.calls[0][0]).toMatchObject({ q: 'rav', page: 1 });

    source.patchQuery({ page: 2 });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(loader).toHaveBeenCalledTimes(2);
  });

  it('cancels a slower, older request', async () => {
    const first = new Subject<readonly Row[]>();
    const loader = vi
      .fn()
      .mockReturnValueOnce(first)
      .mockReturnValueOnce(of([{ id: 2 }]));
    const source = create(loader);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    source.patchQuery({ page: 2 });
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    first.next([{ id: 1 }]);
    expect(source.rows()).toEqual([{ id: 2 }]);
  });

  it('exposes errors and retries on reload', async () => {
    const loader = vi
      .fn()
      .mockReturnValueOnce(throwError(() => new Error('boom')))
      .mockReturnValueOnce(of([]));
    const source = create(loader);
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(source.status()).toBe('error');
    source.reload();
    TestBed.tick();
    await vi.advanceTimersByTimeAsync(0);
    expect(source.status()).toBe('loaded');
    expect(source.isEmpty()).toBe(true);
  });
});
