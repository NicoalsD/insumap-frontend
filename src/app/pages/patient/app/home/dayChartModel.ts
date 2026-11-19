import { classifyGlucose, type GlucoseThresholds, type RangeState } from '@/core/glucose/thresholds';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import type { GlucoseReadingDto } from '@/services/dto/clinical';
import { clockTime, dayKey, hourOfDay } from '../patientFormat';

const HOURS_IN_DAY = 24;
const PLOT_WIDTH = 640;
const PLOT_HEIGHT = 240;
const PAD_MG_DL = 10;
const HOUR_TICK_EVERY = 6;
const HOUR_TICKS: readonly number[] = Array.from(
  { length: HOURS_IN_DAY / HOUR_TICK_EVERY + 1 },
  (_, index) => index * HOUR_TICK_EVERY,
);

export interface DayPoint {
  readonly id: string;
  readonly valueMgDl: number;
  readonly state: RangeState;
  readonly time: string;
  /** 0 to 1 across the day. */
  readonly x: number;
  /** 0 (bottom) to 1 (top) across the glucose domain. */
  readonly y: number;
}

export interface DayChartModel {
  readonly width: number;
  readonly height: number;
  readonly points: readonly DayPoint[];
  readonly band: { readonly top: number; readonly bottom: number };
  readonly hourTicks: readonly number[];
  readonly summary: string;
  readonly empty: boolean;
}

/**
 * Geometry and text of the day chart: today's readings in the clinic's time zone, over the target
 * band of the patient's profile. Pure, so the layout and the screen-reader summary are tested.
 *
 * Pattern: P19 Strategy (the chart is one strategy; the SVG component paints the model).
 */
export function buildDayChart(
  readings: readonly GlucoseReadingDto[],
  thresholds: GlucoseThresholds,
  now: Date,
  timeZone: string,
): DayChartModel {
  const today = dayKey(now, timeZone);
  const todays = readings
    .filter((reading) => dayKey(new Date(reading.measured_at), timeZone) === today)
    .sort((a, b) => Date.parse(a.measured_at) - Date.parse(b.measured_at));

  const values = todays.map((reading) => reading.value_mg_dl);
  const low = Math.min(thresholds.veryLowMgDl, ...values) - PAD_MG_DL;
  const high = Math.max(thresholds.veryHighMgDl, ...values) + PAD_MG_DL;
  const span = Math.max(high - low, 1);
  const yOf = (value: number) => (high - value) / span;

  const points: DayPoint[] = todays.map((reading) => {
    const date = new Date(reading.measured_at);
    const state = classifyGlucose(reading.value_mg_dl, thresholds);
    return {
      id: reading.id,
      valueMgDl: reading.value_mg_dl,
      state,
      time: clockTime(date, timeZone),
      x: hourOfDay(date, timeZone) / HOURS_IN_DAY,
      y: yOf(reading.value_mg_dl),
    };
  });

  const inRange = points.filter((point) => point.state === 'IN_RANGE').length;
  const last = points[points.length - 1];
  const summary =
    points.length === 0
      ? es.patient.dayChart.summaryNone
      : format(es.patient.dayChart.summary, {
          count: points.length,
          inRange,
          last: last?.valueMgDl ?? 0,
        });

  return {
    width: PLOT_WIDTH,
    height: PLOT_HEIGHT,
    points,
    band: { top: yOf(thresholds.rangeHighMgDl), bottom: yOf(thresholds.rangeLowMgDl) },
    hourTicks: HOUR_TICKS,
    summary,
    empty: points.length === 0,
  };
}
