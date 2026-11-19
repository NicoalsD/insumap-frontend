import { mockState, type MockState } from '../MockState';
import { adminHandlers } from './admin';
import { assistantHandlers } from './assistant';
import { authHandlers } from './auth';
import { careHandlers } from './care';
import { clinicalHandlers } from './clinical';
import { injectionHandlers } from './injection';

/** Every handler, shaped like API.md. The client and the handlers build URLs with the same `apiUrl()`. */
export function createHandlers(state: MockState) {
  return [
    ...authHandlers(state),
    ...clinicalHandlers(state),
    ...careHandlers(state),
    ...injectionHandlers(state),
    ...assistantHandlers(state),
    ...adminHandlers(state),
  ];
}

export const handlers = createHandlers(mockState);
