import type { PointerEvent } from 'react';

/**
 * Remembers where a control was pressed, as CSS variables, so its squash grows from that point
 * (origin awareness). Pair it with `transform-origin: var(--press-x) var(--press-y)` in the CSS.
 */
export function markPressOrigin(event: PointerEvent<HTMLElement>): void {
  const element = event.currentTarget;
  const rect = element.getBoundingClientRect();
  element.style.setProperty('--press-x', `${String(Math.round(event.clientX - rect.left))}px`);
  element.style.setProperty('--press-y', `${String(Math.round(event.clientY - rect.top))}px`);
}
