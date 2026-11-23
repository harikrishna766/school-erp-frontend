import { TestBed } from '@angular/core/testing';
import { MatSnackBar } from '@angular/material/snack-bar';
import { TranslateService } from '@ngx-translate/core';
import { ToastService } from './toast.service';

describe('ToastService', () => {
  const open = vi.fn();

  beforeEach(() => {
    open.mockReset();
    TestBed.configureTestingModule({
      providers: [
        { provide: MatSnackBar, useValue: { open } },
        { provide: TranslateService, useValue: { instant: (key: string) => `t(${key})` } },
      ],
    });
  });

  it('lazily opens a translated, assertive snackbar for errors', async () => {
    TestBed.inject(ToastService).error('errors.network');
    await vi.waitFor(() => expect(open).toHaveBeenCalled());
    expect(open).toHaveBeenCalledWith(
      't(errors.network)',
      't(common.dismiss)',
      expect.objectContaining({ politeness: 'assertive', panelClass: 'toast-error' }),
    );
  });

  it('suppresses an identical toast repeated within 2 seconds', async () => {
    const toast = TestBed.inject(ToastService);
    toast.error('errors.offline');
    toast.error('errors.offline');
    toast.success('common.saved');
    await vi.waitFor(() => expect(open).toHaveBeenCalledTimes(2));
  });
});
