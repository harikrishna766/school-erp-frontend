import { FormControl } from '@angular/forms';
import { AppValidators, firstError, formatIndianMobile, normalizeIndianMobile } from './validators';

describe('form validators', () => {
  it.each([
    ['9876543210', '+919876543210'],
    ['+91 98765 43210', '+919876543210'],
    ['09876543210', '+919876543210'],
    ['919876543210', '+919876543210'],
    ['5876543210', null],
    ['98765', null],
  ])('normalizeIndianMobile(%s) → %s', (input, expected) => {
    expect(normalizeIndianMobile(input)).toBe(expected);
  });

  it('formats for display', () => {
    expect(formatIndianMobile('+919876543210')).toBe('+91 98765 43210');
  });

  it('emailOrPhone accepts either and ignores empty (required handles that)', () => {
    const v = AppValidators.emailOrPhone;
    expect(v(new FormControl('a@b.co'))).toBeNull();
    expect(v(new FormControl('98765 43210'))).toBeNull();
    expect(v(new FormControl(''))).toBeNull();
    expect(v(new FormControl('not an id'))).toEqual({ emailOrPhone: true });
  });

  it('otp requires exactly N digits', () => {
    const v = AppValidators.otp(6);
    expect(v(new FormControl('123456'))).toBeNull();
    expect(v(new FormControl('12345'))).toEqual({ otp: { length: 6 } });
    expect(v(new FormControl('12345a'))).toEqual({ otp: { length: 6 } });
  });

  it('firstError returns a translation key with params', () => {
    const control = new FormControl('12', AppValidators.otp(6));
    expect(firstError(control)).toEqual({ key: 'validation.otp', params: { length: 6 } });
    expect(firstError(new FormControl('x'))).toBeNull();
  });
});
