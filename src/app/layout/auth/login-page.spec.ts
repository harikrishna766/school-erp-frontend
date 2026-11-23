import { HttpErrorResponse } from '@angular/common/http';
import { signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideNoopAnimations } from '@angular/platform-browser/animations';
import { Router } from '@angular/router';
import { AuthStore } from '../../core/auth/auth.store';
import { BrandingStore } from '../../core/tenant/branding.store';
import { TenantContext } from '../../core/tenant/tenant-context';
import { provideTestBasics, provideTestConfig } from '../../../testing/providers';
import { LoginPage } from './login-page';

describe('LoginPage', () => {
  const auth = {
    loginWithPassword: vi.fn(),
    verifyTwoFactor: vi.fn(),
    requestOtp: vi.fn(),
    verifyOtp: vi.fn(),
  };
  const slug = signal<string | null>('greenwood');
  const tenant = { slug, isFixed: true, setSchoolCode: vi.fn() };
  const branding = {
    load: vi.fn(),
    logoUrl: signal(null),
    schoolName: signal('Greenwood'),
  };

  async function render(returnUrl?: string) {
    TestBed.configureTestingModule({
      providers: [
        ...provideTestBasics(),
        provideNoopAnimations(),
        provideTestConfig(),
        { provide: AuthStore, useValue: auth },
        { provide: TenantContext, useValue: tenant },
        { provide: BrandingStore, useValue: branding },
      ],
    });
    const router = TestBed.inject(Router);
    const navigate = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(LoginPage);
    if (returnUrl) fixture.componentRef.setInput('returnUrl', returnUrl);
    await fixture.whenStable();
    const el = fixture.nativeElement as HTMLElement;
    const q = <T extends Element = HTMLElement>(id: string) =>
      el.querySelector<T>(`[data-testid="${id}"]`);
    const type = async (id: string, value: string) => {
      const input = q<HTMLInputElement>(id)!;
      input.value = value;
      input.dispatchEvent(new Event('input'));
      await fixture.whenStable();
    };
    const submit = async (id: string) => {
      q<HTMLButtonElement>(id)!.click();
      await fixture.whenStable();
      await new Promise((r) => setTimeout(r));
      await fixture.whenStable();
    };
    return { fixture, el, q, type, submit, navigate };
  }

  beforeEach(() => {
    vi.clearAllMocks();
    slug.set('greenwood');
  });

  it('does not call the API for an invalid form and shows field errors', async () => {
    const { el, type, submit } = await render();
    await type('identifier', 'not-an-id');
    await submit('login-submit');
    expect(auth.loginWithPassword).not.toHaveBeenCalled();
    expect(el.textContent).toContain('validation.emailOrPhone');
    expect(el.textContent).toContain('validation.required');
  });

  it('signs in and goes to a safe returnUrl', async () => {
    auth.loginWithPassword.mockResolvedValue({ kind: 'authenticated' });
    const { type, submit, navigate } = await render('/fees?tab=due');
    await type('identifier', 'teacher@greenwood.test');
    await type('password', 'pw');
    await submit('login-submit');
    expect(auth.loginWithPassword).toHaveBeenCalledWith('teacher@greenwood.test', 'pw');
    expect(navigate).toHaveBeenCalledWith('/fees?tab=due');
  });

  it('ignores an external returnUrl', async () => {
    auth.loginWithPassword.mockResolvedValue({ kind: 'authenticated' });
    const { type, submit, navigate } = await render('https://evil.example');
    await type('identifier', 'teacher@greenwood.test');
    await type('password', 'pw');
    await submit('login-submit');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('asks for the 2FA code when required', async () => {
    auth.loginWithPassword.mockResolvedValue({ kind: 'two-factor', challengeId: 'c1' });
    auth.verifyTwoFactor.mockResolvedValue(undefined);
    const { q, type, submit, navigate } = await render();
    await type('identifier', 'admin@platform.test');
    await type('password', 'pw');
    await submit('login-submit');
    expect(navigate).not.toHaveBeenCalled();
    expect(q('two-factor-code')).not.toBeNull();
    await type('two-factor-code', '123456');
    await submit('two-factor-submit');
    expect(auth.verifyTwoFactor).toHaveBeenCalledWith('c1', '123456');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('shows an inline, announced error for wrong credentials', async () => {
    auth.loginWithPassword.mockRejectedValue(
      new HttpErrorResponse({
        status: 401,
        error: { success: false, error: { code: 'UNAUTHENTICATED' } },
      }),
    );
    const { q, type, submit } = await render();
    await type('identifier', 'teacher@greenwood.test');
    await type('password', 'bad');
    await submit('login-submit');
    const banner = q('login-error')!;
    expect(banner.getAttribute('role')).toBe('alert');
    expect(banner.textContent).toContain('auth.errors.invalidCredentials');
  });

  it('parent OTP: normalizes the number, then verifies the code', async () => {
    auth.requestOtp.mockResolvedValue({ challengeId: 'otp1', expiresIn: 300, resendAfter: 30 });
    auth.verifyOtp.mockResolvedValue(undefined);
    const { fixture, el, q, type, submit, navigate } = await render();
    el.querySelectorAll<HTMLElement>('[role="tab"]')[1].click();
    await fixture.whenStable();

    await type('otp-phone', '98765 43210');
    await submit('otp-request');
    expect(auth.requestOtp).toHaveBeenCalledWith('+919876543210');
    expect(q<HTMLButtonElement>('otp-resend')!.disabled).toBe(true);
    expect(el.textContent).toContain('auth.resendIn');

    await type('otp-code', '123456');
    await submit('otp-submit');
    expect(auth.verifyOtp).toHaveBeenCalledWith('otp1', '123456');
    expect(navigate).toHaveBeenCalledWith('/');
  });

  it('asks for a school code when no tenant is known', async () => {
    slug.set(null);
    const { el, q } = await render();
    expect(q('school-code')).not.toBeNull();
    expect(q('identifier')).toBeNull();
    expect(el.textContent).toContain('auth.schoolCode');
  });
});
