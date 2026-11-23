import { HttpErrorResponse } from '@angular/common/http';
import { type ErrorHandler, Injectable, inject } from '@angular/core';
import { ToastService } from '../notify/toast.service';

/**
 * Last-resort handler for uncaught errors. HTTP errors were already reported by the error
 * interceptor (or deliberately handled by the caller), so they are only logged here.
 */
@Injectable()
export class AppErrorHandler implements ErrorHandler {
  private readonly toast = inject(ToastService);

  handleError(error: unknown): void {
    console.error(error);
    const httpError =
      error instanceof HttpErrorResponse ||
      (error as { rejection?: unknown } | null)?.rejection instanceof HttpErrorResponse;
    if (!httpError) {
      this.toast.error('errors.unexpected');
    }
  }
}
