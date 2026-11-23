import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { loadAppConfig } from './app/core/config/app-config';
import { environment } from './environments/environment';
import { startMocks } from './mocks/mock-start';

async function main(): Promise<void> {
  // No-op unless built with --configuration mock; then returns mock transport providers.
  const mockProviders = await startMocks();
  const config = await loadAppConfig(environment.configUrl);
  await bootstrapApplication(
    App,
    appConfig(config, { serviceWorker: !environment.mockApi, extraProviders: mockProviders }),
  );
}

main().catch((err: unknown) => console.error(err));
