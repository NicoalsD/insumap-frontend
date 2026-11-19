import { screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { http, HttpResponse } from 'msw';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ADMIN_ACCOUNT, DEMO_TOTP_CODE } from '@/mocks/fixtures/people';
import { apiError } from '@/mocks/http';
import { mockState } from '@/mocks/MockState';
import { server } from '@/mocks/server';
import { es } from '@/i18n/es';
import { apiUrl } from '@/services/http/apiUrl';
import { expectNoAxeViolations } from '@/test/axe';
import { renderApp } from '@/test/renderApp';

const t = es.adminImports;
const LOGIN_TIMEOUT_MS = 5000;
const UTF8_BOM = '﻿';

const VALID_CSV = [
  'mrn,birth_date,email',
  'MRN-20001,1980-02-10,ana@example.test',
  'MRN-20002,1975-07-01,',
].join('\n');

const ERROR_CSV = [
  'mrn,birth_date,email',
  'MRN-20001,1980-02-10,ana@example.test',
  ',1980-02-10,sin-mrn@example.test',
  'MRN-20003,2026-13-45,fecha@example.test',
  'MRN-10001,1980-02-10,ya-existe@example.test',
].join('\n');

const FHIR_BUNDLE = JSON.stringify({
  resourceType: 'Bundle',
  type: 'collection',
  entry: [
    {
      resource: {
        resourceType: 'Patient',
        identifier: [{ value: 'MRN-20010' }],
        birthDate: '1990-01-01',
        telecom: [{ system: 'email', value: 'fhir@example.test' }],
      },
    },
    { resource: { resourceType: 'Observation', id: 'obs-1' } },
  ],
});

function csvFile(content: string, name = 'pacientes.csv'): File {
  return new File([content], name, { type: 'text/csv' });
}

/** Signs in as the clinic admin through the real form and MFA challenge, then opens the import screen. */
async function openImports() {
  const view = renderApp('/login');
  await userEvent.type(await screen.findByLabelText(es.access.login.email), ADMIN_ACCOUNT.email);
  await userEvent.type(screen.getByLabelText(es.access.login.password), ADMIN_ACCOUNT.password);
  await userEvent.click(screen.getByRole('button', { name: es.access.login.submit }));
  // Six digits submit the challenge on their own; waiting for the staff shell avoids racing that submit.
  await userEvent.type(await screen.findByLabelText(es.access.mfa.code), DEMO_TOTP_CODE);
  await screen.findByRole('navigation', { name: es.nav.main }, { timeout: LOGIN_TIMEOUT_MS });
  await view.router.navigate('/admin/imports');
  await screen.findByRole('heading', { level: 1, name: t.title });
  return view;
}

async function analyze(file: File, format?: 'FHIR') {
  if (format === 'FHIR') await userEvent.click(screen.getByRole('radio', { name: t.origin.fhirLabel }));
  await userEvent.upload(screen.getByLabelText(t.origin.chooseFile), file);
  await userEvent.click(screen.getByRole('button', { name: t.origin.analyze }));
  return screen.findByRole('table', { name: t.preview.tableCaption });
}

beforeEach(() => {
  vi.stubEnv('VITE_USE_MOCKS', 'true');
});

afterEach(() => {
  vi.unstubAllEnvs();
  vi.restoreAllMocks();
});

describe('import screen: CSV valid', () => {
  it('previews the rows, creates the patients and links to credentials', async () => {
    const { container } = await openImports();
    const table = await analyze(csvFile(VALID_CSV));

    expect(within(table).getAllByRole('row')).toHaveLength(3);
    expect(within(table).getByText(t.rowStatus.VALID)).toBeInTheDocument();
    expect(within(table).getByText(t.rowStatus.WARNING)).toBeInTheDocument();
    expect(within(table).getByText(t.issues.MISSING_EMAIL)).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await userEvent.click(screen.getByRole('button', { name: t.preview.continue }));
    const submit = await screen.findByRole('button', { name: 'Importar 2 pacientes' });
    expect(submit).toBeEnabled();
    await userEvent.click(submit);

    expect(await screen.findByText('Importación completada: 2 pacientes creados.')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: t.confirm.nextCredentials })).toHaveAttribute('href', '/admin/credentials');
    expect(mockState.world.patientAdmin.some((patient) => patient.mrn === 'MRN-20001')).toBe(true);
  });
});

describe('import screen: CSV with errors', () => {
  it('blocks the confirmation, explains why, and filters to the error rows', async () => {
    await openImports();
    const table = await analyze(csvFile(ERROR_CSV));

    expect(within(table).getAllByRole('row')).toHaveLength(5);
    expect(within(table).getByText(t.issues.MISSING_MRN)).toBeInTheDocument();
    expect(within(table).getByText(t.issues.INVALID_BIRTH_DATE)).toBeInTheDocument();
    expect(within(table).getByText(t.issues.DUPLICATE_MRN)).toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: t.preview.continue }));
    const submit = await screen.findByRole('button', { name: 'Importar 1 paciente' });
    expect(submit).toBeDisabled();
    expect(screen.getByText(/No se puede importar mientras haya filas con error \(2\)/)).toBeInTheDocument();
    expect(submit).toHaveAccessibleDescription(/filas con error/);

    await userEvent.click(screen.getByRole('button', { name: t.steps.review }));
    const reopened = await screen.findByRole('table', { name: t.preview.tableCaption });
    await userEvent.click(screen.getByRole('checkbox', { name: t.preview.onlyErrors }));
    await waitFor(() => {
      expect(within(reopened).queryByText(t.issues.DUPLICATE_MRN)).toBeNull();
    });
    expect(within(reopened).getAllByRole('row')).toHaveLength(3);
  });

  it('downloads the error report without personal data', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:error-report');
    const revokeObjectURL = vi.fn();
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: revokeObjectURL });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      /* the browser would start the download here; the test only checks the blob */
    });

    await openImports();
    await analyze(csvFile(ERROR_CSV));
    await userEvent.click(screen.getByRole('button', { name: t.preview.downloadReport }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });
    expect(click).toHaveBeenCalled();
    const blob = createObjectURL.mock.calls[0]?.[0];
    if (blob === undefined) throw new Error('no blob was created');
    const text = (await blob.text()).replace(UTF8_BOM, '');
    const lines = text.trimEnd().split('\r\n');
    expect(lines[0]).toBe(t.report.columns.join(','));
    expect(lines).toContain(`2,${t.rowStatus.ERROR},MISSING_MRN,${t.issues.MISSING_MRN}`);
    expect(lines.some((line) => line.startsWith('3,'))).toBe(true);
    expect(text).not.toContain('MRN-20003');
    expect(text).not.toContain('sin-mrn@example.test');
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:error-report');
  });
});

describe('import screen: FHIR R4 bundle', () => {
  it('counts only the patients that will be created', async () => {
    await openImports();
    const table = await analyze(new File([FHIR_BUNDLE], 'bundle.json', { type: 'application/fhir+json' }), 'FHIR');

    expect(within(table).getByText(t.issues.NOT_A_PATIENT_RESOURCE)).toBeInTheDocument();
    await userEvent.click(screen.getByRole('button', { name: t.preview.continue }));
    expect(await screen.findByRole('button', { name: 'Importar 1 paciente' })).toBeEnabled();
    expect(screen.getByText(t.confirm.ignored.replace('{count}', '1'))).toBeInTheDocument();
  });
});

describe('import screen: invalid files and server rejections', () => {
  it('rejects a file with the wrong extension before sending it', async () => {
    await openImports();
    await userEvent.upload(screen.getByLabelText(t.origin.chooseFile), csvFile('x', 'notas.txt'), {
      applyAccept: false,
    });
    expect(screen.getByRole('alert')).toHaveTextContent('no corresponde al formato elegido');
    expect(screen.getByRole('button', { name: t.origin.analyze })).toBeDisabled();
  });

  it('rejects an empty file', async () => {
    await openImports();
    await userEvent.upload(screen.getByLabelText(t.origin.chooseFile), csvFile(''));
    expect(screen.getByRole('alert')).toHaveTextContent(t.file.empty);
  });

  it('rejects a file above the size the API published', async () => {
    const limit = 20;
    mockState.limits['patient_csv_max_bytes'] = limit;
    await openImports();
    await screen.findByText(/Tamaño máximo/);
    await userEvent.upload(screen.getByLabelText(t.origin.chooseFile), csvFile(`mrn,birth_date\n${'x'.repeat(limit)}`));
    expect(screen.getByRole('alert')).toHaveTextContent('el límite es');
    expect(screen.getByRole('button', { name: t.origin.analyze })).toBeDisabled();
  });

  it('names the missing columns that the API reports', async () => {
    await openImports();
    await userEvent.upload(screen.getByLabelText(t.origin.chooseFile), csvFile('mrn,email\nMRN-1,a@example.test\n'));
    await userEvent.click(screen.getByRole('button', { name: t.origin.analyze }));
    expect(await screen.findByRole('alert')).toHaveTextContent('Al CSV le faltan columnas obligatorias: birth_date.');
  });
});

describe('import screen: states', () => {
  it('shows the loading state while the history is pending, then the empty state', async () => {
    let release: () => void = () => undefined;
    const gate = new Promise<void>((resolve) => {
      release = resolve;
    });
    server.use(
      http.get(apiUrl('/imports'), async () => {
        await gate;
        return HttpResponse.json({ items: [], next_cursor: null });
      }),
    );
    await openImports();
    expect(screen.getByText(t.history.loading)).toBeInTheDocument();
    release();
    expect(await screen.findByText(t.history.empty)).toBeInTheDocument();
  });

  it('shows an error with the reason when the history cannot load', async () => {
    server.use(http.get(apiUrl('/imports'), () => apiError('FORBIDDEN')));
    const { container } = await openImports();
    expect(await screen.findByText(t.history.loadError)).toBeInTheDocument();
    expect(screen.getByText(es.apiErrors.FORBIDDEN)).toBeInTheDocument();
    await expectNoAxeViolations(container);
  });

  it('marks a large batch and pages its rows', async () => {
    mockState.limits['page_size_default'] = 2;
    mockState.limits['page_size_max'] = 2;
    await openImports();
    const table = await analyze(csvFile([VALID_CSV, 'MRN-20003,1981-03-03,', 'MRN-20004,1982-04-04,'].join('\n')));

    expect(screen.getByText(/Lote grande: 4 filas/)).toBeInTheDocument();
    expect(within(table).getAllByRole('row')).toHaveLength(3);
    await userEvent.click(screen.getByRole('button', { name: t.preview.next }));
    await waitFor(() => {
      expect(within(table).getByText('4')).toBeInTheDocument();
    });
  });

  it('shows the batch history with status and counts, and reopens a batch', async () => {
    const { container } = await openImports();
    await analyze(csvFile(ERROR_CSV));
    await userEvent.click(screen.getByRole('button', { name: t.steps.change }));

    const history = await screen.findByRole('table', { name: t.history.caption });
    expect(within(history).getByText(t.batchStatus.PREVIEW)).toBeInTheDocument();
    expect(within(history).getByText(/2 con error/)).toBeInTheDocument();
    await expectNoAxeViolations(container);

    await userEvent.click(within(history).getByRole('button', { name: t.history.open }));
    expect(await screen.findByRole('table', { name: t.preview.tableCaption })).toBeInTheDocument();
  });

  it('downloads the CSV template from the origin step', async () => {
    const createObjectURL = vi.fn<(blob: Blob) => string>(() => 'blob:template');
    Object.defineProperty(URL, 'createObjectURL', { configurable: true, writable: true, value: createObjectURL });
    Object.defineProperty(URL, 'revokeObjectURL', { configurable: true, writable: true, value: vi.fn() });
    vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {
      /* the browser would start the download here; the test only checks the blob */
    });

    await openImports();
    await userEvent.click(screen.getByRole('button', { name: t.origin.templateButton }));

    await waitFor(() => {
      expect(createObjectURL).toHaveBeenCalledTimes(1);
    });
    const blob = createObjectURL.mock.calls[0]?.[0];
    if (blob === undefined) throw new Error('no blob was created');
    const text = (await blob.text()).replace(UTF8_BOM, '');
    expect(text).toBe('mrn,birth_date,email\n');
  });
});
