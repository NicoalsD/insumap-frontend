import { describe, expect, it } from 'vitest';
import type { TimeInRanges } from '../glucose/timeInRanges';
import { ChartRenderer, chartKind, type ChartRenderStrategy } from './ChartRenderStrategy';
import { chartRenderer } from './chartRenderer';
import { GlucoseRulerStrategy, type GlucoseRulerModel } from './GlucoseRulerStrategy';
import { TimeInRangesBandStrategy, type RangeBandModel } from './TimeInRangesBandStrategy';

// Test-only profile; real values always come from the API target profile.
const thresholds = { veryLowMgDl: 54, rangeLowMgDl: 70, rangeHighMgDl: 180, veryHighMgDl: 250 };

const tir = (overrides: Partial<TimeInRanges> = {}): TimeInRanges => ({
  percentByState: { VERY_LOW: 1, LOW: 3, IN_RANGE: 71, HIGH: 20, VERY_HIGH: 5 },
  dataSufficiencyPct: 92,
  isSufficient: true,
  confidence: 'NORMAL',
  windowDays: 14,
  ...overrides,
});

describe('ChartRenderer (P19 context)', () => {
  it('delegates to the strategy registered for a kind', () => {
    const kind = chartKind<number, string>('echo');
    const echo: ChartRenderStrategy<number, string> = { kind, render: (n) => `#${n}` };
    const renderer = new ChartRenderer().register(echo);
    expect(renderer.has('echo')).toBe(true);
    expect(renderer.render(kind, 3)).toBe('#3');
  });

  it('rejects unknown and duplicated kinds', () => {
    const renderer = new ChartRenderer().register(new GlucoseRulerStrategy());
    expect(() => renderer.render(chartKind<object, unknown>('missing'), {})).toThrow(/No chart strategy/);
    expect(() => renderer.register(new GlucoseRulerStrategy())).toThrow(/already registered/);
  });

  it('ships the band and ruler strategies', () => {
    expect(chartRenderer.has(TimeInRangesBandStrategy.KIND)).toBe(true);
    expect(chartRenderer.has(GlucoseRulerStrategy.KIND)).toBe(true);
  });
});

describe('TimeInRangesBandStrategy', () => {
  const strategy = new TimeInRangesBandStrategy(9);

  it('builds proportional segments that add up to 100', () => {
    const model = strategy.render(tir());
    if (model.status !== 'ok') throw new Error('expected ok');
    expect(model.segments.map((s) => s.state)).toEqual(['VERY_LOW', 'LOW', 'IN_RANGE', 'HIGH', 'VERY_HIGH']);
    expect(model.segments.reduce((sum, s) => sum + s.widthPct, 0)).toBeCloseTo(100);
  });

  it('keeps labels inside only where they fit; the legend always lists all states', () => {
    const model = strategy.render(tir()) as Extract<RangeBandModel, { status: 'ok' }>;
    const inline = Object.fromEntries(model.segments.map((s) => [s.state, s.showInlineLabel]));
    expect(inline).toEqual({ VERY_LOW: false, LOW: false, IN_RANGE: true, HIGH: true, VERY_HIGH: false });
    expect(model.legend).toHaveLength(5);
  });

  it('drops 0 % segments from the bar but not from the legend', () => {
    const model = strategy.render(
      tir({ percentByState: { VERY_LOW: 0, LOW: 0, IN_RANGE: 90, HIGH: 10, VERY_HIGH: 0 } }),
    ) as Extract<RangeBandModel, { status: 'ok' }>;
    expect(model.segments.map((s) => s.state)).toEqual(['IN_RANGE', 'HIGH']);
    expect(model.legend.find((l) => l.state === 'VERY_LOW')?.percent).toBe(0);
  });

  it('refuses to draw percentages with insufficient data', () => {
    expect(strategy.render(tir({ isSufficient: false, dataSufficiencyPct: 31 }))).toEqual({
      status: 'insufficient',
      dataSufficiencyPct: 31,
    });
  });

  it('flags low confidence', () => {
    const model = strategy.render(tir({ confidence: 'LOW_CONFIDENCE' }));
    expect(model.status === 'ok' && model.lowConfidence).toBe(true);
  });
});

describe('GlucoseRulerStrategy', () => {
  const strategy = new GlucoseRulerStrategy();
  const at = (valueMgDl: number): GlucoseRulerModel => strategy.render({ valueMgDl, thresholds });

  it('draws five equal bands', () => {
    expect(at(100).bands.map((b) => b.widthPct)).toEqual([20, 20, 20, 20, 20]);
  });

  it('places in-range values proportionally inside the in-range band', () => {
    expect(at(70).markerPct).toBeCloseTo(40);
    expect(at(125).markerPct).toBeCloseTo(50);
    expect(at(180).markerPct).toBeCloseTo(60);
    expect(at(125).state).toBe('IN_RANGE');
  });

  it('places low and high values in their bands', () => {
    expect(at(62).markerPct).toBeCloseTo(30);
    expect(at(215).markerPct).toBeCloseTo(70);
  });

  it('clamps values beyond the mirrored open-ended bands', () => {
    expect(at(20)).toMatchObject({ state: 'VERY_LOW', markerPct: 0, clamped: 'below' });
    expect(at(400)).toMatchObject({ state: 'VERY_HIGH', markerPct: 100, clamped: 'above' });
    expect(at(300).clamped).toBeNull();
  });

  it('exposes the cut points for tick labels', () => {
    expect(at(100).cutPoints).toEqual([54, 70, 180, 250]);
  });
});
