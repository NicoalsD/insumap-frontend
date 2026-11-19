import { z } from 'zod';

/** ISO 8601 instant in UTC with `Z` (API.md 1.2). */
export const instant = z.iso.datetime();
/** `YYYY-MM-DD` date without time (API.md 1.2). */
export const calendarDate = z.iso.date();
export const uuid = z.string().min(1);

export const ROLES = ['DOCTOR', 'PATIENT', 'CLINIC_ADMIN', 'PLATFORM_ADMIN'] as const;
export const roleSchema = z.enum(ROLES);

export const WINDOWS = ['24h', '7d', '14d', '30d'] as const;
export const windowSchema = z.enum(WINDOWS);
export type MetricsWindow = z.infer<typeof windowSchema>;

/** Cursor-paginated list (API.md 3). */
export function pageOf<T extends z.ZodType>(item: T) {
  return z.object({ items: z.array(item), next_cursor: z.string().nullable() });
}

/** Marks fictitious data (API.md 1.2). Optional with a default of false: the UI never shows it. */
export const simulatedFlag = z.boolean().default(false);
