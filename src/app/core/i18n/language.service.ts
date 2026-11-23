import { DOCUMENT, Injectable, computed, inject, signal } from '@angular/core';
import { TranslateService } from '@ngx-translate/core';
import { firstValueFrom } from 'rxjs';
import { APP_CONFIG } from '../config/app-config';
import { PREF_KEYS, prefs } from '../storage/local-storage';
import { LANGUAGES, isLanguage, type Language, type LanguageDef } from './languages';

/**
 * Current UI language. Keeps ngx-translate, `<html lang>` and `<html dir>` in sync;
 * the shell binds `dir` into CDK's `Directionality` so Material components flip too.
 */
@Injectable({ providedIn: 'root' })
export class LanguageService {
  private readonly translate = inject(TranslateService);
  private readonly document = inject(DOCUMENT);
  private readonly config = inject(APP_CONFIG);

  readonly languages: readonly LanguageDef[] = LANGUAGES;
  readonly current = signal<Language>(this.initialLanguage());
  readonly dir = computed(() => LANGUAGES.find((l) => l.code === this.current())?.dir ?? 'ltr');

  /** Called once from an app initializer so the first paint is already translated. */
  async init(): Promise<void> {
    await this.use(this.current());
  }

  async use(lang: Language): Promise<void> {
    await firstValueFrom(this.translate.use(lang));
    this.current.set(lang);
    const root = this.document.documentElement;
    root.lang = lang;
    root.dir = this.dir();
    prefs.set(PREF_KEYS.language, lang);
  }

  private initialLanguage(): Language {
    const stored = prefs.get(PREF_KEYS.language);
    if (stored && isLanguage(stored)) {
      return stored;
    }
    const browser = this.document.defaultView?.navigator.language.slice(0, 2) ?? '';
    return isLanguage(browser) ? browser : this.config.defaultLanguage;
  }
}
