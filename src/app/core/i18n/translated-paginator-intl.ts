import { Injectable, inject } from '@angular/core';
import { MatPaginatorIntl } from '@angular/material/paginator';
import { TranslateService } from '@ngx-translate/core';

/** Paginator labels in the active language (Material ships English only). */
@Injectable()
export class TranslatedPaginatorIntl extends MatPaginatorIntl {
  private readonly translate = inject(TranslateService);

  constructor() {
    super();
    this.translate.onLangChange.subscribe(() => this.update());
    this.update();
  }

  override getRangeLabel = (page: number, pageSize: number, length: number): string => {
    if (length === 0) {
      return this.translate.instant('table.rangeEmpty') as string;
    }
    const start = page * pageSize + 1;
    const end = Math.min(length, (page + 1) * pageSize);
    return this.translate.instant('table.range', { start, end, total: length }) as string;
  };

  private update(): void {
    const t = (key: string) => this.translate.instant(key) as string;
    this.itemsPerPageLabel = t('table.itemsPerPage');
    this.nextPageLabel = t('table.nextPage');
    this.previousPageLabel = t('table.previousPage');
    this.firstPageLabel = t('table.firstPage');
    this.lastPageLabel = t('table.lastPage');
    this.changes.next();
  }
}
