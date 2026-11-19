import { RotateCcw } from 'lucide-react';
import { useEffect, useMemo, useRef, useState, type KeyboardEvent } from 'react';
import type { GlucoseThresholds } from '@/core/glucose/thresholds';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Button } from '@/ui/Button';
import { canRender3D } from '@/ui/body/webglSupport';
import { usePrefersReducedMotion } from '@/ui/body/usePrefersReducedMotion';
import type { TriageItem } from '../triageModel';
import type { MapColors, MapLabel, MapPoint, MapRangeState, TriageMapScene } from './triageMapScene';
import './TriageMap.css';

const RANGE_STATES: readonly MapRangeState[] = ['VERY_LOW', 'LOW', 'IN_RANGE', 'HIGH', 'VERY_HIGH'];
const RANGE_TOKENS: Readonly<Record<MapRangeState, string>> = {
  VERY_LOW: '--color-range-very-low',
  LOW: '--color-range-low',
  IN_RANGE: '--color-range-in-range',
  HIGH: '--color-range-high',
  VERY_HIGH: '--color-range-very-high',
};
const LANES = ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'] as const;
const LEFT_EDGE = 0;
const RIGHT_EDGE = 100;
const MID_TIR = 50;
const TIR_TICKS = [LEFT_EDGE, MID_TIR, RIGHT_EDGE] as const;
const GLUCOSE_FLOOR = 40;
const GLUCOSE_TOP_TICK = 300;
const FRONT_LANE = 3.4;
/** The mg/dL title sits above the top tick. */
const AXIS_TITLE_LIFT = 100;
/** The band's label sits halfway between its cut points. */
const HALVES = 2;
const KEY_STEP = 0.12;
const TOOLTIP_OFFSET = 14;

function token(name: string): string {
  return getComputedStyle(document.documentElement).getPropertyValue(name).trim() || '#888888';
}

function readColors(): MapColors {
  const ranges = Object.fromEntries(RANGE_STATES.map((state) => [state, token(RANGE_TOKENS[state])])) as Record<
    MapRangeState,
    string
  >;
  return {
    ranges,
    noData: token('--color-text-disabled'),
    axis: token('--color-border-strong'),
    grid: token('--color-border'),
    target: token('--color-range-in-range'),
    selection: token('--color-primary'),
  };
}

function labelsFor(thresholds: GlucoseThresholds): MapLabel[] {
  const tir: MapLabel[] = TIR_TICKS.map((value) => ({
    text: format(es.doctor.triage.map.tick, { value }),
    kind: 'tick',
    at: [value, GLUCOSE_FLOOR, FRONT_LANE],
  }));
  const glucose: MapLabel[] = [thresholds.rangeLowMgDl, thresholds.rangeHighMgDl, GLUCOSE_TOP_TICK].map((value) => ({
    text: format('{value}', { value }),
    kind: 'tick',
    at: [LEFT_EDGE, value, FRONT_LANE],
  }));
  const lanes: MapLabel[] = LANES.map((tier, lane) => ({
    text: es.risk[tier],
    kind: 'tick',
    at: [RIGHT_EDGE, GLUCOSE_FLOOR, lane],
  }));
  return [
    ...tir,
    ...glucose,
    ...lanes,
    { text: es.doctor.triage.map.axisTir, kind: 'axis', at: [MID_TIR, GLUCOSE_FLOOR, FRONT_LANE + 1] },
    {
      text: format(es.doctor.triage.map.target, { low: thresholds.rangeLowMgDl, high: thresholds.rangeHighMgDl }),
      kind: 'axis',
      at: [RIGHT_EDGE, (thresholds.rangeLowMgDl + thresholds.rangeHighMgDl) / HALVES, 0],
    },
    { text: es.doctor.triage.map.axisGlucose, kind: 'axis', at: [LEFT_EDGE, GLUCOSE_TOP_TICK + AXIS_TITLE_LIFT, FRONT_LANE] },
  ];
}

export interface TriageMapProps {
  readonly rows: readonly TriageItem[];
  readonly selectedId: string | null;
  readonly onSelect: (patientId: string) => void;
}

/**
 * The doctor's patients in 3D: time in range, last glucose and risk at once, over the target band.
 * Hovering names the patient, a click selects it (the preview and the queue follow), dragging or
 * the arrow keys turn the view. The queue below carries the same data as text, so the map is never
 * the only way in; without WebGL the panel says so and the queue stays.
 */
export function TriageMap({ rows, selectedId, onSelect }: TriageMapProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const labelsRef = useRef<HTMLDivElement>(null);
  const sceneRef = useRef<TriageMapScene | null>(null);
  const onSelectRef = useRef(onSelect);
  const selectedIdRef = useRef(selectedId);
  const [supported] = useState(canRender3D);
  const reducedMotion = usePrefersReducedMotion();
  const [hover, setHover] = useState<{ id: string; x: number; y: number } | null>(null);
  const thresholds = rows[0]?.thresholds ?? null;

  useEffect(() => {
    onSelectRef.current = onSelect;
  }, [onSelect]);

  const points = useMemo<MapPoint[]>(
    () =>
      rows.map((row) => ({
        id: row.patientId,
        tirPct: row.tirPct,
        valueMgDl: row.lastReading?.valueMgDl ?? null,
        riskTier: row.riskTier,
        state: row.lastReading?.state ?? null,
        openAlerts: row.openAlertsCount,
      })),
    [rows],
  );

  // One scene per thresholds and motion preference; points and selection update it in place.
  useEffect(() => {
    const canvas = canvasRef.current;
    const labelLayer = labelsRef.current;
    if (!supported || !canvas || !labelLayer || !thresholds) return;
    let cancelled = false;
    void import('./triageMapScene').then(({ createTriageMapScene }) => {
      if (cancelled) return;
      sceneRef.current = createTriageMapScene({
        canvas,
        labelLayer,
        colors: readColors(),
        labels: labelsFor(thresholds),
        target: { low: thresholds.rangeLowMgDl, high: thresholds.rangeHighMgDl },
        reducedMotion,
        onHover: setHover,
        onSelect: (id) => {
          onSelectRef.current(id);
        },
      });
      sceneRef.current?.setPoints(points);
      sceneRef.current?.setSelected(selectedIdRef.current);
    });
    return () => {
      cancelled = true;
      sceneRef.current?.dispose();
      sceneRef.current = null;
    };
    // The scene is rebuilt only when the profile or the motion preference changes.
    // eslint-disable-next-line react-hooks/exhaustive-deps -- points and selection update the scene in place below
  }, [supported, thresholds, reducedMotion]);

  useEffect(() => {
    selectedIdRef.current = selectedId;
    sceneRef.current?.setSelected(selectedId);
  }, [selectedId]);

  useEffect(() => {
    sceneRef.current?.setPoints(points);
  }, [points]);

  const onKeyDown = (event: KeyboardEvent<HTMLCanvasElement>) => {
    const moves: Record<string, [number, number]> = {
      ArrowLeft: [KEY_STEP, 0],
      ArrowRight: [-KEY_STEP, 0],
      ArrowUp: [0, KEY_STEP],
      ArrowDown: [0, -KEY_STEP],
    };
    const move = moves[event.key];
    if (!move) return;
    event.preventDefault();
    sceneRef.current?.rotate(move[0], move[1]);
  };

  if (!supported) {
    return <p className="triage-map__unavailable">{es.doctor.triage.map.unavailable}</p>;
  }

  const hovered = hover ? rows.find((row) => row.patientId === hover.id) : undefined;
  return (
    <div className="triage-map">
      <div className="triage-map__stage">
        <canvas
          ref={canvasRef}
          className="triage-map__canvas"
          role="img"
          tabIndex={0}
          aria-label={format(es.doctor.triage.map.label, { count: rows.length })}
          onKeyDown={onKeyDown}
        />
        <div ref={labelsRef} className="triage-map__labels" aria-hidden="true" />
        {hover && hovered ? (
          <div
            className="triage-map__tooltip"
            aria-hidden="true"
            style={{ left: hover.x + TOOLTIP_OFFSET, top: hover.y + TOOLTIP_OFFSET }}
          >
            <strong>{hovered.fullName}</strong>
            <span className="measure">
              {hovered.lastReading && hovered.tirPct !== null
                ? format(es.doctor.triage.map.tooltipValue, {
                    value: hovered.lastReading.valueMgDl,
                    tir: Math.round(hovered.tirPct),
                  })
                : es.doctor.triage.map.tooltipNoData}
            </span>
            <span>{es.risk[hovered.riskTier]}</span>
          </div>
        ) : null}
        <Button
          variant="secondary"
          className="triage-map__reset"
          icon={<RotateCcw size="1em" aria-hidden="true" />}
          onClick={() => sceneRef.current?.resetView()}
        >
          {es.doctor.triage.map.reset}
        </Button>
      </div>
      <div className="triage-map__legend">
        <span className="triage-map__legend-title">{es.doctor.triage.map.legend}</span>
        <ul>
          {RANGE_STATES.map((state) => (
            <li key={state}>
              <span className="triage-map__swatch" style={{ background: `var(${RANGE_TOKENS[state]})` }} aria-hidden="true" />
              {es.glucose.ranges[state]}
            </li>
          ))}
          <li>
            <span className="triage-map__swatch triage-map__swatch--empty" aria-hidden="true" />
            {es.doctor.triage.map.noData}
          </li>
        </ul>
        <p>{es.doctor.triage.map.hint} {es.doctor.triage.map.alertsHint}</p>
      </div>
    </div>
  );
}
