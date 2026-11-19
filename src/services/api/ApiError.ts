import { z } from 'zod';
import { es } from '@/i18n/es';

/** Codes the UI knows (API.md 6.3) plus the client-side `NETWORK` and `UNKNOWN`. */
export type ApiErrorCode = keyof typeof es.apiErrors;

const KNOWN_CODES = new Set<string>(Object.keys(es.apiErrors));

/** Canonical error body `{ error: { code, message, detail } }` (API.md 6.1). */
export const apiErrorBodySchema = z.object({
  error: z.object({
    code: z.string(),
    message: z.string(),
    detail: z.record(z.string(), z.unknown()).default({}),
  }),
});

const validationDetailSchema = z.object({
  errors: z.array(z.object({ field: z.string(), type: z.string() })),
});

/** Error thrown by `InsumapApi`. The UI decides by `code`, never by the server text. */
export class ApiError extends Error {
  override readonly name = 'ApiError';

  constructor(
    /** HTTP status; 0 when the request never reached the server. */
    readonly status: number,
    readonly code: ApiErrorCode,
    readonly detail: Readonly<Record<string, unknown>> = {},
    /** Code exactly as the server sent it, kept when it is not one the UI knows. */
    readonly rawCode: string = code,
  ) {
    super(`API error ${String(status)} ${rawCode}`);
  }

  static fromBody(status: number, body: unknown): ApiError {
    const parsed = apiErrorBodySchema.safeParse(body);
    if (!parsed.success) return new ApiError(status, 'UNKNOWN');
    const { code, detail } = parsed.data.error;
    return new ApiError(status, toKnownCode(code), detail, code);
  }

  /** Invalid fields from a `422 VALIDATION_ERROR`, keyed by field path without the `body.` prefix. */
  get fieldErrors(): Readonly<Record<string, string>> {
    const parsed = validationDetailSchema.safeParse(this.detail);
    if (!parsed.success) return {};
    return Object.fromEntries(
      parsed.data.errors.map(({ field, type }) => [field.replace(/^(body|query|path)\./, ''), type]),
    );
  }
}

function toKnownCode(code: string): ApiErrorCode {
  return KNOWN_CODES.has(code) ? (code as ApiErrorCode) : 'UNKNOWN';
}

/** Spanish message for any thrown value: API errors by code, everything else generic. */
export function apiErrorMessage(error: unknown): string {
  return error instanceof ApiError ? es.apiErrors[error.code] : es.apiErrors.UNKNOWN;
}
