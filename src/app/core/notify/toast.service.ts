import { Injectable, Injector, inject } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';

export type ToastKind = 'info' | 'success' | 'error';

const DURATION: Record<ToastKind, number> = { info: 4000, success: 3000, error: 7000 };

/**
 * App-wide notifications. Messages are translation keys. Errors are announced
 * assertively to screen readers and stay longer. Identical consecutive toasts are not
 * stacked (e.g. ten failed requests while offline show one message).
 *
 * MatSnackBar (and the CDK overlay stack behind it, ~40 KB gzipped) is imported on the
 * first toast rather than eagerly: it is never needed for first paint, and the error
 * interceptor that uses this service is part of the initial bundle.
 *
 * Dependencies are resolved lazily for a second reason: TranslateService loads its JSON
 * through HttpClient → interceptors → this service, so eager injection would be a
 * circular dependency (NG0200) during startup.
 */
@Injectable({ providedIn: 'root' })
export class ToastService {
  private readonly injector = inject(Injector);
  private last: { text: string; at: number } | null = null;

  show(key: string, kind: ToastKind = 'info', params?: Record<string, unknown>): void {
    const translate = this.injector.get(TranslateService);
    const text = translate.instant(key, params) as string;
    const now = Date.now();
    if (this.last && this.last.text === text && now - this.last.at < 2000) {
      return;
    }
    this.last = { text, at: now };
    const action = translate.instant('common.dismiss') as string;
    void import('@angular/material/snack-bar').then(({ MatSnackBar }) =>
      this.injector.get(MatSnackBar).open(text, action, {
        duration: DURATION[kind],
        panelClass: `toast-${kind}`,
        politeness: kind === 'error' ? 'assertive' : 'polite',
      }),
    );
  }

  success(key: string, params?: Record<string, unknown>): void {
    this.show(key, 'success', params);
  }

  error(key: string, params?: Record<string, unknown>): void {
    this.show(key, 'error', params);
  }
}
