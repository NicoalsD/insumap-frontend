import { z } from 'zod';

/**
 * `GET /meta/field-limits` (API.md 8.1). One numeric field per `FieldLimits` constant, in
 * snake_case. The object grows with the backend, so unknown keys are kept, never rejected.
 */
export const fieldLimitsResponseSchema = z.object({
  limits: z.record(z.string(), z.number()),
});
export type FieldLimitsDto = z.infer<typeof fieldLimitsResponseSchema>['limits'];
