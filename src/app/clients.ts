import { QueryClient } from '@tanstack/react-query';
import { AccessTokenStore } from '@/services/api/AccessTokenStore';
import { ApiError } from '@/services/api/ApiError';
import { InsumapApi } from '@/services/api/InsumapApi';
import type { ApiContextValue } from '@/state/apiContext';

const STALE_MS = 30_000;
const MAX_RETRIES = 2;
const CLIENT_ERROR_MIN = 400;
const SERVER_ERROR_MIN = 500;

/** Retry network and 5xx failures, never a 4xx: the server already answered. */
export function shouldRetry(failureCount: number, error: unknown): boolean {
  const clientError =
    error instanceof ApiError && error.status >= CLIENT_ERROR_MIN && error.status < SERVER_ERROR_MIN;
  return !clientError && failureCount < MAX_RETRIES;
}

export function createQueryClient(): QueryClient {
  return new QueryClient({
    defaultOptions: { queries: { staleTime: STALE_MS, retry: shouldRetry, refetchOnWindowFocus: false } },
  });
}

const LOGIN_PATH = '/login';

/** A session that cannot continue (revoked, or the refresh failed) sends the person to sign in again. */
function goToExpiredLogin(): void {
  if (window.location.pathname === LOGIN_PATH) return;
  window.location.assign(`${LOGIN_PATH}?reason=expired`);
}

/** Builds the facade with a fresh in-memory token store. */
export function createApiClient(): ApiContextValue {
  const tokens = new AccessTokenStore();
  return { api: new InsumapApi({ tokens, onSessionLost: goToExpiredLogin }), tokens };
}
