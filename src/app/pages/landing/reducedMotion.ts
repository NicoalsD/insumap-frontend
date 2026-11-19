const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked the system for reduced motion. */
export function prefersReducedMotion(): boolean {
  return typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches;
}
