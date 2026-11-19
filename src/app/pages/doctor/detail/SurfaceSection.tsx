import { lazy, Suspense, useCallback, useState } from 'react';
import { classifyGlucose, rangeBounds, type GlucoseThresholds } from '@/core/glucose/thresholds';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Button } from '@/ui/Button';
import { EmptyState, LoadingState } from '@/ui/States';
import { HOURS_PER_DAY } from './constants';
import { formatDayKey } from './format';
import type { SurfaceGrid } from './model/surface';
import './SurfaceSection.css';

/** The 3D view loads only when this section mounts; three.js stays out of the first paint. */
const SurfaceView = lazy(() => import('./surface/SurfaceView').then((module) => ({ default: module.SurfaceView })));

export interface SurfaceSectionProps {
  readonly grid: SurfaceGrid | null;
  readonly thresholds: GlucoseThresholds;
  readonly domain: { readonly min: number; readonly max: number };
  readonly loading: boolean;
}

interface Cell {
  readonly day: number;
  readonly hour: number;
}

const MAX_HOUR = HOURS_PER_DAY - 1;

/**
 * Glucose surface by day and hour, with the same information as text: a readout of the selected
 * cell, two range controls for day and hour, and a table with the minimum and maximum of each hour
 * of each day. The table is always present, so the 3D view is never the only way in. If WebGL is
 * unavailable, the section says so and keeps the table and the controls.
 *
 * Pattern: none (composition of the lazy 3D view and the textual alternative).
 */
export function SurfaceSection({ grid, thresholds, domain, loading }: SurfaceSectionProps) {
  const [unavailable, setUnavailable] = useState(false);
  const [cell, setCell] = useState<Cell | null>(null);
  const [resetToken, setResetToken] = useState(0);
  const onHover = useCallback((next: Cell | null) => {
    setCell(next);
  }, []);
  const onUnavailable = useCallback(() => {
    setUnavailable(true);
  }, []);

  const header = (
    <header className="panel__header">
      <h2 id="surface-title">{es.detail.surface.title}</h2>
    </header>
  );

  if (loading) {
    return (
      <section className="panel surface-section" aria-labelledby="surface-title">
        {header}
        <div className="panel__body">
          <LoadingState label={es.detail.surface.loading} />
        </div>
      </section>
    );
  }

  if (!grid) {
    return (
      <section className="panel surface-section" aria-labelledby="surface-title">
        {header}
        <div className="panel__body">
          <EmptyState title={es.detail.surface.empty} />
        </div>
      </section>
    );
  }

  const dayCount = grid.dayKeys.length;
  const selectedDay = cell?.day ?? 0;
  const selectedHour = cell?.hour ?? 0;
  const dayLabel = (day: number) => formatDayKey(grid.dayKeys[day] ?? '');
  const hourLabel = (hour: number) => format(es.detail.agp.hourTick, { hour });

  const summary = cell ? (grid.cells[cell.day]?.[cell.hour] ?? null) : null;
  const readout = !cell
    ? es.detail.surface.readoutNone
    : summary
      ? format(es.detail.surface.readout, {
          day: dayLabel(cell.day),
          hour: hourLabel(cell.hour),
          value: Math.round(summary.mean),
          state: es.glucose.ranges[classifyGlucose(summary.mean, thresholds)],
        })
      : es.detail.surface.readoutNone;

  return (
    <section className="panel surface-section" aria-labelledby="surface-title">
      <header className="panel__header">
        <h2 id="surface-title">{es.detail.surface.title}</h2>
        <Button
          variant="secondary"
          size="sm"
          onClick={() => {
            setResetToken((value) => value + 1);
          }}
        >
          {es.detail.surface.reset}
        </Button>
      </header>
      <div className="panel__body surface-section__body">
        <p className="surface-section__description">{es.detail.surface.description}</p>
        <ul className="surface-legend" aria-label={es.detail.surface.legend}>
          {rangeBounds(thresholds).map((bound) => (
            <li key={bound.state} className="surface-legend__item" data-state={bound.state}>
              <span className="surface-legend__swatch" aria-hidden="true" />
              <span>{es.glucose.ranges[bound.state]}</span>
              <span className="surface-legend__limits">
                {format(es.glucose.rangeLimits[bound.state], {
                  min: bound.minMgDl ?? 0,
                  max: bound.maxMgDl ?? 0,
                })}
              </span>
            </li>
          ))}
        </ul>
        {unavailable ? (
          <p className="surface-section__fallback">{es.detail.surface.fallback}</p>
        ) : (
          <div className="surface-section__stage">
            <Suspense fallback={<LoadingState label={es.detail.surface.loading} />}>
              <SurfaceView
                grid={grid}
                thresholds={thresholds}
                domain={domain}
                cursor={cell}
                resetToken={resetToken}
                onHover={onHover}
                onUnavailable={onUnavailable}
                label={format(es.detail.surface.canvasLabel, { days: dayCount })}
              />
            </Suspense>
            <p className="surface-section__hint">{es.detail.surface.rotateHint}</p>
          </div>
        )}
        <div className="surface-section__controls">
          <label className="surface-section__control">
            <span>{es.detail.surface.dayControl}</span>
            <input
              type="range"
              min={0}
              max={Math.max(0, dayCount - 1)}
              step={1}
              value={selectedDay}
              aria-valuetext={dayLabel(selectedDay)}
              onChange={(event) => {
                setCell({ day: Number(event.target.value), hour: selectedHour });
              }}
            />
          </label>
          <label className="surface-section__control">
            <span>{es.detail.surface.hourControl}</span>
            <input
              type="range"
              min={0}
              max={MAX_HOUR}
              step={1}
              value={selectedHour}
              aria-valuetext={hourLabel(selectedHour)}
              onChange={(event) => {
                setCell({ day: selectedDay, hour: Number(event.target.value) });
              }}
            />
          </label>
        </div>
        <p className="surface-section__readout">{readout}</p>
        <details className="surface-section__table">
          <summary>{es.detail.surface.tableToggle}</summary>
          <div className="surface-section__scroll" role="region" tabIndex={0} aria-label={es.detail.surface.tableScroll}>
            <table>
              <caption>{es.detail.surface.tableCaption}</caption>
              <thead>
                <tr>
                  <th scope="col">{es.detail.surface.tableHour}</th>
                  {grid.dayKeys.map((dayKey) => (
                    <th key={dayKey} scope="col">
                      {formatDayKey(dayKey)}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {Array.from({ length: HOURS_PER_DAY }, (_, hour) => (
                  <tr key={hour}>
                    <th scope="row">{hourLabel(hour)}</th>
                    {grid.dayKeys.map((dayKey, day) => {
                      const cellSummary = grid.cells[day]?.[hour] ?? null;
                      return (
                        <td key={dayKey}>
                          {cellSummary
                            ? format(es.detail.surface.tableRange, {
                                min: Math.round(cellSummary.min),
                                max: Math.round(cellSummary.max),
                              })
                            : es.detail.noData}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </div>
    </section>
  );
}
