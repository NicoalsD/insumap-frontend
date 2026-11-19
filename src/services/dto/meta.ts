import { z } from 'zod';

/**
 * `GET /meta/field-limits` (API.md 8.1). One field per `FieldLimits` constant, in snake_case.
 * The object grows with the backend, so unknown keys are kept, never rejected. The API also sends
 * validation patterns (`*_pattern`, text): the forms use the numeric limits, so the text is dropped.
 */
export const fieldLimitsResponseSchema = z.object({
  limits: z.record(z.string(), z.union([z.number(), z.string()])).transform((all) => {
    const numeric: Record<string, number> = {};
    for (const [key, value] of Object.entries(all)) if (typeof value === 'number') numeric[key] = value;
    return numeric;
  }),
});
export type FieldLimitsDto = z.infer<typeof fieldLimitsResponseSchema>['limits'];
