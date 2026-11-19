import { useMemo, useState } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { InvitationStatus } from './console/PatientAdminViewModelAdapter';
import { Badge, Button, ErrorState, LoadingState, PageHeader, type BadgeTone } from '@/ui';
import { ConsoleTable, type ConsoleColumn } from './console/ConsoleTable';
import { IssueCredentialsDialog, type IssueTarget } from './console/IssueCredentialsDialog';
import { PatientAdminViewModelAdapter, type PatientRowViewModel } from './console/PatientAdminViewModelAdapter';
import { credentialHistory, historyStateOf, isInCredentialQueue, type HistoryState } from './console/credentialStatus';
import { useClinic, usePatientWalk } from './console/adminQueries';
import type { SortState } from './console/useSortParam';
import './console/console.css';

const HISTORY_TONE: Record<HistoryState, BadgeTone> = {
  issued: 'info',
  used: 'success',
  expired: 'warning',
  revoked: 'neutral',
  other: 'neutral',
};

const QUEUE_SORT: SortState = { columnId: 'patient', direction: 'ascending' };

/** Invitation state as the roster reports it. Null means no credential was ever issued. */
function invitationLabel(status: InvitationStatus): string {
  if (status === null) return es.admin.invitation.none;
  if (status === 'PENDING' || status === 'EXPIRED' || status === 'REVOKED') return es.admin.invitation[status];
  return es.admin.invitation.other;
}

/** Credential queue (patients without a valid credential), one-time issuing and the issue history. */
export function CredentialsPage() {
  const clinic = useClinic();
  const walk = usePatientWalk();
  const adapter = useMemo(() => new PatientAdminViewModelAdapter(), []);
  const roster = useMemo(() => (walk.data ?? []).map((dto) => adapter.adapt(dto)), [walk.data, adapter]);
  const queue = useMemo(() => roster.filter(isInCredentialQueue), [roster]);
  const history = useMemo(() => credentialHistory(roster), [roster]);
  const [queueSort, setQueueSort] = useState<SortState>(QUEUE_SORT);
  const [historySort, setHistorySort] = useState<SortState>({ columnId: 'state', direction: 'ascending' });
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [issueTargets, setIssueTargets] = useState<readonly IssueTarget[]>([]);
  const [issueResend, setIssueResend] = useState(false);

  const selectedRows = queue.filter((row) => selected.has(row.id));

  const openIssue = (targets: readonly PatientRowViewModel[]) => {
    setIssueTargets(targets.map((row) => ({ id: row.id, fullName: row.fullName, mrn: row.mrn })));
    setIssueResend(targets.length === 1 && targets[0]?.accountStatus === 'INVITED');
  };

  const toggleSelected = (ids: readonly string[], on: boolean) => {
    setSelected((current) => {
      const next = new Set(current);
      for (const id of ids) {
        if (on) next.add(id);
        else next.delete(id);
      }
      return next;
    });
  };

  const queueColumns: ConsoleColumn<PatientRowViewModel>[] = [
    { id: 'patient', header: es.admin.credentials.columns.patient, sortValue: (row) => row.fullName, cell: (row) => <strong>{row.fullName}</strong> },
    { id: 'mrn', header: es.admin.credentials.columns.mrn, measure: true, sortValue: (row) => row.mrn, cell: (row) => row.mrn },
    {
      id: 'account',
      header: es.admin.credentials.columns.account,
      sortValue: (row) => es.admin.accountStatus[row.accountStatus],
      cell: (row) => <Badge tone={row.accountStatus === 'INVITED' ? 'info' : 'neutral'}>{es.admin.accountStatus[row.accountStatus]}</Badge>,
    },
    {
      id: 'invitation',
      header: es.admin.credentials.columns.invitation,
      sortValue: (row) => invitationLabel(row.invitationStatus),
      cell: (row) => invitationLabel(row.invitationStatus),
    },
    {
      id: 'actions',
      header: es.admin.credentials.columns.actions,
      cell: (row) => (
        <Button size="sm" variant="secondary" onClick={() => { openIssue([row]); }}>
          {es.admin.credentials.issue}
        </Button>
      ),
    },
  ];

  const historyColumns: ConsoleColumn<PatientRowViewModel>[] = [
    { id: 'patient', header: es.admin.credentials.columns.patient, sortValue: (row) => row.fullName, cell: (row) => row.fullName },
    { id: 'mrn', header: es.admin.credentials.columns.mrn, measure: true, sortValue: (row) => row.mrn, cell: (row) => row.mrn },
    {
      id: 'state',
      header: es.admin.credentials.columns.history,
      sortValue: (row) => es.admin.credentials.historyStates[historyStateOf(row) ?? 'other'],
      cell: (row) => {
        const state = historyStateOf(row) ?? 'other';
        return <Badge tone={HISTORY_TONE[state]}>{es.admin.credentials.historyStates[state]}</Badge>;
      },
    },
    {
      id: 'account',
      header: es.admin.credentials.columns.account,
      sortValue: (row) => es.admin.accountStatus[row.accountStatus],
      cell: (row) => es.admin.accountStatus[row.accountStatus],
    },
  ];

  const loading = walk.isPending;

  return (
    <div className="page">
      <PageHeader
        title={es.admin.credentials.title}
        description={clinic.data ? `${clinic.data.name}. ${es.admin.credentials.lead}` : es.admin.credentials.lead}
      />

      {walk.isError ? (
        <ErrorState error={walk.error} title={es.admin.credentials.errorTitle} onRetry={() => void walk.refetch()} />
      ) : loading ? (
        <LoadingState label={es.admin.credentials.loadingQueue} />
      ) : (
        <>
          <section aria-labelledby="credentials-queue-title" className="console-section">
            <div className="console-section__head">
              <h2 id="credentials-queue-title">{es.admin.credentials.queueTitle}</h2>
              <p className="console-note">{es.admin.credentials.queueLead}</p>
            </div>

            {selectedRows.length > 0 ? (
              <div className="console-batch" role="region" aria-label={es.admin.common.issueSelected}>
                <p>{format(es.admin.common.selectedCount, { count: selectedRows.length })}</p>
                <div className="console-batch__actions">
                  <Button variant="ghost" onClick={() => { setSelected(new Set()); }}>
                    {es.admin.common.clearSelection}
                  </Button>
                  <Button onClick={() => { openIssue(selectedRows); }}>{es.admin.common.issueSelected}</Button>
                </div>
              </div>
            ) : null}

            {queue.length === 0 ? (
              <div className="panel console-empty">
                <p>{es.admin.credentials.queueEmpty}</p>
              </div>
            ) : (
              <ConsoleTable
                caption={es.admin.credentials.queueCaption}
                columns={queueColumns}
                rows={queue}
                rowKey={(row) => row.id}
                sort={queueSort}
                onSortChange={setQueueSort}
                selection={{
                  selectedIds: selected,
                  onChange: toggleSelected,
                  rowLabel: (row) => format(es.admin.credentials.selectRow, { name: row.fullName }),
                }}
              />
            )}
          </section>

          <section aria-labelledby="credentials-history-title" className="console-section">
            <div className="console-section__head">
              <h2 id="credentials-history-title">{es.admin.credentials.historyTitle}</h2>
              <p className="console-note">{es.admin.credentials.historyLead}</p>
            </div>
            {history.length === 0 ? (
              <div className="panel console-empty">
                <p>{es.admin.credentials.historyEmpty}</p>
              </div>
            ) : (
              <ConsoleTable
                caption={es.admin.credentials.historyCaption}
                columns={historyColumns}
                rows={history}
                rowKey={(row) => row.id}
                sort={historySort}
                onSortChange={setHistorySort}
              />
            )}
          </section>
        </>
      )}

      <IssueCredentialsDialog
        open={issueTargets.length > 0}
        targets={issueTargets}
        resend={issueResend}
        onClose={() => {
          setIssueTargets([]);
          setIssueResend(false);
        }}
      />
    </div>
  );
}
