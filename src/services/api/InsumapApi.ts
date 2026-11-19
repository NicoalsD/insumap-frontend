import { z } from 'zod';
import { HTTP_STATUS } from '../http/httpStatus';
import { apiUrl, type QueryParams } from '../http/apiUrl';
import {
  activationCompleteSchema,
  activationVerifySchema,
  currentUserSchema,
  loginResponseSchema,
  mfaConfirmSchema,
  mfaEnrollmentSchema,
  sessionTokenSchema,
  type CurrentUserDto,
  type LoginResponseDto,
} from '../dto/auth';
import {
  careAssignmentPageSchema,
  clinicSchema,
  credentialInvitationSchema,
  importBatchPageSchema,
  importBatchSchema,
  importRowPageSchema,
  patientAdminPageSchema,
  type ClinicDto,
} from '../dto/admin';
import {
  agpResponseSchema,
  alertPageSchema,
  alertSchema,
  glucoseReadingPageSchema,
  metricsResponseSchema,
  ownOverviewSchema,
  patientOverviewSchema,
  recommendationPageSchema,
  recommendationSchema,
  triagePageSchema,
} from '../dto/clinical';
import type { MetricsWindow } from '../dto/common';
import { fieldLimitsResponseSchema, type FieldLimitsDto } from '../dto/meta';
import { AccessTokenStore } from './AccessTokenStore';
import { ApiError } from './ApiError';

/** Header the API requires on refresh and logout as CSRF defense (API.md 1.3). */
export const REQUESTED_WITH = { name: 'X-Requested-With', value: 'insumap-web' } as const;

const REFRESH_PATH = '/auth/refresh';
const JSON_TYPE = 'application/json';

export interface InsumapApiOptions {
  readonly tokens: AccessTokenStore;
  readonly baseUrl?: string;
  /** Injectable for tests; defaults to the global `fetch`. */
  readonly fetchImpl?: typeof fetch;
  /** Called once when the session cannot continue (revoked, or refresh failed): go to login. */
  readonly onSessionLost?: () => void;
}

interface RequestSpec<S extends z.ZodType | undefined> {
  readonly method: 'GET' | 'POST' | 'PUT' | 'PATCH';
  readonly path: string;
  readonly query?: QueryParams;
  readonly body?: unknown;
  /** Raw body for imports (`application/fhir+json`, `text/csv`). */
  readonly raw?: { readonly contentType: string; readonly content: string };
  /** Validates the response; omit for 204 or ignored bodies. */
  readonly schema?: S;
  /** `false` for public endpoints: no bearer, no refresh on 401. */
  readonly auth?: boolean;
}

type Output<S extends z.ZodType | undefined> = S extends z.ZodType ? z.output<S> : undefined;

/**
 * Typed client of the Insumap REST API, the only door from the UI to the network.
 * Keeps the access token in memory, sends the refresh cookie (`credentials: 'include'`) and the
 * CSRF header, parses the canonical error body and, on a 401, refreshes the session once and
 * retries the original request once. Concurrent 401s share one refresh.
 *
 * Pattern: P10 Facade
 */
export class InsumapApi {
  private readonly tokens: AccessTokenStore;
  private readonly baseUrl: string | undefined;
  private readonly fetchImpl: typeof fetch;
  private readonly onSessionLost: (() => void) | undefined;
  private refreshInFlight: Promise<boolean> | null = null;

  constructor(options: InsumapApiOptions) {
    this.tokens = options.tokens;
    this.baseUrl = options.baseUrl;
    this.fetchImpl = options.fetchImpl ?? ((input, init) => fetch(input, init));
    this.onSessionLost = options.onSessionLost;
  }

  // ---- Meta ----------------------------------------------------------------------------

  /** Field limits (lengths, page sizes) that form schemas are built from. */
  async getFieldLimits(): Promise<FieldLimitsDto> {
    const { limits } = await this.request({
      method: 'GET',
      path: '/meta/field-limits',
      schema: fieldLimitsResponseSchema,
      auth: false,
    });
    return limits;
  }

  // ---- Auth ----------------------------------------------------------------------------

  async login(email: string, password: string): Promise<LoginResponseDto> {
    const response = await this.request({
      method: 'POST',
      path: '/auth/login',
      body: { email, password },
      schema: loginResponseSchema,
      auth: false,
    });
    if (response.status !== 'MFA_CHALLENGE') this.tokens.set(response.access_token);
    return response;
  }

  async verifyMfa(challengeToken: string, code: string): Promise<void> {
    const response = await this.request({
      method: 'POST',
      path: '/auth/mfa/verify',
      body: { challenge_token: challengeToken, code },
      schema: sessionTokenSchema,
      auth: false,
    });
    this.tokens.set(response.access_token);
  }

  startMfaEnrollment(): Promise<{ secret: string; otpauth_uri: string }> {
    return this.request({ method: 'POST', path: '/auth/mfa/enrollment', schema: mfaEnrollmentSchema });
  }

  /** Returns the recovery codes, which the API shows only once. */
  async confirmMfaEnrollment(code: string): Promise<readonly string[]> {
    const response = await this.request({
      method: 'POST',
      path: '/auth/mfa/enrollment/confirm',
      body: { code },
      schema: mfaConfirmSchema,
    });
    this.tokens.set(response.access_token);
    return response.recovery_codes;
  }

  getCurrentUser(): Promise<CurrentUserDto> {
    return this.request({ method: 'GET', path: '/auth/current-user', schema: currentUserSchema });
  }

  /** Restores a session after a reload from the refresh cookie. Resolves `false` when there is none. */
  restoreSession(): Promise<boolean> {
    return this.refreshOnce();
  }

  async logout(): Promise<void> {
    try {
      await this.request({ method: 'POST', path: '/auth/logout' });
    } finally {
      this.tokens.clear();
    }
  }

  verifyActivation(activationCode: string, birthDate: string) {
    return this.request({
      method: 'POST',
      path: '/auth/activation/verify',
      body: { activation_code: activationCode, birth_date: birthDate },
      schema: activationVerifySchema,
      auth: false,
    });
  }

  async completeActivation(body: {
    activation_token: string;
    new_password: string;
    email?: string;
    consent: { privacy_notice_version_id: string; accepted: boolean; ai_external_processing: boolean };
  }) {
    const response = await this.request({
      method: 'POST',
      path: '/auth/activation/complete',
      body,
      schema: activationCompleteSchema,
      auth: false,
    });
    this.tokens.set(response.access_token);
    return response.status;
  }

  // ---- Clinic and administration -----------------------------------------------------------

  getCurrentClinic(): Promise<ClinicDto> {
    return this.request({ method: 'GET', path: '/clinics/current', schema: clinicSchema });
  }

  listPatients(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/patients', query, schema: patientAdminPageSchema });
  }

  listCareAssignments(query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: '/care-team/assignments',
      query,
      schema: careAssignmentPageSchema,
    });
  }

  createImportPreview(source: 'FHIR' | 'CSV', content: string) {
    const isFhir = source === 'FHIR';
    return this.request({
      method: 'POST',
      path: isFhir ? '/imports/fhir' : '/imports/csv',
      raw: { contentType: isFhir ? 'application/fhir+json' : 'text/csv', content },
      schema: importBatchSchema,
    });
  }

  listImportBatches(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/imports', query, schema: importBatchPageSchema });
  }

  getImportBatch(batchId: string) {
    return this.request({ method: 'GET', path: `/imports/${batchId}`, schema: importBatchSchema });
  }

  listImportRows(batchId: string, query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: `/imports/${batchId}/rows`,
      query,
      schema: importRowPageSchema,
    });
  }

  confirmImport(batchId: string) {
    return this.request({ method: 'POST', path: `/imports/${batchId}/confirm`, schema: importBatchSchema });
  }

  /** Issuing again on an INVITED patient is the resend (API.md 8.4). */
  issueCredentials(patientId: string, channel: 'PRINT' | 'EMAIL') {
    return this.request({
      method: 'POST',
      path: `/patients/${patientId}/credential-invitations`,
      body: { channel },
      schema: credentialInvitationSchema,
    });
  }

  // ---- Clinical -----------------------------------------------------------------------

  getTriage(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/dashboard/triage', query, schema: triagePageSchema });
  }

  getPatientOverview(patientId: string, window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/overview`,
      query: { window },
      schema: patientOverviewSchema,
    });
  }

  getOwnOverview(window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: '/patients/own/overview',
      query: { window },
      schema: ownOverviewSchema,
    });
  }

  getPatientMetrics(patientId: string, window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/metrics`,
      query: { window },
      schema: metricsResponseSchema,
    });
  }

  getOwnMetrics(window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: '/patients/own/metrics',
      query: { window },
      schema: metricsResponseSchema,
    });
  }

  getPatientAgp(patientId: string, query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/metrics/agp`,
      query,
      schema: agpResponseSchema,
    });
  }

  listPatientReadings(patientId: string, query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/readings`,
      query,
      schema: glucoseReadingPageSchema,
    });
  }

  listOwnReadings(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/readings', query, schema: glucoseReadingPageSchema });
  }

  listAlerts(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/alerts', query, schema: alertPageSchema });
  }

  acknowledgeAlert(alertId: string, note?: string) {
    return this.request({
      method: 'POST',
      path: `/alerts/${alertId}/acknowledge`,
      body: note === undefined ? {} : { note },
      schema: alertSchema,
    });
  }

  resolveAlert(alertId: string, note: string) {
    return this.request({
      method: 'POST',
      path: `/alerts/${alertId}/resolve`,
      body: { note },
      schema: alertSchema,
    });
  }

  listRecommendations(query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: '/recommendations',
      query,
      schema: recommendationPageSchema,
    });
  }

  approveRecommendation(id: string) {
    return this.request({
      method: 'POST',
      path: `/recommendations/${id}/approve`,
      schema: recommendationSchema,
    });
  }

  modifyRecommendation(id: string, modifiedProposal: Record<string, unknown>, reason: string) {
    return this.request({
      method: 'POST',
      path: `/recommendations/${id}/modify`,
      body: { modified_proposal: modifiedProposal, reason },
      schema: recommendationSchema,
    });
  }

  rejectRecommendation(id: string, reason: string) {
    return this.request({
      method: 'POST',
      path: `/recommendations/${id}/reject`,
      body: { reason },
      schema: recommendationSchema,
    });
  }

  // ---- Transport ------------------------------------------------------------------------

  private async request<S extends z.ZodType | undefined = undefined>(
    spec: RequestSpec<S>,
  ): Promise<Output<S>> {
    const auth = spec.auth ?? true;
    try {
      return await this.send(spec);
    } catch (error) {
      if (!(error instanceof ApiError) || !auth) throw error;
      if (error.code === 'SESSION_REVOKED') {
        this.loseSession();
        throw error;
      }
      const canRefresh =
        error.status === HTTP_STATUS.UNAUTHORIZED &&
        error.code === 'UNAUTHENTICATED' &&
        spec.path !== REFRESH_PATH;
      if (!canRefresh) throw error;
      if (!(await this.refreshOnce())) {
        this.loseSession();
        throw error;
      }
      return this.send(spec);
    }
  }

  /** One refresh at a time: concurrent 401s await the same promise. Never retries itself. */
  private refreshOnce(): Promise<boolean> {
    this.refreshInFlight ??= this.send({
      method: 'POST',
      path: REFRESH_PATH,
      schema: sessionTokenSchema,
      auth: false,
    })
      .then((response) => {
        this.tokens.set(response.access_token);
        return true;
      })
      .catch(() => false)
      .finally(() => {
        this.refreshInFlight = null;
      });
    return this.refreshInFlight;
  }

  private loseSession(): void {
    this.tokens.clear();
    this.onSessionLost?.();
  }

  private async send<S extends z.ZodType | undefined>(spec: RequestSpec<S>): Promise<Output<S>> {
    const headers = new Headers({ Accept: JSON_TYPE, [REQUESTED_WITH.name]: REQUESTED_WITH.value });
    const token = this.tokens.get();
    if (token !== null && (spec.auth ?? true)) headers.set('Authorization', `Bearer ${token}`);
    let body: string | undefined;
    if (spec.raw) {
      headers.set('Content-Type', spec.raw.contentType);
      body = spec.raw.content;
    } else if (spec.body !== undefined) {
      headers.set('Content-Type', JSON_TYPE);
      body = JSON.stringify(spec.body);
    }

    let response: Response;
    try {
      response = await this.fetchImpl(apiUrl(spec.path, spec.query, this.baseUrl), {
        method: spec.method,
        headers,
        credentials: 'include',
        ...(body === undefined ? {} : { body }),
      });
    } catch {
      throw new ApiError(0, 'NETWORK');
    }

    if (!response.ok) {
      throw ApiError.fromBody(response.status, await readJson(response));
    }
    if (!spec.schema) return undefined as Output<S>;
    const parsed = spec.schema.safeParse(await readJson(response));
    if (!parsed.success) {
      throw new ApiError(response.status, 'UNKNOWN', {}, 'INVALID_RESPONSE');
    }
    return parsed.data as Output<S>;
  }
}

async function readJson(response: Response): Promise<unknown> {
  try {
    return await response.json();
  } catch {
    return null;
  }
}
