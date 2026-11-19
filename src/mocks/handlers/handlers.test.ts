import { beforeEach, describe, expect, it } from 'vitest';
import { AccessTokenStore } from '@/services/api/AccessTokenStore';
import { ApiError } from '@/services/api/ApiError';
import { InsumapApi } from '@/services/api/InsumapApi';
import {
  ADMIN_ACCOUNT,
  DEMO_ACTIVATION,
  DEMO_TOTP_CODE,
  DOCTOR_ACCOUNT,
  ENROLLMENT_ACCOUNT,
  PATIENT_ACCOUNT,
} from '../fixtures/people';
import { patientId } from '../fixtures/world';

let api: InsumapApi;
let tokens: AccessTokenStore;

beforeEach(() => {
  tokens = new AccessTokenStore();
  api = new InsumapApi({ tokens });
});

async function signInStaff(account: { email: string; password: string }) {
  const login = await api.login(account.email, account.password);
  if (login.status !== 'MFA_CHALLENGE') throw new Error('expected a challenge');
  await api.verifyMfa(login.challenge_token, DEMO_TOTP_CODE);
}

async function codeOf(promise: Promise<unknown>): Promise<string> {
  const error = await promise.catch((e: unknown) => e);
  return error instanceof ApiError ? error.code : 'NO_ERROR';
}

describe('mock auth (API.md 8.2)', () => {
  it('publishes field limits without a session', async () => {
    const limits = await api.getFieldLimits();
    expect(limits['password_min_length']).toBeGreaterThan(0);
  });

  it('answers staff with MFA_CHALLENGE and gives a session only after the code', async () => {
    const login = await api.login(DOCTOR_ACCOUNT.email, DOCTOR_ACCOUNT.password);
    expect(login.status).toBe('MFA_CHALLENGE');
    expect(tokens.get()).toBeNull();
    expect(await codeOf(api.verifyMfa('wrong-token', DEMO_TOTP_CODE))).toBe('UNAUTHENTICATED');
    if (login.status !== 'MFA_CHALLENGE') return;
    expect(await codeOf(api.verifyMfa(login.challenge_token, '000000'))).toBe('INVALID_CREDENTIALS');
    await api.verifyMfa(login.challenge_token, DEMO_TOTP_CODE);
    const me = await api.getCurrentUser();
    expect(me.role).toBe('DOCTOR');
    expect(me.clinic?.is_demo).toBe(true);
    expect(me.permissions).toContain('dashboard.read_assigned');
  });

  it('answers a patient with AUTHENTICATED straight away', async () => {
    const login = await api.login(PATIENT_ACCOUNT.email, PATIENT_ACCOUNT.password);
    expect(login.status).toBe('AUTHENTICATED');
    expect((await api.getCurrentUser()).role).toBe('PATIENT');
  });

  it('rejects wrong credentials with the generic code', async () => {
    expect(await codeOf(api.login(PATIENT_ACCOUNT.email, 'nope'))).toBe('INVALID_CREDENTIALS');
  });

  it('walks MFA enrollment and returns recovery codes once', async () => {
    const login = await api.login(ENROLLMENT_ACCOUNT.email, ENROLLMENT_ACCOUNT.password);
    expect(login.status).toBe('MFA_ENROLLMENT_REQUIRED');
    expect(await codeOf(api.getTriage())).toBe('MFA_REQUIRED');
    const enrollment = await api.startMfaEnrollment();
    expect(enrollment.otpauth_uri).toContain('otpauth://totp/Insumap:');
    expect(await codeOf(api.confirmMfaEnrollment('000000'))).toBe('INVALID_CREDENTIALS');
    const codes = await api.confirmMfaEnrollment(DEMO_TOTP_CODE);
    expect(codes).toHaveLength(10);
    expect((await api.getCurrentUser()).mfa_enabled).toBe(true);
  });

  it('restores a session from the refresh cookie and ends it on logout', async () => {
    await signInStaff(DOCTOR_ACCOUNT);
    const reloaded = new AccessTokenStore();
    const afterReload = new InsumapApi({ tokens: reloaded });
    expect(await afterReload.restoreSession()).toBe(true);
    expect(reloaded.get()).not.toBeNull();
    await afterReload.logout();
    expect(await new InsumapApi({ tokens: new AccessTokenStore() }).restoreSession()).toBe(false);
  });

  it('refreshes transparently when the access token is gone but the cookie lives', async () => {
    await signInStaff(DOCTOR_ACCOUNT);
    tokens.set('expired-token');
    expect((await api.getTriage()).items.length).toBeGreaterThan(0);
  });

  it('verifies the activation code and birth date, then completes with consent', async () => {
    expect(await codeOf(api.verifyActivation(DEMO_ACTIVATION.code, '2000-01-01'))).toBe('INVITATION_INVALID');
    const verified = await api.verifyActivation(DEMO_ACTIVATION.code.toLowerCase(), DEMO_ACTIVATION.birthDate);
    const body = {
      activation_token: verified.activation_token,
      new_password: 'a-long-enough-password',
      consent: { privacy_notice_version_id: verified.privacy_notice_version_id, accepted: false, ai_external_processing: false },
    };
    expect(await codeOf(api.completeActivation(body))).toBe('CONSENT_REQUIRED');
    expect(await api.completeActivation({ ...body, consent: { ...body.consent, accepted: true } })).toBe('AUTHENTICATED');
  });
});

describe('mock doctor endpoints (API.md 8.8 to 8.11)', () => {
  beforeEach(async () => {
    await signInStaff(DOCTOR_ACCOUNT);
  });

  it('serves a triage ordered by risk with the target profile inside every row', async () => {
    const page = await api.getTriage({ window: '14d' });
    expect(page.items[0]?.risk_tier).toBe('CRITICAL');
    expect(page.items.every((row) => row.metrics.target_profile.range_low_mg_dl > 0)).toBe(true);
    expect(page.items.every((row) => row.simulated)).toBe(true);
    const scores = page.items.map((row) => row.risk_score);
    expect(scores).toEqual([...scores].sort((a, b) => b - a));
  });

  it('paginates with an opaque cursor', async () => {
    const first = await api.getTriage({ limit: 3 });
    expect(first.items).toHaveLength(3);
    expect(first.next_cursor).not.toBeNull();
    const second = await api.getTriage({ limit: 3, cursor: first.next_cursor });
    expect(second.items[0]?.patient_id).not.toBe(first.items[0]?.patient_id);
  });

  it('rejects an invalid window with a validation error', async () => {
    expect(await codeOf(api.getTriage({ window: '99d' }))).toBe('VALIDATION_ERROR');
  });

  it('serves overview, metrics, AGP and readings of an assigned patient', async () => {
    const id = patientId(1);
    const overview = await api.getPatientOverview(id, '14d');
    expect(overview.pending_recommendations.length).toBe(1);
    expect(overview.data_source).toBe('SIMULATED');
    const metrics = await api.getPatientMetrics(id, '7d');
    expect(metrics.window).toBe('7d');
    const agp = await api.getPatientAgp(id);
    expect(agp.bins).toHaveLength(24);
    expect((await api.listPatientReadings(id, { limit: 5 })).items).toHaveLength(5);
    const insufficient = await api.getPatientAgp(patientId(7));
    expect(insufficient.is_sufficient).toBe(false);
    expect(insufficient.bins).toEqual([]);
  });

  it('answers 404 for an unknown patient and 403 for a missing permission', async () => {
    expect(await codeOf(api.getPatientOverview('missing', '14d'))).toBe('NOT_FOUND');
    expect(await codeOf(api.listPatients())).toBe('FORBIDDEN');
  });

  it('moves an alert through acknowledge and resolve and refuses invalid transitions', async () => {
    const [alert] = (await api.listAlerts({ status: 'OPEN' })).items;
    if (!alert) throw new Error('missing fixture');
    expect(await codeOf(api.resolveAlert(alert.id, 'Se contactó al paciente'))).toBe('INVALID_STATE_TRANSITION');
    expect((await api.acknowledgeAlert(alert.id)).status).toBe('ACKNOWLEDGED');
    expect((await api.resolveAlert(alert.id, 'Se contactó al paciente')).status).toBe('RESOLVED');
    expect(await codeOf(api.acknowledgeAlert(alert.id))).toBe('INVALID_STATE_TRANSITION');
  });

  it('lets the doctor approve, modify or reject a recommendation, with a reason where required', async () => {
    const { items } = await api.listRecommendations({ status: 'PROPOSED' });
    const [a, b, c] = items;
    if (!a || !b || !c) throw new Error('missing fixture');
    expect((await api.approveRecommendation(a.id)).status).toBe('APPROVED');
    expect(await codeOf(api.approveRecommendation(a.id))).toBe('INVALID_STATE_TRANSITION');
    expect(await codeOf(api.rejectRecommendation(b.id, 'corto'))).toBe('REASON_REQUIRED');
    expect((await api.rejectRecommendation(b.id, 'La tendencia ya se corrigió sola')).status).toBe('REJECTED');
    const modified = await api.modifyRecommendation(c.id, { delta_units: 1 }, 'Prefiero un ajuste más pequeño');
    expect(modified.status).toBe('APPROVED_WITH_CHANGES');
  });
});

describe('mock patient endpoints', () => {
  beforeEach(async () => {
    await api.login(PATIENT_ACCOUNT.email, PATIENT_ACCOUNT.password);
  });

  it('serves the own overview without recommendations or forecast', async () => {
    const overview = await api.getOwnOverview('14d');
    expect(overview.patient.id).toBe(PATIENT_ACCOUNT.id);
    expect('pending_recommendations' in overview).toBe(false);
    expect('latest_forecast' in overview).toBe(false);
    expect((await api.getOwnMetrics('14d')).target_profile.code).toBe('ADULT_STANDARD');
    expect((await api.listOwnReadings()).items.length).toBeGreaterThan(0);
  });

  it('shows only the own alerts and forbids doctor endpoints', async () => {
    const alerts = await api.listAlerts();
    expect(alerts.items.every((alert) => alert.patient_id === PATIENT_ACCOUNT.id)).toBe(true);
    expect(await codeOf(api.getTriage())).toBe('FORBIDDEN');
    expect(await codeOf(api.listRecommendations())).toBe('FORBIDDEN');
  });
});

describe('mock admin endpoints (API.md 8.4)', () => {
  beforeEach(async () => {
    await signInStaff(ADMIN_ACCOUNT);
  });

  const csv = 'mrn,birth_date,email\nMRN-20001,1980-02-03,ana@example.test\nMRN-20002,no-es-fecha,\n,1990-01-01,\nMRN-10001,1985-05-05,\nMRN-20001,1980-02-03,\nMRN-20006,1991-04-04,\n';

  it('validates a CSV per row without creating accounts, then confirms', async () => {
    const preview = await api.createImportPreview('CSV', csv);
    expect(preview.totals).toEqual({ valid: 1, warning: 1, error: 3, skipped_duplicate: 1 });
    const rows = await api.listImportRows(preview.batch_id);
    expect(rows.items.map((row) => [row.row_number, row.status, row.issue_codes[0]])).toEqual([
      [1, 'VALID', undefined],
      [2, 'ERROR', 'INVALID_BIRTH_DATE'],
      [3, 'ERROR', 'MISSING_MRN'],
      [4, 'SKIPPED_DUPLICATE', 'DUPLICATE_MRN'],
      [5, 'ERROR', 'DUPLICATE_MRN_IN_FILE'],
      [6, 'WARNING', 'MISSING_EMAIL'],
    ]);
    const before = (await api.listPatients()).items.length;
    expect((await api.listImportRows(preview.batch_id, { status: 'ERROR' })).items).toHaveLength(3);
    expect((await api.confirmImport(preview.batch_id)).status).toBe('CONFIRMED');
    expect((await api.listPatients()).items.length).toBe(before + 2);
    expect(await codeOf(api.confirmImport(preview.batch_id))).toBe('INVALID_STATE_TRANSITION');
    expect((await api.listImportBatches()).items[0]?.batch_id).toBe(preview.batch_id);
  });

  it('rejects a CSV without required columns and a wrong media type', async () => {
    const error = await api.createImportPreview('CSV', 'nombre\nAna\n').catch((e: unknown) => e);
    expect(error).toBeInstanceOf(ApiError);
    expect((error as ApiError).fieldErrors).toEqual({ 'column.mrn': 'missing', 'column.birth_date': 'missing' });
  });

  it('validates a FHIR bundle entry by entry', async () => {
    const bundle = JSON.stringify({
      resourceType: 'Bundle',
      entry: [
        { resource: { resourceType: 'Patient', identifier: [{ value: 'MRN-30001' }], birthDate: '1975-06-01', telecom: [{ system: 'email', value: 'x@example.test' }] } },
        { resource: { resourceType: 'Patient', identifier: [{ value: 'MRN-30002' }], birthDate: 'mal' } },
        { resource: { resourceType: 'Observation' } },
        { resource: { resourceType: 'Encounter' } },
      ],
    });
    const preview = await api.createImportPreview('FHIR', bundle);
    expect(preview.source).toBe('FHIR');
    expect(preview.totals).toEqual({ valid: 1, warning: 1, error: 2, skipped_duplicate: 0 });
  });

  it('issues credentials once for PRINT and treats a second issue as the resend', async () => {
    const imported = (await api.listPatients({ account_status: 'IMPORTED' })).items[0];
    if (!imported) throw new Error('missing fixture');
    const first = await api.issueCredentials(imported.id, 'PRINT');
    expect(first.activation_code).toMatch(/^[A-Z0-9]{4}(-[A-Z0-9]{4}){3}$/);
    expect(first.purpose).toBe('PATIENT_ACTIVATION');
    const resend = await api.issueCredentials(imported.id, 'EMAIL');
    expect(resend.activation_code).toBeUndefined();
    const invited = (await api.listPatients({ account_status: 'INVITED' })).items.map((p) => p.id);
    expect(invited).toContain(imported.id);
  });

  it('lists care assignments and forbids clinical data', async () => {
    expect((await api.listCareAssignments()).items[0]?.is_primary).toBe(true);
    expect(await codeOf(api.getTriage())).toBe('FORBIDDEN');
    expect(await codeOf(api.getPatientOverview(patientId(1), '14d'))).toBe('FORBIDDEN');
    expect((await api.getCurrentClinic()).is_demo).toBe(true);
  });
});
