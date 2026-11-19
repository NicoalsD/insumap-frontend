import { describe, expect, it } from 'vitest';
import { parseHexColor } from './color';

const FALLBACK = [0.5, 0.5, 0.5] as const;

describe('parseHexColor', () => {
  it('reads a long hex color as RGB in 0 to 1', () => {
    expect(parseHexColor('#ff0000', FALLBACK)).toEqual([1, 0, 0]);
    expect(parseHexColor(' #00FF00 ', FALLBACK)).toEqual([0, 1, 0]);
  });

  it('expands the short form', () => {
    expect(parseHexColor('#fff', FALLBACK)).toEqual([1, 1, 1]);
  });

  it('gives the fallback for a value that is not a hex color', () => {
    expect(parseHexColor('', FALLBACK)).toEqual(FALLBACK);
    expect(parseHexColor('rgb(1, 2, 3)', FALLBACK)).toEqual(FALLBACK);
    expect(parseHexColor('#12345', FALLBACK)).toEqual(FALLBACK);
  });
});
