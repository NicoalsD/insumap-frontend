import { http, HttpResponse } from 'msw';
import { PERMISSIONS } from '@/core/auth/permissions';
import {
  INSULIN_KINDS,
  insulinDoseCreateSchema,
  type InsulinDoseDto,
  type InsulinKind,
} from '@/services/dto/injection';
import { apiUrl } from '@/services/http/apiUrl';
import { HTTP_STATUS } from '@/services/http/httpStatus';
import { apiError, paginate, readBody, validationError } from '../http';
import { planSitesFor, suggestInjectionSite, type InjectionHistoryEntry } from '../injectionRules';
import type { MockState } from '../MockState';
import { guard } from './guard';

/** Permissions of the patient's own insulin records (API.md, `records.*_own`). */
export const INJECTION_PERMISSIONS = {
  recordsWriteOwn: PERMISSIONS.recordsWriteOwn,
  recordsReadOwn: PERMISSIONS.recordsReadOwn,
} as const;

const FALLBACK_PAGE_DEFAULT = 20;
const FALLBACK_PAGE_MAX = 100;

const kindOf = (url: URL): InsulinKind | undefined => {
  const raw = url.searchParams.get('kind');
  return INSULIN_KINDS.find((kind) => kind === raw);
};

/** Doses that carry a site and spot: the only ones the rotation can read. */
const historyOf = (doses: readonly InsulinDoseDto[]): InjectionHistoryEntry[] =>
  doses.flatMap((dose) =>
    dose.injection_site === null || dose.injection_spot === null
      ? []
      : [
          {
            site: dose.injection_site,
            spot: dose.injection_spot,
            kind: dose.kind,
            administeredAt: dose.administered_at,
          },
        ],
  );

/**
 * Injection sites and insulin doses (BRIEF-injection). The suggestion is computed on every request
 * from the profile, the plan and the recorded doses, so a dose posted now changes the next answer.
 */
export function injectionHandlers(state: MockState) {
  const page = <T>(items: readonly T[], url: URL) =>
    paginate(
      items,
      url,
      state.limits['page_size_default'] ?? FALLBACK_PAGE_DEFAULT,
      state.limits['page_size_max'] ?? FALLBACK_PAGE_MAX,
    );
  /** Oldest first is how the state keeps them; the lists answer newest first. */
  const newestFirst = (doses: readonly InsulinDoseDto[]) => [...doses].reverse();

  return [
    http.get(apiUrl('/patients/own/injection-sites'), ({ request }) => {
      const result = guard(state, request, INJECTION_PERMISSIONS.recordsReadOwn);
      if ('response' in result) return result.response;
      const kind = kindOf(new URL(request.url));
      if (!kind) return validationError([{ field: 'query.kind', type: 'enum' }]);
      const patient = result.account.id;
      const profile = state.world.injectionProfile(patient);
      if (!profile) return apiError('NOT_FOUND');
      const schedule = state.world.plans.get(patient)?.schedule ?? [];
      return HttpResponse.json(
        suggestInjectionSite({
          kind,
          now: new Date(),
          profile,
          plan: planSitesFor(schedule, kind),
          history: historyOf(state.world.insulinDoses.get(patient) ?? []),
        }),
      );
    }),

    http.post(apiUrl('/insulin-doses'), async ({ request }) => {
      const result = guard(state, request, INJECTION_PERMISSIONS.recordsWriteOwn);
      if ('response' in result) return result.response;
      const parsed = insulinDoseCreateSchema.safeParse((await readBody(request)) ?? {});
      if (!parsed.success) {
        return validationError(
          parsed.error.issues.map((issue) => ({
            field: `body.${issue.path.join('.')}`,
            type: issue.code,
          })),
        );
      }
      const input = parsed.data;
      const patient = result.account.id;
      const dose: InsulinDoseDto = {
        id: state.world.nextId('i1'),
        insulin_product_id: input.insulin_product_id ?? null,
        kind: input.kind,
        units: input.units,
        administered_at: new Date(input.administered_at).toISOString(),
        treatment_plan_id: state.world.plans.get(patient)?.id ?? null,
        injection_site: input.injection_site ?? null,
        injection_spot: input.injection_spot ?? null,
        simulated: false,
      };
      const doses = [...(state.world.insulinDoses.get(patient) ?? []), dose].sort(
        (a, b) => Date.parse(a.administered_at) - Date.parse(b.administered_at),
      );
      state.world.insulinDoses.set(patient, doses);
      return HttpResponse.json(dose, {
        status: HTTP_STATUS.CREATED,
        headers: { Location: apiUrl(`insulin-doses/${dose.id}`) },
      });
    }),

    http.get(apiUrl('/insulin-doses'), ({ request }) => {
      const result = guard(state, request, INJECTION_PERMISSIONS.recordsReadOwn);
      if ('response' in result) return result.response;
      const doses = state.world.insulinDoses.get(result.account.id) ?? [];
      return HttpResponse.json(page(newestFirst(doses), new URL(request.url)));
    }),

    // Doctor view: the same history, with the sites used (API.md 8.6 style, assigned patients only).
    http.get(apiUrl('/patients/:patient_id/insulin-doses'), ({ request, params }) => {
      const result = guard(state, request, PERMISSIONS.patientRead);
      if ('response' in result) return result.response;
      const patient = String(params['patient_id']);
      if (!state.world.isAssigned(patient)) return apiError('NOT_FOUND');
      const doses = state.world.insulinDoses.get(patient) ?? [];
      return HttpResponse.json(page(newestFirst(doses), new URL(request.url)));
    }),
  ];
}
