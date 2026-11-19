/** Motion tuning of the landing (art direction, not product logic). */

export const ENTRANCE = { rise: 48, duration: 1.1, stagger: 0.08 };

export const REVEAL = { rise: 40, duration: 0.9, stagger: 0.1, start: 'top 82%' };

/** The flow line draws once, in full, as the steps enter the viewport. */
export const FLOW_LINE = { start: 'top 80%', duration: 1.4 };

/** Story progress that shows each step's view: the sensor, inside the vessel, the whole body. */
export const STORY_STEP_VIEWS: readonly number[] = [0.23, 0.53, 0.95];
