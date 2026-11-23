import { DEFAULT_QUERY, toListParams, totalFromMeta } from './table.model';

describe('table model', () => {
  it('maps a query onto the backend ListQueryDto params', () => {
    expect(
      toListParams({
        page: 3,
        limit: 500,
        sort: { field: 'lastName', direction: 'asc' },
        q: '  ravi ',
        filters: { sectionId: 'sec-1', status: '' },
      }),
    ).toEqual({ page: 3, limit: 100, sort: 'lastName:asc', q: 'ravi', sectionId: 'sec-1' });
    expect(toListParams(DEFAULT_QUERY)).toEqual({ page: 1, limit: 20 });
  });

  it('derives totals from offset and cursor meta', () => {
    expect(
      totalFromMeta({ mode: 'offset', page: 1, limit: 20, total: 41, totalPages: 3 }, 20),
    ).toBe(41);
    expect(
      totalFromMeta({ mode: 'cursor', limit: 20, hasMore: true, nextCursor: 'x' }, 20),
    ).toBeNull();
    expect(totalFromMeta({ mode: 'cursor', limit: 20, hasMore: false, nextCursor: null }, 7)).toBe(
      7,
    );
    expect(totalFromMeta(undefined, 3)).toBeNull();
  });
});
