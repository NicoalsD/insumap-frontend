import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '@/core/auth/permissions';
import { ownOverviewSchema, readingCreateSchema, type GlucoseReadingDto } from '@/services/dto/clinical';
import { WINDOWS, type MetricsWindow } from '@/services/dto/common';
import { apiUrl } from '@/services/http/apiUrl';
import { HTTP_STATUS } from '@/services/http/httpStatus';
import { DEMO_CLINIC } from '../fixtures/people';
import { TARGET_PROFILES } from '../fixtures/profiles';
import { patientId } from '../fixtures/world';
import { apiError, paginate, readBody, validationError } from '../http';
import type { AgpResolution } from '../fixtures/world';
import type { MockState } from '../MockState';
import { guard } from './guard';
import { wireAgp, wireMetrics, wireOverview, wireTriageRow } from '../wire';

const DEFAULT_WINDOW: MetricsWindow = '14d';
const FALLBACK_PAGE_DEFAULT = 20;
const FALLBACK_PAGE_MAX = 100;
const FALLBACK_READINGS_PAGE_MAX = 2000;
const FALLBACK_READING_MAX_AGE_DAYS = 14;
const DAY_MS = 86_400_000;
const AGP_RESOLUTIONS: readonly AgpResolution[] = ['15min', 'hour'];
const DEFAULT_AGP_RESOLUTION: AgpResolution = '15min';

function windowOf(url: URL): MetricsWindow | null {
  const raw = url.searchParams.get('window') ?? DEFAULT_WINDOW;
  return (WINDOWS as readonly string[]).includes(raw) ? (raw as MetricsWindow) : null;
}

/** Doctor, patient and alert/AI endpoints of API.md 8.6, 8.8 to 8.11, plus own readings (POST /readings). */
export function clinicalHandlers(state: MockState) {
  const page = <T>(items: readonly T[], url: URL) =>
    paginate(
      items,
      url,
      state.limits['page_size_default'] ?? FALLBACK_PAGE_DEFAULT,
      state.limits['page_size_max'] ?? FALLBACK_PAGE_MAX,
    );
  /** Readings may be read in pages of up to 2000 (the 14-day, 15-minute history fits in one page). */
  const readingsPage = <T>(items: readonly T[], url: URL) =>
    paginate(
      items,
      url,
      state.limits['page_size_default'] ?? FALLBACK_PAGE_DEFAULT,
      state.limits['readings_page_size_max'] ?? FALLBACK_READINGS_PAGE_MAX,
    );
  const reasonOk = (reason: unknown): reason is string =>
    typeof reason === 'string' &&
    reason.trim().length >= (state.limits['reason_min_length'] ?? 0) &&
    reason.trim().length <= (state.limits['reason_max_length'] ?? Number.MAX_SAFE_INTEGER);

  return [
    http.get(apiUrl('/clinics/current'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.clinicRead);
      return 'response' in result ? result.response : HttpResponse.json(DEMO_CLINIC);
    }),

    http.post(apiUrl('/dashboard/patients/:patient_id/review'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.triageRead);
      if ('response' in result) return result.response;
      const id = String(params['patient_id']);
      if (!state.world.isAssigned(id)) return apiError('NOT_FOUND');
      return HttpResponse.json({ patient_id: id, reviewed_at: new Date().toISOString() });
    }),

    http.get(apiUrl('/target-profiles'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.triageRead);
      if ('response' in result) return result.response;
      const items = TARGET_PROFILES.map((profile, index) => ({ ...profile, status: 'ACTIVE', is_default: index === 0 }));
      return HttpResponse.json({ items, next_cursor: null });
    }),

    http.get(apiUrl('/target-profiles/:profile_id'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.triageRead);
      if ('response' in result) return result.response;
      const profile = TARGET_PROFILES.find((item) => item.id === String(params['profile_id']));
      return profile ? HttpResponse.json(profile) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/dashboard/triage'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.triageRead);
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const window = windowOf(url);
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const reviewed = url.searchParams.get('reviewed');
      const rows = state.world
        .triage(window)
        .filter((row) => reviewed === null || (row.reviewed_at !== null) === (reviewed === 'true'));
      return HttpResponse.json(page(rows.map(wireTriageRow), url));
    }),

    // `me` routes are declared before `:patient_id` so "me" is never read as an id (API.md 8.4).
    http.get(apiUrl('/patients/own/overview'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.patientReadOwn);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const overview = state.world.overview(result.account.id, window);
      if (!overview) return apiError('NOT_FOUND');
      // The patient never receives AI output: the schema of the own overview drops it.
      return HttpResponse.json(wireOverview(ownOverviewSchema.parse(overview), overview.timezone));
    }),

    http.get(apiUrl('/patients/own/metrics'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.metricsReadOwn);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const metrics = state.world.metrics(result.account.id, window);
      return metrics ? HttpResponse.json(wireMetrics(metrics)) : apiError('NOT_FOUND');
    }),

    http.post(apiUrl('/readings'), async ({ request }) => {
      const result = guard(state, request, PERMISSIONS.glucoseWriteOwn);
      if ('response' in result) return result.response;
      const parsed = readingCreateSchema(state.limits).safeParse((await readBody(request)) ?? {});
      if (!parsed.success) {
        return validationError(
          parsed.error.issues.map((issue) => ({ field: `body.${issue.path.join('.')}`, type: issue.code })),
        );
      }
      const input = parsed.data;
      const patient = result.account.id;
      const measuredAt = new Date(input.measured_at);
      const measuredIso = measuredAt.toISOString();
      // Same `client_reading_id` with the same content answers with the original; other content conflicts.
      const existing = state.world.findOwnReading(patient, input.client_reading_id);
      if (existing) {
        const sameContent =
          existing.value_mg_dl === input.value_mg_dl &&
          existing.measured_at === measuredIso &&
          existing.context === (input.context ?? null);
        return sameContent ? HttpResponse.json(existing) : apiError('CONFLICT');
      }
      const nowMs = Date.now();
      if (measuredAt.getTime() > nowMs) return apiError('READING_IN_FUTURE');
      const maxAgeMs = (state.limits['reading_max_age_days'] ?? FALLBACK_READING_MAX_AGE_DAYS) * DAY_MS;
      if (nowMs - measuredAt.getTime() > maxAgeMs) return apiError('READING_TOO_OLD');
      const min = state.limits['reading_min_mg_dl'] ?? 0;
      const max = state.limits['reading_max_mg_dl'] ?? Number.MAX_SAFE_INTEGER;
      if (input.value_mg_dl < min || input.value_mg_dl > max) return apiError('GLUCOSE_OUT_OF_RANGE');
      const reading: GlucoseReadingDto = {
        id: state.world.nextId('e3'),
        client_reading_id: input.client_reading_id,
        value_mg_dl: input.value_mg_dl,
        measured_at: measuredIso,
        source: input.source,
        context: input.context ?? null,
        status: 'ACCEPTED',
        issue_codes: [],
        simulated: false,
      };
      state.world.addOwnReading(patient, reading);
      return HttpResponse.json(reading, {
        status: HTTP_STATUS.CREATED,
        headers: { Location: apiUrl(`readings/${reading.id}`) },
      });
    }),

    http.get(apiUrl('/readings'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.glucoseReadOwn);
      if ('response' in result) return result.response;
      return HttpResponse.json(readingsPage(state.world.readings(result.account.id) ?? [], new URL(request.url)));
    }),

    http.get(apiUrl('/patients/:patient_id/overview'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.patientRead);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const overview = state.world.overview(String(params['patient_id']), window);
      return overview ? HttpResponse.json(wireOverview(overview, overview.timezone)) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/patients/:patient_id/metrics'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.metricsRead);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const metrics = state.world.metrics(String(params['patient_id']), window);
      return metrics ? HttpResponse.json(wireMetrics(metrics)) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/patients/:patient_id/metrics/agp'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.metricsRead);
      if ('response' in result) return result.response;
      const raw = new URL(request.url).searchParams.get('resolution') ?? DEFAULT_AGP_RESOLUTION;
      const resolution = AGP_RESOLUTIONS.find((value) => value === raw);
      if (!resolution) return validationError([{ field: 'query.resolution', type: 'enum' }]);
      const agp = state.world.agp(String(params['patient_id']), resolution);
      return agp ? HttpResponse.json(wireAgp(agp)) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/patients/:patient_id/readings'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.patientRead);
      if ('response' in result) return result.response;
      const readings = state.world.readings(String(params['patient_id']));
      return readings ? HttpResponse.json(readingsPage(readings, new URL(request.url))) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/alerts'), ({ request }) => {
      const doctorRead = guard(state, request, PERMISSIONS.alertsRead);
      const result = 'response' in doctorRead ? guard(state, request, PERMISSIONS.alertsReadOwn) : doctorRead;
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const type = url.searchParams.get('type');
      const patient = url.searchParams.get('patient_id');
      const own = result.account.role === 'PATIENT';
      const items = state.world.alerts.filter(
        (alert) =>
          (status === null || alert.status === status) &&
          (type === null || alert.type === type) &&
          (patient === null || alert.patient_id === patient) &&
          (!own || alert.patient_id === result.account.id),
      );
      return HttpResponse.json(page(items, url));
    }),

    http.post(apiUrl('/alerts/:alert_id/acknowledge'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.alertsAcknowledge);
      if ('response' in result) return result.response;
      const alert = state.world.alerts.find((a) => a.id === params['alert_id']);
      if (!alert) return apiError('NOT_FOUND');
      if (alert.status !== 'OPEN' && alert.status !== 'ESCALATED') return apiError('INVALID_STATE_TRANSITION');
      alert.status = 'ACKNOWLEDGED';
      return HttpResponse.json(alert);
    }),

    http.post(apiUrl('/alerts/:alert_id/resolve'), async ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.alertsResolve);
      if ('response' in result) return result.response;
      const alert = state.world.alerts.find((a) => a.id === params['alert_id']);
      if (!alert) return apiError('NOT_FOUND');
      const body = await readBody(request);
      if (typeof body?.['note'] !== 'string' || body['note'].trim() === '') {
        return validationError([{ field: 'body.note', type: 'missing' }]);
      }
      if (alert.status !== 'ACKNOWLEDGED') return apiError('INVALID_STATE_TRANSITION');
      alert.status = 'RESOLVED';
      return HttpResponse.json(alert);
    }),

    http.get(apiUrl('/recommendations'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.recommendationsRead);
      if ('response' in result) return result.response;
      const url = new URL(request.url);
      const status = url.searchParams.get('status');
      const patient = url.searchParams.get('patient_id');
      if (patient !== null && !state.world.specs.some((s) => patientId(s.n) === patient)) {
        return apiError('NOT_FOUND');
      }
      const items = state.world.recommendations.filter(
        (r) => (status === null || r.status === status) && (patient === null || r.patient_id === patient),
      );
      return HttpResponse.json(page(items, url));
    }),

    http.post(apiUrl('/recommendations/:id/approve'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.recommendationsDecide);
      if ('response' in result) return result.response;
      const rec = state.world.recommendations.find((r) => r.id === params['id']);
      if (!rec) return apiError('NOT_FOUND');
      if (rec.status !== 'PROPOSED') return apiError('INVALID_STATE_TRANSITION');
      rec.status = 'APPROVED';
      rec.draft_plan_id = 'd4000000-0000-4000-8000-000000000001';
      return HttpResponse.json(rec);
    }),

    http.post(apiUrl('/recommendations/:id/modify'), async ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.recommendationsDecide);
      if ('response' in result) return result.response;
      const rec = state.world.recommendations.find((r) => r.id === params['id']);
      if (!rec) return apiError('NOT_FOUND');
      const body = await readBody(request);
      if (!reasonOk(body?.['reason'])) return apiError('REASON_REQUIRED');
      if (rec.status !== 'PROPOSED') return apiError('INVALID_STATE_TRANSITION');
      rec.status = 'APPROVED_WITH_CHANGES';
      rec.decision_reason = body['reason'];
      rec.draft_plan_id = 'd4000000-0000-4000-8000-000000000002';
      return HttpResponse.json(rec);
    }),

    http.post(apiUrl('/recommendations/:id/reject'), async ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.recommendationsDecide);
      if ('response' in result) return result.response;
      const rec = state.world.recommendations.find((r) => r.id === params['id']);
      if (!rec) return apiError('NOT_FOUND');
      const body = await readBody(request);
      if (!reasonOk(body?.['reason'])) return apiError('REASON_REQUIRED');
      if (rec.status !== 'PROPOSED') return apiError('INVALID_STATE_TRANSITION');
      rec.status = 'REJECTED';
      rec.decision_reason = body['reason'];
      return HttpResponse.json(rec);
    }),
  ];
}
