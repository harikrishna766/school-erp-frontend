import { type EnvironmentProviders, makeEnvironmentProviders } from '@angular/core';
import { Configuration } from '../../api/generated';
import type { AppConfig } from '../config/app-config';

/**
 * Generated operation paths already include `/api/v{n}`, so the client's basePath is the
 * API *origin* part of `apiBaseUrl`: `/api/v1` → `''`, `https://x.com/api/v1` → `https://x.com`.
 */
export function apiBasePath(apiBaseUrl: string): string {
  return apiBaseUrl.replace(/\/+$/, '').replace(/\/api\/v\d+$/, '');
}

/**
 * Configures the generated client. Credentials are deliberately NOT configured here:
 * the auth interceptor is the single place that attaches and refreshes tokens.
 */
export function provideApiClient(config: AppConfig): EnvironmentProviders {
  return makeEnvironmentProviders([
    {
      provide: Configuration,
      useValue: new Configuration({ basePath: apiBasePath(config.apiBaseUrl) }),
    },
  ]);
}
