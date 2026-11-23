import type { Environment } from './environment.model';

/** Production build. Deployment-specific values (API URL, tenant) live in /config/app-config.json. */
export const environment: Environment = {
  production: true,
  mockApi: false,
  configUrl: '/config/app-config.json',
};
