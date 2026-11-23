import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

export async function startMockWorker(): Promise<void> {
  await setupWorker(...handlers).start({
    onUnhandledFrame: 'bypass',
    serviceWorker: { url: '/mockServiceWorker.js' },
    quiet: false,
  });
  console.info('[mocks] MSW active — API calls are served from src/mocks/handlers.ts');
}
