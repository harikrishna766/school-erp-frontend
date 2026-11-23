import { NgTemplateOutlet } from '@angular/common';
import { CdkVirtualScrollViewport, ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  ElementRef,
  afterNextRender,
  computed,
  inject,
  Injector,
  input,
  output,
  signal,
  viewChild,
} from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe, TranslateService } from '@ngx-translate/core';
import { type GridEntry, cellKey, isTeachable } from '../../data/grid-model';
import type { PeriodSlot, Weekday } from '../../data/timetable.models';
import { formatSlotTime, weekdayName } from '../time-format';

export interface GridMove {
  readonly entryId: string;
  readonly toDay: Weekday;
  readonly toSlotIndex: number;
  readonly swapWithEntryId?: string;
}

export interface GridCellRef {
  readonly day: Weekday;
  readonly slotIndex: number;
  readonly entries: readonly GridEntry[];
}

/** One row of the master view (a section/teacher/room) with its own cells. */
export interface MasterRow {
  readonly id: string;
  readonly label: string;
  readonly cells: ReadonlyMap<string, readonly GridEntry[]>;
}

interface Column {
  readonly day: Weekday;
  readonly slot: PeriodSlot;
}

/** Precomputed view model of one cell; the template only reads these fields. */
export interface GridCell {
  readonly row: number;
  readonly col: number;
  readonly day: Weekday;
  readonly slotIndex: number;
  readonly entries: readonly GridEntry[];
  readonly teachable: boolean;
  readonly highlighted: boolean;
  readonly label: string;
  readonly kind: PeriodSlot['kind'];
}

interface Picked {
  readonly entry: GridEntry;
  readonly row: number;
}

const EMPTY: readonly GridEntry[] = [];

/**
 * Reusable timetable grid (presentational, OnPush).
 *
 * - `layout="week"`: one section/teacher/room; rows = days, columns = periods.
 * - `layout="master"`: rows = all targets, columns = day × period; rows are virtualized.
 *
 * Accessibility (WAI-ARIA grid pattern): one tab stop with roving focus; arrow keys,
 * Home/End, Ctrl+Home/End move focus; when `editable`, Enter/Space picks the entry in the
 * focused cell and drops it on the next Enter/Space (swapping with an unlocked occupant);
 * Escape cancels. Every step is announced through a polite live region.
 */
@Component({
  selector: 'app-timetable-grid',
  imports: [NgTemplateOutlet, ScrollingModule, MatIconModule, MatTooltipModule, TranslatePipe],
  templateUrl: './timetable-grid.html',
  styleUrl: './timetable-grid.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TimetableGrid {
  private readonly translate = inject(TranslateService);
  private readonly host = inject<ElementRef<HTMLElement>>(ElementRef);
  private readonly injector = inject(Injector);

  readonly layout = input<'week' | 'master'>('week');
  readonly days = input.required<readonly Weekday[]>();
  readonly slots = input.required<readonly PeriodSlot[]>();
  readonly lastSlotByDay = input<Readonly<Partial<Record<Weekday, number>>>>({});
  /** Week layout: cell key → entries. */
  readonly cells = input<ReadonlyMap<string, readonly GridEntry[]>>(new Map());
  /** Master layout rows. */
  readonly rows = input<readonly MasterRow[]>([]);
  readonly editable = input(false);
  /** Current period to highlight (e.g. "now"). */
  readonly highlight = input<{ day: Weekday; slotIndex: number } | null>(null);
  /** UI language for day names and times. */
  readonly lang = input('en');
  /** Accessible name (translation key). */
  readonly captionKey = input.required<string>();
  /** Master row height in px (virtual scroll needs a fixed size). */
  readonly rowHeight = input(64);

  readonly move = output<GridMove>();
  readonly lockToggle = output<string>();
  readonly cellActivate = output<GridCellRef>();

  private readonly viewport = viewChild(CdkVirtualScrollViewport);

  /** Focused cell as (row, column) in the current layout. */
  protected readonly focus = signal({ row: 0, col: 0 });
  protected readonly picked = signal<Picked | null>(null);
  protected readonly announcement = signal('');

  protected readonly columns = computed<readonly Column[]>(() =>
    this.layout() === 'week'
      ? this.slots().map((slot) => ({ day: this.days()[0], slot }))
      : this.days().flatMap((day) => this.slots().map((slot) => ({ day, slot }))),
  );
  protected readonly rowCount = computed(() =>
    this.layout() === 'week' ? this.days().length : this.rows().length,
  );
  protected readonly dayLabels = computed(
    () => new Map(this.days().map((d) => [d, weekdayName(d, this.lang(), 'short')])),
  );
  protected readonly dayLongLabels = computed(
    () => new Map(this.days().map((d) => [d, weekdayName(d, this.lang(), 'long')])),
  );
  protected readonly slotTimes = computed(
    () =>
      new Map(
        this.slots().map((s) => [
          s.index,
          `${formatSlotTime(s.start, this.lang())}–${formatSlotTime(s.end, this.lang())}`,
        ]),
      ),
  );
  /** Teaching periods share the width; breaks/lunch get a narrow fixed column. */
  protected readonly gridTemplate = computed(
    () =>
      `minmax(72px, max-content) ${this.columns()
        .map((c) => (c.slot.kind === 'TEACHING' ? 'minmax(76px, 1fr)' : '44px'))
        .join(' ')}`,
  );
  protected readonly trackRow = (_: number, row: MasterRow) => row.id;

  /** Day of a cell: week rows are days; master columns carry their day. */
  private dayAt(row: number, col: number): Weekday {
    return this.layout() === 'week' ? this.days()[row] : this.columns()[col].day;
  }

  /**
   * All cells, computed once per input/language change (not per change-detection pass).
   * Rows: days (week) or targets (master). The master viewport renders only visible rows.
   */
  protected readonly matrix = computed<readonly (readonly GridCell[])[]>(() => {
    this.lang(); // labels depend on the language
    const columns = this.columns();
    const highlight = this.highlight();
    const lastSlotByDay = this.lastSlotByDay();
    const week = this.layout() === 'week';
    return Array.from({ length: this.rowCount() }, (_, row) => {
      const map = week ? this.cells() : this.rows()[row]?.cells;
      const rowLabel = week ? '' : `${this.rows()[row]?.label ?? ''}, `;
      return columns.map((column, col) => {
        const day = week ? this.days()[row] : column.day;
        const entries = map?.get(cellKey(day, column.slot.index)) ?? EMPTY;
        const teachable = isTeachable(column.slot, day, lastSlotByDay);
        return {
          row,
          col,
          day,
          slotIndex: column.slot.index,
          kind: column.slot.kind,
          entries,
          teachable,
          highlighted:
            !!highlight && highlight.day === day && highlight.slotIndex === column.slot.index,
          label: rowLabel + this.describe(day, column.slot, entries, teachable),
        };
      });
    });
  });

  private cellAt(row: number, col: number): GridCell | undefined {
    return this.matrix()[row]?.[col];
  }

  private describe(
    day: Weekday,
    slot: PeriodSlot,
    entries: readonly GridEntry[],
    teachable: boolean,
  ): string {
    const where = `${this.dayLongLabels().get(day) ?? ''}, ${slot.label}, ${this.slotTimes().get(slot.index) ?? ''}`;
    if (!teachable) {
      return `${where}: ${this.t('timetable.grid.noClass')}`;
    }
    if (entries.length === 0) {
      return `${where}: ${this.t('timetable.grid.free')}`;
    }
    const what = entries
      .map((e) =>
        [
          e.description,
          e.locked ? this.t('timetable.grid.locked') : '',
          e.conflict ? this.t(`timetable.grid.conflict${e.conflict.severity}`) : '',
        ]
          .filter(Boolean)
          .join(', '),
      )
      .join('; ');
    return `${where}: ${what}`;
  }

  protected conflictTooltip(entry: GridEntry): string {
    return entry.conflict
      ? entry.conflict.kinds.map((k) => this.t(`timetable.conflict.${k}`)).join('\n')
      : '';
  }

  protected onCellClick(cell: GridCell): void {
    this.setFocus(cell.row, cell.col, false);
    if (this.picked()) {
      this.drop(cell.row, cell.col);
      return;
    }
    this.cellActivate.emit({ day: cell.day, slotIndex: cell.slotIndex, entries: cell.entries });
  }

  protected onKeydown(event: KeyboardEvent): void {
    const { row, col } = this.focus();
    const lastRow = this.rowCount() - 1;
    const lastCol = this.columns().length - 1;
    const moves: Record<string, () => [number, number]> = {
      ArrowRight: () => [row, Math.min(col + 1, lastCol)],
      ArrowLeft: () => [row, Math.max(col - 1, 0)],
      ArrowDown: () => [Math.min(row + 1, lastRow), col],
      ArrowUp: () => [Math.max(row - 1, 0), col],
      Home: () => (event.ctrlKey ? [0, 0] : [row, 0]),
      End: () => (event.ctrlKey ? [lastRow, lastCol] : [row, lastCol]),
      PageDown: () => [Math.min(row + 5, lastRow), col],
      PageUp: () => [Math.max(row - 5, 0), col],
    };
    const target = moves[event.key];
    if (target) {
      event.preventDefault();
      const [r, c] = target();
      this.setFocus(r, c, true);
      return;
    }
    if (event.key === 'Enter' || event.key === ' ') {
      event.preventDefault();
      if (this.picked()) {
        this.drop(row, col);
      } else {
        this.pick(row, col);
      }
      return;
    }
    if (event.key === 'Escape' && this.picked()) {
      event.preventDefault();
      this.cancelPick();
    }
  }

  protected toggleLock(event: Event, entry: GridEntry): void {
    event.stopPropagation();
    this.lockToggle.emit(entry.id);
  }

  private pick(row: number, col: number): void {
    const cell = this.cellAt(row, col);
    if (!cell) {
      return;
    }
    if (!this.editable()) {
      this.cellActivate.emit({ day: cell.day, slotIndex: cell.slotIndex, entries: cell.entries });
      return;
    }
    const entry = cell.entries.find((e) => !e.locked);
    if (!entry) {
      const locked = cell.entries.length > 0;
      this.announce(locked ? 'timetable.grid.cannotPickLocked' : 'timetable.grid.nothingToPick');
      return;
    }
    this.picked.set({ entry, row });
    this.announce('timetable.grid.picked', { entry: entry.description });
  }

  private drop(row: number, col: number): void {
    const picked = this.picked();
    if (!picked) {
      return;
    }
    const cell = this.cellAt(row, col);
    if (!cell) {
      return;
    }
    const column = this.columns()[col];
    const day = cell.day;
    if (picked.row !== row && this.layout() === 'master') {
      this.announce('timetable.grid.sameRowOnly');
      return;
    }
    if (!cell.teachable) {
      this.announce('timetable.grid.notTeachable');
      return;
    }
    if (picked.entry.day === day && picked.entry.slotIndex === column.slot.index) {
      this.cancelPick();
      return;
    }
    const occupants = cell.entries;
    if (occupants.some((e) => e.locked)) {
      this.announce('timetable.grid.cannotDropLocked');
      return;
    }
    const swapWith = occupants.length === 1 ? occupants[0].id : undefined;
    this.picked.set(null);
    this.move.emit({
      entryId: picked.entry.id,
      toDay: day,
      toSlotIndex: column.slot.index,
      ...(swapWith ? { swapWithEntryId: swapWith } : {}),
    });
    this.announce(swapWith ? 'timetable.grid.swapped' : 'timetable.grid.moved', {
      entry: picked.entry.description,
      to: `${this.dayLongLabels().get(day)}, ${column.slot.label}`,
    });
  }

  private cancelPick(): void {
    this.picked.set(null);
    this.announce('timetable.grid.cancelled');
  }

  private setFocus(row: number, col: number, moveDomFocus: boolean): void {
    this.focus.set({ row, col });
    if (!moveDomFocus) {
      return;
    }
    // Master rows may be outside the rendered window: scroll first, focus after render.
    this.viewport()?.scrollToIndex(Math.max(0, row - 2));
    afterNextRender(
      () =>
        this.host.nativeElement
          .querySelector<HTMLElement>(`[data-row="${row}"][data-col="${col}"]`)
          ?.focus({ preventScroll: this.layout() === 'week' ? false : true }),
      { injector: this.injector },
    );
  }

  private announce(key: string, params?: Record<string, unknown>): void {
    this.announcement.set(this.t(key, params));
  }

  private t(key: string, params?: Record<string, unknown>): string {
    return this.translate.instant(key, params) as string;
  }
}
