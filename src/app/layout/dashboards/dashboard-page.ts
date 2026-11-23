import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatCardModule } from '@angular/material/card';
import { TranslatePipe } from '@ngx-translate/core';
import { AccessStore } from '../../core/access/access.store';
import { BrandingStore } from '../../core/tenant/branding.store';
import { Skeleton } from '../../shared/ui/skeleton/skeleton';

/**
 * Home route. Role-specific dashboards (admin KPIs, teacher day, parent child view)
 * replace the skeleton grid once AccessStore knows the user's role.
 */
@Component({
  selector: 'app-dashboard-page',
  imports: [MatCardModule, TranslatePipe, Skeleton],
  template: `
    <h1 class="page-title">
      {{ 'dashboard.greeting' | translate: { name: access.user()?.firstName ?? '' } }}
    </h1>
    <p class="page-subtitle">
      {{
        'dashboard.subtitle'
          | translate: { school: branding.schoolName() ?? ('app.name' | translate) }
      }}
    </p>

    <section
      class="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4"
      [attr.aria-label]="'dashboard.kpis' | translate"
      aria-busy="true"
    >
      @for (tile of tiles; track tile) {
        <mat-card appearance="outlined" class="p-4">
          <app-skeleton class="mb-3 h-4 w-1/2" />
          <app-skeleton class="mb-2 h-8 w-2/3" />
          <app-skeleton class="h-3 w-1/3" />
        </mat-card>
      }
    </section>

    <section class="mt-4 grid grid-cols-1 gap-4 xl:grid-cols-3">
      <mat-card appearance="outlined" class="p-4 xl:col-span-2">
        <app-skeleton class="mb-4 h-5 w-1/3" />
        <app-skeleton class="h-56 w-full" />
      </mat-card>
      <mat-card appearance="outlined" class="p-4">
        <app-skeleton class="mb-4 h-5 w-1/2" />
        @for (row of rows; track row) {
          <div class="mb-3 flex items-center gap-3">
            <app-skeleton shape="circle" class="size-10 shrink-0" />
            <app-skeleton class="h-4 flex-1" />
          </div>
        }
      </mat-card>
    </section>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class DashboardPage {
  protected readonly branding = inject(BrandingStore);
  protected readonly access = inject(AccessStore);
  protected readonly tiles = [1, 2, 3, 4] as const;
  protected readonly rows = [1, 2, 3, 4, 5] as const;
}
