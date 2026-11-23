import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';
import { loadAppConfig } from './app/core/config/app-config';
import { environment } from './environments/environment';
import { startMocks } from './mocks/mock-start';

async function main(): Promise<void> {
  await startMocks(); // no-op unless built with --configuration mock
  const config = await loadAppConfig(environment.configUrl);
  await bootstrapApplication(App, appConfig(config, { serviceWorker: !environment.mockApi }));
}

main().catch((err: unknown) => console.error(err));
