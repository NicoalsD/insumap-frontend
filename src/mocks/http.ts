import { HttpResponse } from 'msw';
import { es } from '@/i18n/es';
import type { ApiErrorCode } from '@/services/api/ApiError';
import { HTTP_STATUS } from '@/services/http/httpStatus';

const STATUS_BY_CODE: Partial<Record<ApiErrorCode, number>> = {
  VALIDATION_ERROR: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  NOT_FOUND: HTTP_STATUS.NOT_FOUND,
  UNAUTHENTICATED: HTTP_STATUS.UNAUTHORIZED,
  SESSION_REVOKED: HTTP_STATUS.UNAUTHORIZED,
  INVALID_CREDENTIALS: HTTP_STATUS.UNAUTHORIZED,
  FORBIDDEN: HTTP_STATUS.FORBIDDEN,
  CONSENT_REQUIRED: HTTP_STATUS.FORBIDDEN,
  CONFLICT: HTTP_STATUS.CONFLICT,
  INVALID_STATE_TRANSITION: HTTP_STATUS.CONFLICT,
  INVITATION_INVALID: HTTP_STATUS.GONE,
  REASON_REQUIRED: HTTP_STATUS.UNPROCESSABLE_ENTITY,
  UNSUPPORTED_MEDIA_TYPE: HTTP_STATUS.UNSUPPORTED_MEDIA_TYPE,
  PAYLOAD_TOO_LARGE: HTTP_STATUS.PAYLOAD_TOO_LARGE,
  RATE_LIMITED: HTTP_STATUS.TOO_MANY_REQUESTS,
  INTERNAL_ERROR: HTTP_STATUS.INTERNAL_SERVER_ERROR,
};

/** Canonical error response `{ error: { code, message, detail } }` (API.md 6.1). */
export function apiError(
  code: ApiErrorCode,
  detail: Record<string, unknown> = {},
  status: number = STATUS_BY_CODE[code] ?? HTTP_STATUS.INTERNAL_SERVER_ERROR,
): Response {
  return HttpResponse.json({ error: { code, message: es.apiErrors[code], detail } }, { status });
}

/** `422 VALIDATION_ERROR` with `detail.errors` as API.md 6.2 shows it. */
export function validationError(fields: readonly { field: string; type: string }[]): Response {
  return apiError('VALIDATION_ERROR', { errors: fields });
}

/** Reads a JSON object body; anything else is a validation error, like the real API. */
export async function readBody(request: Request): Promise<Record<string, unknown> | null> {
  try {
    const body: unknown = await request.json();
    return typeof body === 'object' && body !== null && !Array.isArray(body)
      ? (body as Record<string, unknown>)
      : null;
  } catch {
    return null;
  }
}

/** Cursor pagination (API.md 3). The cursor is the offset, opaque to the client. */
export function paginate<T>(
  items: readonly T[],
  url: URL,
  defaultSize: number,
  maxSize: number,
): { items: T[]; next_cursor: string | null } {
  const requested = Number(url.searchParams.get('limit') ?? defaultSize);
  const size = Math.min(Math.max(Number.isFinite(requested) ? requested : defaultSize, 1), maxSize);
  const offset = Number(url.searchParams.get('cursor') ?? 0) || 0;
  const page = items.slice(offset, offset + size);
  const next = offset + size;
  return { items: page, next_cursor: next < items.length ? String(next) : null };
}
