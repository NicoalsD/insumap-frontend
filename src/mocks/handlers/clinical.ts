import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '@/core/auth/permissions';
import { ownOverviewSchema } from '@/services/dto/clinical';
import { WINDOWS, type MetricsWindow } from '@/services/dto/common';
import { apiUrl } from '@/services/http/apiUrl';
import { DEMO_CLINIC } from '../fixtures/people';
import { patientId } from '../fixtures/world';
import { apiError, paginate, readBody, validationError } from '../http';
import type { MockState } from '../MockState';
import { guard } from './guard';

const DEFAULT_WINDOW: MetricsWindow = '14d';
const FALLBACK_PAGE_DEFAULT = 20;
const FALLBACK_PAGE_MAX = 100;

function windowOf(url: URL): MetricsWindow | null {
  const raw = url.searchParams.get('window') ?? DEFAULT_WINDOW;
  return (WINDOWS as readonly string[]).includes(raw) ? (raw as MetricsWindow) : null;
}

/** Doctor, patient and alert/AI endpoints of API.md 8.6, 8.8 to 8.11. */
export function clinicalHandlers(state: MockState) {
  const page = <T>(items: readonly T[], url: URL) =>
    paginate(
      items,
      url,
      state.limits['page_size_default'] ?? FALLBACK_PAGE_DEFAULT,
      state.limits['page_size_max'] ?? FALLBACK_PAGE_MAX,
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
      return HttpResponse.json(page(rows, url));
    }),

    // `me` routes are declared before `:patient_id` so "me" is never read as an id (API.md 8.4).
    http.get(apiUrl('/patients/me/overview'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.patientReadOwn);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const overview = state.world.overview(result.account.id, window);
      if (!overview) return apiError('NOT_FOUND');
      // The patient never receives AI output: the schema of the own overview drops it.
      return HttpResponse.json(ownOverviewSchema.parse(overview));
    }),

    http.get(apiUrl('/patients/me/metrics'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.metricsReadOwn);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const metrics = state.world.metrics(result.account.id, window);
      return metrics ? HttpResponse.json(metrics) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/readings'), ({ request }) => {
      const result = guard(state, request, PERMISSIONS.glucoseReadOwn);
      if ('response' in result) return result.response;
      return HttpResponse.json(page(state.world.readings(result.account.id) ?? [], new URL(request.url)));
    }),

    http.get(apiUrl('/patients/:patient_id/overview'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.patientRead);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const overview = state.world.overview(String(params['patient_id']), window);
      return overview ? HttpResponse.json(overview) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/patients/:patient_id/metrics'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.metricsRead);
      if ('response' in result) return result.response;
      const window = windowOf(new URL(request.url));
      if (!window) return validationError([{ field: 'query.window', type: 'enum' }]);
      const metrics = state.world.metrics(String(params['patient_id']), window);
      return metrics ? HttpResponse.json(metrics) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/patients/:patient_id/metrics/agp'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.metricsRead);
      if ('response' in result) return result.response;
      const agp = state.world.agp(String(params['patient_id']));
      return agp ? HttpResponse.json(agp) : apiError('NOT_FOUND');
    }),

    http.get(apiUrl('/patients/:patient_id/readings'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.patientRead);
      if ('response' in result) return result.response;
      const readings = state.world.readings(String(params['patient_id']));
      return readings ? HttpResponse.json(page(readings, new URL(request.url))) : apiError('NOT_FOUND');
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
