import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { TranslatePipe } from '@ngx-translate/core';
import type { Language, LanguageDef } from '../../core/i18n/languages';

/** Top app bar. Presentational: all state comes in through inputs. */
@Component({
  selector: 'app-header',
  imports: [
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatTooltipModule,
    TranslatePipe,
  ],
  templateUrl: './header.html',
  styleUrl: './header.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Header {
  readonly schoolName = input<string | null>(null);
  readonly logoUrl = input<string | null>(null);
  /** Shows the school identity in the bar (phone, where the side nav is hidden). */
  readonly showBrand = input(false);
  readonly showMenuButton = input(true);
  readonly navExpanded = input(false);
  readonly isDark = input(false);
  readonly languages = input.required<readonly LanguageDef[]>();
  readonly currentLanguage = input.required<Language>();

  readonly userName = input<string | null>(null);
  /** Comma-separated role names shown under the user's name. */
  readonly userRoles = input<string | null>(null);

  protected readonly initials = computed(() =>
    (this.userName() ?? '')
      .split(/\s+/)
      .filter(Boolean)
      .slice(0, 2)
      .map((part) => part[0]?.toUpperCase())
      .join(''),
  );

  readonly branches = input<readonly { id: string; name: string }[]>([]);
  readonly activeBranchId = input<string | null>(null);

  readonly menuToggle = output();
  readonly logout = output();
  readonly branchChange = output<string>();
  readonly themeToggle = output();
  readonly languageChange = output<Language>();
}
