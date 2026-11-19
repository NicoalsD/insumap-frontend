import type { AlertDto } from '../dto/clinical';
import type { ViewModelAdapter } from './ViewModelAdapter';

export interface AlertViewModel {
  readonly id: string;
  readonly patientId: string;
  readonly patientName: string | null;
  readonly type: AlertDto['type'];
  readonly level: number | null;
  /** Priority as the API sends it (for example `HIGH` or `MEDIUM`), used to order the rail. */
  readonly priority: string;
  readonly status: AlertDto['status'];
  /** Open or escalated: still needs the doctor. */
  readonly needsAttention: boolean;
  readonly openedAt: Date;
  readonly isFallback: boolean;
}

/**
 * Alert row for the doctor's side panel and the patient's own list.
 *
 * Pattern: P06 Adapter
 */
export class AlertViewModelAdapter implements ViewModelAdapter<AlertDto, AlertViewModel> {
  adapt(dto: AlertDto): AlertViewModel {
    return {
      id: dto.id,
      patientId: dto.patient_id,
      patientName: dto.patient_name ?? null,
      type: dto.type,
      level: dto.level,
      priority: dto.priority,
      status: dto.status,
      needsAttention: dto.status === 'OPEN' || dto.status === 'ESCALATED',
      openedAt: new Date(dto.opened_at),
      isFallback: dto.is_fallback,
    };
  }
}
