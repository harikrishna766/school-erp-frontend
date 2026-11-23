import { ChangeDetectionStrategy, Component, input } from '@angular/core';
import { MatIconModule } from '@angular/material/icon';
import { TranslatePipe } from '@ngx-translate/core';

export interface FormErrorItem {
  /** Translation key or literal server message. */
  readonly message: string;
  readonly params?: Record<string, unknown>;
  /** id of the input to link to, for keyboard users. */
  readonly fieldId?: string;
}

/**
 * Form-level error summary: announced (role="alert"), lists every problem, and links
 * each one to its field. Presentational: the page decides what to show and when.
 */
@Component({
  selector: 'app-form-errors',
  imports: [MatIconModule, TranslatePipe],
  template: `
    @if (errors().length > 0) {
      <div class="summary" role="alert" tabindex="-1" data-testid="form-errors">
        <div class="title">
          <mat-icon aria-hidden="true">error</mat-icon>
          <span>{{ titleKey() | translate: { count: errors().length } }}</span>
        </div>
        <ul>
          @for (error of errors(); track $index) {
            <li>
              @if (error.fieldId; as id) {
                <a [href]="'#' + id" (click)="focus($event, id)">{{
                  error.message | translate: error.params
                }}</a>
              } @else {
                {{ error.message | translate: error.params }}
              }
            </li>
          }
        </ul>
      </div>
    }
  `,
  styles: `
    .summary {
      margin-block-end: 16px;
      padding: 12px 16px;
      border-radius: 12px;
      background: var(--mat-sys-error-container);
      color: var(--mat-sys-on-error-container);
      font: var(--mat-sys-body-medium);
    }
    .title {
      display: flex;
      align-items: center;
      gap: 8px;
      font: var(--mat-sys-title-small);
    }
    ul {
      margin: 8px 0 0;
      padding-inline-start: 32px;
    }
    a {
      color: inherit;
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class FormErrors {
  readonly errors = input.required<readonly FormErrorItem[]>();
  readonly titleKey = input('forms.errorSummary');

  protected focus(event: Event, id: string): void {
    event.preventDefault();
    document.getElementById(id)?.focus();
  }
}
