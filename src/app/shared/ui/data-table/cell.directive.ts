import { Directive, TemplateRef, inject, input } from '@angular/core';

export interface CellContext<T> {
  readonly $implicit: T;
  readonly row: T;
}

/**
 * Custom cell content for <app-data-table>:
 * `<ng-template appCell="status" [appCellOf]="rows()" let-row>{{ row.status }}</ng-template>`
 * `appCellOf` is only for type inference: it gives `row` the table's row type.
 */
@Directive({ selector: 'ng-template[appCell]' })
export class TableCell<T = unknown> {
  readonly appCell = input.required<string>();
  readonly appCellOf = input<readonly T[]>();
  readonly template = inject<TemplateRef<CellContext<T>>>(TemplateRef);

  static ngTemplateContextGuard<T>(_dir: TableCell<T>, _ctx: unknown): _ctx is CellContext<T> {
    return true;
  }
}
