import { useMemo } from 'react';
import { useSearchParams } from 'react-router';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { StaffUserDto } from '@/services/dto/admin';
import { Badge, Button, EmptyState, ErrorState, LoadingState, PageHeader, Select, type BadgeTone } from '@/ui';
import type { SelectOption } from '@/ui/Select';
import { ConsoleTable, type ConsoleColumn } from './console/ConsoleTable';
import { useClinic, useStaffWalk } from './console/adminQueries';
import { useSortParam, type SortState } from './console/useSortParam';
import './console/console.css';

const ROLE_OPTIONS = ['ALL', 'DOCTOR', 'CLINIC_ADMIN'] as const;
const STATUS_OPTIONS = ['ALL', 'ACTIVE', 'INACTIVE'] as const;
const DEFAULT_SORT: SortState = { columnId: 'name', direction: 'ascending' };
const SORT_COLUMNS = ['name', 'role', 'status', 'patients'] as const;

type RoleFilter = (typeof ROLE_OPTIONS)[number];
type StatusFilter = (typeof STATUS_OPTIONS)[number];

function roleLabel(role: StaffUserDto['role']): string {
  if (role === 'DOCTOR') return es.admin.staff.roleDoctor;
  if (role === 'CLINIC_ADMIN') return es.admin.staff.roleAdmin;
  return role;
}

function parseRole(value: string | null): RoleFilter {
  return (ROLE_OPTIONS as readonly string[]).includes(value ?? '') ? (value as RoleFilter) : 'ALL';
}

function parseStatus(value: string | null): StatusFilter {
  return (STATUS_OPTIONS as readonly string[]).includes(value ?? '') ? (value as StatusFilter) : 'ALL';
}

/** Clinic staff: doctors and clinic admins, their status and how many patients each doctor carries. */
export function StaffPage() {
  const clinic = useClinic();
  const staff = useStaffWalk();
  const [params, setParams] = useSearchParams();
  const [sort, setSort] = useSortParam(SORT_COLUMNS, DEFAULT_SORT);
  const role = parseRole(params.get('role'));
  const status = parseStatus(params.get('status'));

  const members = useMemo(
    () =>
      (staff.data ?? []).filter(
        (member) =>
          (role === 'ALL' || member.role === role) && (status === 'ALL' || member.status === status),
      ),
    [staff.data, role, status],
  );

  const filtersActive = role !== 'ALL' || status !== 'ALL';

  const setParam = (name: string, value: string) => {
    setParams(
      (current) => {
        const copy = new URLSearchParams(current);
        if (value === 'ALL') copy.delete(name);
        else copy.set(name, value);
        return copy;
      },
      { replace: true },
    );
  };

  const columns: ConsoleColumn<StaffUserDto>[] = [
    { id: 'name', header: es.admin.staff.columns.name, sortValue: (row) => row.full_name, cell: (row) => <strong>{row.full_name}</strong> },
    { id: 'role', header: es.admin.staff.columns.role, sortValue: (row) => roleLabel(row.role), cell: (row) => roleLabel(row.role) },
    {
      id: 'status',
      header: es.admin.staff.columns.status,
      sortValue: (row) => (row.status === 'ACTIVE' ? 0 : 1),
      cell: (row) => {
        const tone: BadgeTone = row.status === 'ACTIVE' ? 'success' : 'neutral';
        return <Badge tone={tone}>{row.status === 'ACTIVE' ? es.admin.staff.active : es.admin.staff.inactive}</Badge>;
      },
    },
    {
      id: 'patients',
      header: es.admin.staff.columns.patients,
      measure: true,
      align: 'end',
      sortValue: (row) => row.patients_count,
      cell: (row) => (row.role === 'DOCTOR' ? row.patients_count : es.admin.staff.notApplicable),
    },
  ];

  const roleOptions: SelectOption[] = [
    { value: 'ALL', label: es.admin.staff.allRoles },
    { value: 'DOCTOR', label: es.admin.staff.roleDoctor },
    { value: 'CLINIC_ADMIN', label: es.admin.staff.roleAdmin },
  ];
  const statusOptions: SelectOption[] = [
    { value: 'ALL', label: es.admin.staff.allStatuses },
    { value: 'ACTIVE', label: es.admin.staff.active },
    { value: 'INACTIVE', label: es.admin.staff.inactive },
  ];

  const body = (() => {
    if (staff.isError) {
      return <ErrorState error={staff.error} title={es.admin.staff.errorTitle} onRetry={() => void staff.refetch()} />;
    }
    if (staff.isPending) return <LoadingState label={es.admin.staff.loading} />;
    if (staff.data.length === 0) {
      return <EmptyState title={es.admin.staff.empty} body={es.admin.staff.emptyBody} />;
    }
    if (members.length === 0) {
      return (
        <div className="panel console-empty">
          <p>{es.admin.staff.noMatches}</p>
          <Button
            variant="secondary"
            onClick={() => {
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            {es.admin.common.clearFilters}
          </Button>
        </div>
      );
    }
    return (
      <ConsoleTable
        caption={es.admin.staff.doctorsCaption}
        columns={columns}
        rows={members}
        rowKey={(row) => row.id}
        sort={sort}
        onSortChange={setSort}
      />
    );
  })();

  return (
    <div className="page">
      <PageHeader
        title={es.admin.staff.title}
        description={clinic.data ? `${clinic.data.name}. ${es.admin.staff.lead}` : es.admin.staff.lead}
      />

      <form className="console-toolbar" role="search" aria-label={es.admin.common.filtersLabel} onSubmit={(event) => { event.preventDefault(); }}>
        <Select
          label={es.admin.staff.filterRole}
          name="role"
          options={roleOptions}
          value={role}
          onChange={(event) => { setParam('role', event.target.value); }}
        />
        <Select
          label={es.admin.staff.filterStatus}
          name="status"
          options={statusOptions}
          value={status}
          onChange={(event) => { setParam('status', event.target.value); }}
        />
        {filtersActive ? (
          <Button
            variant="ghost"
            onClick={() => {
              setParams(new URLSearchParams(), { replace: true });
            }}
          >
            {es.admin.common.clearFilters}
          </Button>
        ) : null}
      </form>

      {body}
      {members.length > 0 ? (
        <p className="console-note">{format(es.admin.common.rowCount, { count: members.length })}</p>
      ) : null}
    </div>
  );
}
