import { Pipe, type PipeTransform } from '@angular/core';
import type { AbstractControl } from '@angular/forms';
import { firstError } from './validators';

/**
 * `{{ form.controls.phone | fieldError | translate: ... }}` is awkward with params, so this
 * returns `{ key, params }` for use with the translate pipe:
 * `@if (ctrl | fieldError; as e) { <mat-error>{{ e.key | translate: e.params }}</mat-error> }`
 * Impure because control errors change without the control reference changing.
 */
@Pipe({ name: 'fieldError', pure: false })
export class FieldErrorPipe implements PipeTransform {
  transform(control: AbstractControl | null): ReturnType<typeof firstError> {
    return firstError(control);
  }
}
