import type { TreatmentScheduleItemDto } from '@/services/dto/care';
import type { ActivePlan } from '../types';

/**
 * Insulin items of the active plan, in schedule order. The overview's plan carries its items as
 * `schedule` once the contract publishes them (`treatmentScheduleItemSchema`); until then the
 * field is absent and the list is empty, which the panel says rather than inventing items.
 *
 * Pattern: none (plain function; tested in planItems.test.ts).
 */
export function planInsulinItems(plan: ActivePlan | null): readonly TreatmentScheduleItemDto[] {
  if (!plan) return [];
  const withSchedule = plan as ActivePlan & { readonly schedule?: readonly TreatmentScheduleItemDto[] };
  return (withSchedule.schedule ?? []).filter((item) => item.insulin_kind !== null);
}
