import { describe, expect, it } from 'vitest';
import { contrastRatio, parseHex, relativeLuminance } from './contrast';

describe('contrast', () => {
  it('parses short and long hex', () => {
    expect(parseHex('#fff')).toEqual([255, 255, 255]);
    expect(parseHex('#00838f')).toEqual([0, 131, 143]);
  });

  it('rejects malformed colors', () => {
    expect(() => parseHex('#12')).toThrow();
    expect(() => parseHex('oklch(50% 0.1 200)')).toThrow();
  });

  it('computes luminance extremes', () => {
    expect(relativeLuminance('#000000')).toBe(0);
    expect(relativeLuminance('#ffffff')).toBeCloseTo(1);
  });

  it('matches the WCAG reference ratios', () => {
    expect(contrastRatio('#000', '#fff')).toBeCloseTo(21);
    expect(contrastRatio('#777777', '#ffffff')).toBeCloseTo(4.48, 2);
    expect(contrastRatio('#fff', '#000')).toBe(contrastRatio('#000', '#fff'));
  });
});
