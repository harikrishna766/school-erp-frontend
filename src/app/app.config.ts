import { provideHttpClient, withFetch } from '@angular/common/http';
import {
  type ApplicationConfig,
  inject,
  isDevMode,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { MatIconRegistry } from '@angular/material/icon';
import {
  TitleStrategy,
  provideRouter,
  withComponentInputBinding,
  withInMemoryScrolling,
  withViewTransitions,
} from '@angular/router';
import { provideServiceWorker } from '@angular/service-worker';
import { provideTranslateService } from '@ngx-translate/core';
import { provideTranslateHttpLoader } from '@ngx-translate/http-loader';
import { routes } from './app.routes';
import { APP_CONFIG, type AppConfig } from './core/config/app-config';
import { LanguageService } from './core/i18n/language.service';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { MODULE_REGISTRY } from './core/modules/module-def';
import { BrandingStore } from './core/tenant/branding.store';
import { ThemeService } from './core/theme/theme.service';
import { APP_MODULES } from './module-registry';

export function appConfig(
  config: AppConfig,
  { serviceWorker }: { serviceWorker: boolean },
): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: APP_CONFIG, useValue: config },
      { provide: MODULE_REGISTRY, useValue: APP_MODULES },
      provideHttpClient(withFetch()),
      provideRouter(
        routes,
        withComponentInputBinding(),
        withInMemoryScrolling({ scrollPositionRestoration: 'enabled' }),
        withViewTransitions({ skipInitialTransition: true }),
      ),
      { provide: TitleStrategy, useClass: TranslatedTitleStrategy },
      provideTranslateService({
        loader: provideTranslateHttpLoader({ prefix: '/i18n/', suffix: '.json' }),
        fallbackLang: 'en',
      }),
      provideServiceWorker('ngsw-worker.js', {
        enabled: serviceWorker && !isDevMode(),
        registrationStrategy: 'registerWhenStable:30000',
      }),
      provideAppInitializer(() => {
        inject(MatIconRegistry).setDefaultFontSetClass('material-symbols-outlined');
        inject(ThemeService); // applies stored light/dark before first paint
        const branding = inject(BrandingStore);
        // Branding must not block startup; translations must (avoids a flash of keys).
        void branding.load();
        return inject(LanguageService).init();
      }),
    ],
  };
}
