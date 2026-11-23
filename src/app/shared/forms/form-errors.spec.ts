import { TestBed } from '@angular/core/testing';
import { provideTestBasics } from '../../../testing/providers';
import { FormErrors } from './form-errors';

describe('FormErrors', () => {
  it('renders nothing without errors, then an alert with links that focus fields', async () => {
    TestBed.configureTestingModule({ providers: provideTestBasics() });
    const fixture = TestBed.createComponent(FormErrors);
    fixture.componentRef.setInput('errors', []);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('[role="alert"]')).toBeNull();

    const input = document.createElement('input');
    input.id = 'pin';
    document.body.appendChild(input);
    fixture.componentRef.setInput('errors', [
      { message: 'validation.required', fieldId: 'pin' },
      { message: 'Code already used' },
    ]);
    await fixture.whenStable();
    expect(el.querySelector('[role="alert"]')).not.toBeNull();
    expect(el.querySelectorAll('li')).toHaveLength(2);
    el.querySelector<HTMLAnchorElement>('a')!.click();
    expect(document.activeElement).toBe(input);
    input.remove();
  });
});
