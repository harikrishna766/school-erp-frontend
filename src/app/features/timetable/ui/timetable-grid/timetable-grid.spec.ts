import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideTestBasics } from '../../../../../testing/providers';
import { buildCells, conflictsByEntry, indexLookups } from '../../data/grid-model';
import type { Conflict, TimetableEntry } from '../../data/timetable.models';
import { ENTRIES, LOOKUPS } from '../../testing/fixtures';
import { type GridCellRef, type GridMove, type MasterRow, TimetableGrid } from './timetable-grid';

@Component({
  imports: [TimetableGrid],
  template: `
    <app-timetable-grid
      captionKey="timetable.title"
      [layout]="layout()"
      [days]="days"
      [slots]="slots"
      [lastSlotByDay]="lastSlotByDay"
      [cells]="cells()"
      [rows]="rows()"
      [editable]="editable()"
      [highlight]="highlight()"
      (move)="moves.push($event)"
      (lockToggle)="locks.push($event)"
      (cellActivate)="activations.push($event)"
    />
  `,
})
class Host {
  days = LOOKUPS.template.days;
  slots = LOOKUPS.template.slots;
  lastSlotByDay = LOOKUPS.template.lastSlotByDay;
  readonly layout = signal<'week' | 'master'>('week');
  readonly editable = signal(true);
  readonly highlight = signal<{ day: 1 | 2; slotIndex: number } | null>(null);
  readonly conflicts = signal<Conflict[]>([]);
  readonly entries = signal<readonly TimetableEntry[]>(ENTRIES.filter((e) => e.sectionId === 's1'));
  readonly cells = signal(new Map());
  readonly rows = signal<readonly MasterRow[]>([]);
  moves: GridMove[] = [];
  locks: string[] = [];
  activations: GridCellRef[] = [];

  refresh(): void {
    this.cells.set(
      buildCells(
        this.entries(),
        'section',
        indexLookups(LOOKUPS),
        conflictsByEntry(this.conflicts()),
      ),
    );
  }
}

describe('TimetableGrid', () => {
  async function render(setup?: (host: Host) => void) {
    TestBed.configureTestingModule({ providers: provideTestBasics() });
    const fixture = TestBed.createComponent(Host);
    const host = fixture.componentInstance;
    setup?.(host);
    host.refresh();
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const grid = () => el.querySelector<HTMLElement>('[role="grid"]')!;
    const cell = (row: number, col: number) =>
      el.querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)!;
    const key = async (k: string, init: KeyboardEventInit = {}) => {
      grid().dispatchEvent(new KeyboardEvent('keydown', { key: k, bubbles: true, ...init }));
      await fixture.whenStable();
    };
    const announced = () => el.querySelector('[data-testid="grid-announcer"]')?.textContent ?? '';
    return { fixture, host, el, cell, key, announced };
  }

  it('renders days × periods with entries, breaks and half days', async () => {
    const { el, cell } = await render();
    expect(el.querySelectorAll('[role="row"]')).toHaveLength(3); // header + 2 days
    expect(cell(0, 0).textContent).toContain('MATH');
    expect(cell(0, 0).textContent).toContain('RK · Room 1');
    expect(cell(0, 1).classList).toContain('unavailable'); // break
    expect(cell(1, 2).classList).toContain('unavailable'); // Tuesday ends after P1
    expect(cell(0, 0).getAttribute('aria-label')).toContain('Mathematics');
  });

  it('marks conflicts and locks, and highlights the current period', async () => {
    const { cell, host, fixture } = await render((h) => {
      h.conflicts.set([
        {
          kind: 'TEACHER_CLASH',
          severity: 'HARD',
          entryIds: ['e1'],
          day: 1,
          slotIndex: 0,
          message: 'x',
        },
      ]);
      h.highlight.set({ day: 1, slotIndex: 2 });
    });
    expect(cell(0, 0).querySelector('.entry')?.classList).toContain('conflict-hard');
    expect(cell(0, 0).getAttribute('aria-label')).toContain('timetable.grid.conflictHARD');
    expect(cell(1, 0).getAttribute('aria-label')).toContain('timetable.grid.locked');
    expect(cell(0, 2).getAttribute('aria-current')).toBe('time');

    cell(0, 0).querySelector<HTMLButtonElement>('[data-testid="lock-e1"]')!.click();
    expect(host.locks).toEqual(['e1']);
    host.editable.set(false);
    await fixture.whenStable();
    expect(cell(0, 0).querySelector('[data-testid="lock-e1"]')).toBeNull();
  });

  it('uses a single tab stop that arrow keys move', async () => {
    const { cell, key } = await render();
    expect(cell(0, 0).tabIndex).toBe(0);
    expect(cell(0, 2).tabIndex).toBe(-1);
    await key('ArrowRight');
    await key('ArrowRight');
    expect(cell(0, 2).tabIndex).toBe(0);
    expect(cell(0, 0).tabIndex).toBe(-1);
    await key('ArrowDown');
    expect(cell(1, 2).tabIndex).toBe(0);
    await key('Home', { ctrlKey: true });
    expect(cell(0, 0).tabIndex).toBe(0);
    await key('End');
    expect(cell(0, 2).tabIndex).toBe(0);
  });

  it('picks with Enter, drops with Enter and swaps with the occupant', async () => {
    const { host, key, announced } = await render();
    await key('Enter'); // pick MATH at Mon P1
    expect(announced()).toContain('timetable.grid.picked');
    await key('ArrowRight');
    await key('ArrowRight'); // Mon P2 (ENG)
    await key('Enter');
    expect(host.moves).toEqual([
      { entryId: 'e1', toDay: 1, toSlotIndex: 2, swapWithEntryId: 'e2' },
    ]);
    expect(announced()).toContain('timetable.grid.swapped');
  });

  it('Escape cancels a pick; locked and break cells are refused', async () => {
    const { host, key, announced } = await render();
    await key('Enter');
    await key('Escape');
    expect(announced()).toContain('timetable.grid.cancelled');

    await key('ArrowDown'); // Tue P1 is locked
    await key('Enter');
    expect(announced()).toContain('timetable.grid.cannotPickLocked');

    await key('ArrowUp');
    await key('Enter'); // pick e1
    await key('ArrowRight'); // break
    await key('Enter');
    expect(announced()).toContain('timetable.grid.notTeachable');
    await key('ArrowDown'); // Tue break (also not teachable) → then left to locked
    await key('ArrowLeft');
    await key('Enter');
    expect(announced()).toContain('timetable.grid.cannotDropLocked');
    expect(host.moves).toEqual([]);
  });

  it('read-only grids activate cells instead of picking', async () => {
    const { host, fixture, key } = await render();
    host.editable.set(false);
    await fixture.whenStable();
    await key('Enter');
    expect(host.moves).toEqual([]);
    expect(host.activations[0]).toMatchObject({ day: 1, slotIndex: 0 });
    expect(host.activations[0].entries[0].id).toBe('e1');
  });

  it('master layout renders one row per target with day-prefixed columns', async () => {
    const { el } = await render((h) => {
      h.layout.set('master');
      const index = indexLookups(LOOKUPS);
      h.rows.set(
        LOOKUPS.sections.map((s) => ({
          id: s.id,
          label: s.name,
          cells: buildCells(
            ENTRIES.filter((e) => e.sectionId === s.id),
            'section',
            index,
            new Map(),
          ),
        })),
      );
    });
    expect(el.querySelectorAll('[role="columnheader"]')).toHaveLength(1 + 2 * 3);
    // Virtual scroll renders lazily; the header row is always present.
    expect(el.querySelector('cdk-virtual-scroll-viewport')).not.toBeNull();
  });
});
