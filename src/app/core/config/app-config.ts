import { InjectionToken } from '@angular/core';
import { isLanguage, type Language } from '../i18n/languages';

/** Deployment config fetched from `/config/app-config.json` before bootstrap. */
export interface AppConfig {
  /** Base URL of the versioned REST API, e.g. `/api/v1` or `https://api.example.com/api/v1`. */
  readonly apiBaseUrl: string;
  /** Socket.IO origin. `/` means same origin as the page. */
  readonly wsUrl: string;
  readonly defaultLanguage: Language;
  /**
   * Fixed tenant for single-school deployments and local dev. When null the tenant is
   * resolved from the sub-domain (`<slug>.example.com`).
   */
  readonly tenantSlug: string | null;
}

export const APP_CONFIG = new InjectionToken<AppConfig>('APP_CONFIG');

export const DEFAULT_APP_CONFIG: AppConfig = {
  apiBaseUrl: '/api/v1',
  wsUrl: '/',
  defaultLanguage: 'en',
  tenantSlug: null,
};

/** Validates an untrusted JSON payload, falling back to defaults field by field. */
export function parseAppConfig(raw: unknown): AppConfig {
  const value = (raw !== null && typeof raw === 'object' ? raw : {}) as Record<string, unknown>;
  const str = (key: string): string | undefined =>
    typeof value[key] === 'string' && value[key] !== '' ? value[key] : undefined;
  const lang = str('defaultLanguage');

  return {
    apiBaseUrl: (str('apiBaseUrl') ?? DEFAULT_APP_CONFIG.apiBaseUrl).replace(/\/+$/, ''),
    wsUrl: str('wsUrl') ?? DEFAULT_APP_CONFIG.wsUrl,
    defaultLanguage:
      lang !== undefined && isLanguage(lang) ? lang : DEFAULT_APP_CONFIG.defaultLanguage,
    tenantSlug: str('tenantSlug') ?? null,
  };
}

export async function loadAppConfig(url: string): Promise<AppConfig> {
  try {
    const response = await fetch(url, { cache: 'no-cache' });
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    return parseAppConfig(await response.json());
  } catch (error) {
    console.error(`[config] Could not load ${url}; using defaults.`, error);
    return DEFAULT_APP_CONFIG;
  }
}
