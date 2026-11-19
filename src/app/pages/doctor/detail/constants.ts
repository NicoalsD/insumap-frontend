import type { MetricsWindow } from '@/services/dto/common';

export const HOURS_PER_DAY = 24;
export const MINUTES_PER_HOUR = 60;
export const HOUR_MS = 3_600_000;
export const DAY_MS = 86_400_000;
/** Largest page the readings endpoint serves (`page_size_max`); a window is read page by page. */
export const READINGS_PAGE = 100;
/** Safety bound on cursor loops over the triage list. */
export const MAX_PAGES = 100;
/** Timeline entries shown at first, and how many more each "Ver más" adds. */
export const TIMELINE_PAGE_SIZE = 12;
/**
 * Days on which a pattern must repeat before it is reported. Product rule from the frontend brief
 * (repetition across days), not a clinical threshold: the clinical cut points come from the profile.
 */
export const PATTERN_MIN_REPEATED_DAYS = 3;
/** Windows the doctor can pick. The API also serves 24h; the detail screen does not offer it. */
export const WINDOW_OPTIONS: readonly MetricsWindow[] = ['7d', '14d', '30d'];
export const DEFAULT_WINDOW: MetricsWindow = '14d';
/** Hours between labels on the 24-hour profile. */
export const AGP_TICK_EVERY_HOURS = 6;
/** Height of the glucose surface relative to the grid spacing. */
export const SURFACE_HEIGHT_SCALE = 2;
/** Distance between two neighbouring cells of the surface, in scene units. */
export const SURFACE_CELL_SPACING = 0.25;
/** Columns of the main reading column and of the right rail (patron F, 12-column grid). */
export const MAIN_SPAN = 8;
export const RAIL_SPAN = 4;
export const NOTE_FIELD_ID = 'patient-note-field';
export const SURFACE_CANVAS_ID = 'patient-surface-canvas';
