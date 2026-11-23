import { Injectable, inject } from '@angular/core';
import { MatDialog } from '@angular/material/dialog';
import { firstValueFrom } from 'rxjs';
import { ConfirmDialog, type ConfirmOptions } from './confirm-dialog';

/**
 * `await confirm.ask({ titleKey, messageKey })` → true/false. Escape, backdrop and Cancel
 * all resolve false. Danger actions get an error-coloured confirm button.
 */
@Injectable({ providedIn: 'root' })
export class ConfirmService {
  private readonly dialog = inject(MatDialog);

  async ask(options: ConfirmOptions): Promise<boolean> {
    const ref = this.dialog.open<ConfirmDialog, ConfirmOptions, boolean>(ConfirmDialog, {
      data: options,
      width: '440px',
      maxWidth: 'calc(100vw - 32px)',
      autoFocus: 'first-tabbable',
      restoreFocus: true,
      ariaModal: true,
    });
    return (await firstValueFrom(ref.afterClosed())) === true;
  }
}
