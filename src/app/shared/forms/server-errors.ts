import { HttpErrorResponse } from '@angular/common/http';
import type { AbstractControl, FormArray, FormGroup } from '@angular/forms';
import { isApiFailure } from '../../core/http/api-envelope';

/** Backend `VALIDATION_FAILED` detail (school-erp-backend common/pipes/validation.pipe.ts). */
export interface ServerFieldError {
  readonly field: string;
  readonly constraints: readonly string[];
}

export interface ServerErrorResult {
  /** Messages not attached to any control: show them in <app-form-errors>. */
  readonly unmatched: readonly string[];
  /** Backend error code, if any (VALIDATION_FAILED, CONFLICT, …). */
  readonly code: string | null;
}

function isFieldErrorList(value: unknown): value is ServerFieldError[] {
  return (
    Array.isArray(value) &&
    value.every(
      (v) =>
        typeof v === 'object' &&
        v !== null &&
        typeof (v as ServerFieldError).field === 'string' &&
        Array.isArray((v as ServerFieldError).constraints),
    )
  );
}

/** Resolves `a.b`, `items.0.name` paths against nested groups and arrays. */
function controlAt(root: AbstractControl, path: string): AbstractControl | null {
  let current: AbstractControl | null = root;
  for (const segment of path.split('.')) {
    if (!current) {
      return null;
    }
    current = (current as FormGroup | FormArray).get(segment) ?? null;
  }
  return current === root ? null : current;
}

/**
 * Puts server-side validation messages onto the matching controls as a `server` error
 * (rendered by the fieldError pipe as `validation.server`). Anything that can't be placed,
 * including non-validation failures, is returned for a form-level summary.
 */
export function applyServerErrors(form: AbstractControl, error: unknown): ServerErrorResult {
  if (!(error instanceof HttpErrorResponse) || !isApiFailure(error.error)) {
    return { unmatched: [], code: null };
  }
  const { code, message, details } = error.error.error;
  if (!isFieldErrorList(details)) {
    return { unmatched: [message], code };
  }
  const unmatched: string[] = [];
  for (const { field, constraints } of details) {
    const control = controlAt(form, field);
    const text = constraints.join(' ');
    if (control) {
      control.setErrors({ ...(control.errors ?? {}), server: { message: text } });
      control.markAsTouched();
    } else {
      unmatched.push(`${field}: ${text}`);
    }
  }
  return { unmatched, code };
}

/** Moves focus to the first invalid, focusable control inside `host` (WCAG 3.3.1). */
export function focusFirstInvalid(host: HTMLElement): void {
  const target = host.querySelector<HTMLElement>(
    'input.ng-invalid, select.ng-invalid, textarea.ng-invalid, [formcontrolname].ng-invalid input, mat-select.ng-invalid',
  );
  target?.focus();
}
