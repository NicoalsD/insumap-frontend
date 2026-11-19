import { z } from 'zod';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { FieldLimitsDto } from '../dto/meta';

/** Keys of `GET /meta/field-limits` the form schemas read. A key the API does not send adds no rule. */
export const LIMIT_KEYS = {
  emailMax: 'email_max_length',
  passwordMin: 'password_min_length',
  passwordMax: 'password_max_length',
  reasonMin: 'reason_min_length',
  reasonMax: 'reason_max_length',
  noteMax: 'note_max_length',
} as const;

type LimitKey = (typeof LIMIT_KEYS)[keyof typeof LIMIT_KEYS];

function limit(limits: FieldLimitsDto, key: LimitKey): number | undefined {
  return limits[key];
}

/** Required, trimmed text with the length bounds the API published. */
function boundedText(limits: FieldLimitsDto, minKey?: LimitKey, maxKey?: LimitKey) {
  let schema = z.string().trim().min(1, es.validation.required);
  const min = minKey ? limit(limits, minKey) : undefined;
  const max = maxKey ? limit(limits, maxKey) : undefined;
  if (min !== undefined) schema = schema.min(min, format(es.validation.tooShort, { min }));
  if (max !== undefined) schema = schema.max(max, format(es.validation.tooLong, { max }));
  return schema;
}

/**
 * Builds the Zod schemas of every form from the limits the API publishes at runtime
 * (`GET /meta/field-limits`). No length or pattern literal lives here: the server still decides,
 * these only give feedback before the request.
 *
 * Pattern: none (plain factory); tested in formSchemas.test.ts.
 */
export function buildFormSchemas(limits: FieldLimitsDto) {
  const email = boundedText(limits, undefined, LIMIT_KEYS.emailMax).pipe(
    z.email(es.validation.invalidEmail),
  );
  return {
    email,
    login: z.object({
      email,
      password: boundedText(limits, undefined, LIMIT_KEYS.passwordMax),
    }),
    newPassword: boundedText(limits, LIMIT_KEYS.passwordMin, LIMIT_KEYS.passwordMax),
    /** Reason for an AI decision, suspension or correction (API.md `REASON_REQUIRED`). */
    reason: boundedText(limits, LIMIT_KEYS.reasonMin, LIMIT_KEYS.reasonMax),
    note: (() => {
      const max = limit(limits, LIMIT_KEYS.noteMax);
      const base = z.string().trim();
      return max === undefined ? base : base.max(max, format(es.validation.tooLong, { max }));
    })(),
    /** TOTP or recovery code: the server checks the format; here it only must not be empty. */
    mfaCode: z.object({ code: z.string().trim().min(1, es.validation.required) }),
  } as const;
}

export type FormSchemas = ReturnType<typeof buildFormSchemas>;

/** First message per field path (`"password"`, `"consent.accepted"`), ready for `TextField error`. */
export function toFieldErrors(error: z.ZodError): Readonly<Record<string, string>> {
  const result: Record<string, string> = {};
  for (const issue of error.issues) {
    const key = issue.path.join('.');
    result[key] ??= issue.message;
  }
  return result;
}
