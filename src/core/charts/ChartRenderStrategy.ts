/** A strategy identifier that also carries its input and model types. */
export type ChartKind<TInput, TModel> = string & {
  readonly __input?: TInput;
  readonly __model?: TModel;
};

/** Declares a typed chart kind. */
export function chartKind<TInput, TModel>(name: string): ChartKind<TInput, TModel> {
  return name;
}

/**
 * Turns domain data into a framework-free chart model (geometry, labels, states).
 * React components only paint the model, so each chart is testable without a DOM.
 *
 * Pattern: P19 Strategy
 */
export interface ChartRenderStrategy<TInput, TModel> {
  /** Stable identifier the renderer uses to pick this strategy. */
  readonly kind: ChartKind<TInput, TModel>;
  render(input: TInput): TModel;
}

/**
 * Context of the Strategy pattern: holds the registered strategies and delegates to the one
 * asked for. New charts (AGP, timeline, forecast) register a strategy; callers do not change.
 *
 * Pattern: P19 Strategy
 */
export class ChartRenderer {
  private readonly strategies = new Map<string, ChartRenderStrategy<unknown, unknown>>();

  register<TInput, TModel>(strategy: ChartRenderStrategy<TInput, TModel>): this {
    if (this.strategies.has(strategy.kind)) {
      throw new Error(`Chart strategy already registered: ${strategy.kind}`);
    }
    this.strategies.set(strategy.kind, strategy);
    return this;
  }

  has(kind: string): boolean {
    return this.strategies.has(kind);
  }

  render<TInput, TModel>(kind: ChartKind<TInput, TModel>, input: TInput): TModel {
    const strategy = this.strategies.get(kind);
    if (!strategy) throw new Error(`No chart strategy for kind: ${kind}`);
    return strategy.render(input) as TModel;
  }
}
