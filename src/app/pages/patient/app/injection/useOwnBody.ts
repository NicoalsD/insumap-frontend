import type { PatientSex } from '@/services/dto/injection';
import { useOwnOverview } from '../patientQueries';

/** The patient's recorded sex and BMI, from the overview the home already loaded (no extra request). */
export function useOwnBody(): { readonly sex: PatientSex; readonly bmi: number | null } {
  const overview = useOwnOverview('14d');
  return { sex: overview.data?.patient.sex ?? 'UNKNOWN', bmi: overview.data?.patient.bmi ?? null };
}
