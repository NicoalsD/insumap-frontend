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
  staffUserPageSchema,
  type ClinicDto,
} from '../dto/admin';
import {
  clinicalNotePageSchema,
  clinicalNoteSchema,
  messagePageSchema,
  messageSchema,
  reminderPageSchema,
  reminderSchema,
  type MessageCreateDto,
  type ReminderUpdateDto,
} from '../dto/care';
import {
  alertPageSchema,
  alertSchema,
  glucoseReadingPageSchema,
  glucoseReadingSchema,
  recommendationPageSchema,
  recommendationSchema,
  type ReadingCreateDto,
} from '../dto/clinical';
import type { MetricsWindow } from '../dto/common';
import {
  insulinDosePageSchema,
  insulinDoseSchema,
  injectionSitesResponseSchema,
  type InjectionSitesDto,
  type InsulinDoseCreateDto,
  type InsulinKind,
} from '../dto/injection';
import {
  agpResponseSchema as wireAgpSchema,
  insulinTimelineSchema,
  metricsResponseSchema as wireMetricsSchema,
  overviewResponseSchema,
  planResponseSchema,
  triagePageSchema as wireTriageSchema,
  usersPageSchema,
} from '../dto/wire';
import { pageOf } from '../dto/common';
import { targetProfileSchema, type TargetProfileDto } from '../dto/targetProfile';
import { fieldLimitsResponseSchema, type FieldLimitsDto } from '../dto/meta';
import {
  assistantReplySchema,
  type AssistantMessageCreateDto,
} from '../dto/assistant';
import { AccessTokenStore } from './AccessTokenStore';
import { ApiError } from './ApiError';

/** Header the API requires on refresh and logout as CSRF defense (API.md 1.3). */
export const REQUESTED_WITH = { name: 'X-Requested-With', value: 'insumap-web' } as const;

const REFRESH_PATH = '/auth/refresh';
/** How many mismatching fields the development warning lists. */
const MAX_REPORTED_ISSUES = 14;
/** Bound on the assignment pages read to count each doctor's patients. */
const MAX_COUNT_PAGES = 100;
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
    return this.request({ method: 'GET', path: '/dashboard/triage', query, schema: wireTriageSchema });
  }

  /** The overview names its profile by code; the doctor also reads the label from the profile itself. */
  async getPatientOverview(patientId: string, window: MetricsWindow) {
    const overview = await this.request({
      method: 'GET',
      path: `/patients/${patientId}/overview`,
      query: { window },
      schema: overviewResponseSchema,
    });
    try {
      const full = await this.request({
        method: 'GET',
        path: `/target-profiles/${overview.target_profile.id}`,
        schema: targetProfileSchema,
      });
      return { ...overview, target_profile: { ...overview.target_profile, label: full.label } };
    } catch {
      return overview;
    }
  }

  getOwnOverview(window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: '/patients/own/overview',
      query: { window },
      schema: overviewResponseSchema,
    });
  }

  getPatientMetrics(patientId: string, window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/metrics`,
      query: { window },
      schema: wireMetricsSchema,
    });
  }

  getOwnMetrics(window: MetricsWindow) {
    return this.request({
      method: 'GET',
      path: '/patients/own/metrics',
      query: { window },
      schema: wireMetricsSchema,
    });
  }

  getPatientAgp(patientId: string, query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/metrics/agp`,
      query,
      schema: wireAgpSchema,
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

  // ---- Patient record, plan and reminders (API.md 8.6, 8.7) ---------------------------

  /** Records a reading of the signed-in patient. Repeating the same `client_reading_id` returns the original. */
  createOwnReading(body: ReadingCreateDto) {
    return this.request({ method: 'POST', path: '/readings', body, schema: glucoseReadingSchema });
  }

  /** The active plan in plain language. It never carries an AI dose. */
  getTreatmentPlan(planId: string) {
    return this.request({ method: 'GET', path: `/treatment-plans/${planId}`, schema: planResponseSchema });
  }

  getOwnTreatmentPlan() {
    return this.request({ method: 'GET', path: '/patients/own/treatment-plan', schema: planResponseSchema });
  }

  /** Where to inject now for the given kind of insulin (BRIEF-injection). The API never suggests units. */
  getOwnInjectionSites(kind: InsulinKind): Promise<InjectionSitesDto> {
    return this.request({
      method: 'GET',
      path: '/patients/own/injection-sites',
      query: { kind },
      schema: injectionSitesResponseSchema,
    });
  }

  /** Records an insulin dose with the site and spot used; the next suggestion rotates away from them. */
  recordInsulinDose(body: InsulinDoseCreateDto) {
    return this.request({ method: 'POST', path: '/insulin-doses', body, schema: insulinDoseSchema });
  }

  /** The signed-in patient's own dose history, newest first. */
  listOwnInsulinDoses(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/insulin-doses', query, schema: insulinDosePageSchema });
  }

  /** The doctor's view of an assigned patient's dose history, including the sites used. */
  listPatientInsulinDoses(patientId: string, query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/timeline`,
      query: { ...query, event_types: ['INSULIN'] },
      schema: insulinTimelineSchema,
    });
  }

  listOwnReminders(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/reminders', query, schema: reminderPageSchema });
  }

  updateOwnReminder(reminderId: string, body: ReminderUpdateDto) {
    return this.request({
      method: 'PATCH',
      path: `/reminders/${reminderId}`,
      body,
      schema: reminderSchema,
    });
  }

  // ---- Doctor: clinical notes and messages (API.md 8.11, 8.12) -----------------------

  listClinicalNotes(patientId: string, query: QueryParams = {}) {
    return this.request({
      method: 'GET',
      path: `/patients/${patientId}/clinical-notes`,
      query,
      schema: clinicalNotePageSchema,
    });
  }

  createClinicalNote(patientId: string, body: string) {
    return this.request({
      method: 'POST',
      path: `/patients/${patientId}/clinical-notes`,
      body: { body },
      schema: clinicalNoteSchema,
    });
  }

  /** The doctor passes `patient_id`; the patient reads the own thread without it. */
  listMessages(query: QueryParams = {}) {
    return this.request({ method: 'GET', path: '/messages', query, schema: messagePageSchema });
  }

  sendMessage(body: MessageCreateDto) {
    return this.request({ method: 'POST', path: '/messages', body, schema: messageSchema });
  }

  /** Educational assistant of the patient (HU-42). Replies are plain text with citations and an escalation. */
  sendAssistantMessage(body: AssistantMessageCreateDto) {
    return this.request({ method: 'POST', path: '/assistant/messages', body, schema: assistantReplySchema });
  }

  /** The clinic's default target profile (the triage list classifies with it). */
  async getDefaultTargetProfile(): Promise<TargetProfileDto> {
    const page = await this.request({
      method: 'GET',
      path: '/target-profiles',
      query: { status: 'ACTIVE' },
      schema: pageOf(targetProfileSchema.extend({ status: z.string().optional() })),
    });
    const found = page.items.find((profile) => profile.is_default === true) ?? page.items[0];
    if (!found) throw new ApiError(HTTP_STATUS.NOT_FOUND, 'NOT_FOUND');
    return found;
  }

  // ---- Admin: clinic staff (API.md 8.3) ----------------------------------------------

  /** Staff list. The API sends no patient counts: they are the open care-team assignments per doctor. */
  async listUsers(query: QueryParams = {}): Promise<z.output<typeof staffUserPageSchema>> {
    const page = await this.request({ method: 'GET', path: '/users', query, schema: usersPageSchema });
    const counts = new Map<string, number>();
    let cursor: string | undefined;
    for (let pages = 0; pages < MAX_COUNT_PAGES; pages += 1) {
      const assignments = await this.listCareAssignments({ status: 'ACTIVE', cursor });
      for (const assignment of assignments.items) {
        counts.set(assignment.doctor_id, (counts.get(assignment.doctor_id) ?? 0) + 1);
      }
      if (assignments.next_cursor === null) break;
      cursor = assignments.next_cursor;
    }
    return {
      next_cursor: page.next_cursor,
      items: page.items.map((user) => ({
        id: user.id,
        full_name: user.full_name,
        email: user.email ?? '',
        role: user.role,
        status: user.is_active ? ('ACTIVE' as const) : ('INACTIVE' as const),
        patients_count: counts.get(user.id) ?? 0,
      })),
    };
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
      if (import.meta.env.DEV) {
        // Solo en desarrollo: dice qué campo del contrato real no coincide con el esquema.
        console.warn(
          `[contrato] ${spec.method} ${spec.path}`,
          parsed.error.issues.slice(0, MAX_REPORTED_ISSUES).map((issue) => `${issue.path.join('.')}: ${issue.message}`),
        );
      }
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
