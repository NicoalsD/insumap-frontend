import { setupServer } from 'msw/node';
import { handlers } from './handlers';

/** Node server for Vitest; `src/test/setup.ts` listens, resets and closes it. */
export const server = setupServer(...handlers);
