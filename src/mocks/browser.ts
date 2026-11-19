import { setupWorker } from 'msw/browser';
import { handlers } from './handlers';

/** Starts Mock Service Worker in the browser (`VITE_USE_MOCKS=true`). Unhandled requests pass through. */
export async function startMocks(): Promise<void> {
  const worker = setupWorker(...handlers);
  await worker.start({ onUnhandledFrame: 'bypass', quiet: true });
}
