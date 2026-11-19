import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { useApi } from '@/state/useApi';
import type { GlucoseReadingDto, OwnOverviewDto, MetricsResponseDto } from '@/services/dto/clinical';
import type { MessageCreateDto, ReminderUpdateDto } from '@/services/dto/care';
import type { MetricsWindow } from '@/services/dto/common';

/** Safety bound on cursor loops: the API pages at most `page_size_max` rows. */
const MAX_PAGES = 100;

export const patientKeys = {
  all: ['patient'] as const,
  overview: (window: MetricsWindow) => ['patient', 'overview', window] as const,
  metrics: (window: MetricsWindow) => ['patient', 'metrics', window] as const,
  readings: (filter: ReadingFilter) => ['patient', 'readings', filter.from ?? '', filter.to ?? ''] as const,
  plan: ['patient', 'plan'] as const,
  reminders: ['patient', 'reminders'] as const,
  messages: ['patient', 'messages'] as const,
};

export interface ReadingFilter {
  readonly from?: string | undefined;
  readonly to?: string | undefined;
}

/** Overview of the signed-in patient: profile, latest readings and own alerts. Never carries AI output. */
export function useOwnOverview(window: MetricsWindow = '14d') {
  const { api } = useApi();
  return useQuery({
    queryKey: patientKeys.overview(window),
    queryFn: (): Promise<OwnOverviewDto> => api.getOwnOverview(window),
    placeholderData: keepPreviousData,
  });
}

/** Metrics of the own patient for a window (the week bar uses 7 days). */
export function useOwnMetrics(window: MetricsWindow) {
  const { api } = useApi();
  return useQuery({
    queryKey: patientKeys.metrics(window),
    queryFn: (): Promise<MetricsResponseDto> => api.getOwnMetrics(window),
  });
}

/** Reads every page of the own readings for a date range (the API filters by `from` and `to`). */
export function useOwnReadings(filter: ReadingFilter = {}) {
  const { api } = useApi();
  return useInfiniteQuery({
    queryKey: patientKeys.readings(filter),
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.listOwnReadings({ from: filter.from, to: filter.to, cursor: pageParam }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

/** Flattens the loaded pages, newest first as the API sends them. */
export async function readAllOwnReadings(
  fetchPage: (cursor: string | undefined) => Promise<{ items: readonly GlucoseReadingDto[]; next_cursor: string | null }>,
): Promise<GlucoseReadingDto[]> {
  const items: GlucoseReadingDto[] = [];
  let cursor: string | undefined;
  for (let page = 0; page < MAX_PAGES; page += 1) {
    const response = await fetchPage(cursor);
    items.push(...response.items);
    if (response.next_cursor === null) break;
    cursor = response.next_cursor;
  }
  return items;
}

/** Every own reading (all pages), used by the day chart. */
export function useAllOwnReadings() {
  const { api } = useApi();
  return useQuery({
    queryKey: [...patientKeys.all, 'readings-all'],
    queryFn: () => readAllOwnReadings((cursor) => api.listOwnReadings({ cursor })),
  });
}

/** Active plan in plain language. */
export function useOwnPlan() {
  const { api } = useApi();
  return useQuery({ queryKey: patientKeys.plan, queryFn: () => api.getOwnTreatmentPlan() });
}

export function useOwnReminders() {
  const { api } = useApi();
  return useQuery({
    queryKey: patientKeys.reminders,
    queryFn: async () => {
      const page = await api.listOwnReminders();
      return page.items;
    },
  });
}

export function useUpdateReminder() {
  const { api } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: ({ reminderId, body }: { reminderId: string; body: ReminderUpdateDto }) =>
      api.updateOwnReminder(reminderId, body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientKeys.reminders }),
  });
}

/** Thread with the care team, newest first as the API sends it. */
export function useMessageThread() {
  const { api } = useApi();
  return useInfiniteQuery({
    queryKey: patientKeys.messages,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) => api.listMessages({ cursor: pageParam }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

export function useSendMessage() {
  const { api } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: (body: MessageCreateDto) => api.sendMessage(body),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: patientKeys.messages }),
  });
}

/** Refreshes what a new reading changes: overview, metrics and the reading lists. */
export function useInvalidateReadings() {
  const queryClient = useQueryClient();
  return () =>
    queryClient.invalidateQueries({ predicate: (query) => query.queryKey[0] === 'patient' });
}
