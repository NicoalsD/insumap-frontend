import { useInfiniteQuery, useQuery, type QueryClient } from '@tanstack/react-query';
import type { CareAssignmentDto, PatientAdminDto } from '@/services/dto/admin';
import { useApi } from '@/state/useApi';
import { useFieldLimits } from '@/state/useFieldLimits';
import type { PatientFilters } from './patientFilters';
import { serverFilterFor } from './patientFilters';

/** Cache keys. Every admin query starts with `admin`, so one prefix invalidates the whole console. */
export const adminKeys = {
  clinic: ['admin', 'clinic'] as const,
  patientPages: (serverFilters: string) => ['admin', 'patients', 'pages', serverFilters] as const,
  patientWalk: ['admin', 'patients', 'walk'] as const,
  assignmentWalk: ['admin', 'care-team', 'walk'] as const,
  staffWalk: ['admin', 'staff', 'walk'] as const,
};

export const PATIENT_QUERY_PREFIX = ['admin', 'patients'] as const;
export const CARE_TEAM_QUERY_PREFIX = ['admin', 'care-team'] as const;
export const STAFF_QUERY_PREFIX = ['admin', 'staff'] as const;

/** Invalidates patient and care-team data after a credential, status or assignment change. */
export function invalidateAdminData(queryClient: QueryClient): Promise<void> {
  return Promise.all([
    queryClient.invalidateQueries({ queryKey: PATIENT_QUERY_PREFIX }),
    queryClient.invalidateQueries({ queryKey: CARE_TEAM_QUERY_PREFIX }),
    queryClient.invalidateQueries({ queryKey: STAFF_QUERY_PREFIX }),
  ]).then(() => undefined);
}

/** One cursor page as the API returns it (API.md 3). */
interface CursorPage<T> {
  readonly items: readonly T[];
  readonly next_cursor: string | null;
}

/** Follows `next_cursor` until the last page, so totals and client-side filters see every row. */
export async function walkCursor<T>(
  fetchPage: (cursor: string | undefined) => Promise<CursorPage<T>>,
): Promise<T[]> {
  const items: T[] = [];
  let cursor: string | undefined;
  do {
    const page = await fetchPage(cursor);
    items.push(...page.items);
    cursor = page.next_cursor ?? undefined;
  } while (cursor !== undefined);
  return items;
}

/** Clinic of the session (name and timezone). */
export function useClinic() {
  const { api } = useApi();
  return useQuery({ queryKey: adminKeys.clinic, queryFn: () => api.getCurrentClinic() });
}

/**
 * Cursor pages of the patient roster, with the server filters the API supports. Page size comes
 * from the field limits, never a literal.
 */
export function usePatientPages(filters: PatientFilters) {
  const { api } = useApi();
  const limits = useFieldLimits();
  const pageSize = limits.data?.['page_size_default'];
  const server = serverFilterFor(filters);
  const serverKey = JSON.stringify(server);
  return useInfiniteQuery({
    queryKey: adminKeys.patientPages(serverKey),
    enabled: pageSize !== undefined,
    initialPageParam: undefined as string | undefined,
    queryFn: ({ pageParam }) =>
      api.listPatients({
        limit: pageSize,
        cursor: pageParam,
        account_status: server.accountStatus,
        without_doctor: server.withoutDoctor ? true : undefined,
      }),
    getNextPageParam: (last) => last.next_cursor ?? undefined,
  });
}

/** Every patient of the clinic, walked page by page. Feeds the counters and the credential queue. */
export function usePatientWalk() {
  const { api } = useApi();
  const limits = useFieldLimits();
  const maxSize = limits.data?.['page_size_max'];
  return useQuery<PatientAdminDto[]>({
    queryKey: adminKeys.patientWalk,
    enabled: maxSize !== undefined,
    queryFn: () =>
      walkCursor((cursor) => api.listPatients({ limit: maxSize, cursor })),
  });
}

/** Every active care-team assignment of the clinic. */
export function useAssignmentWalk() {
  const { api } = useApi();
  const limits = useFieldLimits();
  const maxSize = limits.data?.['page_size_max'];
  return useQuery<CareAssignmentDto[]>({
    queryKey: adminKeys.assignmentWalk,
    enabled: maxSize !== undefined,
    queryFn: () =>
      walkCursor((cursor) => api.listCareAssignments({ status: 'ACTIVE', limit: maxSize, cursor })),
  });
}

/** Every clinic staff member (doctors and clinic admins) from `GET /users`. */
export function useStaffWalk() {
  const { api } = useApi();
  const limits = useFieldLimits();
  const maxSize = limits.data?.['page_size_max'];
  return useQuery({
    queryKey: adminKeys.staffWalk,
    enabled: maxSize !== undefined,
    queryFn: () => walkCursor((cursor) => api.listUsers({ limit: maxSize, cursor })),
  });
}
