import { describe, expect, it } from 'vitest';
import { es } from '@/i18n/es';
import type { ImportBatchViewModel, ImportRowViewModel } from '@/services/adapters/ImportViewModelAdapters';
import { ApiError } from '@/services/api/ApiError';
import {
  buildCsvTemplate,
  sizeParts,
  validateImportFile,
  CSV_TEMPLATE_HEADER,
} from './importFile';
import { analysisErrorMessage, batchStatusTone, issueMessage } from './importMessages';
import { buildErrorReportCsv, confirmGate, csvCell, formatBatchDate, patientsToCreate, warningPatientCount } from './importModel';

const t = es.adminImports;

function batch(overrides: Partial<ImportBatchViewModel['totals']> & { status?: string } = {}): ImportBatchViewModel {
  const valid = overrides.valid ?? 0;
  const warning = overrides.warning ?? 0;
  const error = overrides.error ?? 0;
  const skippedDuplicate = overrides.skippedDuplicate ?? 0;
  return {
    id: 'b1',
    source: 'CSV',
    status: overrides.status ?? 'PREVIEW',
    totals: { valid, warning, error, skippedDuplicate, all: valid + warning + error + skippedDuplicate },
    canConfirm: valid + warning > 0,
    simulated: false,
  };
}

describe('validateImportFile', () => {
  const limits = { patient_csv_max_bytes: 10, fhir_bundle_max_bytes: 20 };

  it('rejects an empty file before any other check', () => {
    expect(validateImportFile({ name: 'a.csv', size: 0, type: 'text/csv' }, 'CSV', limits)).toBe('EMPTY');
  });

  it('rejects a file whose extension does not match the chosen format', () => {
    expect(validateImportFile({ name: 'a.json', size: 1, type: '' }, 'CSV', limits)).toBe('WRONG_TYPE');
    expect(validateImportFile({ name: 'a.csv', size: 1, type: '' }, 'FHIR', limits)).toBe('WRONG_TYPE');
  });

  it('rejects a known MIME type that does not match, but accepts an unknown one', () => {
    expect(validateImportFile({ name: 'a.csv', size: 1, type: 'image/png' }, 'CSV', limits)).toBe('WRONG_TYPE');
    expect(validateImportFile({ name: 'a.csv', size: 1, type: '' }, 'CSV', limits)).toBeNull();
    expect(validateImportFile({ name: 'a.CSV', size: 1, type: 'text/csv' }, 'CSV', limits)).toBeNull();
  });

  it('checks size against the limit the API published for each format', () => {
    expect(validateImportFile({ name: 'a.csv', size: 10, type: '' }, 'CSV', limits)).toBeNull();
    expect(validateImportFile({ name: 'a.csv', size: 11, type: '' }, 'CSV', limits)).toBe('TOO_LARGE');
    expect(validateImportFile({ name: 'b.json', size: 20, type: '' }, 'FHIR', limits)).toBeNull();
  });

  it('leaves the size to the server when the API did not publish a limit', () => {
    expect(validateImportFile({ name: 'a.csv', size: 999_999_999, type: '' }, 'CSV', {})).toBeNull();
  });
});

describe('sizeParts and the template', () => {
  it('picks the unit a clinic admin reads', () => {
    expect(sizeParts(500)).toEqual({ unit: 'bytes', value: 500 });
    expect(sizeParts(2048)).toEqual({ unit: 'kilobytes', value: 2 });
    expect(sizeParts(2 * 1024 * 1024)).toEqual({ unit: 'megabytes', value: 2 });
    expect(sizeParts(1.5 * 1024 * 1024)).toEqual({ unit: 'megabytes', value: 1.5 });
  });

  it('writes the CSV header with the required columns first', () => {
    expect(buildCsvTemplate()).toBe(`${CSV_TEMPLATE_HEADER}\n`);
    expect(CSV_TEMPLATE_HEADER.startsWith('mrn,birth_date')).toBe(true);
  });
});

describe('confirmGate', () => {
  it('is ready when there are importable rows and no errors', () => {
    expect(confirmGate(batch({ valid: 2, warning: 1, skippedDuplicate: 1 }), 3)).toBe('READY');
  });

  it('blocks the whole batch while any row has an error, even with valid rows', () => {
    expect(confirmGate(batch({ valid: 5, error: 1 }), 5)).toBe('BLOCKED_BY_ERRORS');
  });

  it('has nothing to import when every row is a duplicate', () => {
    expect(confirmGate(batch({ skippedDuplicate: 3 }), 0)).toBe('NOTHING_TO_IMPORT');
  });

  it('recognizes an imported batch in either spelling of the status', () => {
    expect(confirmGate(batch({ valid: 1, status: 'COMPLETED' }), 1)).toBe('ALREADY_IMPORTED');
    expect(confirmGate(batch({ valid: 1, status: 'CONFIRMED' }), 1)).toBe('ALREADY_IMPORTED');
  });

  it('counts only the warning rows that are patients', () => {
    const warningRows: ImportRowViewModel[] = [
      { rowNumber: 2, status: 'WARNING', issueCodes: ['MISSING_EMAIL'], patientId: null },
      { rowNumber: 3, status: 'WARNING', issueCodes: ['NOT_A_PATIENT_RESOURCE'], patientId: null },
    ];
    expect(warningPatientCount(warningRows)).toBe(1);
    expect(patientsToCreate(batch({ valid: 1, warning: 2 }), 1)).toBe(2);
  });
});

describe('error report', () => {
  const labels = {
    columns: ['Fila', 'Estado', 'Código', 'Motivo'],
    rowStatus: (status: ImportRowViewModel['status']) => t.rowStatus[status],
    issue: issueMessage,
  };

  it('writes one line per row and issue code, with the row number and reason only', () => {
    const rows: ImportRowViewModel[] = [
      { rowNumber: 3, status: 'ERROR', issueCodes: ['MISSING_MRN', 'INVALID_BIRTH_DATE'], patientId: null },
    ];
    const csv = buildErrorReportCsv(rows, labels).split('\r\n');
    expect(csv[0]).toBe('Fila,Estado,Código,Motivo');
    expect(csv[1]).toBe(`3,${t.rowStatus.ERROR},MISSING_MRN,${issueMessage('MISSING_MRN')}`);
    expect(csv[2]).toContain('INVALID_BIRTH_DATE');
    expect(csv).toHaveLength(4);
  });

  it('quotes cells with commas and escapes quotes', () => {
    expect(csvCell('a, "b"')).toBe('"a, ""b"""');
  });

  it('neutralizes values that a spreadsheet would run as formulas', () => {
    expect(csvCell('=HYPERLINK("x")')).toBe(`"'=HYPERLINK(""x"")"`);
    expect(csvCell('+1')).toBe(`'+1`);
  });
});

describe('issue and status messages', () => {
  it('translates known issue codes and falls back for unknown ones', () => {
    expect(issueMessage('DUPLICATE_MRN')).toBe(t.issues.DUPLICATE_MRN);
    expect(issueMessage('SOMETHING_NEW')).toBe(t.issueUnknown);
    expect(issueMessage('constructor')).toBe(t.issueUnknown);
  });

  it('gives a tone to known batch statuses and neutral to the rest', () => {
    expect(batchStatusTone('COMPLETED')).toBe('success');
    expect(batchStatusTone('REJECTED')).toBe('critical');
    expect(batchStatusTone('OPEN')).toBe('neutral');
  });

  it('names the missing CSV columns when the API reports them', () => {
    const error = ApiError.fromBody(422, {
      error: {
        code: 'VALIDATION_ERROR',
        message: 'x',
        detail: { errors: [{ field: 'column.mrn', type: 'missing' }, { field: 'column.birth_date', type: 'missing' }] },
      },
    });
    expect(analysisErrorMessage(error, 'CSV')).toBe(
      t.file.missingColumns.replace('{columns}', 'mrn, birth_date'),
    );
  });

  it('maps the upload codes of the API to the file problem, not the raw code', () => {
    const unsupported = ApiError.fromBody(415, { error: { code: 'UNSUPPORTED_MEDIA_TYPE', message: 'x', detail: {} } });
    expect(analysisErrorMessage(unsupported, 'FHIR')).toBe(t.file.unsupportedType);
    const tooLarge = ApiError.fromBody(413, { error: { code: 'PAYLOAD_TOO_LARGE', message: 'x', detail: {} } });
    expect(analysisErrorMessage(tooLarge, 'CSV')).toBe(t.file.tooLargeServer);
  });
});

describe('formatBatchDate', () => {
  it('returns null for a missing or invalid date', () => {
    expect(formatBatchDate(undefined, 'America/Bogota')).toBeNull();
    expect(formatBatchDate('not a date', 'America/Bogota')).toBeNull();
  });

  it('formats in the clinic zone and survives an unknown zone', () => {
    const inBogota = formatBatchDate('2026-11-19T15:00:00Z', 'America/Bogota');
    expect(inBogota).toEqual(expect.stringContaining('10:00'));
    expect(formatBatchDate('2026-11-19T15:00:00Z', 'Mars/Olympus')).not.toBeNull();
  });
});
