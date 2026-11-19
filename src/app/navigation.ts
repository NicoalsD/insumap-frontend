import {
  Activity,
  Bell,
  CalendarClock,
  ClipboardList,
  FileUp,
  House,
  KeyRound,
  Bot,
  MessageSquare,
  UserCog,
  Network,
  Users,
  type LucideIcon,
} from 'lucide-react';
import { PERMISSIONS, type PermissionCode, type Role } from '@/core/auth/permissions';
import { es } from '@/i18n/es';

export interface NavItem {
  readonly path: string;
  readonly label: string;
  readonly icon: LucideIcon;
  /** Hidden when the session lacks it. UX only: the server decides. */
  readonly permission?: PermissionCode;
}

export type ShellRole = 'DOCTOR' | 'CLINIC_ADMIN' | 'PATIENT';

/** Where each role lands after signing in. */
export const HOME_PATH: Record<ShellRole, string> = {
  DOCTOR: '/doctor/triage',
  CLINIC_ADMIN: '/admin/patients',
  PATIENT: '/patient',
};

export function homePathFor(role: Role): string {
  return role === 'PLATFORM_ADMIN' ? '/' : HOME_PATH[role];
}

/** Navigation of each shell. To add a screen to the rail, add an item here and its route in `routes.tsx`. */
export const NAV_ITEMS: Record<ShellRole, readonly NavItem[]> = {
  DOCTOR: [
    { path: '/doctor/triage', label: es.nav.triage, icon: Activity, permission: PERMISSIONS.triageRead },
    { path: '/doctor/alerts', label: es.nav.alerts, icon: Bell, permission: PERMISSIONS.alertsRead },
  ],
  CLINIC_ADMIN: [
    { path: '/admin/patients', label: es.nav.patients, icon: Users, permission: PERMISSIONS.patientsRoster },
    { path: '/admin/imports', label: es.nav.imports, icon: FileUp, permission: PERMISSIONS.patientsImport },
    { path: '/admin/credentials', label: es.nav.credentials, icon: KeyRound, permission: PERMISSIONS.credentialsIssue },
    { path: '/admin/care-teams', label: es.nav.careTeams, icon: Network, permission: PERMISSIONS.careTeamRead },
    { path: '/admin/staff', label: es.nav.staff, icon: UserCog },
  ],
  PATIENT: [
    { path: '/patient', label: es.nav.home, icon: House },
    { path: '/patient/readings', label: es.nav.readings, icon: ClipboardList, permission: PERMISSIONS.glucoseReadOwn },
    { path: '/patient/plan', label: es.nav.plan, icon: CalendarClock },
    { path: '/patient/messages', label: es.nav.messages, icon: MessageSquare },
    { path: '/patient/assistant', label: es.nav.assistant, icon: Bot },
  ],
};
