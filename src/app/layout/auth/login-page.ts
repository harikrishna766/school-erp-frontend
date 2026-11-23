import { Dir } from '@angular/cdk/bidi';
import {
  ChangeDetectionStrategy,
  Component,
  computed,
  effect,
  inject,
  input,
  signal,
} from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { MatMenuModule } from '@angular/material/menu';
import { MatProgressSpinnerModule } from '@angular/material/progress-spinner';
import { MatTabsModule } from '@angular/material/tabs';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { interval, map } from 'rxjs';
import { environment } from '../../../environments/environment';
import { AuthStore } from '../../core/auth/auth.store';
import { LanguageService } from '../../core/i18n/language.service';
import { BrandingStore } from '../../core/tenant/branding.store';
import { SCHOOL_CODE_PATTERN, TenantContext } from '../../core/tenant/tenant-context';
import { ThemeService } from '../../core/theme/theme.service';
import { FieldErrorPipe } from '../../shared/forms/field-error.pipe';
import {
  AppValidators,
  formatIndianMobile,
  normalizeIndianMobile,
} from '../../shared/forms/validators';
import { authErrorKey, safeReturnUrl } from './auth-errors';

type PasswordStep = { kind: 'credentials' } | { kind: 'two-factor'; challengeToken: string };
type OtpStep =
  { kind: 'phone' } | { kind: 'code'; phone: string; displayPhone: string; resendAt: number };

/** The API doesn't dictate a resend interval; this keeps users from tripping OTP_RATE_LIMITED. */
const OTP_RESEND_SECONDS = 30;

/** Demo accounts served by MSW (mock builds only). */
const DEMO_ACCOUNTS = [
  { label: 'Principal', email: 'principal@greenwood.test' },
  { label: 'Teacher', email: 'teacher@greenwood.test' },
  { label: 'Accountant', email: 'accounts@greenwood.test' },
  { label: 'Student', email: 'student@greenwood.test' },
  { label: 'Org admin (2FA setup)', email: 'admin@greenwood.test' },
] as const;

/**
 * Sign-in. Staff & students use email/phone + password (+ TOTP when enabled); parents,
 * who often have no password, use mobile + SMS OTP. Smart component: owns the flow,
 * delegates every call to AuthStore.
 */
@Component({
  selector: 'app-login-page',
  imports: [
    Dir,
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    MatMenuModule,
    MatProgressSpinnerModule,
    MatTabsModule,
    TranslatePipe,
    FieldErrorPipe,
  ],
  templateUrl: './login-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LoginPage {
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly fb = inject(NonNullableFormBuilder);
  protected readonly tenant = inject(TenantContext);
  protected readonly branding = inject(BrandingStore);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);

  /** From `?returnUrl=` (withComponentInputBinding). */
  readonly returnUrl = input<string | undefined>(undefined);

  protected readonly demoAccounts = environment.mockApi ? DEMO_ACCOUNTS : [];
  /** Super-admin sign-in: no school, password only. */
  protected readonly platformMode = signal(false);
  protected readonly needsSchoolCode = computed(
    () => this.tenant.slug() === null && !this.platformMode(),
  );
  protected readonly useRecoveryCode = signal(false);

  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly passwordVisible = signal(false);
  protected readonly passwordStep = signal<PasswordStep>({ kind: 'credentials' });
  protected readonly otpStep = signal<OtpStep>({ kind: 'phone' });

  private readonly now = toSignal(interval(1000).pipe(map(() => Date.now())), {
    initialValue: Date.now(),
  });
  protected readonly resendIn = computed(() => {
    const step = this.otpStep();
    return step.kind === 'code' ? Math.max(0, Math.ceil((step.resendAt - this.now()) / 1000)) : 0;
  });

  protected readonly schoolForm = this.fb.group({
    code: ['', [Validators.required, AppValidators.pattern(SCHOOL_CODE_PATTERN, 'schoolCode')]],
  });
  protected readonly passwordForm = this.fb.group({
    email: ['', [Validators.required, Validators.email]],
    password: ['', [Validators.required]],
  });
  protected readonly twoFactorForm = this.fb.group({
    code: ['', [Validators.required, AppValidators.otp(6)]],
  });
  protected readonly recoveryForm = this.fb.group({
    recoveryCode: ['', [Validators.required, Validators.minLength(8)]],
  });
  protected readonly phoneForm = this.fb.group({
    phone: ['', [Validators.required, AppValidators.indianMobile]],
  });
  protected readonly otpForm = this.fb.group({
    code: ['', [Validators.required, AppValidators.otp(6)]],
  });

  constructor() {
    // Re-fetch branding when the school changes via school-code entry (the initial
    // school's branding was already loaded at startup).
    let previous = this.tenant.slug();
    effect(() => {
      const slug = this.tenant.slug();
      if (slug !== previous) {
        previous = slug;
        void this.branding.load();
      }
    });
  }

  protected submitSchoolCode(): void {
    if (this.schoolForm.invalid) {
      this.schoolForm.markAllAsTouched();
      return;
    }
    this.tenant.setSchoolCode(this.schoolForm.controls.code.value);
  }

  protected changeSchool(): void {
    this.platformMode.set(false);
    this.tenant.setSchoolCode('');
  }

  protected signInAsPlatformAdmin(): void {
    this.platformMode.set(true);
    this.errorKey.set(null);
  }

  protected useDemo(email: string): void {
    this.passwordForm.setValue({ email, password: 'demo1234' });
  }

  protected onTabChange(): void {
    this.errorKey.set(null);
  }

  protected submitPassword(): Promise<void> {
    return this.run(this.passwordForm, 'password', async () => {
      const { email, password } = this.passwordForm.getRawValue();
      const outcome = await this.auth.loginWithPassword(email, password, {
        platform: this.platformMode(),
      });
      if (outcome.kind === 'two-factor') {
        this.passwordStep.set({ kind: 'two-factor', challengeToken: outcome.challengeToken });
        this.useRecoveryCode.set(false);
        this.twoFactorForm.reset();
        this.recoveryForm.reset();
        return false;
      }
      return true;
    });
  }

  protected submitTwoFactor(): Promise<void> {
    const step = this.passwordStep();
    if (step.kind !== 'two-factor') {
      return Promise.resolve();
    }
    if (this.useRecoveryCode()) {
      return this.run(this.recoveryForm, 'code', async () => {
        await this.auth.verifyTwoFactor(step.challengeToken, {
          recoveryCode: this.recoveryForm.controls.recoveryCode.value.trim(),
        });
        return true;
      });
    }
    return this.run(this.twoFactorForm, 'code', async () => {
      await this.auth.verifyTwoFactor(step.challengeToken, {
        code: this.twoFactorForm.controls.code.value,
      });
      return true;
    });
  }

  protected toggleRecoveryCode(): void {
    this.useRecoveryCode.update((v) => !v);
    this.errorKey.set(null);
  }

  protected backToCredentials(): void {
    this.passwordStep.set({ kind: 'credentials' });
    this.errorKey.set(null);
  }

  protected requestOtp(): Promise<void> {
    return this.run(this.phoneForm, 'otp-request', async () => {
      const phone = normalizeIndianMobile(this.phoneForm.controls.phone.value) as string;
      await this.auth.requestOtp(phone);
      this.otpStep.set({
        kind: 'code',
        phone,
        displayPhone: formatIndianMobile(phone),
        resendAt: Date.now() + OTP_RESEND_SECONDS * 1000,
      });
      this.otpForm.reset();
      return false;
    });
  }

  protected submitOtp(): Promise<void> {
    const step = this.otpStep();
    if (step.kind !== 'code') {
      return Promise.resolve();
    }
    return this.run(this.otpForm, 'code', async () => {
      await this.auth.verifyOtp(step.phone, this.otpForm.controls.code.value);
      return true;
    });
  }

  protected changePhone(): void {
    this.otpStep.set({ kind: 'phone' });
    this.errorKey.set(null);
  }

  /** Validates, runs the step with busy/error handling, navigates when signed in. */
  private async run(
    form: { invalid: boolean; markAllAsTouched(): void },
    step: Parameters<typeof authErrorKey>[1],
    action: () => Promise<boolean>,
  ): Promise<void> {
    if (form.invalid) {
      form.markAllAsTouched();
      return;
    }
    if (this.busy()) {
      return;
    }
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      if (await action()) {
        await this.router.navigateByUrl(safeReturnUrl(this.returnUrl()));
      }
    } catch (error) {
      this.errorKey.set(authErrorKey(error, step));
    } finally {
      this.busy.set(false);
    }
  }
}
