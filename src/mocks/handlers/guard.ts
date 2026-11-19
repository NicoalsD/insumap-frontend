import type { FixtureAccount } from '../fixtures/people';
import { apiError } from '../http';
import type { MockState } from '../MockState';

export type Guarded = { readonly account: FixtureAccount } | { readonly response: Response };

/**
 * Authenticates a request by its bearer token and, optionally, checks a permission.
 * Order follows API.md 2.4: 401 first, then 403 before any 404.
 */
export function guard(
  state: MockState,
  request: Request,
  permission?: string,
  options: { allowEnrollment?: boolean } = {},
): Guarded {
  const header = request.headers.get('Authorization');
  const token = header?.startsWith('Bearer ') ? header.slice('Bearer '.length) : null;
  const session = token === null ? undefined : state.accessTokens.get(token);
  const account = session && state.accountById(session.accountId);
  if (!session || !account) return { response: apiError('UNAUTHENTICATED') };
  if (session.enrollmentOnly && options.allowEnrollment !== true) {
    return { response: apiError('MFA_REQUIRED') };
  }
  if (permission !== undefined && !account.permissions.includes(permission)) {
    return { response: apiError('FORBIDDEN') };
  }
  return { account };
}

/** Header the real API demands on refresh and logout (CSRF defense). */
export function hasCsrfHeader(request: Request): boolean {
  return request.headers.get('X-Requested-With') === 'insumap-web';
}
