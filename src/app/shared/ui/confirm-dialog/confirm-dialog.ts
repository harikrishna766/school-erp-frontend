import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { TranslatePipe } from '@ngx-translate/core';

export interface ConfirmOptions {
  readonly titleKey: string;
  readonly messageKey?: string;
  readonly params?: Record<string, unknown>;
  /** Already-translated or literal lines shown as a summary list (e.g. what will change). */
  readonly details?: readonly string[];
  readonly confirmKey?: string;
  readonly cancelKey?: string;
  readonly danger?: boolean;
}

@Component({
  selector: 'app-confirm-dialog',
  imports: [MatDialogModule, MatButtonModule, TranslatePipe],
  template: `
    <h2 mat-dialog-title>{{ data.titleKey | translate: data.params }}</h2>
    <mat-dialog-content>
      @if (data.messageKey; as message) {
        <p>{{ message | translate: data.params }}</p>
      }
      @if (data.details?.length) {
        <ul class="details" data-testid="confirm-details">
          @for (line of data.details; track $index) {
            <li>{{ line }}</li>
          }
        </ul>
      }
    </mat-dialog-content>
    <mat-dialog-actions align="end">
      <button matButton type="button" [mat-dialog-close]="false" data-testid="confirm-cancel">
        {{ data.cancelKey ?? 'common.cancel' | translate }}
      </button>
      <button
        matButton="filled"
        type="button"
        [class.danger]="data.danger"
        [mat-dialog-close]="true"
        data-testid="confirm-ok"
      >
        {{ data.confirmKey ?? 'common.confirm' | translate }}
      </button>
    </mat-dialog-actions>
  `,
  styles: `
    .details {
      margin: 0;
      padding-inline-start: 20px;
      font: var(--mat-sys-body-medium);
    }
    .danger {
      --mat-button-filled-container-color: var(--mat-sys-error);
      --mat-button-filled-label-text-color: var(--mat-sys-on-error);
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ConfirmDialog {
  protected readonly data = inject<ConfirmOptions>(MAT_DIALOG_DATA);
}
