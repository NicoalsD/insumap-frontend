import { useEffect, useMemo, useState } from 'react';
import { useSearchParams } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { CareAssignmentDto } from '@/services/dto/admin';
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Select, TextField, type BadgeTone } from '@/ui';
import type { SelectOption } from '@/ui/Select';
import { ConsoleTable, type ConsoleColumn } from './console/ConsoleTable';
import { IssueCredentialsDialog, type IssueTarget } from './console/IssueCredentialsDialog';
import { PatientAdminViewModelAdapter, ACCOUNT_STATUSES, type AccountStatus, type PatientRowViewModel } from './console/PatientAdminViewModelAdapter';
import { CareAssignmentViewModelAdapter } from './console/CareAssignmentViewModelAdapter';
import { doctorNameMap } from './console/careTeamSummary';
import { staffNames, useAssignmentWalk, useClinic, usePatientPages, usePatientWalk, useStaffWalk } from './console/adminQueries';
import {
  countPatients,
  matchesPatientFilters,
  needsFullRoster,
  PATIENT_VIEWS,
  type PatientFilters,
  type PatientView,
} from './console/patientFilters';
import { useSortParam, type SortState } from './console/useSortParam';
import './console/console.css';

const ACCOUNT_TONE: Record<AccountStatus, BadgeTone> = {
  IMPORTED: 'neutral',
  INVITED: 'info',
  ACTIVE: 'success',
  SUSPENDED: 'warning',
  DEACTIVATED: 'neutral',
};

const DEFAULT_SORT: SortState = { columnId: 'patient', direction: 'ascending' };
const SORT_COLUMNS = ['patient', 'account', 'doctor'] as const;
type CounterId = 'active' | 'pending' | 'expired' | 'noDoctor';
const COUNTER_VIEW: Record<CounterId, PatientView> = {
  active: 'active',
  pending: 'pending',
  expired: 'expired',
  noDoctor: 'noDoctor',
};

function isView(value: string | null): value is PatientView {
  return PATIENT_VIEWS.some((view) => view === value);
}

function isAccountStatus(value: string | null): value is AccountStatus {
  return ACCOUNT_STATUSES.some((status) => status === value);
}

/** Patients of the clinic: counters that filter, a search, status and doctor filters, and issuing. */
export function RosterPage() {
  const [params, setParams] = useSearchParams();
  const clinic = useClinic();
  const pages = usePatientPages(filtersFromUrl(params));
  const walk = usePatientWalk();
  const assignments = useAssignmentWalk();
  const [sort, setSort] = useSortParam(SORT_COLUMNS, DEFAULT_SORT);
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<ReadonlySet<string>>(new Set());
  const [issueTargets, setIssueTargets] = useState<readonly IssueTarget[]>([]);
  const [issueResend, setIssueResend] = useState(false);

  const filters = useMemo<PatientFilters>(() => ({ ...filtersFromUrl(params), search }), [params, search]);
  const staff = useStaffWalk();
  const doctorNames = useMemo(
    () => doctorNameMap(assignmentRows(assignments.data, staffNames(staff.data))),
    [assignments.data, staff.data],
  );
  const adapter = useMemo(() => new PatientAdminViewModelAdapter(doctorNames), [doctorNames]);
  const pageRows = useMemo(
    () => (pages.data?.pages.flatMap((page) => page.items) ?? []).map((dto) => adapter.adapt(dto)),
    [pages.data, adapter],
  );
  const rows = useMemo(() => pageRows.filter((row) => matchesPatientFilters(row, filters)), [pageRows, filters]);
  const walkRows = useMemo(() => (walk.data ?? []).map((dto) => adapter.adapt(dto)), [walk.data, adapter]);
  const counts = useMemo(() => countPatients(walkRows), [walkRows]);
  const doctorOptions = useMemo<SelectOption[]>(
    () => [
      { value: '', label: es.admin.common.allDoctors },
      ...[...doctorNames.entries()]
        .sort((a, b) => a[1].localeCompare(b[1], 'es-CO'))
        .map(([value, label]) => ({ value, label })),
    ],
    [doctorNames],
  );

  const { hasNextPage, isFetchingNextPage, fetchNextPage } = pages;
  const fullRosterNeeded = needsFullRoster(filters);
  useEffect(() => {
    if (fullRosterNeeded && hasNextPage && !isFetchingNextPage) void fetchNextPage();
  }, [fullRosterNeeded, hasNextPage, isFetchingNextPage, fetchNextPage]);

  const selectedRows = rows.filter((row) => selected.has(row.id) && row.canIssue);
  const filtersActive = filters.view !== 'all' || filters.accountStatus !== 'ALL' || filters.doctorId !== '' || search !== '';

  const setParam = (name: string, value: string) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (value === '') copy.delete(name);
        else copy.set(name, value);
        return copy;
      },
      { replace: true },
    );
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

  const openIssue = (targets: readonly PatientRowViewModel[], resend: boolean) => {
    setIssueTargets(targets.map((row) => ({ id: row.id, fullName: row.fullName, mrn: row.mrn })));
    setIssueResend(resend);
  };

  const clearFilters = () => {
    setSearch('');
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        copy.delete('view');
        copy.delete('account');
        copy.delete('doctor');
        return copy;
      },
      { replace: true },
    );
  };

  const columns: ConsoleColumn<PatientRowViewModel>[] = [
    {
      id: 'patient',
      header: es.admin.patients.columns.patient,
      sortValue: (row) => row.fullName,
      cell: (row) => <strong>{row.fullName}</strong>,
    },
    {
      id: 'document',
      header: es.admin.patients.columns.document,
      measure: true,
      cell: (row) => format(es.admin.common.documentMasked, { last4: row.documentLast4 }),
    },
    {
      id: 'account',
      header: es.admin.patients.columns.account,
      sortValue: (row) => es.admin.accountStatus[row.accountStatus],
      cell: (row) => <Badge tone={ACCOUNT_TONE[row.accountStatus]}>{es.admin.accountStatus[row.accountStatus]}</Badge>,
    },
    {
      id: 'doctor',
      header: es.admin.patients.columns.doctor,
      sortValue: (row) => row.primaryDoctorName,
      cell: (row) =>
        row.primaryDoctorId === null ? (
          <Badge tone="warning">{es.admin.common.noDoctorFilter}</Badge>
        ) : (
          (row.primaryDoctorName ?? es.admin.common.unknownDoctor)
        ),
    },
    {
      id: 'actions',
      header: es.admin.patients.columns.actions,
      cell: (row) =>
        row.canIssue ? (
          <Button
            size="sm"
            variant="secondary"
            onClick={() => { openIssue([row], row.accountStatus === 'INVITED'); }}
            aria-label={
              row.accountStatus === 'INVITED'
                ? format(es.admin.patients.resendLabelFor, { name: row.fullName })
                : format(es.admin.patients.issueLabelFor, { name: row.fullName })
            }
          >
            {row.accountStatus === 'INVITED' ? es.admin.patients.resend : es.admin.patients.issue}
          </Button>
        ) : null,
    },
  ];

  const accountOptions: SelectOption[] = [
    { value: 'ALL', label: es.admin.common.all },
    ...ACCOUNT_STATUSES.map((status) => ({ value: status, label: es.admin.accountStatus[status] })),
  ];

  const counterItems: { id: CounterId; label: string; value: number }[] = [
    { id: 'active', label: es.admin.patients.counters.active, value: counts.active },
    { id: 'pending', label: es.admin.patients.counters.pending, value: counts.pending },
    { id: 'expired', label: es.admin.patients.counters.expired, value: counts.expired },
    { id: 'noDoctor', label: es.admin.patients.counters.noDoctor, value: counts.noDoctor },
  ];

  const body = (() => {
    if (pages.isError) {
      return <ErrorState error={pages.error} title={es.admin.patients.errorTitle} onRetry={() => void pages.refetch()} />;
    }
    if (pages.isPending) return <LoadingState label={es.admin.patients.loadingRoster} />;
    if (pageRows.length === 0 && !filtersActive && !pages.hasNextPage) {
      return <EmptyState title={es.admin.patients.empty} body={es.admin.patients.emptyBody} />;
    }
    if (rows.length === 0) {
      return (
        <div className="panel console-empty">
          <p>{es.admin.common.noMatches}</p>
          {filtersActive ? (
            <Button variant="secondary" onClick={clearFilters}>
              {es.admin.common.clearFilters}
            </Button>
          ) : null}
        </div>
      );
    }
    return (
      <>
        <ConsoleTable
          caption={es.admin.patients.tableCaption}
          columns={columns}
          rows={rows}
          rowKey={(row) => row.id}
          sort={sort}
          onSortChange={setSort}
          selection={{
            selectedIds: selected,
            onChange: toggleSelected,
            rowLabel: (row) => format(es.admin.common.selectRow, { name: row.fullName }),
          }}
        />
        <p className="console-note" aria-live="polite">
          {format(es.admin.common.rowCount, { count: rows.length })}
          {isFetchingNextPage ? ` · ${es.admin.common.loadingMore}` : ''}
        </p>
        {hasNextPage && !fullRosterNeeded ? (
          <div className="console-link-row">
            <Button variant="secondary" loading={isFetchingNextPage} onClick={() => void fetchNextPage()}>
              {isFetchingNextPage ? es.admin.common.loadingMore : es.admin.common.loadMore}
            </Button>
          </div>
        ) : null}
      </>
    );
  })();

  return (
    <div className="page">
      <PageHeader
        title={clinic.data?.name ?? es.admin.patients.title}
        description={es.admin.patients.lead}
      />

      {walk.isError ? (
        <p className="console-note" role="alert">
          {es.admin.patients.countersError}
        </p>
      ) : (
        <div className="console-counters" role="group" aria-label={es.admin.patients.counterHint}>
          {counterItems.map((item) => {
            const pressed = filters.view === COUNTER_VIEW[item.id];
            return (
              <button
                key={item.id}
                type="button"
                className="console-counter"
                aria-pressed={pressed}
                onClick={() => { setParam('view', pressed ? 'all' : COUNTER_VIEW[item.id]); }}
              >
                <span className="console-counter__value">{item.value}</span>
                <span className="console-counter__label">{item.label}</span>
              </button>
            );
          })}
        </div>
      )}

      <form className="console-toolbar" role="search" aria-label={es.admin.common.filtersLabel} onSubmit={(event) => { event.preventDefault(); }}>
        <TextField
          label={es.admin.common.search}
          hint={es.admin.common.searchHint}
          type="search"
          name="patient-search"
          autoComplete="off"
          placeholder={es.admin.common.searchPlaceholder}
          value={search}
          onChange={(event) => { setSearch(event.target.value); }}
        />
        <Select
          label={es.admin.common.accountStatus}
          name="account-status"
          options={accountOptions}
          value={filters.accountStatus}
          onChange={(event) => { setParam('account', event.target.value === 'ALL' ? '' : event.target.value); }}
        />
        <Select
          label={es.admin.common.doctor}
          name="doctor"
          options={doctorOptions}
          value={filters.doctorId}
          onChange={(event) => { setParam('doctor', event.target.value); }}
        />
        {filtersActive ? (
          <Button variant="ghost" onClick={clearFilters}>
            {es.admin.common.clearFilters}
          </Button>
        ) : null}
      </form>

      {selectedRows.length > 0 ? (
        <div className="console-batch" role="region" aria-label={es.admin.common.issueSelected}>
          <p>{format(es.admin.common.selectedCount, { count: selectedRows.length })}</p>
          <div className="console-batch__actions">
            <Button variant="ghost" onClick={() => { setSelected(new Set()); }}>
              {es.admin.common.clearSelection}
            </Button>
            <Button onClick={() => { openIssue(selectedRows, false); }}>{es.admin.common.issueSelected}</Button>
          </div>
        </div>
      ) : null}

      {body}

      <IssueCredentialsDialog
        open={issueTargets.length > 0}
        targets={issueTargets}
        resend={issueResend}
        onClose={() => { setIssueTargets([]); setIssueResend(false); }}
      />
    </div>
  );
}

function filtersFromUrl(params: URLSearchParams): PatientFilters {
  const viewParam = params.get('view');
  const accountParam = params.get('account');
  return {
    view: isView(viewParam) ? viewParam : 'all',
    accountStatus: isAccountStatus(accountParam) ? accountParam : 'ALL',
    doctorId: params.get('doctor') ?? '',
    search: '',
  };
}

function assignmentRows(dtos: readonly CareAssignmentDto[] | undefined, doctors: ReadonlyMap<string, string>) {
  const adapter = new CareAssignmentViewModelAdapter(new Map(), doctors);
  return (dtos ?? []).map((dto) => adapter.adapt(dto));
}
