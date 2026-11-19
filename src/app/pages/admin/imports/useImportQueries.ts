import { keepPreviousData, useInfiniteQuery, useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { adaptAll, type ViewModelAdapter } from '@/services/adapters/ViewModelAdapter';
import {
  ImportBatchViewModelAdapter,
  ImportRowViewModelAdapter,
  type ImportBatchViewModel,
  type ImportRowViewModel,
} from '@/services/adapters/ImportViewModelAdapters';
import type { ImportBatchDto, ImportRowDto } from '@/services/dto/admin';
import type { InsumapApi } from '@/services/api/InsumapApi';
import { useApi } from '@/state/useApi';
import type { ImportSource } from './importFile';

type RowStatusFilter = ImportRowDto['status'] | undefined;

/** Query keys of the import screen. One root so a confirmation can refresh every batch view at once. */
export const importKeys = {
  all: ['imports'] as const,
  batches: () => [...importKeys.all, 'batches'] as const,
  batch: (batchId: string) => [...importKeys.all, 'batch', batchId] as const,
  rows: (batchId: string, status: RowStatusFilter, cursor: string | null) =>
    [...importKeys.all, 'rows', batchId, status ?? 'ALL', cursor ?? 'FIRST'] as const,
};

const batchAdapter: ViewModelAdapter<ImportBatchDto, ImportBatchViewModel> = new ImportBatchViewModelAdapter();
const rowAdapter: ViewModelAdapter<ImportRowDto, ImportRowViewModel> = new ImportRowViewModelAdapter();

/** A batch in the history list. The adapter view model has no date, so the DTO's `created_at` travels next to it. */
export interface BatchListItem {
  readonly batch: ImportBatchViewModel;
  readonly createdAt: string | undefined;
}

export interface RowsPage {
  readonly items: readonly ImportRowViewModel[];
  readonly nextCursor: string | null;
}

/** Batches of the clinic, newest first, paged by cursor (API.md 3). */
export function useImportBatches() {
  const { api } = useApi();
  return useInfiniteQuery({
    queryKey: importKeys.batches(),
    queryFn: async ({ pageParam }) => {
      const page = await api.listImportBatches({ cursor: pageParam });
      const items: readonly BatchListItem[] = page.items.map((dto) => ({
        batch: batchAdapter.adapt(dto),
        createdAt: dto.created_at,
      }));
      return { items, nextCursor: page.next_cursor };
    },
    initialPageParam: null as string | null,
    getNextPageParam: (last) => last.nextCursor,
  });
}

export function useImportBatch(batchId: string | null) {
  const { api } = useApi();
  return useQuery({
    queryKey: batchId === null ? importKeys.all : importKeys.batch(batchId),
    queryFn: async () => {
      if (batchId === null) throw new Error('batchId is required');
      return batchAdapter.adapt(await api.getImportBatch(batchId));
    },
    enabled: batchId !== null,
  });
}

/** Rows of one page of a batch, optionally only the rows with errors. The row content is never returned. */
export function useImportRows(batchId: string, status: RowStatusFilter, cursor: string | null) {
  const { api } = useApi();
  return useQuery({
    queryKey: importKeys.rows(batchId, status, cursor),
    queryFn: async (): Promise<RowsPage> => {
      const page = await api.listImportRows(batchId, { status, cursor });
      return { items: adaptAll(rowAdapter, page.items), nextCursor: page.next_cursor };
    },
    placeholderData: keepPreviousData,
  });
}

/** Reads every row of one status, page after page. Used by the error report and the patient count. */
export async function fetchAllRows(
  api: InsumapApi,
  batchId: string,
  status: ImportRowDto['status'],
): Promise<readonly ImportRowViewModel[]> {
  const rows: ImportRowDto[] = [];
  let cursor: string | null = null;
  do {
    const page = await api.listImportRows(batchId, { status, cursor });
    rows.push(...page.items);
    cursor = page.next_cursor;
  } while (cursor !== null);
  return adaptAll(rowAdapter, rows);
}

/**
 * Warning rows of a batch. A FHIR warning can be a resource that is not a patient, so the confirm
 * step needs the rows to count the patients it will create. Read only when `enabled`.
 */
export function useWarningRows(batchId: string, enabled: boolean) {
  const { api } = useApi();
  return useQuery({
    queryKey: [...importKeys.batch(batchId), 'warning-rows'] as const,
    queryFn: () => fetchAllRows(api, batchId, 'WARNING'),
    enabled,
  });
}

/** Analyzes a file: the API validates every row and returns the batch as a preview. */
export function useCreateImportPreview() {
  const { api } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ source, content }: { readonly source: ImportSource; readonly content: string }) =>
      batchAdapter.adapt(await api.createImportPreview(source, content)),
    onSuccess: async (batch) => {
      queryClient.setQueryData(importKeys.batch(batch.id), batch);
      await queryClient.invalidateQueries({ queryKey: importKeys.batches() });
    },
  });
}

/** Creates the patients of a preview. Valid and warning rows become patients; the server decides the rest. */
export function useConfirmImport(batchId: string) {
  const { api } = useApi();
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async () => batchAdapter.adapt(await api.confirmImport(batchId)),
    onSuccess: async (batch) => {
      queryClient.setQueryData(importKeys.batch(batch.id), batch);
      await queryClient.invalidateQueries({ queryKey: importKeys.batches() });
    },
  });
}

/** The clinic's time zone, to show batch dates the way the clinic reads them. */
export function useClinicTimeZone(): string | undefined {
  const { api } = useApi();
  const { data } = useQuery({
    queryKey: ['clinics', 'current'],
    queryFn: () => api.getCurrentClinic(),
    select: (clinic) => clinic.timezone,
  });
  return data;
}
