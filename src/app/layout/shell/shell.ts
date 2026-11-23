import { Dir } from '@angular/cdk/bidi';
import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  effect,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSidenavModule } from '@angular/material/sidenav';
import { NavigationEnd, Router, RouterOutlet } from '@angular/router';
import { TranslatePipe } from '@ngx-translate/core';
import { filter } from 'rxjs';
import { AccessStore } from '../../core/access/access.store';
import { AuthStore } from '../../core/auth/auth.store';
import { LoadingService } from '../../core/http/loading.service';
import { LanguageService } from '../../core/i18n/language.service';
import type { Language } from '../../core/i18n/languages';
import { BreakpointService } from '../../core/layout/breakpoint.service';
import { PREF_KEYS, prefs } from '../../core/storage/local-storage';
import { BranchContext } from '../../core/tenant/branch-context';
import { BrandingStore } from '../../core/tenant/branding.store';
import { ThemeService } from '../../core/theme/theme.service';
import { BottomNav } from '../bottom-nav/bottom-nav';
import { Header } from '../header/header';
import { HOME_ITEM, NavigationService } from '../navigation/navigation.service';
import { SideNav } from '../side-nav/side-nav';

/**
 * Responsive application frame.
 *
 * | device  | side nav                         | bottom bar |
 * |---------|----------------------------------|------------|
 * | phone   | modal drawer ("More" / ☰)        | yes        |
 * | tablet  | rail (icons) ⇄ expanded, toggled | no         |
 * | desktop | always expanded                  | no         |
 */
@Component({
  selector: 'app-shell',
  imports: [
    Dir,
    RouterOutlet,
    MatSidenavModule,
    MatProgressBarModule,
    TranslatePipe,
    Header,
    SideNav,
    BottomNav,
  ],
  templateUrl: './shell.html',
  styleUrl: './shell.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Shell {
  protected readonly breakpoints = inject(BreakpointService);
  protected readonly navigation = inject(NavigationService);
  protected readonly theme = inject(ThemeService);
  protected readonly language = inject(LanguageService);
  protected readonly branding = inject(BrandingStore);
  protected readonly loading = inject(LoadingService);
  private readonly auth = inject(AuthStore);
  private readonly access = inject(AccessStore);

  protected readonly userName = computed(() => {
    const user = this.access.user();
    return user ? [user.firstName, user.lastName].filter(Boolean).join(' ') : null;
  });
  protected readonly branches = this.access.branches;
  protected readonly activeBranchId = inject(BranchContext).id;
  protected readonly userRoles = computed(
    () =>
      this.access
        .roles()
        .map((r) => r.name)
        .join(', ') || null,
  );

  protected readonly home = HOME_ITEM;

  /** Phone: modal drawer state. */
  protected readonly drawerOpen = signal(false);
  /** Tablet: rail vs expanded. Persisted; rail is the default. */
  protected readonly tabletExpanded = signal(prefs.get(PREF_KEYS.navCollapsed) === 'false');

  protected readonly mode = computed(() => (this.breakpoints.isPhone() ? 'over' : 'side'));
  protected readonly opened = computed(() => !this.breakpoints.isPhone() || this.drawerOpen());
  protected readonly collapsed = computed(
    () => this.breakpoints.isTablet() && !this.tabletExpanded(),
  );
  protected readonly navExpanded = computed(() =>
    this.breakpoints.isPhone() ? this.drawerOpen() : !this.collapsed(),
  );

  constructor() {
    inject(Router)
      .events.pipe(
        filter((e) => e instanceof NavigationEnd),
        takeUntilDestroyed(inject(DestroyRef)),
      )
      .subscribe(() => this.drawerOpen.set(false));

    // Leaving phone layout must not leave a stale modal drawer behind.
    effect(() => {
      if (!this.breakpoints.isPhone()) {
        this.drawerOpen.set(false);
      }
    });
  }

  protected toggleNav(): void {
    if (this.breakpoints.isPhone()) {
      this.drawerOpen.update((open) => !open);
      return;
    }
    this.tabletExpanded.update((expanded) => !expanded);
    prefs.set(PREF_KEYS.navCollapsed, String(!this.tabletExpanded()));
  }

  protected skipToMain(event: Event, main: HTMLElement): void {
    event.preventDefault();
    main.focus();
  }

  protected switchBranch(id: string): void {
    void this.access.switchBranch(id);
  }

  protected logout(): void {
    void this.auth.logout();
  }

  protected setLanguage(lang: Language): void {
    void this.language.use(lang);
  }
}
