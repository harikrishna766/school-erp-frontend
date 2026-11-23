import {
  type EnvironmentProviders,
  type Provider,
  provideZonelessChangeDetection,
  signal,
} from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideTranslateService } from '@ngx-translate/core';
import { APP_CONFIG, DEFAULT_APP_CONFIG, type AppConfig } from '../app/core/config/app-config';
import { BreakpointService, type DeviceClass } from '../app/core/layout/breakpoint.service';

/** Translation without a loader: templates render keys, which makes assertions stable. */
export function provideTestTranslate(): Provider[] {
  return provideTranslateService({ fallbackLang: 'en', lang: 'en' });
}

export function provideTestConfig(overrides: Partial<AppConfig> = {}): Provider {
  return { provide: APP_CONFIG, useValue: { ...DEFAULT_APP_CONFIG, ...overrides } };
}

export function provideTestBasics(): (Provider | EnvironmentProviders)[] {
  // Catch-all so clicking a routerLink in a test navigates cleanly instead of erroring.
  return [
    provideZonelessChangeDetection(),
    provideRouter([{ path: '**', children: [] }]),
    provideTestTranslate(),
  ];
}

/** BreakpointService double whose device class is set by the test. */
export function fakeBreakpoints(initial: DeviceClass = 'desktop') {
  const device = signal<DeviceClass>(initial);
  const service = {
    device,
    isPhone: () => device() === 'phone',
    isTablet: () => device() === 'tablet',
    isDesktop: () => device() === 'desktop',
  };
  return { device, provider: { provide: BreakpointService, useValue: service } };
}
