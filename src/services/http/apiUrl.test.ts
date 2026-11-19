import { describe, expect, it } from 'vitest';
import { apiBaseUrl, apiUrl } from './apiUrl';

describe('apiUrl', () => {
  it('resolves a relative base against the page origin', () => {
    expect(apiBaseUrl('/api/v1')).toBe(`${location.origin}/api/v1/`);
    expect(apiBaseUrl(undefined)).toBe(`${location.origin}/api/v1/`);
  });

  it('keeps an absolute base', () => {
    expect(apiBaseUrl('https://api.example.test/api/v1/')).toBe('https://api.example.test/api/v1/');
  });

  it('joins paths and query strings, skipping empty values', () => {
    const base = 'https://api.example.test/api/v1/';
    expect(apiUrl('/dashboard/triage', { window: '14d', reviewed: false, cursor: null }, base)).toBe(
      'https://api.example.test/api/v1/dashboard/triage?window=14d&reviewed=false',
    );
    expect(apiUrl('timeline', { event_types: ['GLUCOSE', 'MEAL'] }, base)).toBe(
      'https://api.example.test/api/v1/timeline?event_types=GLUCOSE&event_types=MEAL',
    );
  });
});
