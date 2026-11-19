import { WidgetGroup, WidgetLeaf } from '@/core/dashboard/DashboardWidget';
import { PERMISSIONS, type PermissionCode } from '@/core/auth/permissions';

export const TRIAGE_WIDGET = {
  root: 'triage',
  map: 'patient-map',
  openAlerts: 'open-alerts',
  queue: 'triage-queue',
  preview: 'patient-preview',
} as const;

/** The queue and the alerts take the full 12-column width: nothing narrows the table. */
const FULL_SPAN = 12;
/** The 3D map opens the screen beside the preview of the patient it selects. */
const MAP_SPAN = 7;

export interface WidgetSpan {
  readonly span: number;
  readonly spanMd: number;
}

export const TRIAGE_SPANS: Readonly<Record<string, WidgetSpan>> = {
  [TRIAGE_WIDGET.map]: { span: MAP_SPAN, spanMd: FULL_SPAN },
  [TRIAGE_WIDGET.preview]: { span: FULL_SPAN - MAP_SPAN, spanMd: FULL_SPAN },
  [TRIAGE_WIDGET.queue]: { span: FULL_SPAN, spanMd: FULL_SPAN },
  [TRIAGE_WIDGET.openAlerts]: { span: FULL_SPAN, spanMd: FULL_SPAN },
};

/**
 * Layout tree of the triage screen (Composite), read top to bottom: the 3D map of the patients and
 * the preview of the one it selects, then the full-width queue (the same data as text) and the open
 * alerts. A side rail would narrow the table, so none is used. Each node carries its permission.
 *
 * Pattern: P08 Composite
 */
export function buildTriageLayout(): WidgetGroup {
  return new WidgetGroup(TRIAGE_WIDGET.root, 'stack')
    .add(new WidgetLeaf(TRIAGE_WIDGET.map, TRIAGE_WIDGET.map, PERMISSIONS.triageRead))
    .add(new WidgetLeaf(TRIAGE_WIDGET.preview, TRIAGE_WIDGET.preview, PERMISSIONS.patientRead))
    .add(new WidgetLeaf(TRIAGE_WIDGET.queue, TRIAGE_WIDGET.queue, PERMISSIONS.triageRead))
    .add(new WidgetLeaf(TRIAGE_WIDGET.openAlerts, TRIAGE_WIDGET.openAlerts, PERMISSIONS.alertsRead));
}

/** Permission codes the session holds, as the set the layout prunes with. */
export function permissionSet(can: (permission: PermissionCode) => boolean): ReadonlySet<string> {
  return new Set(Object.values(PERMISSIONS).filter((permission) => can(permission)));
}
