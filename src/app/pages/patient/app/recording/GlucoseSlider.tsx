import { useMemo } from 'react';
import { rulerPosition, rulerValue } from '@/core/charts/GlucoseRulerStrategy';
import { classifyGlucose, type GlucoseThresholds } from '@/core/glucose/thresholds';
import { es } from '@/i18n/es';
import { format } from '@/i18n/format';
import { Slider } from '@/ui/Slider';

/** Half a step of the ruler per key press: fine near the narrow low bands. */
const STEP = 0.5;
const PERCENT = 100;
/** Where the thumb rests before any value: the middle of the target band. */
const RESTING_POSITION = 50;

/**
 * A slider over the patient's own range bands that writes the value into the field above. The field
 * stays the exact entry; the slider is the quick one, and its bands say where the value falls before
 * it is saved. Each band takes a fifth of the track, so the narrow low bands are as easy to hit as
 * the wide high ones (Fitts's law).
 */
export function GlucoseSlider({
  thresholds,
  valueText,
  onPick,
}: {
  readonly thresholds: GlucoseThresholds;
  readonly valueText: string;
  readonly onPick: (valueMgDl: number) => void;
}) {
  const typed = Number.parseInt(valueText, 10);
  const position = Number.isFinite(typed) ? rulerPosition(typed, thresholds) : RESTING_POSITION;
  const track = useMemo(
    () =>
      `linear-gradient(to right, ${[
        'var(--color-range-very-low) 0 20%',
        'var(--color-range-low) 20% 40%',
        'var(--color-range-in-range) 40% 60%',
        'var(--color-range-high) 60% 80%',
        'var(--color-range-very-high) 80% 100%',
      ].join(', ')})`,
    [],
  );
  return (
    <Slider
      className="glucose-slider"
      label={es.patient.record.value.slider}
      size="lg"
      value={Math.round(position / STEP) * STEP}
      min={0}
      max={PERCENT}
      step={STEP}
      track={track}
      valueText={(at) => {
        const value = rulerValue(at, thresholds);
        return format(es.patient.record.value.sliderValue, {
          value,
          state: es.glucose.ranges[classifyGlucose(value, thresholds)].toLowerCase(),
        });
      }}
      onChange={(at) => {
        onPick(rulerValue(at, thresholds));
      }}
    />
  );
}
