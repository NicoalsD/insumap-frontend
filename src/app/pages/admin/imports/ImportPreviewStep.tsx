import { CircleAlert, CircleCheck, CircleX, Copy, Download, TriangleAlert, type LucideIcon } from 'lucide-react';
import { useId, useState } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { ImportBatchViewModel, ImportRowViewModel } from '@/services/adapters/ImportViewModelAdapters';
import { useApi } from '@/state/useApi';
import { useFieldLimits } from '@/state/useFieldLimits';
import { Badge, Button, DataTable, EmptyState, ErrorState, LoadingState, type BadgeTone, type DataTableColumn } from '@/ui';
import { downloadTextFile } from './importFile';
import { buildErrorReportCsv } from './importModel';
import { issueMessage } from './importMessages';
import { fetchAllRows, useImportRows } from './useImportQueries';

const t = es.adminImports;

type RowStatus = ImportRowViewModel['status'];

const ROW_STATUS_ICON: Readonly<Record<RowStatus, LucideIcon>> = {
  VALID: CircleCheck,
  WARNING: TriangleAlert,
  ERROR: CircleX,
  SKIPPED_DUPLICATE: Copy,
};

const ROW_STATUS_TONE: Readonly<Record<RowStatus, BadgeTone>> = {
  VALID: 'success',
  WARNING: 'warning',
  ERROR: 'critical',
  SKIPPED_DUPLICATE: 'neutral',
};

const NO_LIMITS: Readonly<Record<string, number>> = {};

export interface ImportPreviewStepProps {
  readonly batch: ImportBatchViewModel;
  /** Moves to the confirmation step; it explains any blocking error there. */
  readonly onContinue: () => void;
}

/**
 * Step 2: what the file would do, row by row. The summary counts come from the batch; the table
 * reads the rows page by page, and "solo con errores" asks the API for the error rows only.
 */
export function ImportPreviewStep({ batch, onContinue }: ImportPreviewStepProps) {
  const { api } = useApi();
  const filterId = useId();
  const limits = useFieldLimits().data ?? NO_LIMITS;
  const pageSizeMax = limits['page_size_max'];

  const [onlyErrors, setOnlyErrors] = useState(false);
  // Cursor history: the first entry is the first page (null), the last one is the page on screen.
  const [cursors, setCursors] = useState<readonly (string | null)[]>([null]);
  const [reportState, setReportState] = useState<'idle' | 'working' | 'failed'>('idle');

  const cursor = cursors.at(-1) ?? null;
  const status = onlyErrors ? 'ERROR' : undefined;
  const rows = useImportRows(batch.id, status, cursor);
  const isLarge = pageSizeMax !== undefined && batch.totals.all > pageSizeMax;

  const changeFilter = (next: boolean) => {
    setOnlyErrors(next);
    setCursors([null]);
  };

  const nextPage = () => {
    const next = rows.data?.nextCursor ?? null;
    if (next !== null) setCursors((current) => [...current, next]);
  };

  const previousPage = () => {
    setCursors((current) => (current.length > 1 ? current.slice(0, -1) : current));
  };

  const downloadReport = async () => {
    setReportState('working');
    try {
      const errorRows = await fetchAllRows(api, batch.id, 'ERROR');
      const csv = buildErrorReportCsv(errorRows, {
        columns: t.report.columns,
        rowStatus: (value) => t.rowStatus[value],
        issue: issueMessage,
      });
      downloadTextFile(t.preview.reportFileName, csv);
      setReportState('idle');
    } catch {
      setReportState('failed');
    }
  };

  const columns: readonly DataTableColumn<ImportRowViewModel>[] = [
    {
      id: 'row',
      header: t.preview.columnRow,
      cell: (row) => row.rowNumber,
      measure: true,
    },
    {
      id: 'status',
      header: t.preview.columnStatus,
      cell: (row) => {
        const Icon = ROW_STATUS_ICON[row.status];
        return (
          <Badge tone={ROW_STATUS_TONE[row.status]} icon={<Icon size="1em" aria-hidden="true" />}>
            {t.rowStatus[row.status]}
          </Badge>
        );
      },
    },
    {
      id: 'issue',
      header: t.preview.columnIssue,
      cell: (row) =>
        row.issueCodes.length === 0 ? (
          t.preview.noIssues
        ) : (
          <ul className="import-issues">
            {row.issueCodes.map((code) => (
              <li key={code}>{issueMessage(code)}</li>
            ))}
          </ul>
        ),
    },
  ];

  const summary: readonly { readonly key: string; readonly label: string; readonly value: number; readonly tone: BadgeTone }[] = [
    { key: 'total', label: t.preview.total, value: batch.totals.all, tone: 'neutral' },
    { key: 'valid', label: t.preview.valid, value: batch.totals.valid, tone: 'success' },
    { key: 'warning', label: t.preview.warning, value: batch.totals.warning, tone: 'warning' },
    { key: 'error', label: t.preview.error, value: batch.totals.error, tone: 'critical' },
    { key: 'duplicate', label: t.preview.duplicate, value: batch.totals.skippedDuplicate, tone: 'neutral' },
  ];

  const emptyTitle = onlyErrors ? t.preview.noErrorRows : t.preview.noRows;

  return (
    <div className="import-preview">
      <div role="group" aria-label={t.preview.summaryLabel}>
        <dl className="import-summary">
          {summary.map((item) => (
            <div key={item.key} className="import-summary__item" data-tone={item.tone}>
              <dt>{item.label}</dt>
              <dd className="measure">{item.value}</dd>
            </div>
          ))}
        </dl>
      </div>

      {isLarge ? (
        <p role="status" className="import-notice">
          <TriangleAlert size="1.125rem" aria-hidden="true" />
          <span>{format(t.preview.largeBatch, { count: batch.totals.all })}</span>
        </p>
      ) : null}

      <div className="import-toolbar">
        <label className="import-toolbar__filter" htmlFor={filterId}>
          <input
            id={filterId}
            type="checkbox"
            checked={onlyErrors}
            onChange={(event) => {
              changeFilter(event.target.checked);
            }}
          />
          {t.preview.onlyErrors}
        </label>
        <div className="import-toolbar__report">
          <Button
            variant="secondary"
            loading={reportState === 'working'}
            disabled={batch.totals.error === 0}
            icon={<Download size="1em" aria-hidden="true" />}
            onClick={() => {
              void downloadReport();
            }}
          >
            {t.preview.downloadReport}
          </Button>
          <p className="import-toolbar__hint">{t.preview.reportHint}</p>
        </div>
      </div>
      {reportState === 'failed' ? (
        <p role="alert" className="import-alert">
          <CircleAlert size="1.125rem" aria-hidden="true" />
          <span>{t.preview.reportError}</span>
        </p>
      ) : null}

      {rows.isPending ? (
        <LoadingState label={t.preview.loadingRows} />
      ) : rows.isError ? (
        <ErrorState error={rows.error} title={t.preview.rowsError} onRetry={() => void rows.refetch()} />
      ) : rows.data.items.length === 0 ? (
        <EmptyState title={emptyTitle} />
      ) : (
        <div aria-busy={rows.isFetching || undefined}>
          <DataTable
            caption={t.preview.tableCaption}
            columns={columns}
            rows={rows.data.items}
            rowKey={(row) => String(row.rowNumber)}
          />
        </div>
      )}

      {rows.isSuccess && (cursors.length > 1 || rows.data.nextCursor !== null) ? (
        <nav className="import-pager" aria-label={t.preview.pageNav}>
          <Button variant="secondary" size="sm" disabled={cursors.length <= 1} onClick={previousPage}>
            {t.preview.previous}
          </Button>
          <Button variant="secondary" size="sm" disabled={rows.data.nextCursor === null} onClick={nextPage}>
            {t.preview.next}
          </Button>
        </nav>
      ) : null}

      <div className="import-preview__next">
        <Button onClick={onContinue}>{t.preview.continue}</Button>
      </div>
    </div>
  );
}
