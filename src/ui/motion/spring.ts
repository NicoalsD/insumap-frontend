/**
 * Interruptible motion: a damped spring that can be retargeted mid-flight (it keeps its velocity),
 * and the rubber band used past the ends of a range. Frame-driven with requestAnimationFrame and
 * written to the DOM by the caller, so nothing re-renders React sixty times a second.
 *
 * Principles it carries: slow in and slow out (the spring eases both ends), follow-through (a
 * little overshoot when the damping allows it), interruptible motion (a new target bends the path
 * instead of restarting it) and rubber banding (resistance that grows past the edge).
 */

export interface SpringConfig {
  /** Pull toward the target. Higher is snappier. */
  readonly stiffness: number;
  /** Friction. Critical damping (no overshoot) is 2 * sqrt(stiffness * mass). */
  readonly damping: number;
  readonly mass?: number;
  /** Below this distance and speed the spring rests on its target. */
  readonly precision?: number;
}

/** Crisp, no overshoot: numbers, positions that must never read a wrong value. */
export const SPRING_CRISP: SpringConfig = { stiffness: 420, damping: 41 };
/** A small, quick overshoot: thumbs, chips, markers (follow-through). */
export const SPRING_BOUNCY: SpringConfig = { stiffness: 380, damping: 22 };
/** Soft and slow: large surfaces, the body's morph. */
export const SPRING_GENTLE: SpringConfig = { stiffness: 120, damping: 20 };

const DEFAULT_PRECISION = 0.001;
/** The resistance of iOS scroll views past their edge. */
const RUBBER_RESISTANCE = 0.55;
/** One frame at 30 fps: a slow frame never makes the spring jump. */
const MAX_STEP_SECONDS = 0.033;
const MS_PER_SECOND = 1000;

export interface Spring {
  /** Current value. */
  readonly value: number;
  readonly velocity: number;
  readonly target: number;
  /** Moves toward `target`, keeping the current velocity (interruptible). */
  to(target: number, options?: { readonly velocity?: number }): void;
  /** Jumps to `value` and rests there. */
  set(value: number): void;
  stop(): void;
}

/** Whether the person asked for less motion. Read live, so a change in the OS applies at once. */
export function prefersReducedMotion(): boolean {
  return typeof window !== 'undefined' && typeof window.matchMedia === 'function'
    ? window.matchMedia('(prefers-reduced-motion: reduce)').matches
    : false;
}

export function createSpring(
  initial: number,
  config: SpringConfig,
  onUpdate: (value: number, velocity: number) => void,
): Spring {
  const mass = config.mass ?? 1;
  const precision = config.precision ?? DEFAULT_PRECISION;
  let value = initial;
  let velocity = 0;
  let target = initial;
  let frame = 0;
  let last = 0;

  const rest = () => {
    value = target;
    velocity = 0;
    frame = 0;
    onUpdate(value, velocity);
  };

  const step = (now: number) => {
    const dt = Math.min((now - last) / MS_PER_SECOND, MAX_STEP_SECONDS);
    last = now;
    // Semi-implicit Euler: stable at these stiffnesses and frame rates.
    const force = -config.stiffness * (value - target) - config.damping * velocity;
    velocity += (force / mass) * dt;
    value += velocity * dt;
    if (Math.abs(value - target) < precision && Math.abs(velocity) < precision) {
      rest();
      return;
    }
    onUpdate(value, velocity);
    frame = requestAnimationFrame(step);
  };

  return {
    get value() {
      return value;
    },
    get velocity() {
      return velocity;
    },
    get target() {
      return target;
    },
    to(next, options) {
      target = next;
      if (options?.velocity !== undefined) velocity = options.velocity;
      if (prefersReducedMotion() || typeof requestAnimationFrame === 'undefined') {
        rest();
        return;
      }
      if (frame === 0) {
        last = performance.now();
        frame = requestAnimationFrame(step);
      }
    },
    set(next) {
      if (frame !== 0) cancelAnimationFrame(frame);
      target = next;
      rest();
    },
    stop() {
      if (frame !== 0) cancelAnimationFrame(frame);
      frame = 0;
    },
  };
}

/** How far past an edge a drag shows, for a pull of `overshoot` (both in the same unit). */
export function rubberBand(
  overshoot: number,
  dimension: number,
  resistance = RUBBER_RESISTANCE,
): number {
  if (overshoot <= 0 || dimension <= 0) return 0;
  return (1 - 1 / ((overshoot * resistance) / dimension + 1)) * dimension;
}
