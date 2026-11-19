import { describe, expect, it } from 'vitest';

describe('toolchain', () => {
  it('runs vitest in jsdom', () => {
    expect(document.createElement('div').tagName).toBe('DIV');
  });
});
