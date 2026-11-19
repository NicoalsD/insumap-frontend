import { describe, expect, it } from 'vitest';
import { safeInternalPath } from './nextPath';

describe('safeInternalPath', () => {
  it('keeps internal paths', () => {
    expect(safeInternalPath('/doctor/triage')).toBe('/doctor/triage');
    expect(safeInternalPath('/patient?tab=plan')).toBe('/patient?tab=plan');
  });

  it('drops anything that could leave the app or is not a path', () => {
    for (const next of [null, '', 'doctor/triage', 'https://evil.test/', '//evil.test', '/\\evil.test', '/a\nb']) {
      expect(safeInternalPath(next)).toBeNull();
    }
  });
});
