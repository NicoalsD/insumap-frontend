import { useMemo, useState } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Badge, EmptyState, ErrorState, LoadingState, PageHeader, type BadgeTone } from '@/ui';
import { CareAssignmentViewModelAdapter, type CareAssignmentViewModel } from './console/CareAssignmentViewModelAdapter';
import { ConsoleTable, type ConsoleColumn } from './console/ConsoleTable';
import { doctorLoads, loadShare } from './console/careTeamSummary';
import { formatAdminDate } from './console/formatAdminDate';
import { staffNames, useAssignmentWalk, useClinic, usePatientWalk, useStaffWalk } from './console/adminQueries';
import type { SortState } from './console/useSortParam';
import './console/console.css';

const PERCENT = 100;
const ASSIGNMENT_SORT: SortState = { columnId: 'patient', direction: 'ascending' };

/**
 * Care teams: who attends each patient and how many patients each doctor carries. Read-only: the
 * API's assign, make-primary, reassign and end endpoints are not wired to this console yet.
 */
export function CareTeamsPage() {
  const clinic = useClinic();
  const assignments = useAssignmentWalk();
  const patients = usePatientWalk();
  const staff = useStaffWalk();
  const [sort, setSort] = useState<SortState>(ASSIGNMENT_SORT);

  const rows = useMemo<CareAssignmentViewModel[]>(() => {
    const names = new Map((patients.data ?? []).map((patient) => [patient.id, patient.full_name]));
    const adapter = new CareAssignmentViewModelAdapter(names, staffNames(staff.data));
    return (assignments.data ?? []).map((dto) => adapter.adapt(dto));
  }, [assignments.data, patients.data, staff.data]);

  const loads = useMemo(() => doctorLoads(rows), [rows]);
  const maxLoad = loads[0]?.patientCount ?? 0;

  const columns: ConsoleColumn<CareAssignmentViewModel>[] = [
    {
      id: 'patient',
      header: es.admin.careTeams.columns.patient,
      sortValue: (row) => row.patientName,
      cell: (row) => row.patientName ?? es.admin.common.noDoctorName,
    },
    {
      id: 'doctor',
      header: es.admin.careTeams.columns.doctor,
      sortValue: (row) => row.doctorName,
      cell: (row) => row.doctorName ?? es.admin.common.unknownDoctor,
    },
    {
      id: 'role',
      header: es.admin.careTeams.columns.role,
      sortValue: (row) => (row.isPrimary ? 0 : 1),
      cell: (row) => {
        const tone: BadgeTone = row.isPrimary ? 'success' : 'neutral';
        return <Badge tone={tone}>{row.isPrimary ? es.admin.careTeams.primary : es.admin.careTeams.secondary}</Badge>;
      },
    },
    {
      id: 'since',
      header: es.admin.careTeams.columns.since,
      measure: true,
      sortValue: (row) => row.startedAt,
      cell: (row) => formatAdminDate(row.startedAt, clinic.data?.timezone),
    },
  ];

  const body = (() => {
    if (assignments.isError || patients.isError) {
      const error = assignments.error ?? patients.error;
      return (
        <ErrorState
          error={error}
          title={es.admin.careTeams.errorTitle}
          onRetry={() => {
            void assignments.refetch();
            void patients.refetch();
          }}
        />
      );
    }
    if (assignments.isPending || patients.isPending) return <LoadingState label={es.admin.careTeams.loading} />;
    if (rows.length === 0) {
      return <EmptyState title={es.admin.careTeams.empty} body={es.admin.careTeams.emptyBody} />;
    }
    return (
      <div className="page-grid-two">
        <section className="console-section" aria-labelledby="care-load-title">
          <div className="console-section__head">
            <h2 id="care-load-title">{es.admin.careTeams.loadTitle}</h2>
            <p className="console-note">{es.admin.careTeams.loadLead}</p>
          </div>
          <ul className="console-load panel panel__body" aria-label={es.admin.careTeams.loadCaption}>
            {loads.map((load) => {
              const name = load.doctorName ?? es.admin.common.unknownDoctor;
              return (
                <li key={load.doctorId} className="console-load__row">
                  <span>{name}</span>
                  <span className="console-load__track" aria-hidden="true">
                    <span
                      className="console-load__bar"
                      style={{ inlineSize: `${String(loadShare(load.patientCount, maxLoad) * PERCENT)}%` }}
                    />
                  </span>
                  <span className="console-load__count">
                    {format(es.admin.careTeams.patientCount, { count: load.patientCount })}
                  </span>
                </li>
              );
            })}
          </ul>
        </section>

        <section className="console-section" aria-labelledby="care-assignments-title">
          <div className="console-section__head">
            <h2 id="care-assignments-title">{es.admin.careTeams.assignmentsTitle}</h2>
          </div>
          <ConsoleTable
            caption={es.admin.careTeams.assignmentsCaption}
            columns={columns}
            rows={rows}
            rowKey={(row) => row.id}
            sort={sort}
            onSortChange={setSort}
          />
        </section>
      </div>
    );
  })();

  return (
    <div className="page">
      <PageHeader
        title={es.admin.careTeams.title}
        description={clinic.data ? `${clinic.data.name}. ${es.admin.careTeams.lead}` : es.admin.careTeams.lead}
      />
      {body}
    </div>
  );
}
