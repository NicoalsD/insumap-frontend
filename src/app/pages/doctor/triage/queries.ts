import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/state/useApi';
import type { AlertViewModel } from '@/services/adapters/AlertViewModelAdapter';
import { AlertViewModelAdapter } from '@/services/adapters/AlertViewModelAdapter';
import { TargetProfileViewModelAdapter } from '@/services/adapters/TargetProfileViewModelAdapter';
import { TriageViewModelAdapter } from '@/services/adapters/TriageViewModelAdapter';
import type { AlertDto } from '@/services/dto/clinical';
import type { MetricsWindow } from '@/services/dto/common';
import type { TriageItem } from './triageModel';

/** Safety bound on cursor loops: the API pages at most `page_size_max` rows, so this never binds in practice. */
const MAX_PAGES = 100;
/** Alert statuses that still need the doctor (RESOLVED is history). The API filters one status at a time. */
export const OPEN_ALERT_STATUSES = ['OPEN', 'ESCALATED', 'ACKNOWLEDGED'] as const;

export const triageKey = ['dashboard', 'triage'] as const;
export const alertsKey = ['alerts'] as const;

interface Page<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
}

/** Reads every page of a cursor-paginated list (API.md section 3). */
export async function fetchAllPages<T>(fetchPage: (cursor: string | undefined) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchPage(cursor);
    items.push(...response.items);
    if (response.next_cursor === null) return items;
    cursor = response.next_cursor;
  }
  return items;
}

const triageAdapter = new TriageViewModelAdapter();
const profileAdapter = new TargetProfileViewModelAdapter();
const alertAdapter = new AlertViewModelAdapter();

/**
 * Every assigned patient for a window, ranked by the API. Filtering happens on the client over this
 * full list. Changing the window keeps the previous rows on screen until the new ones arrive.
 */
export function useTriageRows(window: MetricsWindow) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...triageKey, window],
    placeholderData: keepPreviousData,
    queryFn: async (): Promise<TriageItem[]> => {
      const [dtos, profile, proposed] = await Promise.all([
        fetchAllPages((cursor) => api.getTriage({ window, cursor })),
        api.getDefaultTargetProfile(),
        fetchAllPages((cursor) => api.listRecommendations({ status: 'PROPOSED', cursor })),
      ]);
      const { thresholds } = profileAdapter.adapt(profile);
      const pending = new Map<string, number>();
      for (const recommendation of proposed) {
        pending.set(recommendation.patient_id, (pending.get(recommendation.patient_id) ?? 0) + 1);
      }
      // The triage list carries no time zone; the doctor's device zone formats the times.
      const timezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
      return dtos.map((dto) => ({
        ...triageAdapter.adapt(dto, { thresholds, pendingRecommendationsCount: pending.get(dto.patient_id) ?? 0 }),
        timezone,
      }));
    },
  });
}

/** Alerts that still need action, across the open statuses. */
export function useOpenAlerts() {
  const { api } = useApi();
  return useQuery({
    queryKey: [...alertsKey, 'open'],
    queryFn: async (): Promise<AlertViewModel[]> => {
      const groups = await Promise.all(
        OPEN_ALERT_STATUSES.map((status) => fetchAllPages((cursor) => api.listAlerts({ status, cursor }))),
      );
      return groups.flat().map((dto: AlertDto) => alertAdapter.adapt(dto));
    },
  });
}

export interface AlertListFilters {
  readonly status?: AlertDto['status'] | undefined;
  readonly type?: AlertDto['type'] | undefined;
}

/** Full alert list for `/doctor/alerts`; priority is filtered on the client (no API parameter). */
export function useAlertList(filters: AlertListFilters) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...alertsKey, 'list', filters.status ?? 'ALL', filters.type ?? 'ALL'],
    queryFn: async (): Promise<AlertViewModel[]> => {
      const dtos = await fetchAllPages((cursor) =>
        api.listAlerts({ status: filters.status, type: filters.type, cursor }),
      );
      return dtos.map((dto) => alertAdapter.adapt(dto));
    },
  });
}

/** The doctor marks a patient as reviewed; the queue refreshes so the row says so. */
export function useMarkReviewed(window: MetricsWindow) {
  const { api } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (patientId: string) => api.markPatientReviewed(patientId, window),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: triageKey }),
  });
}

/** Acknowledge and resolve. Both refresh the queue and every alert list, so counts stay true. */
export function useAlertActions() {
  const { api } = useApi();
  const queryClient = useQueryClient();
  const refresh = async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: triageKey }),
      queryClient.invalidateQueries({ queryKey: alertsKey }),
    ]);
  };
  const acknowledge = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeAlert(alertId),
    onSuccess: refresh,
  });
  const resolve = useMutation({
    mutationFn: ({ alertId, note }: { alertId: string; note: string }) => api.resolveAlert(alertId, note),
    onSuccess: refresh,
  });
  return { acknowledge, resolve };
}
