import { http, HttpResponse } from 'msw';
import { apiUrl } from '@/services/http/apiUrl';
import {
  DEMO_ACTIVATION,
  DEMO_CLINIC,
  DEMO_RECOVERY_CODE,
  DEMO_TOTP_CODE,
  PATIENT_ACCOUNT,
} from '../fixtures/people';
import { apiError, readBody, validationError } from '../http';
import type { MockState } from '../MockState';
import { guard, hasCsrfHeader } from './guard';

const MAX_MFA_ATTEMPTS = 5;
const RECOVERY_CODE_COUNT = 10;
const FIXTURE_TOTP_SECRET = 'JBSWY3DPEHPK3PXPJBSWY3DPEHPK3PXP';
const NO_CONTENT = 204;

const str = (value: unknown): string | null => (typeof value === 'string' && value !== '' ? value : null);

/** `/meta/*` and `/auth/*` of API.md 8.1 and 8.2. */
export function authHandlers(state: MockState) {
  const session = (accountId: string): Response => {
    state.setRefreshCookie(accountId);
    return HttpResponse.json({ status: 'AUTHENTICATED', access_token: state.issueAccessToken(accountId) });
  };

  return [
    http.get(apiUrl('/meta/field-limits'), () =>
      HttpResponse.json({ limits: state.limits }, { headers: { 'Cache-Control': 'public, max-age=300' } }),
    ),

    http.post(apiUrl('/auth/login'), async ({ request }) => {
      const body = await readBody(request);
      const email = str(body?.['email']);
      const password = str(body?.['password']);
      const missing = [
        ...(email === null ? [{ field: 'body.email', type: 'missing' }] : []),
        ...(password === null ? [{ field: 'body.password', type: 'missing' }] : []),
      ];
      if (missing.length > 0 || email === null || password === null) return validationError(missing);
      const account = state.accountByEmail(email);
      if (!account || account.password !== password) return apiError('INVALID_CREDENTIALS');
      if (account.role === 'PATIENT') return session(account.id);
      if (state.mfaEnabled.get(account.id) === true) {
        return HttpResponse.json({ status: 'MFA_CHALLENGE', challenge_token: state.issueChallenge(account.id) });
      }
      return HttpResponse.json({
        status: 'MFA_ENROLLMENT_REQUIRED',
        access_token: state.issueAccessToken(account.id, true),
      });
    }),

    http.post(apiUrl('/auth/mfa/verify'), async ({ request }) => {
      const body = await readBody(request);
      const token = str(body?.['challenge_token']);
      const code = str(body?.['code']);
      if (token === null || code === null) {
        return validationError([{ field: 'body.code', type: 'missing' }]);
      }
      const challenge = state.challenges.get(token);
      if (!challenge) return apiError('UNAUTHENTICATED');
      if (code !== DEMO_TOTP_CODE && code !== DEMO_RECOVERY_CODE) {
        challenge.attempts += 1;
        if (challenge.attempts >= MAX_MFA_ATTEMPTS) state.challenges.delete(token);
        return apiError('INVALID_CREDENTIALS');
      }
      state.challenges.delete(token);
      return session(challenge.accountId);
    }),

    http.post(apiUrl('/auth/mfa/enrollment'), ({ request }) => {
      const result = guard(state, request, undefined, { allowEnrollment: true });
      if ('response' in result) return result.response;
      if (result.account.role === 'PATIENT') return apiError('FORBIDDEN');
      return HttpResponse.json(
        {
          secret: FIXTURE_TOTP_SECRET,
          otpauth_uri: `otpauth://totp/Insumap:${result.account.email}?secret=${FIXTURE_TOTP_SECRET}&issuer=Insumap`,
        },
        { headers: { 'Cache-Control': 'no-store' } },
      );
    }),

    http.post(apiUrl('/auth/mfa/enrollment/confirm'), async ({ request }) => {
      const result = guard(state, request, undefined, { allowEnrollment: true });
      if ('response' in result) return result.response;
      const body = await readBody(request);
      const code = str(body?.['code']);
      if (code === null) return validationError([{ field: 'body.code', type: 'missing' }]);
      if (code !== DEMO_TOTP_CODE) return apiError('INVALID_CREDENTIALS');
      state.mfaEnabled.set(result.account.id, true);
      state.setRefreshCookie(result.account.id);
      return HttpResponse.json({
        status: 'AUTHENTICATED',
        access_token: state.issueAccessToken(result.account.id),
        recovery_codes: Array.from(
          { length: RECOVERY_CODE_COUNT },
          (_, i) => `${DEMO_RECOVERY_CODE.slice(0, 3)}${String(i)}E-1234${String(i)}`,
        ),
      });
    }),

    http.get(apiUrl('/auth/current-user'), ({ request }) => {
      const result = guard(state, request, undefined, { allowEnrollment: true });
      if ('response' in result) return result.response;
      const { account } = result;
      const clinic = DEMO_CLINIC;
      return HttpResponse.json({
        user: { id: account.id, email: account.email, full_name: account.fullName },
        role: account.role,
        clinic: { id: clinic.id, name: clinic.name, is_demo: clinic.is_demo, simulated: clinic.simulated },
        permissions: account.permissions,
        mfa_enabled: state.mfaEnabled.get(account.id) ?? false,
        consent_required: false,
      });
    }),

    http.post(apiUrl('/auth/refresh'), ({ request }) => {
      if (!hasCsrfHeader(request)) return apiError('FORBIDDEN');
      const accountId = state.getRefreshCookie();
      if (accountId === null || !state.accountById(accountId)) return apiError('UNAUTHENTICATED');
      return HttpResponse.json({ access_token: state.issueAccessToken(accountId) });
    }),

    http.post(apiUrl('/auth/logout'), ({ request }) => {
      if (!hasCsrfHeader(request)) return apiError('FORBIDDEN');
      const result = guard(state, request, undefined, { allowEnrollment: true });
      if ('response' in result) return result.response;
      state.setRefreshCookie(null);
      state.accessTokens.clear();
      return new HttpResponse(null, { status: NO_CONTENT });
    }),

    http.post(apiUrl('/auth/activation/verify'), async ({ request }) => {
      const body = await readBody(request);
      const code = str(body?.['activation_code']);
      const birthDate = str(body?.['birth_date']);
      if (code === null || birthDate === null) {
        return validationError([{ field: 'body.activation_code', type: 'missing' }]);
      }
      const normalized = code.toUpperCase().replace(/O/g, '0').replace(/[IL]/g, '1');
      const expected = DEMO_ACTIVATION.code.replace(/O/g, '0').replace(/[IL]/g, '1');
      if (normalized !== expected || birthDate !== DEMO_ACTIVATION.birthDate) {
        return apiError('INVITATION_INVALID');
      }
      return HttpResponse.json({
        activation_token: 'mock-activation-token',
        clinic_name: DEMO_CLINIC.name,
        privacy_notice_version_id: 'p1000000-0000-4000-8000-000000000001',
        email_required: false,
      });
    }),

    http.post(apiUrl('/auth/activation/complete'), async ({ request }) => {
      const body = await readBody(request);
      if (body?.['activation_token'] !== 'mock-activation-token') return apiError('INVITATION_INVALID');
      const password = str(body['new_password']);
      const minLength = state.limits['password_min_length'] ?? 0;
      if (password === null || password.length < minLength) {
        return validationError([{ field: 'body.new_password', type: 'string_too_short' }]);
      }
      const consent = body['consent'] as { accepted?: unknown } | undefined;
      if (consent?.accepted !== true) return apiError('CONSENT_REQUIRED');
      return session(PATIENT_ACCOUNT.id);
    }),
  ];
}
