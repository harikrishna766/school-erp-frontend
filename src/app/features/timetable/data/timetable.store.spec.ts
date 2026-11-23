import { HttpErrorResponse } from '@angular/common/http';
import { TestBed } from '@angular/core/testing';
import { Subject, of, throwError } from 'rxjs';
import { DRAFT, ENTRIES, LOOKUPS, PUBLISHED, entry } from '../testing/fixtures';
import { cellKey } from './grid-model';
import { TimetableApi } from './timetable.api';
import type { MoveRequest, TimetableEntry, ValidateResult } from './timetable.models';
import { TimetableStore, applyMoveLocally, inverseOf } from './timetable.store';

describe('TimetableStore', () => {
  const api = {
    lookups: vi.fn(() => of(LOOKUPS)),
    versions: vi.fn(() => of([PUBLISHED, DRAFT])),
    entries: vi.fn(() => of([...ENTRIES])),
    conflicts: vi.fn(() => of([])),
    move: vi.fn(),
    setLocked: vi.fn(),
  };
  let store: TimetableStore;

  beforeEach(async () => {
    vi.clearAllMocks();
    TestBed.configureTestingModule({
      providers: [TimetableStore, { provide: TimetableApi, useValue: api }],
    });
    store = TestBed.inject(TimetableStore);
    await store.init();
  });

  /**
   * Fake server with its own state, like the real one: the store has already applied the
   * optimistic change locally when the request arrives, so the server must not read it.
   */
  let serverEntries: readonly TimetableEntry[] = ENTRIES;
  const fakeServer = (_versionId: string, request: MoveRequest) => {
    const after = applyMoveLocally(serverEntries, request);
    const changed = after.filter((e) => !serverEntries.includes(e));
    serverEntries = after;
    return of<ValidateResult>({ changed, conflicts: [] });
  };
  beforeEach(() => {
    serverEntries = ENTRIES;
  });

  it('opens the draft version with the first section in view', () => {
    expect(store.status()).toBe('ready');
    expect(store.activeVersionId()).toBe(DRAFT.id);
    expect(store.isEditable()).toBe(true);
    expect(store.view()).toEqual({ mode: 'section', targetId: 's1' });
    expect([...store.cells().keys()].sort()).toEqual([cellKey(1, 0), cellKey(1, 2), cellKey(2, 0)]);
  });

  it('filters by teacher and labels entries for that view', () => {
    store.setView({ mode: 'teacher', targetId: 't2' });
    const cells = store.cells();
    expect(cells.get(cellKey(1, 0))?.[0]).toMatchObject({ id: 'e3', subtitle: '7-B · Room 1' });
    expect(cells.get(cellKey(1, 2))?.[0].title).toBe('ENG');
  });

  it('setMode picks the first target of the new mode', () => {
    store.setMode('room');
    expect(store.view()).toEqual({ mode: 'room', targetId: 'r1' });
    expect(store.targets()).toEqual(LOOKUPS.rooms);
  });

  it('moves optimistically, then applies the server result and conflicts', async () => {
    const server = new Subject<ValidateResult>();
    api.move.mockReturnValue(server);
    const done = store.move('e1', 2, 2);
    expect(store.entries().find((e) => e.id === 'e1')).toMatchObject({ day: 2, slotIndex: 2 });
    expect(store.saving()).toBe(true);
    server.next({
      changed: [entry({ id: 'e1', day: 2, slotIndex: 2 })],
      conflicts: [
        {
          kind: 'OUTSIDE_TEMPLATE',
          severity: 'HARD',
          entryIds: ['e1'],
          day: 2,
          slotIndex: 2,
          message: 'x',
        },
      ],
    });
    server.complete();
    await expect(done).resolves.toBe(true);
    expect(store.hardConflicts()).toBe(1);
    expect(store.conflictMap().get('e1')?.severity).toBe('HARD');
    expect(store.canUndo()).toBe(true);
  });

  it('rolls back and reports when the server rejects the move', async () => {
    api.move.mockReturnValue(
      throwError(
        () =>
          new HttpErrorResponse({
            status: 409,
            error: { success: false, error: { code: 'CONFLICT', message: '' } },
          }),
      ),
    );
    await expect(store.move('e1', 1, 2)).resolves.toBe(false);
    expect(store.entries().find((e) => e.id === 'e1')).toMatchObject({ day: 1, slotIndex: 0 });
    expect(store.editErrorKey()).toBe('timetable.errors.staleVersion');
    expect(store.canUndo()).toBe(false);
  });

  it('refuses to move locked entries or edit published versions', async () => {
    await expect(store.move('e4', 1, 2)).resolves.toBe(false);
    await store.selectVersion(PUBLISHED.id);
    await expect(store.move('e1', 1, 2)).resolves.toBe(false);
    expect(api.move).not.toHaveBeenCalled();
  });

  it('swaps with the occupant and undoes/redoes through the API', async () => {
    api.move.mockImplementation(fakeServer);
    await store.move('e1', 1, 2, 'e2');
    const pos = (id: string) => {
      const e = store.entries().find((x) => x.id === id);
      return [e?.day, e?.slotIndex];
    };
    expect(pos('e1')).toEqual([1, 2]);
    expect(pos('e2')).toEqual([1, 0]);

    await store.undo();
    expect(pos('e1')).toEqual([1, 0]);
    expect(pos('e2')).toEqual([1, 2]);
    expect(store.canRedo()).toBe(true);
    await store.redo();
    expect(pos('e1')).toEqual([1, 2]);
    expect(store.undoStack()).toHaveLength(1);
  });

  it('a new edit clears the redo stack', async () => {
    api.move.mockImplementation(fakeServer);
    await store.move('e1', 1, 2, 'e2');
    await store.undo();
    await store.move('e3', 1, 2);
    expect(store.redoStack()).toHaveLength(0);
  });

  it('toggles locks via the API', async () => {
    api.setLocked.mockReturnValue(of(entry({ id: 'e1', locked: true })));
    await store.toggleLock('e1');
    expect(api.setLocked).toHaveBeenCalledWith(DRAFT.id, 'e1', true);
    expect(store.entries().find((e) => e.id === 'e1')?.locked).toBe(true);
  });

  it('builds master rows for every target of the mode', () => {
    expect(store.masterRows().map((r) => r.label)).toEqual(['7-A', '7-B']);
    expect(store.masterRows()[1].cells.get(cellKey(1, 0))?.[0].id).toBe('e3');
  });

  it('reports load failures', async () => {
    api.lookups.mockReturnValueOnce(throwError(() => new Error('down')));
    await store.init();
    expect(store.status()).toBe('error');
  });
});

describe('move helpers', () => {
  it('inverseOf restores the original position (including swaps)', () => {
    const request: MoveRequest = { entryId: 'e1', toDay: 1, toSlotIndex: 2, swapWithEntryId: 'e2' };
    const after = applyMoveLocally(ENTRIES, request);
    const back = inverseOf(ENTRIES, request);
    expect(back).toEqual({ entryId: 'e1', toDay: 1, toSlotIndex: 0, swapWithEntryId: 'e2' });
    expect(applyMoveLocally(after, back as MoveRequest)).toEqual(ENTRIES);
  });
});
