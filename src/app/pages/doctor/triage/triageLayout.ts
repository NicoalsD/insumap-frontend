import { WidgetGroup, WidgetLeaf } from '@/core/dashboard/DashboardWidget';
import { PERMISSIONS, type PermissionCode } from '@/core/auth/permissions';

export const TRIAGE_WIDGET = {
  root: 'triage',
  openAlerts: 'open-alerts',
  queue: 'triage-queue',
  preview: 'patient-preview',
} as const;

/** Every block takes the full 12-column width: the queue must dominate, nothing narrows it. */
const FULL_SPAN = 12;
/** Open alerts sit under the queue beside the preview of the selected patient. */
const ALERTS_SPAN = 7;

export interface WidgetSpan {
  readonly span: number;
  readonly spanMd: number;
}

export const TRIAGE_SPANS: Readonly<Record<string, WidgetSpan>> = {
  [TRIAGE_WIDGET.queue]: { span: FULL_SPAN, spanMd: FULL_SPAN },
  [TRIAGE_WIDGET.openAlerts]: { span: ALERTS_SPAN, spanMd: FULL_SPAN },
  [TRIAGE_WIDGET.preview]: { span: FULL_SPAN - ALERTS_SPAN, spanMd: FULL_SPAN },
};

/**
 * Layout tree of the triage screen (Composite), read top to bottom: the full-width queue first (it
 * owns the top-left of the screen), then open alerts and the selected patient's preview side by side. A side rail would
 * narrow the table, so none is used. Each node carries the permission that shows it.
 *
 * Pattern: P08 Composite
 */
export function buildTriageLayout(): WidgetGroup {
  return new WidgetGroup(TRIAGE_WIDGET.root, 'stack')
    .add(new WidgetLeaf(TRIAGE_WIDGET.queue, TRIAGE_WIDGET.queue, PERMISSIONS.triageRead))
    .add(new WidgetLeaf(TRIAGE_WIDGET.openAlerts, TRIAGE_WIDGET.openAlerts, PERMISSIONS.alertsRead))
    .add(new WidgetLeaf(TRIAGE_WIDGET.preview, TRIAGE_WIDGET.preview, PERMISSIONS.patientRead));
}

/** Permission codes the session holds, as the set the layout prunes with. */
export function permissionSet(can: (permission: PermissionCode) => boolean): ReadonlySet<string> {
  return new Set(Object.values(PERMISSIONS).filter((permission) => can(permission)));
}
