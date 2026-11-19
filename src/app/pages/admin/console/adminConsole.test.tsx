import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { beforeAll, beforeEach, describe, expect, it, vi } from 'vitest';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { CareAssignmentDto, PatientAdminDto, StaffUserDto } from '@/services/dto/admin';
import { apiUrl } from '@/services/http/apiUrl';
import { ADMIN_ACCOUNT, DEMO_CLINIC } from '@/mocks/fixtures/people';
import { mockState } from '@/mocks/MockState';
import { server } from '@/mocks/server';
import { apiError } from '@/mocks/http';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

/** Fixture code the mock returns for PRINT (mocks/handlers/admin.ts). */
const PRINT_CODE = 'K7M2-9PQX-4TRD-8WHN';
const DOCTOR_ID = 'd1000000-0000-4000-8000-0000000000aa';
const SECOND_DOCTOR_ID = 'd1000000-0000-4000-8000-0000000000bb';

function patient(overrides: Partial<PatientAdminDto> & Pick<PatientAdminDto, 'id' | 'full_name' | 'mrn'>): PatientAdminDto {
  return {
    document_last4: '4321',
    account_status: 'ACTIVE',
    primary_doctor_id: DOCTOR_ID,
    assigned_doctor_count: 1,
    invitation_status: null,
    simulated: false,
    ...overrides,
  };
}

/** Roster covering every counter: 1 active, 3 pending, 1 expired credential, 2 without doctor. */
const ROSTER: PatientAdminDto[] = [
  patient({ id: 'a1000000-0000-4000-8000-000000000001', full_name: 'Camila Restrepo', mrn: 'MRN-1' }),
  patient({
    id: 'a1000000-0000-4000-8000-000000000002',
    full_name: 'Andrés Cardona',
    mrn: 'MRN-2',
    account_status: 'INVITED',
    primary_doctor_id: null,
    assigned_doctor_count: 0,
    invitation_status: 'EXPIRED',
  }),
  patient({
    id: 'a1000000-0000-4000-8000-000000000003',
    full_name: 'Sofía Vélez',
    mrn: 'MRN-3',
    account_status: 'IMPORTED',
    primary_doctor_id: null,
    assigned_doctor_count: 0,
  }),
  patient({
    id: 'a1000000-0000-4000-8000-000000000004',
    full_name: 'Luisa Ortiz',
    mrn: 'MRN-4',
    account_status: 'INVITED',
    invitation_status: 'PENDING',
  }),
];

const ASSIGNMENTS: CareAssignmentDto[] = [
  {
    id: 'ca000000-0000-4000-8000-000000000001',
    patient_id: 'a1000000-0000-4000-8000-000000000001',
    doctor_id: DOCTOR_ID,
    is_primary: true,
    started_at: '2026-10-01T10:00:00.000Z',
    ended_at: null,
    end_reason: null,
    patient_name: 'Camila Restrepo',
    doctor_name: 'Mauricio Henao',
  },
  {
    id: 'ca000000-0000-4000-8000-000000000002',
    patient_id: 'a1000000-0000-4000-8000-000000000004',
    doctor_id: DOCTOR_ID,
    is_primary: true,
    started_at: '2026-10-02T10:00:00.000Z',
    ended_at: null,
    end_reason: null,
    patient_name: 'Luisa Ortiz',
    doctor_name: 'Mauricio Henao',
  },
  {
    id: 'ca000000-0000-4000-8000-000000000003',
    patient_id: 'a1000000-0000-4000-8000-000000000004',
    doctor_id: SECOND_DOCTOR_ID,
    is_primary: false,
    started_at: '2026-10-03T10:00:00.000Z',
    ended_at: null,
    end_reason: null,
    patient_name: 'Luisa Ortiz',
    doctor_name: 'Carolina Ruiz',
  },
];

/** Serves the roster with the server-side filters the API applies (`account_status`, `without_doctor`). */
function seedRoster(patients: readonly PatientAdminDto[] = ROSTER) {
  server.use(
    http.get(apiUrl('/patients'), ({ request }) => {
      const url = new URL(request.url);
      const status = url.searchParams.get('account_status');
      const withoutDoctor = url.searchParams.get('without_doctor') === 'true';
      const items = patients.filter(
        (p) => (status === null || p.account_status === status) && (!withoutDoctor || p.assigned_doctor_count === 0),
      );
      return HttpResponse.json({ items, next_cursor: null });
    }),
    http.get(apiUrl('/care-team/assignments'), () => HttpResponse.json({ items: ASSIGNMENTS, next_cursor: null })),
    http.post(apiUrl('/patients/:patientId/credential-invitations'), async ({ request }) => {
      const body = (await request.json()) as { channel: 'PRINT' | 'EMAIL' };
      return HttpResponse.json(
        {
          invitation_id: 'ee000000-0000-4000-8000-000000000001',
          purpose: 'PATIENT_ACTIVATION',
          status: 'PENDING',
          channel: body.channel,
          expires_at: '2026-11-26T12:00:00.000Z',
          delivery_status: body.channel === 'EMAIL' ? 'QUEUED' : 'PRINTED',
          ...(body.channel === 'PRINT' ? { activation_code: PRINT_CODE } : {}),
        },
        { status: 201 },
      );
    }),
  );
}

function signInAsAdmin() {
  mockState.setRefreshCookie(ADMIN_ACCOUNT.id);
}

beforeAll(() => {
  // jsdom has no <dialog> modal support: model showModal/close with the same open state and close event.
  HTMLDialogElement.prototype.showModal = function showModal(this: HTMLDialogElement) {
    this.open = true;
  };
  HTMLDialogElement.prototype.close = function close(this: HTMLDialogElement) {
    if (!this.open) return;
    this.open = false;
    this.dispatchEvent(new Event('close'));
  };
  window.print = vi.fn();
});

beforeEach(() => {
  signInAsAdmin();
});

describe('patients roster', () => {
  it('shows the clinic name, counters that filter, and a table with the masked document', async () => {
    seedRoster();
    const { container, router } = renderApp('/admin/patients');
    expect(await screen.findByRole('heading', { level: 1, name: DEMO_CLINIC.name })).toBeInTheDocument();

    const table = await screen.findByRole('table', { name: es.admin.patients.tableCaption });
    expect(within(table).getByText('Camila Restrepo')).toBeInTheDocument();
    expect(within(table).getAllByText('•••• 4321').length).toBeGreaterThan(0);

    const expired = screen.getByRole('button', { name: /Credenciales vencidas/ });
    expect(expired).toHaveAttribute('aria-pressed', 'false');
    await userEvent.click(expired);
    expect(expired).toHaveAttribute('aria-pressed', 'true');
    expect(router.state.location.search).toContain('view=expired');
    await waitFor(() => { expect(within(table).queryByText('Camila Restrepo')).toBeNull(); });
    expect(within(table).getByText('Andrés Cardona')).toBeInTheDocument();

    await expectNoAxeViolations(container);
  });

  it('searches by name without writing the search text to the URL', async () => {
    seedRoster();
    const { router } = renderApp('/admin/patients');
    const table = await screen.findByRole('table', { name: es.admin.patients.tableCaption });
    await userEvent.type(screen.getByRole('searchbox', { name: es.admin.common.search }), 'Luisa');
    await waitFor(() => { expect(within(table).queryByText('Camila Restrepo')).toBeNull(); });
    expect(within(table).getByText('Luisa Ortiz')).toBeInTheDocument();
    expect(router.state.location.search).not.toContain('Luisa');
  });

  it('issues to the selected patients in a batch and shows the codes once for print', async () => {
    seedRoster();
    const { container } = renderApp('/admin/patients');
    const table = await screen.findByRole('table', { name: es.admin.patients.tableCaption });

    await userEvent.click(within(table).getByRole('checkbox', { name: es.admin.common.selectAllVisible }));
    expect(screen.getByText(format(es.admin.common.selectedCount, { count: 4 }))).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: es.admin.common.issueSelected }));
    const dialog = await screen.findByRole('dialog', { name: es.admin.issue.dialogTitle });
    expect(within(dialog).getByText(format(es.admin.issue.dialogLeadMany, { count: 4 }))).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: es.admin.issue.confirm }));

    expect(await within(dialog).findByRole('heading', { name: format(es.admin.issue.sheetTitle, { clinic: DEMO_CLINIC.name }) })).toBeInTheDocument();
    expect(within(dialog).getByText(es.admin.issue.sheetWarning)).toBeInTheDocument();
    expect(within(dialog).getAllByText(PRINT_CODE).length).toBeGreaterThan(0);

    await userEvent.click(within(dialog).getByRole('button', { name: es.admin.issue.done }));
    await waitFor(() => { expect(dialog).not.toHaveAttribute('open'); });
    expect(screen.queryByText(PRINT_CODE)).toBeNull();
    await expectNoAxeViolations(container);
  });

  it('resends from the row of an invited patient', async () => {
    seedRoster();
    renderApp('/admin/patients');
    await screen.findByRole('table', { name: es.admin.patients.tableCaption });
    await userEvent.click(screen.getByRole('button', { name: format(es.admin.patients.resendLabelFor, { name: 'Luisa Ortiz' }) }));
    const dialog = await screen.findByRole('dialog', { name: es.admin.patients.resend });
    await userEvent.click(within(dialog).getByRole('radio', { name: new RegExp(es.admin.channel.EMAIL) }));
    await userEvent.click(within(dialog).getByRole('button', { name: es.admin.issue.confirm }));
    expect(await within(dialog).findByText(format(es.admin.issue.emailDone, { count: 1 }))).toBeInTheDocument();
  });

  it('shows the empty state when the clinic has no patients', async () => {
    seedRoster([]);
    renderApp('/admin/patients');
    expect(await screen.findByRole('heading', { name: es.admin.patients.empty })).toBeInTheDocument();
  });

  it('shows the error state with a retry when the roster cannot load', async () => {
    server.use(http.get(apiUrl('/patients'), () => apiError('FORBIDDEN')));
    renderApp('/admin/patients');
    expect(await screen.findByRole('heading', { name: es.admin.patients.errorTitle })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: es.states.retry })).toBeInTheDocument();
  });
});

describe('credentials', () => {
  it('queues only patients without a valid credential and lists the history with its state', async () => {
    seedRoster();
    const { container } = renderApp('/admin/credentials');
    const queue = await screen.findByRole('table', { name: es.admin.credentials.queueCaption });
    expect(within(queue).getByText('Sofía Vélez')).toBeInTheDocument();
    expect(within(queue).getByText('Andrés Cardona')).toBeInTheDocument();
    expect(within(queue).queryByText('Luisa Ortiz')).toBeNull();
    expect(within(queue).queryByText('Camila Restrepo')).toBeNull();

    const history = screen.getByRole('table', { name: es.admin.credentials.historyCaption });
    const expiredRow = within(history).getByText('Andrés Cardona').closest('tr');
    expect(expiredRow).not.toBeNull();
    expect(within(expiredRow as HTMLElement).getByText(es.admin.credentials.historyStates.expired)).toBeInTheDocument();
    expect(within(history).getByText(es.admin.credentials.historyStates.used)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('issues by email to the selected patients and reports it without showing any code', async () => {
    seedRoster();
    renderApp('/admin/credentials');
    const queue = await screen.findByRole('table', { name: es.admin.credentials.queueCaption });
    await userEvent.click(within(queue).getByRole('checkbox', { name: format(es.admin.credentials.selectRow, { name: 'Sofía Vélez' }) }));
    await userEvent.click(screen.getByRole('button', { name: es.admin.common.issueSelected }));
    const dialog = await screen.findByRole('dialog', { name: es.admin.issue.dialogTitle });
    await userEvent.click(within(dialog).getByRole('radio', { name: new RegExp(es.admin.channel.EMAIL) }));
    await userEvent.click(within(dialog).getByRole('button', { name: es.admin.issue.confirm }));
    expect(await within(dialog).findByText(format(es.admin.issue.emailDone, { count: 1 }))).toBeInTheDocument();
    expect(within(dialog).queryByText(PRINT_CODE)).toBeNull();
  });

  it('prints one code on the sheet from a row in print mode', async () => {
    seedRoster();
    renderApp('/admin/credentials');
    await screen.findByRole('table', { name: es.admin.credentials.queueCaption });
    await userEvent.click(screen.getAllByRole('button', { name: es.admin.credentials.issue })[0] as HTMLElement);
    const dialog = await screen.findByRole('dialog');
    await userEvent.click(within(dialog).getByRole('button', { name: es.admin.issue.confirm }));
    expect(await within(dialog).findByText(PRINT_CODE)).toBeInTheDocument();
    await userEvent.click(within(dialog).getByRole('button', { name: es.admin.issue.printSheet }));
    expect(window.print).toHaveBeenCalled();
  });

  it('shows the empty queue message when every patient has a valid credential', async () => {
    seedRoster([ROSTER[0] as PatientAdminDto, ROSTER[3] as PatientAdminDto]);
    renderApp('/admin/credentials');
    expect(await screen.findByText(es.admin.credentials.queueEmpty)).toBeInTheDocument();
  });
});

describe('care teams', () => {
  it('shows the primary doctor in text and the load per doctor as numbered bars', async () => {
    seedRoster();
    const { container } = renderApp('/admin/care-teams');
    const table = await screen.findByRole('table', { name: es.admin.careTeams.assignmentsCaption });
    expect(within(table).getAllByText(es.admin.careTeams.primary).length).toBeGreaterThan(0);
    expect(within(table).getByText(es.admin.careTeams.secondary)).toBeInTheDocument();

    const load = screen.getByRole('list', { name: es.admin.careTeams.loadCaption });
    expect(within(load).getByText(format(es.admin.careTeams.patientCount, { count: 2 }))).toBeInTheDocument();
    expect(within(load).getByText(format(es.admin.careTeams.patientCount, { count: 1 }))).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('shows the empty state when there are no active assignments', async () => {
    seedRoster();
    server.use(http.get(apiUrl('/care-team/assignments'), () => HttpResponse.json({ items: [], next_cursor: null })));
    renderApp('/admin/care-teams');
    expect(await screen.findByRole('heading', { name: es.admin.careTeams.empty })).toBeInTheDocument();
  });
});

describe('staff', () => {
  const STAFF: StaffUserDto[] = [
    { id: DOCTOR_ID, full_name: 'Mauricio Henao', email: 'mauricio.henao@example.test', role: 'DOCTOR', status: 'ACTIVE', patients_count: 2 },
    { id: SECOND_DOCTOR_ID, full_name: 'Carolina Ruiz', email: 'carolina.ruiz@example.test', role: 'DOCTOR', status: 'INACTIVE', patients_count: 0 },
    { id: ADMIN_ACCOUNT.id, full_name: ADMIN_ACCOUNT.fullName, email: ADMIN_ACCOUNT.email, role: 'CLINIC_ADMIN', status: 'ACTIVE', patients_count: 0 },
  ];

  beforeEach(() => {
    server.use(
      http.get(apiUrl('/users'), ({ request }) => {
        const role = new URL(request.url).searchParams.get('role');
        const items = role === null ? STAFF : STAFF.filter((member) => member.role === role);
        return HttpResponse.json({ items, next_cursor: null });
      }),
    );
  });

  it('lists doctors and admins with role, status and patients per doctor', async () => {
    const { container } = renderApp('/admin/staff');
    const table = await screen.findByRole('table', { name: es.admin.staff.doctorsCaption });
    expect(within(table).getByText('Mauricio Henao')).toBeInTheDocument();
    expect(within(table).getByText(es.admin.staff.roleAdmin)).toBeInTheDocument();
    expect(within(table).getByText(es.admin.staff.inactive)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('filters by role', async () => {
    renderApp('/admin/staff');
    const table = await screen.findByRole('table', { name: es.admin.staff.doctorsCaption });
    await userEvent.selectOptions(screen.getByRole('combobox', { name: es.admin.staff.filterRole }), 'CLINIC_ADMIN');
    await waitFor(() => { expect(within(table).queryByText('Mauricio Henao')).toBeNull(); });
    expect(within(table).getByText(ADMIN_ACCOUNT.fullName)).toBeInTheDocument();
  });
});

