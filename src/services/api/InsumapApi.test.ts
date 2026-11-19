import { describe, expect, it, vi } from 'vitest';
import { AccessTokenStore } from './AccessTokenStore';
import { ApiError } from './ApiError';
import { InsumapApi } from './InsumapApi';

const BASE = 'https://api.example.test/api/v1/';
const json = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } });
const unauthenticated = () =>
  json(401, { error: { code: 'UNAUTHENTICATED', message: 'x', detail: {} } });
const emptyAlerts = () => json(200, { items: [], next_cursor: null });

function setup(responses: (() => Response)[]) {
  const queue = [...responses];
  const fetchImpl = vi.fn<typeof fetch>(() => {
    const next = queue.shift();
    if (!next) throw new Error('unexpected request');
    return Promise.resolve(next());
  });
  const tokens = new AccessTokenStore();
  const onSessionLost = vi.fn();
  const api = new InsumapApi({ tokens, baseUrl: BASE, fetchImpl, onSessionLost });
  return { api, tokens, fetchImpl, onSessionLost };
}

describe('InsumapApi', () => {
  it('sends the bearer token, the CSRF header and cookies', async () => {
    const { api, tokens, fetchImpl } = setup([emptyAlerts]);
    tokens.set('abc');
    await api.listAlerts({ status: 'OPEN' });
    const [url, init] = fetchImpl.mock.calls[0] ?? [];
    expect(url).toBe(`${BASE}alerts?status=OPEN`);
    expect(init?.credentials).toBe('include');
    const headers = new Headers(init?.headers);
    expect(headers.get('Authorization')).toBe('Bearer abc');
    expect(headers.get('X-Requested-With')).toBe('insumap-web');
  });

  it('parses the canonical error body into an ApiError', async () => {
    const { api } = setup([
      () =>
        json(422, {
          error: {
            code: 'VALIDATION_ERROR',
            message: 'x',
            detail: { errors: [{ field: 'body.email', type: 'string_too_long' }] },
          },
        }),
    ]);
    const error = await api.login('a@example.test', 'x').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).code).toBe('VALIDATION_ERROR');
    expect((error as ApiError).fieldErrors).toEqual({ email: 'string_too_long' });
  });

  it('maps a network failure to NETWORK and a bad body to UNKNOWN', async () => {
    const down = new InsumapApi({
      tokens: new AccessTokenStore(),
      baseUrl: BASE,
      fetchImpl: () => Promise.reject(new TypeError('offline')),
    });
    await expect(down.getFieldLimits()).rejects.toMatchObject({ status: 0, code: 'NETWORK' });
    const { api } = setup([() => json(200, { nope: true })]);
    await expect(api.getFieldLimits()).rejects.toMatchObject({ code: 'UNKNOWN', rawCode: 'INVALID_RESPONSE' });
  });

  it('refreshes once on a 401 and retries the original request', async () => {
    const { api, tokens, fetchImpl } = setup([
      unauthenticated,
      () => json(200, { access_token: 'fresh' }),
      emptyAlerts,
    ]);
    tokens.set('old');
    await api.listAlerts();
    expect(fetchImpl).toHaveBeenCalledTimes(3);
    expect(tokens.get()).toBe('fresh');
    const retryHeaders = new Headers(fetchImpl.mock.calls[2]?.[1]?.headers);
    expect(retryHeaders.get('Authorization')).toBe('Bearer fresh');
  });

  it('does not retry twice and signals session loss when refresh fails', async () => {
    const { api, tokens, fetchImpl, onSessionLost } = setup([unauthenticated, unauthenticated]);
    tokens.set('old');
    await expect(api.listAlerts()).rejects.toMatchObject({ code: 'UNAUTHENTICATED' });
    expect(fetchImpl).toHaveBeenCalledTimes(2);
    expect(tokens.get()).toBeNull();
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it('shares one refresh among concurrent 401s', async () => {
    const { api, tokens, fetchImpl } = setup([
      unauthenticated,
      unauthenticated,
      () => json(200, { access_token: 'fresh' }),
      emptyAlerts,
      emptyAlerts,
    ]);
    tokens.set('old');
    await Promise.all([api.listAlerts(), api.listAlerts()]);
    const refreshCalls = fetchImpl.mock.calls.filter(([url]) => typeof url === 'string' && url.endsWith('/auth/refresh'));
    expect(refreshCalls).toHaveLength(1);
  });

  it('does not refresh on SESSION_REVOKED', async () => {
    const { api, tokens, fetchImpl, onSessionLost } = setup([
      () => json(401, { error: { code: 'SESSION_REVOKED', message: 'x', detail: {} } }),
    ]);
    tokens.set('old');
    await expect(api.listAlerts()).rejects.toMatchObject({ code: 'SESSION_REVOKED' });
    expect(fetchImpl).toHaveBeenCalledTimes(1);
    expect(onSessionLost).toHaveBeenCalledTimes(1);
  });

  it('keeps the token of a staff login only after MFA', async () => {
    const { api, tokens } = setup([
      () => json(200, { status: 'MFA_CHALLENGE', challenge_token: 'c1' }),
      () => json(200, { status: 'AUTHENTICATED', access_token: 'full' }),
    ]);
    const first = await api.login('doc@example.test', 'pw');
    expect(first.status).toBe('MFA_CHALLENGE');
    expect(tokens.get()).toBeNull();
    await api.verifyMfa('c1', '123456');
    expect(tokens.get()).toBe('full');
  });

  it('clears the token on logout even when the call fails', async () => {
    const { api, tokens } = setup([() => json(403, { error: { code: 'FORBIDDEN', message: 'x', detail: {} } })]);
    tokens.set('abc');
    await expect(api.logout()).rejects.toBeInstanceOf(ApiError);
    expect(tokens.get()).toBeNull();
  });
});
