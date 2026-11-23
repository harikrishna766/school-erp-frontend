import { ChangeDetectionStrategy, Component, computed, input } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

/**
 * Where module/permission guards send users. Distinguishes "your school hasn't enabled
 * this module" (talk to the school office) from "your role can't open this" (talk to
 * an admin). Query params arrive via withComponentInputBinding().
 */
@Component({
  selector: 'app-forbidden-page',
  imports: [EmptyState, MatButtonModule, RouterLink, TranslatePipe],
  template: `
    <app-empty-state
      [icon]="isModule() ? 'lock' : 'block'"
      [heading]="(isModule() ? 'forbidden.moduleHeading' : 'forbidden.heading') | translate"
      [message]="(isModule() ? 'forbidden.moduleMessage' : 'forbidden.message') | translate"
    >
      <a matButton="filled" routerLink="/" empty-state-action>{{ 'notFound.home' | translate }}</a>
    </app-empty-state>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ForbiddenPage {
  readonly reason = input<string | undefined>(undefined);
  protected readonly isModule = computed(() => this.reason() === 'module');
}
