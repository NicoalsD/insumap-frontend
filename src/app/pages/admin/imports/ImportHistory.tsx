import { useId } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge, Button, DataTable, EmptyState, ErrorState, LoadingState, type DataTableColumn } from '@/ui';
import { batchStatusLabel, batchStatusTone } from './importMessages';
import { formatBatchDate } from './importModel';
import { useClinicTimeZone, useImportBatches, type BatchListItem } from './useImportQueries';

const t = es.adminImports;

export interface ImportHistoryProps {
  /** Loads a batch back into the preview step. */
  readonly onOpen: (batchId: string) => void;
}

/**
 * Batches of the clinic, newest first, with the date, source, counts and status of each one.
 * The table is the admin's audit trail of what was analyzed and what was created.
 */
export function ImportHistory({ onOpen }: ImportHistoryProps) {
  const titleId = useId();
  const batches = useImportBatches();
  const timeZone = useClinicTimeZone();

  const columns: readonly DataTableColumn<BatchListItem>[] = [
    {
      id: 'date',
      header: t.history.columnDate,
      cell: ({ createdAt }) => formatBatchDate(createdAt, timeZone) ?? t.history.unknownDate,
    },
    {
      id: 'source',
      header: t.history.columnSource,
      cell: ({ batch }) => t.sourceLabel[batch.source],
    },
    {
      id: 'counts',
      header: t.history.columnCounts,
      cell: ({ batch }) =>
        format(t.history.counts, {
          valid: batch.totals.valid,
          warning: batch.totals.warning,
          error: batch.totals.error,
          duplicate: batch.totals.skippedDuplicate,
        }),
    },
    {
      id: 'status',
      header: t.history.columnStatus,
      cell: ({ batch }) => <Badge tone={batchStatusTone(batch.status)}>{batchStatusLabel(batch.status)}</Badge>,
    },
    {
      id: 'action',
      header: t.history.columnAction,
      cell: ({ batch }) => (
        <Button
          variant="ghost"
          size="sm"
          onClick={() => {
            onOpen(batch.id);
          }}
        >
          {t.history.open}
        </Button>
      ),
    },
  ];

  const items = batches.data?.pages.flatMap((page) => page.items) ?? [];

  return (
    <section className="panel import-history" aria-labelledby={titleId}>
      <header className="panel__header">
        <h2 id={titleId}>{t.history.title}</h2>
      </header>
      <div className="import-history__body">
        {batches.isPending ? (
          <LoadingState label={t.history.loading} />
        ) : batches.isError ? (
          <ErrorState error={batches.error} title={t.history.loadError} onRetry={() => void batches.refetch()} />
        ) : items.length === 0 ? (
          <EmptyState title={t.history.empty} body={t.history.emptyBody} />
        ) : (
          <>
            <DataTable
              caption={t.history.caption}
              columns={columns}
              rows={items}
              rowKey={({ batch }) => batch.id}
            />
            {batches.hasNextPage ? (
              <div className="import-history__more">
                <Button
                  variant="secondary"
                  loading={batches.isFetchingNextPage}
                  onClick={() => {
                    void batches.fetchNextPage();
                  }}
                >
                  {t.history.loadMore}
                </Button>
              </div>
            ) : null}
          </>
        )}
      </div>
    </section>
  );
}
