import { HttpContext } from '@angular/common/http';
import { ChangeDetectionStrategy, Component, inject, signal } from '@angular/core';
import { NonNullableFormBuilder, ReactiveFormsModule, Validators } from '@angular/forms';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatIconModule } from '@angular/material/icon';
import { MatInputModule } from '@angular/material/input';
import { Router } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { AuthService } from '../../api/generated/api/auth.service';
import { AccessStore } from '../../core/access/access.store';
import { AuthStore } from '../../core/auth/auth.store';
import { SKIP_ERROR_TOAST } from '../../core/http/http-context';
import { FieldErrorPipe } from '../../shared/forms/field-error.pipe';
import { AppValidators } from '../../shared/forms/validators';
import { authErrorKey } from './auth-errors';

type Step =
  | { kind: 'loading' }
  | { kind: 'scan'; secret: string; otpauthUrl: string; qrDataUrl: string | null }
  | { kind: 'codes'; recoveryCodes: readonly string[] };

/**
 * Mandatory TOTP enrolment for roles the backend lists in AUTH_REQUIRE_2FA_ROLES
 * (`twoFactorSetupRequired` in /me/access). Until it is done the backend rejects every
 * other call with TWO_FACTOR_SETUP_REQUIRED, so this page lives outside the shell.
 */
@Component({
  selector: 'app-two-factor-setup-page',
  imports: [
    ReactiveFormsModule,
    MatButtonModule,
    MatFormFieldModule,
    MatIconModule,
    MatInputModule,
    TranslatePipe,
    FieldErrorPipe,
  ],
  templateUrl: './two-factor-setup-page.html',
  styleUrl: './login-page.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class TwoFactorSetupPage {
  private readonly api = inject(AuthService);
  private readonly access = inject(AccessStore);
  private readonly auth = inject(AuthStore);
  private readonly router = inject(Router);
  private readonly context = new HttpContext().set(SKIP_ERROR_TOAST, true);

  protected readonly step = signal<Step>({ kind: 'loading' });
  protected readonly busy = signal(false);
  protected readonly errorKey = signal<string | null>(null);
  protected readonly copied = signal(false);

  protected readonly form = inject(NonNullableFormBuilder).group({
    code: ['', [Validators.required, AppValidators.otp(6)]],
  });

  constructor() {
    void this.start();
  }

  protected async start(): Promise<void> {
    this.errorKey.set(null);
    try {
      const setup = await firstValueFrom(
        this.api.authControllerSetupTwoFactorV1('body', false, { context: this.context }),
      );
      this.step.set({ kind: 'scan', ...setup, qrDataUrl: null });
      // QR rendering is lazy-loaded with this page only.
      const { toDataURL } = await import('qrcode');
      const qrDataUrl = await toDataURL(setup.otpauthUrl, { margin: 1, width: 200 });
      this.step.update((s) => (s.kind === 'scan' ? { ...s, qrDataUrl } : s));
    } catch (error) {
      this.errorKey.set(authErrorKey(error, 'code'));
    }
  }

  protected async enable(): Promise<void> {
    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }
    this.busy.set(true);
    this.errorKey.set(null);
    try {
      const res = await firstValueFrom(
        this.api.authControllerEnableTwoFactorV1(
          { twoFactorCodeDto: { code: this.form.controls.code.value } },
          'body',
          false,
          { context: this.context },
        ),
      );
      this.step.set({ kind: 'codes', recoveryCodes: res.recoveryCodes });
    } catch (error) {
      this.errorKey.set(authErrorKey(error, 'code'));
    } finally {
      this.busy.set(false);
    }
  }

  protected async copyCodes(codes: readonly string[]): Promise<void> {
    try {
      await navigator.clipboard.writeText(codes.join('\n'));
      this.copied.set(true);
    } catch {
      this.copied.set(false);
    }
  }

  protected async finish(): Promise<void> {
    await this.access.reload();
    await this.router.navigateByUrl('/');
  }

  protected logout(): void {
    void this.auth.logout();
  }
}
