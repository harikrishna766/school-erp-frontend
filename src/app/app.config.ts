import { provideHttpClient, withFetch, withInterceptors } from '@angular/common/http';
import {
  type ApplicationConfig,
  type Provider,
  ErrorHandler,
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
import { provideApiClient } from './core/api/provide-api-client';
import { AuthStore } from './core/auth/auth.store';
import { REALTIME_TRANSPORT } from './core/realtime/realtime-transport';
import { SocketIoTransport } from './core/realtime/socket-io.transport';
import { APP_CONFIG, type AppConfig } from './core/config/app-config';
import { AppErrorHandler } from './core/errors/app-error-handler';
import { HTTP_INTERCEPTORS } from './core/http/interceptors';
import { LanguageService } from './core/i18n/language.service';
import { TranslatedTitleStrategy } from './core/i18n/translated-title.strategy';
import { MODULE_REGISTRY } from './core/modules/module-def';
import { BrandingStore } from './core/tenant/branding.store';
import { ThemeService } from './core/theme/theme.service';
import { APP_MODULES } from './module-registry';

export interface AppConfigOptions {
  readonly serviceWorker: boolean;
  /** Overrides appended last (mock transports in mock builds). */
  readonly extraProviders?: readonly Provider[];
}

export function appConfig(
  config: AppConfig,
  { serviceWorker, extraProviders = [] }: AppConfigOptions,
): ApplicationConfig {
  return {
    providers: [
      provideBrowserGlobalErrorListeners(),
      { provide: APP_CONFIG, useValue: config },
      { provide: MODULE_REGISTRY, useValue: APP_MODULES },
      provideApiClient(config),
      { provide: REALTIME_TRANSPORT, useClass: SocketIoTransport },
      provideHttpClient(withFetch(), withInterceptors(HTTP_INTERCEPTORS)),
      { provide: ErrorHandler, useClass: AppErrorHandler },
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
        // Branding and the session check run in parallel and don't block first paint;
        // guards await the session (AuthStore.whenReady). Translations do block, to
        // avoid a flash of raw keys.
        void inject(BrandingStore).load();
        void inject(AuthStore).restore();
        return inject(LanguageService).init();
      }),
      ...extraProviders,
    ],
  };
}
