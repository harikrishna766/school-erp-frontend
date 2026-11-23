import { BreakpointObserver } from '@angular/cdk/layout';
import { DOCUMENT, Injectable, computed, effect, inject, signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { map } from 'rxjs';
import { PREF_KEYS, prefs } from '../storage/local-storage';
import { derivePalette } from './color';

export type ThemeMode = 'light' | 'dark' | 'system';

const DARK_QUERY = '(prefers-color-scheme: dark)';
const THEME_MODES: readonly ThemeMode[] = ['light', 'dark', 'system'];

function storedMode(): ThemeMode {
  const value = prefs.get(PREF_KEYS.theme);
  return THEME_MODES.includes(value as ThemeMode) ? (value as ThemeMode) : 'system';
}

/**
 * Owns light/dark mode and per-school brand colour. Material 3 tokens are emitted with
 * `light-dark()`, so switching is just `color-scheme` on <html>; the `.dark` class is for
 * Tailwind's `dark:` variant.
 */
@Injectable({ providedIn: 'root' })
export class ThemeService {
  private readonly document = inject(DOCUMENT);
  private readonly breakpoints = inject(BreakpointObserver);

  private readonly prefersDark = toSignal(
    this.breakpoints.observe(DARK_QUERY).pipe(map((state) => state.matches)),
    { initialValue: this.breakpoints.isMatched(DARK_QUERY) },
  );

  readonly mode = signal<ThemeMode>(storedMode());
  readonly isDark = computed(
    () => this.mode() === 'dark' || (this.mode() === 'system' && this.prefersDark()),
  );

  constructor() {
    effect(() => {
      const dark = this.isDark();
      const root = this.document.documentElement;
      root.classList.toggle('dark', dark);
      root.style.colorScheme = dark ? 'dark' : 'light';
      prefs.set(PREF_KEYS.theme, this.mode());
    });
  }

  setMode(mode: ThemeMode): void {
    this.mode.set(mode);
  }

  toggle(): void {
    this.mode.set(this.isDark() ? 'light' : 'dark');
  }

  /**
   * Applies a school's brand colour. Invalid or empty colours restore the default
   * palette. Derived roles are contrast-checked (see `derivePalette`).
   */
  applyBrandColor(hex: string | null | undefined): void {
    const root = this.document.documentElement;
    const palette = hex ? derivePalette(hex) : null;
    if (!palette) {
      delete root.dataset['branded'];
      return;
    }
    const vars: Record<string, string> = {
      '--brand-primary-light': palette.primaryLight,
      '--brand-on-primary-light': palette.onPrimaryLight,
      '--brand-container-light': palette.containerLight,
      '--brand-on-container-light': palette.onContainerLight,
      '--brand-primary-dark': palette.primaryDark,
      '--brand-on-primary-dark': palette.onPrimaryDark,
      '--brand-container-dark': palette.containerDark,
      '--brand-on-container-dark': palette.onContainerDark,
    };
    for (const [name, value] of Object.entries(vars)) {
      root.style.setProperty(name, value);
    }
    root.dataset['branded'] = '';
    this.document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', palette.primaryLight);
  }
}
