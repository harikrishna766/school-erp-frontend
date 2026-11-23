import { ChangeDetectionStrategy, Component } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { RouterLink } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { EmptyState } from '../../shared/ui/empty-state/empty-state';

@Component({
  selector: 'app-not-found-page',
  imports: [EmptyState, MatButtonModule, RouterLink, TranslatePipe],
  template: `
    <app-empty-state
      icon="travel_explore"
      [heading]="'notFound.heading' | translate"
      [message]="'notFound.message' | translate"
    >
      <a matButton="filled" routerLink="/" empty-state-action>{{ 'notFound.home' | translate }}</a>
    </app-empty-state>
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class NotFoundPage {}
