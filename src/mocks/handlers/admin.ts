import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '@/core/auth/permissions';
import type { CredentialInvitationDto, ImportBatchDto } from '@/services/dto/admin';
import { ROLES } from '@/services/dto/common';
import { apiUrl } from '@/services/http/apiUrl';
import { HTTP_STATUS } from '@/services/http/httpStatus';
import { parseCsvImport, parseFhirImport, type ImportCandidate, type ParsedImport } from '../importValidation';
import { apiError, paginate, readBody, validationError } from '../http';
import type { MockState } from '../MockState';
import { guard } from './guard';
import { wireUser } from '../wire';

const FALLBACK_PAGE_DEFAULT = 20;
const FALLBACK_PAGE_MAX = 100;
const INVITATION_DAYS = 7;
const DAY_MS = 86_400_000;
const CSV_TEMPLATE = 'mrn,birth_date,email\n';
const FHIR_TYPE = 'application/fhir+json';
const CSV_TYPE = 'text/csv';

function totalsOf(parsed: Extract<ParsedImport, { ok: true }>): ImportBatchDto['totals'] {
  const count = (status: string) => parsed.rows.filter((row) => row.status === status).length;
  return {
    valid: count('VALID'),
    warning: count('WARNING'),
    error: count('ERROR'),
    skipped_duplicate: count('SKIPPED_DUPLICATE'),
  };
}

/** Admin console endpoints of API.md 8.4 and 8.5: imports, credential invitations, rosters. */
export function adminHandlers(state: MockState) {
  const page = <T>(items: readonly T[], url: URL) =>
    paginate(
      items,
      url,
      state.limits['page_size_default'] ?? FALLBACK_PAGE_DEFAULT,
      state.limits['page_size_max'] ?? FALLBACK_PAGE_MAX,
    );
  const existingMrns = () => new Set(state.world.patientAdmin.map((p) => p.mrn));
  let batchCounter = 0;
  const candidatesByBatch = new Map<string, readonly ImportCandidate[]>();

  const createPreview = (source: 'FHIR' | 'CSV', contentType: string, parse: typeof parseCsvImport) =>
    http.post(apiUrl(source === 'FHIR' ? '/imports/fhir' : '/imports/csv'), async ({ request }) => {
      const result = guard(state, request, PERMISSIONS.patientsImport);
      if ('response' in result) return result.response;
      if (!(request.headers.get('Content-Type') ?? '').startsWith(contentType)) {
        return apiError('UNSUPPORTED_MEDIA_TYPE');
      }
      const parsed = parse(await request.text(), existingMrns(), state.world.now);
      if (!parsed.ok) {
        return validationError(parsed.missingColumns.map((column) => ({ field: `column.${column}`, type: 'missing' })));
      }
      batchCounter += 1;
      const batch: ImportBatchDto = {
        batch_id: `e5000000-0000-4000-8000-${String(batchCounter).padStart(12, '0')}`,
        source,
        status: 'PREVIEW',
        created_by: result.account.fullName,
        created_at: new Date().toISOString(),
        totals: totalsOf(parsed),
        simulated: false,
      };
      state.world.imports.set(batch.batch_id, { batch, rows: [...parsed.rows] });
      candidatesByBatch.set(batch.batch_id, parsed.candidates);
      return HttpResponse.json(batch, { status: HTTP_STATUS.CREATED });
    });

  return [
    http.get(apiUrl('/imports/csv-template'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.patientsImport);
      return 'response' in result
        ? result.response
        : new HttpResponse(CSV_TEMPLATE, { headers: { 'Content-Type': 'text/csv; charset=utf-8' } });
    }),
    createPreview('FHIR', FHIR_TYPE, parseFhirImport),
    createPreview('CSV', CSV_TYPE, parseCsvImport),

    http.get(apiUrl('/imports'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.importBatchesRead);
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const source = url.searchParams.get('source');
      const items = [...state.world.imports.values()]
        .map((entry) => entry.batch)
        .filter((batch) => source === null || batch.source === source)
        .reverse();
      return HttpResponse.json(page(items, url));
    }),

    http.get(apiUrl('/imports/:batch_id'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.importBatchesRead);
      if ('response' in result) return result.response;
      const entry = state.world.imports.get(String(params['batch_id']));
      return entry ? HttpResponse.json(entry.batch) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/imports/:batch_id/rows'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.importBatchesRead);
      if ('response' in result) return result.response;
      const entry = state.world.imports.get(String(params['batch_id']));
      if (!entry) return apiError('NOT_FOUND');
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      return HttpResponse.json(page(entry.rows.filter((row) => status === null || row.status === status), url));
    }),

    http.post(apiUrl('/imports/:batch_id/confirm'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.patientsImport);
      if ('response' in result) return result.response;
      const id = String(params['batch_id']);
      const entry = state.world.imports.get(id);
      if (!entry) return apiError('NOT_FOUND');
      if (entry.batch.status !== 'PREVIEW') return apiError('INVALID_STATE_TRANSITION');
      entry.batch = { ...entry.batch, status: 'CONFIRMED' };
      for (const candidate of candidatesByBatch.get(id) ?? []) {
        state.world.patientAdmin.push({
          id: `a2${String(state.world.patientAdmin.length + 1).padStart(6, '0')}-0000-4000-8000-000000000000`,
          full_name: `Paciente importado ${candidate.mrn}`,
          mrn: candidate.mrn,
          document_last4: '0000',
          account_status: 'IMPORTED',
          primary_doctor_id: null,
          assigned_doctor_count: 0,
          invitation_status: null,
          simulated: false,
        });
      }
      return HttpResponse.json(entry.batch, { status: HTTP_STATUS.ACCEPTED });
    }),

    http.get(apiUrl('/patients'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.patientsRoster);
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const status = url.searchParams.get('account_status');
      const withoutDoctor = url.searchParams.get('without_doctor');
      const items = state.world.patientAdmin.filter(
        (p) =>
          (status === null || p.account_status === status) &&
          (withoutDoctor !== 'true' || p.assigned_doctor_count === 0),
      );
      return HttpResponse.json(page(items, url));
    }),

    http.post(apiUrl('/patients/:patient_id/credential-invitations'), async ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.credentialsIssue);
      if ('response' in result) return result.response;
      const patient = state.world.patientAdmin.find((p) => p.id === params['patient_id']);
      if (!patient) return apiError('NOT_FOUND');
      const body = await readBody(request);
      const channel = body?.['channel'];
      if (channel !== 'PRINT' && channel !== 'EMAIL') {
        return validationError([{ field: 'body.channel', type: 'enum' }]);
      }
      if (patient.account_status === 'SUSPENDED' || patient.account_status === 'DEACTIVATED') {
        return apiError('INVALID_STATE_TRANSITION');
      }
      const active = patient.account_status === 'ACTIVE';
      const invitation: CredentialInvitationDto = {
        invitation_id: `1a000000-0000-4000-8000-${String(state.world.invitations.size + 1).padStart(12, '0')}`,
        purpose: active ? ('PASSWORD_RESET' as const) : ('PATIENT_ACTIVATION' as const),
        status: 'PENDING' as const,
        channel,
        expires_at: new Date(state.world.now.getTime() + INVITATION_DAYS * DAY_MS).toISOString(),
        delivery_status: channel === 'EMAIL' ? 'QUEUED' : 'PRINTED',
        ...(channel === 'PRINT' ? { activation_code: 'K7M2-9PQX-4TRD-8WHN' } : {}),
      };
      state.world.invitations.set(invitation.invitation_id, invitation);
      patient.account_status = active ? patient.account_status : 'INVITED';
      patient.invitation_status = 'PENDING';
      return HttpResponse.json(invitation, {
        status: HTTP_STATUS.CREATED,
        headers: { 'Cache-Control': 'no-store' },
      });
    }),

    http.get(apiUrl('/users'), ({ request }) => {
      const result = guard(state, request, 'users.read');
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const role = url.searchParams.get('role');
      if (role !== null && !(ROLES as readonly string[]).includes(role)) {
        return validationError([{ field: 'query.role', type: 'enum' }]);
      }
      // Patients are not clinic staff: the list answers doctors and admins only.
      const items = state.world
        .staffUsers()
        .filter((user) => (role === null ? user.role !== 'PATIENT' : user.role === role));
      return HttpResponse.json(page(items.map(wireUser), url));
    }),

    http.get(apiUrl('/care-team/assignments'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.careTeamRead);
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const items = state.world.careAssignments.filter(
        (a) => status === null || (status === 'ENDED') === (a.ended_at !== null),
      );
      return HttpResponse.json(page(items, url));
    }),
  ];
}
