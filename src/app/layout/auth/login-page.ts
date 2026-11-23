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

type PasswordStep = { kind: 'credentials' } | { kind: 'two-factor'; challengeId: string };
type OtpStep =
  { kind: 'phone' } | { kind: 'code'; challengeId: string; phone: string; resendAt: number };

/** Demo accounts served by MSW (mock builds only). */
const DEMO_ACCOUNTS = [
  { label: 'Principal', identifier: 'principal@greenwood.test' },
  { label: 'Teacher', identifier: 'teacher@greenwood.test' },
  { label: 'Accountant', identifier: 'accounts@greenwood.test' },
  { label: 'Student', identifier: 'student@greenwood.test' },
  { label: 'Super admin (2FA)', identifier: 'admin@platform.test' },
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
  protected readonly needsSchoolCode = computed(() => this.tenant.slug() === null);

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
    identifier: ['', [Validators.required, AppValidators.emailOrPhone]],
    password: ['', [Validators.required]],
  });
  protected readonly twoFactorForm = this.fb.group({
    code: ['', [Validators.required, AppValidators.otp(6)]],
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
    this.tenant.setSchoolCode('');
  }

  protected useDemo(identifier: string): void {
    this.passwordForm.setValue({ identifier, password: 'demo1234' });
  }

  protected onTabChange(): void {
    this.errorKey.set(null);
  }

  protected submitPassword(): Promise<void> {
    return this.run(this.passwordForm, 'password', async () => {
      const { identifier, password } = this.passwordForm.getRawValue();
      const outcome = await this.auth.loginWithPassword(identifier, password);
      if (outcome.kind === 'two-factor') {
        this.passwordStep.set({ kind: 'two-factor', challengeId: outcome.challengeId });
        this.twoFactorForm.reset();
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
    return this.run(this.twoFactorForm, 'code', async () => {
      await this.auth.verifyTwoFactor(step.challengeId, this.twoFactorForm.controls.code.value);
      return true;
    });
  }

  protected backToCredentials(): void {
    this.passwordStep.set({ kind: 'credentials' });
    this.errorKey.set(null);
  }

  protected requestOtp(): Promise<void> {
    return this.run(this.phoneForm, 'otp-request', async () => {
      const phone = normalizeIndianMobile(this.phoneForm.controls.phone.value) as string;
      const challenge = await this.auth.requestOtp(phone);
      this.otpStep.set({
        kind: 'code',
        challengeId: challenge.challengeId,
        phone: formatIndianMobile(phone),
        resendAt: Date.now() + challenge.resendAfter * 1000,
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
      await this.auth.verifyOtp(step.challengeId, this.otpForm.controls.code.value);
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
