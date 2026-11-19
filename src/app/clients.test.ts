import { describe, expect, it } from 'vitest';
import { ApiError } from '@/services/api/ApiError';
import { shouldRetry } from './clients';

describe('shouldRetry', () => {
  it('retries network and server failures a limited number of times', () => {
    expect(shouldRetry(0, new ApiError(0, 'NETWORK'))).toBe(true);
    expect(shouldRetry(1, new ApiError(500, 'INTERNAL_ERROR'))).toBe(true);
    expect(shouldRetry(2, new ApiError(500, 'INTERNAL_ERROR'))).toBe(false);
  });

  it('never retries a client error: the server already answered', () => {
    expect(shouldRetry(0, new ApiError(404, 'NOT_FOUND'))).toBe(false);
    expect(shouldRetry(0, new ApiError(422, 'VALIDATION_ERROR'))).toBe(false);
  });
});
