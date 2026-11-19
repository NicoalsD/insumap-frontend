import type { ImportBatchDto, ImportRowDto } from '../dto/admin';
import type { ViewModelAdapter } from './ViewModelAdapter';

export interface ImportBatchViewModel {
  readonly id: string;
  readonly source: ImportBatchDto['source'];
  readonly status: string;
  readonly totals: {
    readonly valid: number;
    readonly warning: number;
    readonly error: number;
    readonly skippedDuplicate: number;
    readonly all: number;
  };
  /** Only valid rows become patients on confirmation. */
  readonly canConfirm: boolean;
  readonly simulated: boolean;
}

export interface ImportRowViewModel {
  readonly rowNumber: number;
  readonly status: ImportRowDto['status'];
  readonly issueCodes: readonly string[];
  readonly patientId: string | null;
}

/**
 * Import preview or batch summary for the admin console.
 *
 * Pattern: P06 Adapter
 */
export class ImportBatchViewModelAdapter implements ViewModelAdapter<ImportBatchDto, ImportBatchViewModel> {
  adapt(dto: ImportBatchDto): ImportBatchViewModel {
    const { valid, warning, error, skipped_duplicate: skippedDuplicate } = dto.totals;
    return {
      id: dto.batch_id,
      source: dto.source,
      status: dto.status,
      totals: { valid, warning, error, skippedDuplicate, all: valid + warning + error + skippedDuplicate },
      canConfirm: valid + warning > 0,
      simulated: dto.simulated,
    };
  }
}

/**
 * Per-row validation result of an import.
 *
 * Pattern: P06 Adapter
 */
export class ImportRowViewModelAdapter implements ViewModelAdapter<ImportRowDto, ImportRowViewModel> {
  adapt(dto: ImportRowDto): ImportRowViewModel {
    return {
      rowNumber: dto.row_number,
      status: dto.status,
      issueCodes: dto.issue_codes,
      patientId: dto.patient_id,
    };
  }
}
