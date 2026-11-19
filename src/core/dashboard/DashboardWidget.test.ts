import { describe, expect, it } from 'vitest';
import { WidgetGroup, WidgetLeaf } from './DashboardWidget';

const layout = () =>
  new WidgetGroup('doctor-home', 'sidebar').add(
    new WidgetGroup('main', 'stack').add(
      new WidgetLeaf('triage', 'triage-table', 'dashboard.read_assigned'),
      new WidgetLeaf('recommendations', 'ai-recommendations', 'recommendations.read_assigned'),
    ),
    new WidgetGroup('side', 'stack').add(new WidgetLeaf('alerts', 'open-alerts', 'alerts.read_assigned')),
  );

describe('DashboardWidget (P08 Composite)', () => {
  it('treats leaves and groups uniformly', () => {
    const tree = layout();
    expect(tree.isComposite()).toBe(true);
    expect(new WidgetLeaf('x', 'k').isComposite()).toBe(false);
    expect(tree.leaves().map((leaf) => leaf.id)).toEqual(['triage', 'recommendations', 'alerts']);
    expect(new WidgetLeaf('solo', 'k').leaves().map((l) => l.id)).toEqual(['solo']);
  });

  it('finds nodes at any depth', () => {
    expect(layout().find('alerts')).toBeInstanceOf(WidgetLeaf);
    expect(layout().find('main')).toBeInstanceOf(WidgetGroup);
    expect(layout().find('nope')).toBeNull();
  });

  it('prunes what the permissions do not allow and drops empty groups', () => {
    const visible = layout().visibleFor(new Set(['dashboard.read_assigned']));
    expect(visible?.leaves().map((leaf) => leaf.id)).toEqual(['triage']);
    expect(visible?.find('side')).toBeNull();
    expect(layout().visibleFor(new Set())).toBeNull();
  });

  it('does not mutate the original tree when pruning', () => {
    const tree = layout();
    tree.visibleFor(new Set(['alerts.read_assigned']));
    expect(tree.leaves()).toHaveLength(3);
  });

  it('removes nested nodes and rejects duplicated ids', () => {
    const tree = layout();
    expect(tree.remove('recommendations')).toBe(true);
    expect(tree.remove('missing')).toBe(false);
    expect(tree.leaves().map((leaf) => leaf.id)).toEqual(['triage', 'alerts']);
    expect(() => tree.add(new WidgetLeaf('alerts', 'dup'))).toThrow(/Duplicate/);
  });

  it('hides a whole group behind its own permission', () => {
    const group = new WidgetGroup('admin', 'stack', 'patients.import').add(new WidgetLeaf('imports', 'imports'));
    expect(group.visibleFor(new Set(['dashboard.read_assigned']))).toBeNull();
  });
});
