import { describe, expect, it } from 'vitest';
import { qrModules } from './qrModules';

describe('qrModules', () => {
  it('builds a square matrix with the three finder patterns in its corners', () => {
    const uri = 'otpauth://totp/Insumap:ana@example.test?secret=JBSWY3DPEHPK3PXP&issuer=Insumap';
    const modules = qrModules(uri);
    const size = modules.length;
    expect(size).toBeGreaterThanOrEqual(21);
    expect(modules.every((row) => row.length === size)).toBe(true);
    // Top-left finder: the outer ring and the centre are dark, the ring next to it is light.
    expect(modules[0]?.[0]).toBe(true);
    expect(modules[0]?.[size - 1]).toBe(true);
    expect(modules[size - 1]?.[0]).toBe(true);
    expect(modules[3]?.[3]).toBe(true);
  });

  it('encodes different values differently', () => {
    expect(qrModules('otpauth://totp/a?secret=AAAA')).not.toEqual(qrModules('otpauth://totp/b?secret=BBBB'));
  });
});
