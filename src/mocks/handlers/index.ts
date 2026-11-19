import { mockState, type MockState } from '../MockState';
import { adminHandlers } from './admin';
import { authHandlers } from './auth';
import { clinicalHandlers } from './clinical';

/** Every handler, shaped like API.md. The client and the handlers build URLs with the same `apiUrl()`. */
export function createHandlers(state: MockState) {
  return [...authHandlers(state), ...clinicalHandlers(state), ...adminHandlers(state)];
}

export const handlers = createHandlers(mockState);
