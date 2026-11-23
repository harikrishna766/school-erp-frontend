import { NgTemplateOutlet } from '@angular/common';
import { ScrollingModule } from '@angular/cdk/scrolling';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  contentChildren,
  inject,
  input,
  output,
} from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatPaginatorIntl, MatPaginatorModule, type PageEvent } from '@angular/material/paginator';
import { MatSortModule, type Sort } from '@angular/material/sort';
import { MatTableModule } from '@angular/material/table';
import { TranslatePipe } from '@ngx-translate/core';
import { TranslatedPaginatorIntl } from '../../../core/i18n/translated-paginator-intl';
import { BreakpointService } from '../../../core/layout/breakpoint.service';
import { EmptyState } from '../empty-state/empty-state';
import { Skeleton } from '../skeleton/skeleton';
import { TableCell } from './cell.directive';
import { DEFAULT_QUERY, type TableColumn, type TableQuery } from './table.model';

/**
 * Responsive, server-driven table.
 *
 * - Tablet/desktop: Material table with server sort + paginator (`mode="paged"`) or a
 *   virtualized list that asks for the next page near the end (`mode="virtual"`).
 * - Phone: cards (primary column as title, the rest as label/value pairs).
 * - Loading skeleton, empty and error states with retry are built in.
 * - Presentational: state lives in a ServerTableSource (or the parent).
 */
@Component({
  selector: 'app-data-table',
  imports: [
    NgTemplateOutlet,
    ScrollingModule,
    MatTableModule,
    MatSortModule,
    MatPaginatorModule,
    MatButtonModule,
    MatIconModule,
    TranslatePipe,
    EmptyState,
    Skeleton,
  ],
  // Provided here, not at the root: keeps the paginator (and MatSelect/overlay behind it)
  // out of the initial bundle; it ships with the first lazy chunk that shows a table.
  providers: [{ provide: MatPaginatorIntl, useClass: TranslatedPaginatorIntl }],
  templateUrl: './data-table.html',
  styleUrl: './data-table.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DataTable<T> {
  private readonly breakpoints = inject(BreakpointService);

  readonly columns = input.required<readonly TableColumn<T>[]>();
  readonly rows = input.required<readonly T[]>();
  /** Stable identity for rows (trackBy). */
  readonly rowKey = input.required<(row: T) => string | number>();
  readonly query = input<TableQuery>(DEFAULT_QUERY);
  /** null = unknown (cursor paging); the paginator then hides the total. */
  readonly total = input<number | null>(null);
  readonly loading = input(false);
  /** Translation key of an error to show (with a retry button), or null. */
  readonly errorKey = input<string | null>(null);
  readonly mode = input<'paged' | 'virtual'>('paged');
  /** Rows become buttons (click/Enter/Space) that emit rowActivate. */
  readonly clickable = input(false);
  /** Accessible name of the table, e.g. 'students.title' (translation key). */
  readonly captionKey = input.required<string>();
  readonly emptyKey = input('table.empty');
  readonly pageSizes = input<readonly number[]>([10, 20, 50, 100]);
  /** Virtual mode row height in px (must be fixed for virtual scroll). */
  readonly rowHeight = input(52);

  readonly queryChange = output<TableQuery>();
  readonly rowActivate = output<T>();
  readonly retry = output();

  private readonly cellTemplates = contentChildren(TableCell);

  protected readonly isPhone = this.breakpoints.isPhone;
  protected readonly visibleColumns = computed(() => {
    const device = this.breakpoints.device();
    return this.columns().filter(
      (c) =>
        !c.hideBelow ||
        (c.hideBelow === 'tablet' && device !== 'phone') ||
        (c.hideBelow === 'desktop' && device === 'desktop'),
    );
  });
  protected readonly columnKeys = computed(() => this.visibleColumns().map((c) => c.key));
  protected readonly templates = computed(
    () => new Map(this.cellTemplates().map((t) => [t.appCell(), t.template])),
  );
  protected readonly primaryColumn = computed(
    () => this.columns().find((c) => c.primary) ?? this.columns()[0],
  );
  protected readonly secondaryColumns = computed(() =>
    this.columns().filter((c) => c !== this.primaryColumn()),
  );
  protected readonly skeletonRows = computed(() =>
    Array.from({ length: Math.min(this.query().limit, 8) }, (_, i) => i),
  );
  protected readonly showSkeleton = computed(() => this.loading() && this.rows().length === 0);
  protected readonly isEmpty = computed(
    () => !this.loading() && !this.errorKey() && this.rows().length === 0,
  );
  protected readonly trackRow = (_: number, row: T) => this.rowKey()(row);
  protected readonly sortActive = computed(() => this.query().sort?.field ?? '');
  protected readonly sortDirection = computed(() => this.query().sort?.direction ?? '');

  protected text(column: TableColumn<T>, row: T): string {
    const value = column.value?.(row);
    return value === null || value === undefined ? '—' : String(value);
  }

  protected onSort(sort: Sort): void {
    this.queryChange.emit({
      ...this.query(),
      page: 1,
      sort: sort.direction ? { field: sort.active, direction: sort.direction } : null,
    });
  }

  protected onPage(event: PageEvent): void {
    this.queryChange.emit({ ...this.query(), page: event.pageIndex + 1, limit: event.pageSize });
  }

  /** Virtual mode: request the next page when the end comes into view. */
  protected onScrolled(index: number): void {
    const total = this.total();
    const loaded = this.rows().length;
    const nearEnd = index + 20 >= loaded;
    const more = total === null || loaded < total;
    if (nearEnd && more && !this.loading()) {
      this.queryChange.emit({ ...this.query(), page: this.query().page + 1 });
    }
  }

  protected activate(row: T, event?: Event): void {
    if (!this.clickable()) {
      return;
    }
    event?.preventDefault();
    this.rowActivate.emit(row);
  }
}
