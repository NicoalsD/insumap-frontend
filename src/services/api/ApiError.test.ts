import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import { ApiError, apiErrorMessage } from './ApiError';

describe('ApiError', () => {
  it('reads the canonical body', () => {
    const error = ApiError.fromBody(404, { error: { code: 'NOT_FOUND', message: 'x', detail: {} } });
    expect(error.code).toBe('NOT_FOUND');
    expect(apiErrorMessage(error)).toBe(es.apiErrors.NOT_FOUND);
  });

  it('falls back to UNKNOWN for an unknown code or a malformed body, keeping the raw code', () => {
    const odd = ApiError.fromBody(500, { error: { code: 'NEW_CODE', message: 'x' } });
    expect(odd.code).toBe('UNKNOWN');
    expect(odd.rawCode).toBe('NEW_CODE');
    expect(ApiError.fromBody(500, 'nope').code).toBe('UNKNOWN');
    expect(apiErrorMessage(new Error('boom'))).toBe(es.apiErrors.UNKNOWN);
  });
});
