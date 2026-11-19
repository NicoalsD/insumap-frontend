import { useState } from 'react';

const REDUCED_MOTION = '(prefers-reduced-motion: reduce)';

/** True when the visitor asked the system for reduced motion (read once when the map mounts). */
export function usePrefersReducedMotion(): boolean {
  const [reduced] = useState(
    () => typeof window.matchMedia === 'function' && window.matchMedia(REDUCED_MOTION).matches,
  );
  return reduced;
}
