import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { fakeBreakpoints, provideTestBasics } from '../../../../testing/providers';
import { TableCell } from './cell.directive';
import { DataTable } from './data-table';
import { DEFAULT_QUERY, type TableColumn, type TableQuery } from './table.model';

interface Student {
  id: string;
  name: string;
  section: string;
  fees: number;
}

@Component({
  imports: [DataTable, TableCell],
  template: `
    <app-data-table
      captionKey="students.title"
      [columns]="columns"
      [rows]="rows()"
      [rowKey]="key"
      [query]="query()"
      [total]="total()"
      [loading]="loading()"
      [errorKey]="errorKey()"
      [clickable]="true"
      (queryChange)="changes.push($event)"
      (rowActivate)="activated.push($event)"
      (retry)="retries = retries + 1"
    >
      <ng-template appCell="fees" [appCellOf]="rows()" let-row>
        <strong class="fee">₹{{ row.fees }}</strong>
      </ng-template>
    </app-data-table>
  `,
})
class Host {
  columns: TableColumn<Student>[] = [
    { key: 'name', header: 'Name', sortable: true, primary: true, value: (s) => s.name },
    { key: 'section', header: 'Section', value: (s) => s.section, hideBelow: 'desktop' },
    { key: 'fees', header: 'Fees', align: 'end' },
  ];
  key = (s: Student) => s.id;
  readonly rows = signal<Student[]>([
    { id: '1', name: 'Aarav', section: '7A', fees: 1200 },
    { id: '2', name: 'Diya', section: '3B', fees: 0 },
  ]);
  readonly query = signal<TableQuery>(DEFAULT_QUERY);
  readonly total = signal<number | null>(42);
  readonly loading = signal(false);
  readonly errorKey = signal<string | null>(null);
  changes: TableQuery[] = [];
  activated: Student[] = [];
  retries = 0;
}

describe('DataTable', () => {
  async function render(device: 'phone' | 'tablet' | 'desktop' = 'desktop') {
    const bp = fakeBreakpoints(device);
    TestBed.configureTestingModule({
      providers: [...provideTestBasics(), provideNoopAnimations(), bp.provider],
    });
    const fixture = TestBed.createComponent(Host);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    return { fixture, el, host: fixture.componentInstance, bp };
  }

  it('renders a table with custom cells and hides low-priority columns below desktop', async () => {
    const { el, fixture, bp } = await render('desktop');
    expect(el.querySelectorAll('[data-testid="table-row"]')).toHaveLength(2);
    expect(el.querySelector('.fee')?.textContent).toBe('₹1200');
    expect(el.textContent).toContain('Section');
    bp.device.set('tablet');
    await fixture.whenStable();
    expect(el.querySelector('th')?.parentElement?.textContent).not.toContain('Section');
  });

  it('emits server sort and paging queries', async () => {
    const { el, host, fixture } = await render();
    el.querySelector<HTMLElement>('.mat-sort-header-container')!.click();
    await fixture.whenStable();
    expect(host.changes.at(-1)).toMatchObject({
      page: 1,
      sort: { field: 'name', direction: 'asc' },
    });

    el.querySelector<HTMLButtonElement>('.mat-mdc-paginator-navigation-next')!.click();
    expect(host.changes.at(-1)).toMatchObject({ page: 2 });
  });

  it('activates rows by click and keyboard', async () => {
    const { el, host } = await render();
    const row = el.querySelector<HTMLElement>('[data-testid="table-row"]')!;
    expect(row.tabIndex).toBe(0);
    row.click();
    row.dispatchEvent(new KeyboardEvent('keydown', { key: 'Enter' }));
    expect(host.activated.map((s) => s.id)).toEqual(['1', '1']);
  });

  it('renders cards on phones, with the primary column as the title', async () => {
    const { el } = await render('phone');
    const cards = el.querySelectorAll('[data-testid="table-card"]');
    expect(cards).toHaveLength(2);
    expect(cards[0].querySelector('.card-title')?.textContent?.trim()).toBe('Aarav');
    expect(cards[0].getAttribute('role')).toBe('button');
  });

  it('shows skeleton, empty and error states', async () => {
    const { el, host, fixture } = await render();
    host.rows.set([]);
    host.loading.set(true);
    await fixture.whenStable();
    expect(el.querySelector('[aria-busy="true"]')).not.toBeNull();

    host.loading.set(false);
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="table-empty"]')).not.toBeNull();

    host.errorKey.set('errors.network');
    await fixture.whenStable();
    expect(el.querySelector('[data-testid="table-error"]')?.textContent).toContain(
      'errors.network',
    );
    el.querySelector<HTMLButtonElement>('[data-testid="table-error"] button')!.click();
    expect(host.retries).toBe(1);
  });
});
