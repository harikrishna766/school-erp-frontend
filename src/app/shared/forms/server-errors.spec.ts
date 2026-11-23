import { HttpErrorResponse } from '@angular/common/http';
import { FormArray, FormControl, FormGroup } from '@angular/forms';
import { firstError } from './validators';
import { applyServerErrors } from './server-errors';

const validationError = (details: unknown) =>
  new HttpErrorResponse({
    status: 400,
    error: {
      success: false,
      error: { code: 'VALIDATION_FAILED', message: 'Request validation failed', details },
    },
  });

describe('applyServerErrors', () => {
  const form = () =>
    new FormGroup({
      name: new FormControl('x'),
      address: new FormGroup({ pin: new FormControl('1') }),
      periods: new FormArray([new FormGroup({ start: new FormControl('09:00') })]),
    });

  it('attaches messages to nested and array controls, returning the rest', () => {
    const f = form();
    const result = applyServerErrors(
      f,
      validationError([
        { field: 'name', constraints: ['name must be shorter than 60 characters'] },
        { field: 'address.pin', constraints: ['pin must be 6 digits'] },
        { field: 'periods.0.start', constraints: ['start must be before end'] },
        { field: 'unknownField', constraints: ['property unknownField should not exist'] },
      ]),
    );
    expect(result.code).toBe('VALIDATION_FAILED');
    expect(firstError(f.get('name'))).toEqual({
      key: 'validation.server',
      params: { message: 'name must be shorter than 60 characters' },
    });
    expect(f.get('address.pin')?.errors?.['server']).toEqual({ message: 'pin must be 6 digits' });
    expect(f.get('periods.0.start')?.touched).toBe(true);
    expect(result.unmatched).toEqual(['unknownField: property unknownField should not exist']);
  });

  it('returns the message of non-validation failures for a form-level summary', () => {
    const result = applyServerErrors(
      form(),
      new HttpErrorResponse({
        status: 409,
        error: { success: false, error: { code: 'CONFLICT', message: 'Code already used' } },
      }),
    );
    expect(result).toEqual({ unmatched: ['Code already used'], code: 'CONFLICT' });
  });

  it('ignores errors that are not API failures', () => {
    expect(applyServerErrors(form(), new Error('x'))).toEqual({ unmatched: [], code: null });
  });
});
