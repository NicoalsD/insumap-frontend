import { describe, expect, it } from 'vitest';
import { rubberBand } from './spring';

describe('rubberBand', () => {
  it('gives nothing back inside the range', () => {
    expect(rubberBand(0, 100)).toBe(0);
    expect(rubberBand(-5, 100)).toBe(0);
  });

  it('resists more the farther the pull, and never passes the dimension', () => {
    const near = rubberBand(20, 100);
    const far = rubberBand(200, 100);
    expect(near).toBeGreaterThan(0);
    expect(near).toBeLessThan(20);
    expect(far / 200).toBeLessThan(near / 20);
    expect(rubberBand(1e6, 100)).toBeLessThan(100);
  });
});
