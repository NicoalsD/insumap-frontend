import type { ReactNode } from 'react';
import { WidgetLeaf, type DashboardWidget } from '@/core/dashboard/DashboardWidget';
import { TRIAGE_SPANS } from './triageLayout';

export interface WidgetTreeProps {
  /** Pruned layout tree (already filtered by permissions). */
  readonly node: DashboardWidget;
  /** Painters by widget `kind`. A kind without a painter renders nothing, never a placeholder. */
  readonly painters: Readonly<Record<string, ReactNode>>;
}

/**
 * Renders a layout tree (Composite): a group becomes the 12-column grid, each child takes the span
 * from `TRIAGE_SPANS`, and a leaf becomes the painter registered for its kind.
 *
 * Pattern: P08 Composite
 */
export function WidgetTree({ node, painters }: WidgetTreeProps) {
  if (node instanceof WidgetLeaf) return <>{painters[node.kind] ?? null}</>;
  if (!node.isComposite()) return null;
  return (
    <div className="grid-12" data-widget={node.id}>
      {node.children.map((child) => {
        const span = TRIAGE_SPANS[child.id];
        const style = span ? ({ '--span': span.span, '--span-md': span.spanMd } as React.CSSProperties) : undefined;
        return (
          <div key={child.id} className="triage-block" data-widget={child.id} style={style}>
            <WidgetTree node={child} painters={painters} />
          </div>
        );
      })}
    </div>
  );
}
