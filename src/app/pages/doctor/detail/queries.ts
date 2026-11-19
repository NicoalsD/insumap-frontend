import { keepPreviousData, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/state/useApi';
import type { MetricsWindow } from '@/services/dto/common';
import { MAX_PAGES, READINGS_LIMIT } from './constants';

/** Keys of every query of one patient. Mutations invalidate this prefix, so the screen stays true. */
export const patientKey = (patientId: string) => ['detail', patientId] as const;
const triageKey = ['dashboard', 'triage'] as const;
const alertsKey = ['alerts'] as const;

interface Page<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
}

/** Reads every page of a cursor-paginated list (API.md section 3), bounded by `MAX_PAGES`. */
async function fetchAllPages<T>(fetchPage: (cursor: string | undefined) => Promise<Page<T>>): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchPage(cursor);
    items.push(...response.items);
    if (response.next_cursor === null) break;
    cursor = response.next_cursor;
  }
  return items;
}

/** Overview: profile, metrics, active plan, open alerts and pending AI suggestions of the patient. */
export function usePatientOverview(patientId: string, window: MetricsWindow) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'overview', window],
    queryFn: () => api.getPatientOverview(patientId, window),
    placeholderData: keepPreviousData,
  });
}

/** Window metrics with the previous window, for the deltas. */
export function usePatientMetrics(patientId: string, window: MetricsWindow) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'metrics', window],
    queryFn: () => api.getPatientMetrics(patientId, window),
    placeholderData: keepPreviousData,
  });
}

/** The 24-hour profile (AGP) as the API computes it. */
export function usePatientAgp(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'agp'],
    queryFn: () => api.getPatientAgp(patientId),
  });
}

/** Readings of the sensor and the fingersticks, up to one page. The window is applied on the client. */
export function usePatientReadings(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'readings'],
    queryFn: async () => {
      const page = await api.listPatientReadings(patientId, { limit: READINGS_LIMIT });
      return [...page.items];
    },
    placeholderData: keepPreviousData,
  });
}

/** Risk tier of the patient, read from the triage list (the overview does not carry it). */
export function usePatientRiskTier(patientId: string, window: MetricsWindow) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'risk', window],
    queryFn: async () => {
      const rows = await fetchAllPages((cursor) => api.getTriage({ window, cursor }));
      return rows.find((row) => row.patient_id === patientId)?.risk_tier ?? null;
    },
    placeholderData: keepPreviousData,
  });
}

export function usePatientRecommendations(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'recommendations'],
    queryFn: async () => {
      const items = await fetchAllPages((cursor) => api.listRecommendations({ patient_id: patientId, cursor }));
      return [...items];
    },
  });
}

export function usePatientAlerts(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'alerts'],
    queryFn: async () => {
      const items = await fetchAllPages((cursor) => api.listAlerts({ patient_id: patientId, cursor }));
      return [...items];
    },
  });
}

export function usePatientNotes(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'notes'],
    queryFn: async () => {
      const items = await fetchAllPages((cursor) => api.listClinicalNotes(patientId, { cursor }));
      return [...items];
    },
  });
}

/** Insulin doses the patient recorded, every page: the injection panel reads the last two weeks of them. */
export function usePatientInsulinDoses(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'insulin-doses'],
    queryFn: () => fetchAllPages((cursor) => api.listPatientInsulinDoses(patientId, { cursor })),
    placeholderData: keepPreviousData,
  });
}

export function usePatientMessages(patientId: string) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKey(patientId), 'messages'],
    queryFn: () => api.listMessages({ patient_id: patientId }),
  });
}

/** Invalidates the patient's queries, the triage queue and the alert lists after any write. */
function useRefresh(patientId: string) {
  const queryClient = useQueryClient();
  return () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: patientKey(patientId) }),
      queryClient.invalidateQueries({ queryKey: triageKey }),
      queryClient.invalidateQueries({ queryKey: alertsKey }),
    ]);
}

/** Approve, modify or reject an AI suggestion. The doctor always decides; the API enforces the reason. */
export function useRecommendationDecisions(patientId: string) {
  const { api } = useApi();
  const refresh = useRefresh(patientId);
  const approve = useMutation({
    mutationFn: (id: string) => api.approveRecommendation(id),
    onSuccess: refresh,
  });
  const modify = useMutation({
    mutationFn: (input: { id: string; proposal: Record<string, unknown>; reason: string }) =>
      api.modifyRecommendation(input.id, input.proposal, input.reason),
    onSuccess: refresh,
  });
  const reject = useMutation({
    mutationFn: (input: { id: string; reason: string }) => api.rejectRecommendation(input.id, input.reason),
    onSuccess: refresh,
  });
  return { approve, modify, reject };
}

/** Acknowledge an open alert, or resolve an acknowledged one with a note. */
export function useAlertActions(patientId: string) {
  const { api } = useApi();
  const refresh = useRefresh(patientId);
  const acknowledge = useMutation({
    mutationFn: (alertId: string) => api.acknowledgeAlert(alertId),
    onSuccess: refresh,
  });
  const resolve = useMutation({
    mutationFn: (input: { alertId: string; note: string }) => api.resolveAlert(input.alertId, input.note),
    onSuccess: refresh,
  });
  return { acknowledge, resolve };
}

export function useClinicalNoteWrite(patientId: string) {
  const { api } = useApi();
  const refresh = useRefresh(patientId);
  return useMutation({
    mutationFn: (body: string) => api.createClinicalNote(patientId, body),
    onSuccess: refresh,
  });
}

export function useMessageWrite(patientId: string) {
  const { api } = useApi();
  const refresh = useRefresh(patientId);
  return useMutation({
    mutationFn: (body: string) => api.sendMessage({ body, patient_id: patientId }),
    onSuccess: refresh,
  });
}
