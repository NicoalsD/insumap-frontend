/**
 * A node of a dashboard layout: either one widget (leaf) or a group of widgets (composite).
 * Screens declare their layout as a tree and render it recursively; permission pruning,
 * lookups and enumeration work the same on a single widget or a whole section.
 *
 * Pattern: P08 Composite
 */
export abstract class DashboardWidget {
  constructor(
    readonly id: string,
    /** Permission code from `/auth/current-user` needed to show this node; `null` means always. */
    readonly requiredPermission: string | null = null,
  ) {}

  abstract isComposite(): this is WidgetGroup;

  /** Copy of this node without what the permissions do not allow; `null` if nothing is left. */
  abstract visibleFor(permissions: ReadonlySet<string>): DashboardWidget | null;

  /** Every leaf below (or this node itself), in document order. */
  abstract leaves(): readonly WidgetLeaf[];

  find(id: string): DashboardWidget | null {
    return this.id === id ? this : null;
  }

  protected allowed(permissions: ReadonlySet<string>): boolean {
    return this.requiredPermission === null || permissions.has(this.requiredPermission);
  }
}

/** One widget. `kind` keys the React component that paints it. */
export class WidgetLeaf extends DashboardWidget {
  constructor(
    id: string,
    readonly kind: string,
    requiredPermission: string | null = null,
  ) {
    super(id, requiredPermission);
  }

  isComposite(): this is WidgetGroup {
    return false;
  }

  visibleFor(permissions: ReadonlySet<string>): WidgetLeaf | null {
    return this.allowed(permissions) ? this : null;
  }

  leaves(): readonly WidgetLeaf[] {
    return [this];
  }
}

export type WidgetGroupLayout = 'stack' | 'row' | 'sidebar';

/** A group of widgets laid out together (a column, a row, main content plus a side panel). */
export class WidgetGroup extends DashboardWidget {
  private readonly items: DashboardWidget[] = [];

  constructor(
    id: string,
    readonly layout: WidgetGroupLayout = 'stack',
    requiredPermission: string | null = null,
  ) {
    super(id, requiredPermission);
  }

  get children(): readonly DashboardWidget[] {
    return this.items;
  }

  add(...widgets: DashboardWidget[]): this {
    for (const widget of widgets) {
      if (this.find(widget.id) ?? widget.leaves().some((leaf) => this.find(leaf.id))) {
        throw new Error(`Duplicate dashboard widget id: ${widget.id}`);
      }
      this.items.push(widget);
    }
    return this;
  }

  remove(id: string): boolean {
    const index = this.items.findIndex((widget) => widget.id === id);
    if (index >= 0) {
      this.items.splice(index, 1);
      return true;
    }
    return this.items.some((widget) => widget.isComposite() && widget.remove(id));
  }

  isComposite(): this is WidgetGroup {
    return true;
  }

  override find(id: string): DashboardWidget | null {
    if (this.id === id) return this;
    for (const widget of this.items) {
      const found = widget.find(id);
      if (found) return found;
    }
    return null;
  }

  visibleFor(permissions: ReadonlySet<string>): WidgetGroup | null {
    if (!this.allowed(permissions)) return null;
    const copy = new WidgetGroup(this.id, this.layout, this.requiredPermission);
    for (const widget of this.items) {
      const visible = widget.visibleFor(permissions);
      if (visible) copy.items.push(visible);
    }
    return copy.items.length > 0 ? copy : null;
  }

  leaves(): readonly WidgetLeaf[] {
    return this.items.flatMap((widget) => widget.leaves());
  }
}
