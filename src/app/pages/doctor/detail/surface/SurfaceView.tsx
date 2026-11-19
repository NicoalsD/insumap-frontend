import { useEffect, useMemo, useRef } from 'react';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { classifyGlucose, RANGE_STATES, type GlucoseThresholds, type RangeState } from '@/core/glucose/thresholds';
import { SURFACE_CANVAS_ID, SURFACE_CELL_SPACING, SURFACE_HEIGHT_SCALE } from '../constants';
import { parseHexColor, type Rgb } from '../model/color';
import { buildSurfaceMesh, heightOfValue, type SurfaceGrid } from '../model/surface';
import { buildSurfaceLabels } from '../model/surfaceLabels';
import { formatDayKey } from '../format';
import { createSurfaceScene, type SurfaceScene } from './surfaceScene';
import './SurfaceView.css';

/** Used only when a token is not resolved (no stylesheet, for example in a test). */
const HALF = 0.5;
const NEUTRAL_FALLBACK: Rgb = [HALF, HALF, HALF];
/** Distance of the wall labels from the floor edge, in scene units. */
const LABEL_OFFSET = 0.3;
const RANGE_TOKEN: Record<RangeState, string> = {
  VERY_LOW: '--color-range-very-low',
  LOW: '--color-range-low',
  IN_RANGE: '--color-range-in-range',
  HIGH: '--color-range-high',
  VERY_HIGH: '--color-range-very-high',
};

/** Reads the range colors from the design tokens, so dark mode follows the page. */
function readRangeColors(): Record<RangeState, Rgb> {
  const style = getComputedStyle(document.documentElement);
  const entries = RANGE_STATES.map((state) => [
    state,
    parseHexColor(style.getPropertyValue(RANGE_TOKEN[state]), NEUTRAL_FALLBACK),
  ] as const);
  return Object.fromEntries(entries) as Record<RangeState, Rgb>;
}

function readToken(name: string, fallback: string): string {
  const value = getComputedStyle(document.documentElement).getPropertyValue(name).trim();
  return value === '' ? fallback : value;
}

export interface SurfaceViewProps {
  readonly grid: SurfaceGrid;
  readonly thresholds: GlucoseThresholds;
  /** Value domain of the height: the readings and the target cut points together. */
  readonly domain: { readonly min: number; readonly max: number };
  readonly cursor: { readonly day: number; readonly hour: number } | null;
  readonly resetToken: number;
  readonly onHover: (cell: { readonly day: number; readonly hour: number } | null) => void;
  /** Called when WebGL cannot start; the section then shows its textual alternative only. */
  readonly onUnavailable: () => void;
  readonly label: string;
}

/**
 * Canvas of the glucose surface. Creates the three.js scene once per grid and disposes it when the
 * grid changes or the screen leaves. Keyboard focus lands on the canvas; arrow keys rotate it.
 *
 * Pattern: none (React wrapper around `createSurfaceScene`).
 */
export function SurfaceView(props: SurfaceViewProps) {
  const { grid, thresholds, domain, cursor, resetToken, onHover, onUnavailable, label } = props;
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const sceneRef = useRef<SurfaceScene | null>(null);
  const labelLayerRef = useRef<HTMLDivElement>(null);
  const hoverRef = useRef(onHover);
  const unavailableRef = useRef(onUnavailable);
  useEffect(() => {
    hoverRef.current = onHover;
    unavailableRef.current = onUnavailable;
  }, [onHover, onUnavailable]);

  const labels = useMemo(
    () =>
      buildSurfaceLabels({
        grid,
        cellSpacing: SURFACE_CELL_SPACING,
        target: { low: thresholds.rangeLowMgDl, high: thresholds.rangeHighMgDl },
        heightOf: (value) => heightOfValue(value, domain, SURFACE_HEIGHT_SCALE),
        text: {
          hour: (hour) => format(es.detail.agp.hourTick, { hour }),
          day: formatDayKey,
          value: (valueMgDl) => format(es.glucose.value, { value: valueMgDl }),
          hourAxis: es.detail.surface.hourAxis,
          dayAxis: es.detail.surface.dayAxis,
          target: es.detail.surface.targetLabel,
        },
        offset: LABEL_OFFSET,
      }),
    [grid, thresholds, domain],
  );

  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelLayerRef.current;
    if (!canvas || !labelLayer) return;
    const colors = readRangeColors();
    const heightOf = (value: number) => heightOfValue(value, domain, SURFACE_HEIGHT_SCALE);
    const mesh = buildSurfaceMesh(grid, {
      heightOf,
      colorOf: (value) => colors[classifyGlucose(value, thresholds)],
      cellSpacing: SURFACE_CELL_SPACING,
    });
    const scene = createSurfaceScene({
      canvas,
      grid,
      mesh,
      targetHeights: {
        low: heightOf(thresholds.rangeLowMgDl),
        high: heightOf(thresholds.rangeHighMgDl),
      },
      heightOfCell: (day, hour) => heightOf(grid.cells[day]?.[hour]?.mean ?? domain.min),
      cellSpacing: SURFACE_CELL_SPACING,
      axisColor: readToken('--color-border-strong', '#6e739f'),
      targetColor: readToken('--color-range-in-range', '#2a7d43'),
      cursorColor: readToken('--color-text', '#15173a'),
      onHover: (cell) => {
        hoverRef.current(cell);
      },
      labels,
      labelLayer,
    });
    if (!scene) {
      unavailableRef.current();
      return;
    }
    sceneRef.current = scene;
    return () => {
      scene.dispose();
      sceneRef.current = null;
    };
  }, [grid, thresholds, domain, labels]);

  useEffect(() => {
    sceneRef.current?.setCursor(cursor);
  }, [cursor]);

  useEffect(() => {
    if (resetToken > 0) sceneRef.current?.resetView();
  }, [resetToken]);

  return (
    <div className="surface-view">
      <canvas
        ref={canvasRef}
        id={SURFACE_CANVAS_ID}
        className="surface-view__canvas"
        tabIndex={0}
        role="application"
        aria-label={label}
      />
      <div ref={labelLayerRef} className="surface-view__labels" aria-hidden="true" />
    </div>
  );
}
