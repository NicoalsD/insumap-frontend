/**
 * Whether the 3D map can run here: the observers it needs and a WebGL context. Synchronous and
 * without side effects on the page, so the component can decide before it renders the canvas.
 * jsdom has no ResizeObserver and no WebGL, so it returns false there and the list is shown alone.
 */
export function canRender3D(): boolean {
  if (typeof ResizeObserver === 'undefined' || typeof IntersectionObserver === 'undefined')
    return false;
  try {
    const probe = document.createElement('canvas');
    return probe.getContext('webgl2') !== null || probe.getContext('webgl') !== null;
  } catch {
    return false;
  }
}
