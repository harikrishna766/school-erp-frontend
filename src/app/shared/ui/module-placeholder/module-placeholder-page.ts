import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '../empty-state/empty-state';

/**
 * Temporary landing page for feature modules that are routed and lazy-loaded but not yet
 * built. `labelKey`/`icon` arrive as route data via `withComponentInputBinding()`.
 */
@Component({
  selector: 'app-module-placeholder-page',
  imports: [EmptyState, TranslatePipe],
  template: `
    <h1 class="page-title">{{ labelKey() | translate }}</h1>
    <app-empty-state
      [icon]="icon()"
      [heading]="'placeholder.heading' | translate: { module: (labelKey() | translate) }"
      [message]="'placeholder.message' | translate"
    />
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ModulePlaceholderPage {
  readonly labelKey = input.required<string>();
  readonly icon = input('construction');
}
