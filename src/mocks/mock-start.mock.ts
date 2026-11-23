import type { Provider } from '@angular/core';
import { REALTIME_TRANSPORT } from '../app/core/realtime/realtime-transport';
import { startMockWorker } from './browser';
import { MockRealtimeTransport } from './realtime';

/** Starts MSW and returns providers that replace real transports with mocks. */
export async function startMocks(): Promise<Provider[]> {
  await startMockWorker();
  return [{ provide: REALTIME_TRANSPORT, useClass: MockRealtimeTransport }];
}
