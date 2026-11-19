import { describe, expect, it } from 'vitest';
import { PERMISSIONS } from '@/core/auth/permissions';
import { WidgetGroup, WidgetLeaf } from '@/core/dashboard/DashboardWidget';
import { buildTriageLayout, permissionSet, TRIAGE_SPANS, TRIAGE_WIDGET } from './triageLayout';

const FULL_SPAN = 12;

const ALL = new Set<string>(Object.values(PERMISSIONS));

describe('triage layout (P08 Composite)', () => {
  it('opens with the map and the preview, then the queue and the open alerts', () => {
    const layout = buildTriageLayout();
    expect(layout).toBeInstanceOf(WidgetGroup);
    expect(layout.layout).toBe('stack');
    expect(layout.leaves().map((leaf) => leaf.id)).toEqual([
      TRIAGE_WIDGET.map,
      TRIAGE_WIDGET.preview,
      TRIAGE_WIDGET.queue,
      TRIAGE_WIDGET.openAlerts,
    ]);
  });

  it('gives the queue the full width and shares the first row between map and preview', () => {
    expect(TRIAGE_SPANS[TRIAGE_WIDGET.queue]?.span).toBe(FULL_SPAN);
    const shared = (TRIAGE_SPANS[TRIAGE_WIDGET.map]?.span ?? 0) + (TRIAGE_SPANS[TRIAGE_WIDGET.preview]?.span ?? 0);
    expect(shared).toBe(FULL_SPAN);
  });

  it('prunes the rail blocks the session may not read, and keeps the queue', () => {
    const noAlerts = new Set(ALL);
    noAlerts.delete(PERMISSIONS.alertsRead);
    const pruned = buildTriageLayout().visibleFor(noAlerts);
    expect(pruned?.leaves().map((leaf) => leaf.id)).toEqual([TRIAGE_WIDGET.map, TRIAGE_WIDGET.preview, TRIAGE_WIDGET.queue]);
    expect(TRIAGE_SPANS[TRIAGE_WIDGET.queue]?.span).toBe(FULL_SPAN);
  });

  it('shows nothing when the session has no triage permission', () => {
    expect(buildTriageLayout().visibleFor(new Set())).toBeNull();
  });

  it('builds the permission set from the session check, not from a guess', () => {
    const set = permissionSet((permission) => permission === PERMISSIONS.triageRead);
    expect([...set]).toEqual([PERMISSIONS.triageRead]);
  });

  it('keeps leaf ids unique', () => {
    expect(() => new WidgetGroup('x').add(new WidgetLeaf('a', 'a'), new WidgetLeaf('a', 'a'))).toThrow();
  });
});
