import type { CareAssignmentViewModel } from './CareAssignmentViewModelAdapter';

export interface DoctorLoad {
  readonly doctorId: string;
  readonly doctorName: string | null;
  /** Distinct patients with an active assignment to this doctor, in any role. */
  readonly patientCount: number;
}

/** Name of each doctor that appears in an active assignment. Doctors without a name are left out. */
export function doctorNameMap(assignments: readonly CareAssignmentViewModel[]): ReadonlyMap<string, string> {
  const names = new Map<string, string>();
  for (const assignment of assignments) {
    if (assignment.doctorName !== null) names.set(assignment.doctorId, assignment.doctorName);
  }
  return names;
}

/** Patients per doctor, largest load first; ties are ordered by name. */
export function doctorLoads(assignments: readonly CareAssignmentViewModel[]): readonly DoctorLoad[] {
  const byDoctor = new Map<string, { name: string | null; patients: Set<string> }>();
  for (const assignment of assignments) {
    const entry = byDoctor.get(assignment.doctorId) ?? { name: null, patients: new Set<string>() };
    entry.name ??= assignment.doctorName;
    entry.patients.add(assignment.patientId);
    byDoctor.set(assignment.doctorId, entry);
  }
  return [...byDoctor.entries()]
    .map(([doctorId, entry]) => ({ doctorId, doctorName: entry.name, patientCount: entry.patients.size }))
    .sort((a, b) => b.patientCount - a.patientCount || (a.doctorName ?? '').localeCompare(b.doctorName ?? '', 'es-CO'));
}

/** Share of the largest load, from 0 to 1, for drawing the bars. */
export function loadShare(count: number, max: number): number {
  return max === 0 ? 0 : count / max;
}
