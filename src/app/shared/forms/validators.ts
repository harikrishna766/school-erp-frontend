import type { AbstractControl, ValidationErrors, ValidatorFn } from '@angular/forms';

const EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
/** Indian mobile: 10 digits starting 6–9, optionally prefixed by +91 / 91 / 0. */
const IN_MOBILE = /^(?:\+?91|0)?([6-9]\d{9})$/;

const digitsAndPlus = (value: string): string => value.replace(/[\s()-]/g, '');

/** `+91XXXXXXXXXX` for a valid Indian mobile number, otherwise null. */
export function normalizeIndianMobile(value: string): string | null {
  const match = IN_MOBILE.exec(digitsAndPlus(value));
  return match ? `+91${match[1]}` : null;
}

/** `+91 98765 43210` for display; input must already be normalized. */
export function formatIndianMobile(e164: string): string {
  const digits = e164.replace(/^\+91/, '');
  return digits.length === 10 ? `+91 ${digits.slice(0, 5)} ${digits.slice(5)}` : e164;
}

const str = (control: AbstractControl): string =>
  typeof control.value === 'string' ? control.value.trim() : '';

/** Reusable typed validators. Error keys map to `validation.<key>` translations. */
export const AppValidators = {
  indianMobile: ((control) => {
    const value = str(control);
    return !value || normalizeIndianMobile(value) ? null : { indianMobile: true };
  }) satisfies ValidatorFn,

  /** Email address or Indian mobile number (login identifier). */
  emailOrPhone: ((control) => {
    const value = str(control);
    return !value || EMAIL.test(value) || normalizeIndianMobile(value)
      ? null
      : { emailOrPhone: true };
  }) satisfies ValidatorFn,

  /** Numeric one-time code of exactly `length` digits. */
  otp(length = 6): ValidatorFn {
    const pattern = new RegExp(`^\\d{${length}}$`);
    return (control): ValidationErrors | null => {
      const value = str(control);
      return !value || pattern.test(value) ? null : { otp: { length } };
    };
  },

  pattern(regex: RegExp, errorKey: string): ValidatorFn {
    return (control) => {
      const value = str(control);
      return !value || regex.test(value) ? null : { [errorKey]: true };
    };
  },
};

/** First error of a control as a translation key + params, for <mat-error>. */
export function firstError(
  control: AbstractControl | null,
): { key: string; params?: Record<string, unknown> } | null {
  const errors = control?.errors;
  if (!errors) {
    return null;
  }
  const [name, detail] = Object.entries(errors)[0];
  return {
    key: `validation.${name}`,
    params:
      typeof detail === 'object' && detail !== null
        ? (detail as Record<string, unknown>)
        : undefined,
  };
}
