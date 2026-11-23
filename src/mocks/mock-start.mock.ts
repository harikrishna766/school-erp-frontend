import { startMockWorker } from './browser';

export async function startMocks(): Promise<void> {
  await startMockWorker();
}
